/**
 * Examen geldadvies (docs/GELDADVIES_PLAN.md): speelt bewaarde chatbeurten na met de context die ArnoBot toen kreeg
 * (arnobot_rds_logs.bron_context) en de huidige code (systeemprompt, rekentools, werkruisfilter), in varianten.
 * Gevallen en sleutels bevatten klantgegevens en staan buiten de repo; dit script bevat er geen.
 * Gebruik: npx tsx scripts/examen-geldadvies.ts <gevallen.json> <uitvoer.json> <runs> [varianten,komma] [gevalcodes,komma]
 * gevallen.json: [{ "code": "A4", "sessie": "<begin session_id>", "beurt": 4 }]
 * Schrijft niets in de database (VITEST=1 zet de kostenmeting uit). Draait op de sleutel uit .env.local.
 */
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { execSync } from 'child_process'
import Anthropic from '@anthropic-ai/sdk'

for (const l of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = l.match(/^([^#=]+)=(.*)$/)
  if (m && !process.env[m[1].trim()]) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '')
}
process.env.VITEST = '1'

// Prijs per miljoen tokens (invoer, uitvoer), cache schrijven 1,25x en cache lezen 0,1x invoer (ruime schatting).
const PRIJS: Record<string, [number, number]> = {
  'claude-sonnet-4-6': [3, 15], 'claude-sonnet-5-5': [2, 10], 'claude-opus-5-5': [4, 20],
}
const MAX_RONDES = 6

type Variant = {
  model: string
  denken?: boolean
  weg?: ('geheugen' | 'kennisbank' | 'historie' | 'persona' | 'regels')[]
}
// Verdachte regels uit lib/systemPrompt.ts (hypotheses in docs/GELDADVIES_PLAN.md). Elk stuk wordt letterlijk uit de prompt geknipt.
const VERDACHT = [
  /Vraag alleen mee als het antwoord zonder die informatie[\s\S]*?Een vraag aan het eind is de uitzondering, niet de gewoonte\./,
  /Je hebt altijd een mening\. /,
]
export const VARIANTEN: Record<string, Variant> = {
  huidig: { model: 'claude-sonnet-4-6' },
  zonderGeheugen: { model: 'claude-sonnet-4-6', weg: ['geheugen'] },
  zonderKennisbank: { model: 'claude-sonnet-4-6', weg: ['kennisbank'] },
  zonderHistorie: { model: 'claude-sonnet-4-6', weg: ['historie'] },
  zonderRegels: { model: 'claude-sonnet-4-6', weg: ['regels'] },
  kaal: { model: 'claude-sonnet-4-6', weg: ['persona', 'geheugen', 'kennisbank'] },
  denkstap: { model: 'claude-sonnet-4-6', denken: true },
  sonnet55: { model: 'claude-sonnet-5-5', denken: true },
  opus55: { model: 'claude-opus-5-5', denken: true },
}

type Geval = { code: string; sessie: string; beurt: number }
type Rij = { session_id: string; question: string; answer: string; bron_context: string | null; verbruik: { lengte?: string } | null; created_at: string; user_id: string }
type Uitslag = { code: string; variant: string; run: number; antwoord: string; verborgen: string[]; tools: string[]; stop: string; seconden: number; eersteTekstSeconden: number | null; kostenUsd: number; commit: string }

async function main() {
  const [gevallenPad, uitPad, runsArg, variantArg, codeArg] = process.argv.slice(2)
  const runs = Number(runsArg) || 5
  const varianten = (variantArg ?? 'huidig').split(',')
  const alleGevallen = JSON.parse(readFileSync(gevallenPad, 'utf8')) as Geval[]
  const gevallen = codeArg ? alleGevallen.filter(g => codeArg.split(',').includes(g.code)) : alleGevallen
  const commit = execSync('git rev-parse --short HEAD').toString().trim()

  const { createClient } = await import('@supabase/supabase-js')
  const { buildRdsSystemPrompt } = await import('../lib/systemPrompt')
  const { CHAT_REKENTOOLS, voerToolUit } = await import('../lib/rekenTool')
  const { maakTabelStaat } = await import('../lib/tabelTool')
  const { streamRonde, haalWerkruisWeg } = await import('../lib/chatStreamRonde')
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 5 })

  const logs: Rij[] = []
  for (let van = 0; ; van += 1000) {
    const { data, error } = await db.from('arnobot_rds_logs').select('session_id,question,answer,bron_context,verbruik,created_at,user_id').order('created_at').order('id').range(van, van + 999)
    if (error) throw new Error(error.message)
    logs.push(...(data as Rij[]))
    if (data.length < 1000) break
  }

  async function bereid(g: Geval, v: Variant) {
    const sessie = logs.filter(r => r.session_id?.startsWith(g.sessie))
    const rij = sessie[g.beurt - 1]
    if (!rij?.bron_context) throw new Error(`${g.code}: geen bewaarde context`)
    // bron_context = kennisbankfragmenten, geheugen, profiel, coaching, met dezelfde scheiding (zie app/api/chat/route.ts).
    const delen = rij.bron_context.split('\n\n---\n\n')
    const iGeheugen = delen.findIndex(d => d.trimStart().startsWith('WAT DEZE'))
    const iProfiel = delen.findIndex(d => d.trimStart().startsWith('VANDAAG IS'))
    const start = iGeheugen >= 0 ? iGeheugen : iProfiel
    if (iProfiel < 0 || start < 0) throw new Error(`${g.code}: context niet te splitsen`)
    const kennis = delen.slice(0, start).join('\n\n---\n\n')
    const geheugen = iGeheugen >= 0 ? delen.slice(iGeheugen, iProfiel).join('\n\n---\n\n') : ''
    const profiel = delen[iProfiel]
    const coaching = delen.slice(iProfiel + 1).join('\n\n---\n\n')
    const weg = new Set(v.weg ?? [])
    const historie: Anthropic.MessageParam[] = weg.has('historie') ? [] : sessie.slice(0, g.beurt - 1)
      .flatMap(r => [{ role: 'user' as const, content: r.question }, { role: 'assistant' as const, content: r.answer }])
    const vraag = weg.has('historie')
      ? sessie.slice(0, g.beurt).map(r => r.question).join('\n\n') // zonder eerdere antwoorden, wel alle feiten van de gebruiker
      : rij.question
    const persoonlijk = profiel + (weg.has('geheugen') ? '' : geheugen + coaching)
    const fragmenten = weg.has('kennisbank') ? '' : kennis
    const eerdereSessies = new Set(logs.filter(r => r.user_id === rij.user_id && r.created_at < sessie[0].created_at).map(r => r.session_id)).size
    const lengte = (rij.verbruik?.lengte ?? 'normaal') as 'kort' | 'normaal' | 'uitgebreid'
    let system: Anthropic.TextBlockParam[] = weg.has('persona')
      ? [{ type: 'text', text: 'Je bent een ervaren B2B-salescoach. Antwoord in het Nederlands, kort en met een duidelijk oordeel als je genoeg weet.' }]
      : buildRdsSystemPrompt(persoonlijk, fragmenten, historie.length, lengte, eerdereSessies)
    if (weg.has('regels')) {
      let geknipt = 0
      system = system.map(b => ({ ...b, text: VERDACHT.reduce((t, re) => { if (re.test(t)) geknipt++; return t.replace(re, '') }, b.text) }))
      if (geknipt !== VERDACHT.length) throw new Error(`verdachte regels niet gevonden (${geknipt} van ${VERDACHT.length}), lib/systemPrompt.ts is gewijzigd`)
    }
    const maxTokens = lengte === 'kort' ? 750 : lengte === 'uitgebreid' ? 2500 : 1450
    const metTools = /\d/.test(vraag + ' ' + historie.slice(-6).map(h => h.content).join(' '))
    const tabel = /[|\t]/.test(vraag)
    const tools = metTools ? CHAT_REKENTOOLS.filter(t => tabel || (t.name !== 'schrijf_tabel_over' && t.name !== 'tabel_vraag')) : undefined
    return { system, historie, vraag, maxTokens, tools }
  }

  async function speel(g: Geval, naam: string, run: number): Promise<Uitslag> {
    const v = VARIANTEN[naam]
    const p = await bereid(g, v)
    const berichten: Anthropic.MessageParam[] = [...p.historie, { role: 'user', content: p.vraag }]
    const t0 = Date.now()
    let eersteTekst: number | null = null
    let antwoord = ''
    let kosten = 0
    const verborgen: string[] = []
    const gebruikt: string[] = []
    const tabelStaat = maakTabelStaat()
    const decoder = new TextDecoder()
    let stop = ''
    for (let ronde = 0; ronde <= MAX_RONDES; ronde++) {
      // Denktokens tellen mee in max_tokens: met denkstap komt er ruimte bovenop de lengte van het antwoord.
      const extra: Record<string, unknown> = v.denken ? { thinking: { type: 'adaptive' }, output_config: { effort: 'high' } } : {}
      const stream = client.messages.stream({
        model: v.model, max_tokens: v.denken ? p.maxTokens + 12000 : p.maxTokens, system: p.system, messages: berichten,
        ...(p.tools ? { tools: p.tools } : {}), ...extra,
      } as Anthropic.MessageStreamParams)
      let zichtbaar = ''
      const controller = {
        enqueue: (b: Uint8Array) => { if (eersteTekst === null) eersteTekst = (Date.now() - t0) / 1000; zichtbaar += decoder.decode(b) },
      } as unknown as ReadableStreamDefaultController<Uint8Array>
      const uit = await streamRonde(stream, controller, new TextEncoder(), Boolean(p.tools))
      const eind = await stream.finalMessage()
      const u = eind.usage
      const [pi, pu] = PRIJS[v.model]
      kosten += (u.input_tokens * pi + (u.cache_creation_input_tokens ?? 0) * pi * 1.25 + (u.cache_read_input_tokens ?? 0) * pi * 0.1 + u.output_tokens * pu) / 1e6
      if (uit.weggegooid) verborgen.push(uit.weggegooid)
      if (zichtbaar) antwoord += (antwoord ? '\n\n' : '') + zichtbaar
      stop = eind.stop_reason ?? ''
      if (stop !== 'tool_use') break
      const aanroepen = eind.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
      berichten.push({ role: 'assistant', content: eind.content }, {
        role: 'user',
        content: aanroepen.map(a => {
          const r = voerToolUit(a.name, a.input, tabelStaat)
          gebruikt.push(`${a.name} ${JSON.stringify(a.input).slice(0, 300)}`)
          return { type: 'tool_result' as const, tool_use_id: a.id, content: r.content, is_error: r.isError }
        }),
      })
    }
    return { code: g.code, variant: naam, run, antwoord: haalWerkruisWeg(antwoord), verborgen, tools: gebruikt, stop, seconden: (Date.now() - t0) / 1000, eersteTekstSeconden: eersteTekst, kostenUsd: kosten, commit }
  }

  const uitslagen: Uitslag[] = existsSync(uitPad) ? JSON.parse(readFileSync(uitPad, 'utf8')) : []
  const klaar = new Set(uitslagen.map(u => `${u.code}|${u.variant}|${u.run}`))
  const taken: (() => Promise<void>)[] = []
  for (const naam of varianten) {
    if (!VARIANTEN[naam]) throw new Error(`onbekende variant ${naam}`)
    for (const g of gevallen) for (let run = 1; run <= runs; run++) {
      if (klaar.has(`${g.code}|${naam}|${run}`)) continue
      taken.push(async () => {
        try {
          uitslagen.push(await speel(g, naam, run))
          writeFileSync(uitPad, JSON.stringify(uitslagen, null, 1))
        } catch (e) {
          console.log(`${g.code} ${naam} run ${run} mislukt: ${(e as Error).message.slice(0, 300)}`)
        }
      })
    }
  }
  console.log(`${taken.length} antwoorden te maken, code ${commit}`)
  let volgende = 0
  await Promise.all(Array.from({ length: 3 }, async () => { while (volgende < taken.length) await taken[volgende++]() }))
  console.log(`klaar: ${uitslagen.length} antwoorden, geschatte kosten totaal in dit bestand $${uitslagen.reduce((s, u) => s + u.kostenUsd, 0).toFixed(2)}`)
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
