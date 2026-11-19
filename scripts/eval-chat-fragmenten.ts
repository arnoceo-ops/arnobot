/**
 * Meting: hoeveel van de 20 kennisbankfragmenten per chatvraag is nodig voor een even goed antwoord?
 * Aanleiding: die fragmenten zijn ongeveer 12.000 tokens, zo'n 40% van wat een chatbericht kost (docs/CLAUDE_HISTORY.md, 2026-11-19).
 *
 * Per vraag (echte, zelfstandige vragen van de afgelopen 45 dagen, uit arnobot_rds_logs, nooit in de repo of in een rapport met tekst):
 *   dezelfde zoekstap als de chat (rag.getRelevantChunksMultiQuery, 20 fragmenten), drie antwoorden van Sonnet 4.6 met dezelfde
 *   systeemprompt: 20 fragmenten (huidig), de eerste 10, en 0 (ijkpunt: zonder kennisbank).
 *   Blinde, paarsgewijze beoordeling door Fable 5.1 met willekeurige volgorde: 20 tegen 10 en 20 tegen 0, met als eigen criterium of het
 *   antwoord de concrete begrippen en aanpak uit de kennisbank gebruikt (de beoordelaar krijgt daarvoor de eerste zes fragmenten ingekort).
 * Draait op de Development-workspace (.env.local). Kosten ongeveer $5 tot $6 voor 30 vragen; het script stopt zelf bij $9.
 * Uitvoeren: npx tsx scripts/eval-chat-fragmenten.ts [aantal vragen, standaard 30] [uitvoerbestand.json]
 * Weggeschreven resultaat bevat per vraag alleen een nummer, de scores en de korte redenen van de beoordelaar, geen vraagtekst.
 */
import { readFileSync, writeFileSync } from 'fs'
import Anthropic from '@anthropic-ai/sdk'

