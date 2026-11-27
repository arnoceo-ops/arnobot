/**
 * Gedragstest hervat gesprek (docs/ANTWOORDCONTROLE_ONTWERP.md, stap 1): speelt een beurt na zoals de chat zich met de reparatie gedraagt.
 * De bewaarde context van de eerste beurt na de stilte krijgt de nieuwe hervattekst (lib/hervatGesprek.ts) in plaats van de oude, en de
 * geschiedenis bevat alleen beurten van na de stilte. Gevallen bevatten klantgegevens en staan buiten de repo.
 * Gebruik: npx tsx scripts/test-hervat.ts <gevallen.json> <uitvoer.json> <runs> <pad naar .env.local>
 * gevallen.json: [{ "code": "H1", "sessie": "<begin session_id>", "eersteNaStilte": 5, "eerdereNaStilte": 0, "vraag": "optioneel" }]
 * Zonder "vraag" gaat de bewaarde vraag van die beurt mee. Schrijft niets in de database. Harde grens: $2.
 */
import { readFileSync, writeFileSync, existsSync } from 'fs'
import Anthropic from '@anthropic-ai/sdk'

const MAX_USD = 2
const MODEL = 'claude-sonnet-4-6'
const [gevallenPad, uitPad, runsArg, envPad] = process.argv.slice(2)

