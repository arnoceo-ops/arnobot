/**
 * Gedragstest hervat gesprek (docs/ANTWOORDCONTROLE_ONTWERP.md): speelt een beurt na zoals de chat zich met de wijziging gedraagt. De
 * geschiedenis, de datumregel en de instructie komen uit dezelfde functie als de chat (lib/hervatGesprek.ts), op de opgeslagen
 * berichten van vóór de beurt. Gevallen bevatten klantgegevens en staan buiten de repo.
 * Gebruik: npx tsx scripts/test-hervat.ts <gevallen.json> <uitvoer.json> <runs> <pad naar .env.local>
 * gevallen.json: [{ "code": "H1", "sessie": "<begin session_id>", "beurt": 5 }]  bewaarde vraag, context en tijdstip van die beurt
 *            of:  [{ "code": "O1", "sessie": "<begin session_id>", "vraag": "..." }]  nieuwe vraag vandaag na het hele gesprek, zonder
 *                 geheugen en kennisfragmenten: de geschiedenis is dan de enige bron van oude informatie.
 * Met "tot": 4 bij een nieuwe vraag ziet het model alleen de eerste 4 beurten, op het tijdstip van beurt 5.
 * Met "kaal": true bij een nieuwe vraag, ter vergelijking als doorlopend gesprek: zonder datums en zonder hervatinstructie.
 * Schrijft niets in de database. Harde grens: $2.
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

type Geval = { code: string; sessie: string; beurt?: number; vraag?: string; tot?: number; kaal?: boolean }
type Rij = { session_id: string; question: string; answer: string; bron_context: string | null; verbruik: { lengte?: string } | null; created_at: string; user_id: string }
type Uitslag = { code: string; run: number; vraag: string; vraagRegel: string; historie: number; antwoord: string; kostenUsd: number; stop: string }

async function main() {
  const { createClient } = await import('@supabase/supabase-js')
  const { buildRdsSystemPrompt } = await import('../lib/systemPrompt')
  const { CHAT_REKENTOOLS, voerToolUit } = await import('../lib/rekenTool')
  const { maakTabelStaat } = await import('../lib/tabelTool')
  const { streamRonde, haalWerkruisWeg } = await import('../lib/chatStreamRonde')
  const { bepaalHervatting, HERVAT_TEKST } = await import('../lib/hervatGesprek')
  const { bouwProfielContext } = await import('../lib/geheugenContext')
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
    if (sessie.length === 0) throw new Error(`${g.code}: gesprek niet gevonden`)
    const rij = g.beurt ? sessie[g.beurt - 1] : undefined
    const eerder = g.beurt ? sessie.slice(0, g.beurt - 1) : sessie.slice(0, g.tot ?? sessie.length)
    const volgende = g.tot ? sessie[g.tot] : undefined
    const nu = rij || volgende ? new Date((rij ?? volgende)!.created_at).getTime() : Date.now()
    const hervatting = bepaalHervatting([...eerder].reverse(), nu)
    if (!hervatting) throw new Error(`${g.code}: geen stilte van meer dan 48 uur`)

    let kennis = ''
    let persoonlijk = bouwProfielContext(null, '', new Date(nu)) + (g.kaal ? '' : HERVAT_TEKST)
    if (g.beurt) {
      if (!rij?.bron_context) throw new Error(`${g.code}: geen bewaarde context`)
      const oudBlok = /EERDER DEEL VAN DIT GESPREK \(laatste bericht .*?\):\n[^\n]*\n[^\n]*/
      if (!oudBlok.test(rij.bron_context)) throw new Error(`${g.code}: oud hervatblok niet gevonden`)
      const delen = rij.bron_context.replace(oudBlok, () => HERVAT_TEKST.trim()).split('\n\n---\n\n')
      const iGeheugen = delen.findIndex(d => d.trimStart().startsWith('WAT DEZE'))
      const iProfiel = delen.findIndex(d => d.trimStart().startsWith('VANDAAG IS'))
      const start = iGeheugen >= 0 ? iGeheugen : iProfiel
      if (iProfiel < 0 || start < 0) throw new Error(`${g.code}: context niet te splitsen`)
      kennis = delen.slice(0, start).join('\n\n---\n\n')
      persoonlijk = delen[iProfiel] + (iGeheugen >= 0 ? delen.slice(iGeheugen, iProfiel).join('\n\n---\n\n') : '') + delen.slice(iProfiel + 1).join('\n\n---\n\n')
    }
    if (persoonlijk.includes('Je ziet het eerdere gesprek') === Boolean(g.kaal)) throw new Error(`${g.code}: hervatinstructie klopt niet met het geval`)

    const historie = (g.kaal ? hervatting.kaal : hervatting.gedateerd) as Anthropic.MessageParam[]
    const vraagRegel = g.kaal ? '' : hervatting.vraagRegel
    const vraag = g.vraag ?? rij!.question
    const eerste = sessie[0]
    const eerdereSessies = new Set(logs.filter(r => r.user_id === eerste.user_id && r.created_at < eerste.created_at).map(r => r.session_id)).size
    const lengte = (rij?.verbruik?.lengte ?? 'normaal') as 'kort' | 'normaal' | 'uitgebreid'
    const system = buildRdsSystemPrompt(persoonlijk, kennis, historie.length, lengte, eerdereSessies)
    const maxTokens = lengte === 'kort' ? 750 : lengte === 'uitgebreid' ? 2500 : 1450
    const metTools = /\d/.test(vraag + ' ' + hervatting.kaal.slice(-6).map(h => h.content).join(' '))
    const tools = metTools ? CHAT_REKENTOOLS.filter(t => /[|\t]/.test(vraag) || (t.name !== 'schrijf_tabel_over' && t.name !== 'tabel_vraag')) : undefined

    const berichten: Anthropic.MessageParam[] = [...historie, { role: 'user', content: vraagRegel ? `${vraagRegel}\n${vraag}` : vraag }]
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
    uitslagen.push({ code: g.code, run, vraag, vraagRegel, historie: historie.length, antwoord: haalWerkruisWeg(antwoord), kostenUsd: kosten, stop })
    writeFileSync(uitPad, JSON.stringify(uitslagen, null, 1))
  }
  console.log(`klaar: ${uitslagen.length} antwoorden, geschatte kosten $${uitgegeven.toFixed(2)} (grens $${MAX_USD})`)
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