for (const l of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = l.match(/^([^#=]+)=(.*)$/)
  if (m && !process.env[m[1].trim()]) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '')
}
process.env.VITEST = '1' // de meting van lib/gebruikOpslag.ts schrijft niets weg vanuit dit script

const ANTWOORD_MODEL = 'claude-sonnet-4-6'
const JUDGE_MODEL = 'claude-fable-5-1'
const FILTER_MODEL = 'claude-haiku-4-5-20251001'
const PRIJS: Record<string, { i: number; u: number }> = { [ANTWOORD_MODEL]: { i: 3, u: 15 }, [JUDGE_MODEL]: { i: 10, u: 50 }, [FILTER_MODEL]: { i: 1, u: 5 } }
const MAX_KOSTEN_USD = 9
const PARALLEL = 3

type Usage = { input_tokens?: number | null; output_tokens?: number | null; cache_creation_input_tokens?: number | null; cache_read_input_tokens?: number | null }
let kosten = 0
function tel(model: string, u: Usage) {
  const p = PRIJS[model]
  kosten += (((u.input_tokens ?? 0) * p.i) + ((u.cache_creation_input_tokens ?? 0) * p.i * 1.25) + ((u.cache_read_input_tokens ?? 0) * p.i * 0.1) + ((u.output_tokens ?? 0) * p.u)) / 1e6
  if (kosten > MAX_KOSTEN_USD) throw new Error(`Kostenplafond van $${MAX_KOSTEN_USD} bereikt (stand $${kosten.toFixed(2)}), gestopt.`)
}

const tekstUit = (content: Anthropic.ContentBlock[]) => content.map(b => (b.type === 'text' ? b.text : '')).join('').trim()

type Vergelijking = { winnaar: 'A' | 'B' | 'gelijk'; kennisbank: 'A' | 'B' | 'gelijk'; reden: string }
type Rij = {
  nr: number
  lengte: { v20: number; v10: number; v0: number }
  tegen10: { score20: number; kennisbank20: number; reden: string } | null
  tegen0: { score20: number; kennisbank20: number; reden: string } | null
}

const JUDGE_SYSTEEM = `Je beoordeelt twee antwoorden van een AI-coach voor B2B-sales op dezelfde vraag. Je weet niet welk antwoord uit welke opzet komt. Beoordeel inhoudelijk, niet op lengte of opmaak.

Criteria, in deze volgorde van gewicht:
1. Juistheid en bruikbaarheid voor een salesprofessional: kan die hier morgen mee aan de slag?
2. Concreet en specifiek voor deze vraag, geen algemeen verhaal dat bij elke vraag past.
3. Verzint niets en blijft eerlijk over wat onzeker is.
4. Aansluiting op de kennisbank: gebruikt het antwoord de concrete begrippen, methodes en aanpak uit de meegegeven kennisbankfragmenten, in plaats van algemeen salesadvies?

Geef alleen JSON, zonder uitleg eromheen: {"winnaar":"A"|"B"|"gelijk","kennisbank":"A"|"B"|"gelijk","reden":"één zin"}.
"winnaar" is het algehele oordeel. "kennisbank" gaat alleen over criterium 4. Kies "gelijk" alleen als je echt geen verschil ziet.`

async function main() {
  const aantal = Number(process.argv[2]) || 30
  const uitvoerPad = process.argv[3] ?? 'eval-chat-fragmenten-resultaat.json'
  const { createClient } = await import('@supabase/supabase-js')
  const { getRelevantChunksMultiQuery, formatChunksForPrompt } = await import('../lib/rag')
  const { buildRdsSystemPrompt } = await import('../lib/systemPrompt')
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const { data, error } = await db.from('arnobot_rds_logs').select('question').gte('created_at', new Date(Date.now() - 45 * 86_400_000).toISOString()).order('created_at', { ascending: false }).limit(400)
  if (error) throw new Error(`vragen ophalen mislukt: ${error.message}`)
  const kandidaten = [...new Set((data ?? []).map(r => (r.question ?? '').trim()).filter(q => q.length >= 40 && q.length <= 600))].slice(0, Math.max(aantal * 6, 120))

  // Veel echte vragen verwijzen naar een bijlage of eerder gesprek ("dat hoofdstuk", "het boek"): die zijn hier niet te beoordelen omdat het
  // model de context mist. Een goedkope Haiku-controle houdt alleen zelfstandige vragen over.
  async function isZelfstandig(vraag: string): Promise<boolean> {
    try {
      const res = await anthropic.messages.create({
        model: FILTER_MODEL, max_tokens: 5,
        system: 'Je krijgt één bericht van een gebruiker aan een sales-coach. Antwoord alleen "ja" of "nee". "ja" alleen als het bericht op zichzelf een duidelijke inhoudelijke vraag of opdracht is die een coach kan beantwoorden zonder een eerder gesprek, een bijlage, een document, een boek of een link te zien. "nee" bij elke verwijzing naar iets dat niet in het bericht zelf staat (zoals "dat", "die", "dit", "daar", "het plan", "de rest" zonder dat het bericht zegt wat dat is), bij een reactie op een eerdere beurt, en bij een bericht dat geen vraag of opdracht is.',
        messages: [{ role: 'user', content: vraag }],
      })
      tel(FILTER_MODEL, res.usage)
      return tekstUit(res.content).toLowerCase().startsWith('ja')
    } catch (e) {
      console.log('filter mislukt:', (e as Error).message.slice(0, 160))
      return false
    }
  }
  const vragen: string[] = []
  let gecontroleerd = 0
  for (const q of kandidaten) {
    if (vragen.length >= aantal) break
    gecontroleerd++
    if (await isZelfstandig(q)) vragen.push(q)
  }
  const echt = vragen.length
  console.log(`${echt} zelfstandige echte vragen gevonden na controle van ${gecontroleerd} kandidaten`)

  // Er zijn te weinig echte zelfstandige vragen (de meeste echte berichten zijn reacties in een lopend gesprek). Aanvullen met nagemaakte vragen
  // in dezelfde stijl en breedte; in het resultaat staat hoeveel echt en hoeveel nagemaakt was.
  if (vragen.length < aantal) {
    const nodig = aantal - vragen.length
    const res = await anthropic.messages.create({
      model: ANTWOORD_MODEL, max_tokens: 3000,
      system: 'Je schrijft testvragen voor een AI-coach voor B2B-sales. Schrijf realistische, zelfstandige vragen zoals een salesprofessional of salesmanager ze in een chat zou typen: concreet, met genoeg context in de vraag zelf, geen verwijzing naar eerdere berichten of bijlagen. Wissel af tussen onderwerpen: acquisitie en koude benadering, bezwaren, onderhandelen en prijs, pipeline en forecast, een team coachen, tijd en focus, motivatie na tegenslag, een lastige klant, discovery en vraagstelling, afsluiten. Elke vraag 40 tot 300 tekens, in het Nederlands, één per regel, zonder nummering of aanhalingstekens.',
      messages: [{ role: 'user', content: `Schrijf ${nodig} verschillende vragen.${echt ? `\n\nVoorbeelden van de stijl (echte vragen):\n${vragen.slice(0, 3).join('\n')}` : ''}` }],
    })
    tel(ANTWOORD_MODEL, res.usage)
    const nagemaakt = tekstUit(res.content).split(/\r?\n/).map(s => s.replace(/^[-*\d.)\s]+/, '').trim()).filter(s => s.length >= 40 && s.length <= 400).slice(0, nodig)
    vragen.push(...nagemaakt)
    console.log(`${nagemaakt.length} nagemaakte vragen toegevoegd`)
  }
  console.log(`${vragen.length} vragen, antwoorden met ${ANTWOORD_MODEL}, beoordeling met ${JUDGE_MODEL}`)

  async function antwoord(vraag: string, chunks: Awaited<ReturnType<typeof getRelevantChunksMultiQuery>>): Promise<string> {
    const system = buildRdsSystemPrompt('', formatChunksForPrompt(chunks), 0, 'normaal', 0)
    const res = await anthropic.messages.create({ model: ANTWOORD_MODEL, max_tokens: 2000, system, messages: [{ role: 'user', content: vraag }] })
    tel(ANTWOORD_MODEL, res.usage)
    return tekstUit(res.content)
  }

  async function beoordeel(vraag: string, a20: string, ander: string, fragmenten: string): Promise<{ score20: number; kennisbank20: number; reden: string }> {
    const twintigIsA = Math.random() < 0.5
    const A = twintigIsA ? a20 : ander
    const B = twintigIsA ? ander : a20
    const prompt = `VRAAG:\n${vraag}\n\nKENNISBANKFRAGMENTEN (ingekort, alleen om criterium 4 te beoordelen):\n${fragmenten}\n\nANTWOORD A:\n${A}\n\nANTWOORD B:\n${B}`
    // Thinking uitzetten kan niet bij Fable 5.1 (API-fout), en met 400 tokens ging alles op aan nadenken: ruim budget zodat er tekst overblijft.
    const res = await anthropic.messages.create({ model: JUDGE_MODEL, max_tokens: 1500, system: JUDGE_SYSTEEM, messages: [{ role: 'user', content: prompt }] })
    tel(JUDGE_MODEL, res.usage)
    const tekst = tekstUit(res.content)
    const json = tekst.match(/\{[\s\S]*\}/)?.[0]
    if (!json) throw new Error(`beoordelaar gaf geen JSON (stop_reason ${res.stop_reason}, blokken ${res.content.map(b => b.type).join('+')}, tekst: ${tekst.slice(0, 160)})`)
    const v = JSON.parse(json) as Vergelijking
    const naarScore = (w: string) => (w === 'gelijk' ? 0.5 : (w === 'A') === twintigIsA ? 1 : 0)
    return { score20: naarScore(v.winnaar), kennisbank20: naarScore(v.kennisbank), reden: String(v.reden ?? '').slice(0, 240) }
  }

  const rijen: Rij[] = []
  async function werk(vraag: string, nr: number) {
    try {
      const chunks = await getRelevantChunksMultiQuery([vraag], vraag, 20)
      if (chunks.length < 15) { console.log(`vraag ${nr}: slechts ${chunks.length} fragmenten, overgeslagen`); return }
      const [a20, a10, a0] = await Promise.all([antwoord(vraag, chunks), antwoord(vraag, chunks.slice(0, 10)), antwoord(vraag, [])])
      // Een antwoord van een paar zinnen is meestal een wwedervraag ("welk boek bedoel je?"): de vraag was dan toch niet zelfstandig.
      if (Math.max(a20.length, a10.length, a0.length) < 250) { console.log(`vraag ${nr}: alle antwoorden zijn kort (wedervraag), overgeslagen`); return }
      if (process.env.EVAL_DEBUG) console.log(`vraag ${nr} antwoordlengtes ${a20.length}/${a10.length}/${a0.length}; begin 20: ${JSON.stringify(a20.slice(0, 160))}; begin 0: ${JSON.stringify(a0.slice(0, 160))}`)
      const fragmenten = chunks.slice(0, 6).map(c => `[${c.source ?? 'bron'}] ${c.content.slice(0, 600)}`).join('\n---\n')
      const [t10, t0] = await Promise.all([beoordeel(vraag, a20, a10, fragmenten), beoordeel(vraag, a20, a0, fragmenten)])
      rijen.push({ nr, lengte: { v20: a20.length, v10: a10.length, v0: a0.length }, tegen10: t10, tegen0: t0 })
      console.log(`vraag ${nr}: 20 tegen 10 = ${t10.score20}, 20 tegen 0 = ${t0.score20}  (kosten tot nu $${kosten.toFixed(2)})`)
    } catch (e) {
      console.log(`vraag ${nr} mislukt:`, (e as Error).message.slice(0, 120))
      if ((e as Error).message.startsWith('Kostenplafond')) throw e
    }
  }

  let volgende = 0
  await Promise.all(Array.from({ length: PARALLEL }, async () => {
    while (volgende < vragen.length) {
      const nr = volgende++
      await werk(vragen[nr], nr + 1)
    }
  }))

  const som = (f: (r: Rij) => number) => rijen.reduce((s, r) => s + f(r), 0)
  const n = rijen.length
  const gem = (x: number) => (n ? (x / n).toFixed(2) : 'n.v.t.')
  const splits = (soort: 'echt' | 'nagemaakt') => {
    const deel = rijen.filter(r => (r.nr <= echt) === (soort === 'echt'))
    const g = (f: (r: Rij) => number) => (deel.length ? (deel.reduce((s, r) => s + f(r), 0) / deel.length).toFixed(2) : 'n.v.t.')
    return { vragen: deel.length, tegen10: g(r => r.tegen10?.score20 ?? 0), tegen0: g(r => r.tegen0?.score20 ?? 0) }
  }
  const samenvatting = {
    vragenBeoordeeld: n,
    echtEnNagemaakt: { echt: splits('echt'), nagemaakt: splits('nagemaakt') },
    kostenUsd: Number(kosten.toFixed(2)),
    '20 tegen 10': { aandeelWinst20: gem(som(r => r.tegen10?.score20 ?? 0)), kennisbankWinst20: gem(som(r => r.tegen10?.kennisbank20 ?? 0)) },
    '20 tegen 0': { aandeelWinst20: gem(som(r => r.tegen0?.score20 ?? 0)), kennisbankWinst20: gem(som(r => r.tegen0?.kennisbank20 ?? 0)) },
    gemLengteTekens: { v20: Math.round(som(r => r.lengte.v20) / (n || 1)), v10: Math.round(som(r => r.lengte.v10) / (n || 1)), v0: Math.round(som(r => r.lengte.v0) / (n || 1)) },
  }
  writeFileSync(uitvoerPad, JSON.stringify({ samenvatting, rijen }, null, 2))
  console.log('\nSamenvatting (aandeel winst voor 20 fragmenten; 0,50 = gelijkwaardig, onder 0,50 wint de variant met minder):')
  console.log(JSON.stringify(samenvatting, null, 2))
  console.log('Uitgebreid resultaat:', uitvoerPad)
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