for (const l of readFileSync(envPad, 'utf8').split(/\r?\n/)) {
  const m = l.match(/^([^#=]+)=(.*)$/)
  if (m && !process.env[m[1].trim()]) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '')
}
process.env.VITEST = '1' // zet de kostenmeting uit, zodat niets in de database komt

type Geval = { code: string; sessie: string; eersteNaStilte: number; eerdereNaStilte: number; vraag?: string }
type Rij = { session_id: string; question: string; answer: string; bron_context: string | null; verbruik: { lengte?: string } | null; created_at: string; user_id: string }
type Uitslag = { code: string; run: number; vraag: string; historie: number; antwoord: string; kostenUsd: number; stop: string }

async function main() {
  const { createClient } = await import('@supabase/supabase-js')
  const { buildRdsSystemPrompt } = await import('../lib/systemPrompt')
  const { CHAT_REKENTOOLS, voerToolUit } = await import('../lib/rekenTool')
  const { maakTabelStaat } = await import('../lib/tabelTool')
  const { streamRonde, haalWerkruisWeg } = await import('../lib/chatStreamRonde')
  const { bouwHervatTekst } = await import('../lib/hervatGesprek')
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 5 })

  const logs: Rij[] = []
  for (let van = 0; ; van += 1000) {
    const { data, error } = await db.from('arnobot_rds_logs').select('session_id,question,answer,bron_context,verbruik,created_at,user_id').order('created_at').order('id').range(van, van + 999)
    if (error) throw new Error(error.message)
    logs.push(...(data as Rij[]))
    if (data.length < 1000) break
  }

  const gevallen = JSON.parse(readFileSync(gevallenPad, 'utf8')) as Geval[]
  const uitslagen: Uitslag[] = existsSync(uitPad) ? JSON.parse(readFileSync(uitPad, 'utf8')) : []
  let uitgegeven = uitslagen.reduce((s, u) => s + u.kostenUsd, 0)
  let duurste = 0.2

  for (let run = 1; run <= Number(runsArg); run++) for (const g of gevallen) {
    if (uitslagen.some(u => u.code === g.code && u.run === run)) continue
    if (uitgegeven + duurste > MAX_USD) { console.log(`grens bereikt, overgeslagen: ${g.code} run ${run}`); continue }
    const sessie = logs.filter(r => r.session_id?.startsWith(g.sessie))
    const rij = sessie[g.eersteNaStilte - 1]
    if (!rij?.bron_context) throw new Error(`${g.code}: geen bewaarde context`)

    const oudBlok = /EERDER DEEL VAN DIT GESPREK \(laatste bericht (.*?)\):\n[^\n]*\n([^\n]*)/
    const gevonden = rij.bron_context.match(oudBlok)
    if (!gevonden) throw new Error(`${g.code}: oud hervatblok niet gevonden`)
    const onderwerp = gevonden[2].match(/^Onderwerp van toen: (.*?)\. Wat er toen/)?.[1] ?? ''
    const context = rij.bron_context.replace(oudBlok, () => bouwHervatTekst(gevonden[1], onderwerp).trim())

    const delen = context.split('\n\n---\n\n')
    const iGeheugen = delen.findIndex(d => d.trimStart().startsWith('WAT DEZE'))
    const iProfiel = delen.findIndex(d => d.trimStart().startsWith('VANDAAG IS'))
    const start = iGeheugen >= 0 ? iGeheugen : iProfiel
    if (iProfiel < 0 || start < 0) throw new Error(`${g.code}: context niet te splitsen`)
    const kennis = delen.slice(0, start).join('\n\n---\n\n')
    const persoonlijk = delen[iProfiel] + (iGeheugen >= 0 ? delen.slice(iGeheugen, iProfiel).join('\n\n---\n\n') : '') + delen.slice(iProfiel + 1).join('\n\n---\n\n')
    if (!persoonlijk.includes('jij ziet die berichten niet')) throw new Error(`${g.code}: nieuwe hervattekst ontbreekt`)

    const historie: Anthropic.MessageParam[] = sessie.slice(g.eersteNaStilte - 1, g.eersteNaStilte - 1 + g.eerdereNaStilte)
      .flatMap(r => [{ role: 'user' as const, content: r.question }, { role: 'assistant' as const, content: r.answer }])
    const vraag = g.vraag ?? rij.question
    const eerdereSessies = new Set(logs.filter(r => r.user_id === rij.user_id && r.created_at < sessie[0].created_at).map(r => r.session_id)).size
    const lengte = (rij.verbruik?.lengte ?? 'normaal') as 'kort' | 'normaal' | 'uitgebreid'
    const system = buildRdsSystemPrompt(persoonlijk, kennis, historie.length, lengte, eerdereSessies)
    const maxTokens = lengte === 'kort' ? 750 : lengte === 'uitgebreid' ? 2500 : 1450
    const metTools = /\d/.test(vraag + ' ' + historie.slice(-6).map(h => h.content).join(' '))
    const tools = metTools ? CHAT_REKENTOOLS.filter(t => /[|\t]/.test(vraag) || (t.name !== 'schrijf_tabel_over' && t.name !== 'tabel_vraag')) : undefined

    const berichten: Anthropic.MessageParam[] = [...historie, { role: 'user', content: vraag }]
    const tabelStaat = maakTabelStaat()
    const decoder = new TextDecoder()
    let antwoord = ''
    let kosten = 0
    let stop = ''
    for (let ronde = 0; ronde <= 6; ronde++) {
      const stream = client.messages.stream({ model: MODEL, max_tokens: maxTokens, system, messages: berichten, ...(tools ? { tools } : {}) })
      let zichtbaar = ''
      const controller = { enqueue: (b: Uint8Array) => { zichtbaar += decoder.decode(b) } } as unknown as ReadableStreamDefaultController<Uint8Array>
      await streamRonde(stream, controller, new TextEncoder(), Boolean(tools))
      const eind = await stream.finalMessage()
      const u = eind.usage
      // Prijs Sonnet 4.6 per miljoen tokens: invoer 3, uitvoer 15, cache schrijven 1,25x en lezen 0,1x invoer.
      kosten += (u.input_tokens * 3 + (u.cache_creation_input_tokens ?? 0) * 3.75 + (u.cache_read_input_tokens ?? 0) * 0.3 + u.output_tokens * 15) / 1e6
      if (zichtbaar) antwoord += (antwoord ? '\n\n' : '') + zichtbaar
      stop = eind.stop_reason ?? ''
      if (stop !== 'tool_use') break
      const aanroepen = eind.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
      berichten.push({ role: 'assistant', content: eind.content }, {
        role: 'user',
        content: aanroepen.map(a => { const r = voerToolUit(a.name, a.input, tabelStaat); return { type: 'tool_result' as const, tool_use_id: a.id, content: r.content, is_error: r.isError } }),
      })
    }
    uitgegeven += kosten
    duurste = Math.max(duurste, kosten)
    uitslagen.push({ code: g.code, run, vraag, historie: historie.length, antwoord: haalWerkruisWeg(antwoord), kostenUsd: kosten, stop })
    writeFileSync(uitPad, JSON.stringify(uitslagen, null, 1))
  }
  console.log(`klaar: ${uitslagen.length} antwoorden, geschatte kosten $${uitgegeven.toFixed(2)} (grens $${MAX_USD})`)
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
