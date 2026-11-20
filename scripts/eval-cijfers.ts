/**
 * Meetset voor cijfervragen in de hoofdchat (2026-11-19). Aanleiding: ArnoBot gebruikte bij een groeidoel
 * de verkeerde basis (huidige stand x 1,1 i.p.v. vorig jaar x 1,1), terwijl de rekentool zelf niets fout deed.
 * De tool vangt verkeerde invoer niet op, dus dit script meet het eindantwoord, niet de som.
 *
 * Gebruikt de ECHTE productieprompt (lib/systemPrompt.ts) en de echte tools (lib/rekenTool.ts), met dezelfde
 * toolronde als app/api/chat/route.ts. Alle gegevens hieronder zijn verzonnen (geen klantdata) maar hebben
 * dezelfde structuur als de tabel waarop het misging: kolommen heel jaar (LY) en YTD (LY YTD) naast elkaar.
 *
 * Elke case: een gesprek, de getallen die in het antwoord MOETEN staan (per groep: een van de varianten) en
 * getallen die er NOOIT in mogen staan. Getallen worden genormaliseerd (2.090.000 en 2090000 zijn gelijk).
 *
 * Uitvoeren: npx --yes tsx scripts/eval-cijfers.ts <label> [herhalingen]
 * Schrijft data/eval-cijfers-<label>.json. Roept alleen de Anthropic-API aan, schrijft niets naar Supabase.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs'

for (const line of readFileSync('.env.local', 'utf-8').split(/\r?\n/)) {
  const m = line.match(/^([^#=]+)=(.*)$/)
  if (m) process.env[m[1].trim()] = m[2].trim().replace(/^"|"$/g, '')
}

type Beurt = { role: 'user' | 'assistant'; content: string }
type Case = {
  id: string
  omschrijving: string
  gesprek: Beurt[]
  moet: string[][] // elke groep: minstens een van deze genormaliseerde teksten moet voorkomen
  nooit: string[] // genormaliseerde teksten die niet mogen voorkomen
  afbeeldingPad?: string // privé: schermafbeelding die bij het eerste bericht hoort (nooit in de repo)
  context?: string // privé: de bibliotheekcontext die het model in productie kreeg
}

const TABEL = `Account Manager Performance
Account Manager | This Year | Last Year | Δ TY-LY | Last Year YTD | Δ TY-LY YTD | B Margin % TY | B Margin % LY
Jan Jansen | 2.000.000 | 1.900.000 | 100.000 | 1.700.000 | 300.000 | 47,1% | 47,7%
Piet Pieters | 3.000.000 | 3.600.000 | -600.000 | 3.300.000 | -300.000 | 41,0% | 40,7%
Klaas Kuiper | 1.500.000 | 1.400.000 | 100.000 | 1.250.000 | 250.000 | 43,6% | 43,6%
Totaal | 6.500.000 | 6.900.000 | -400.000 | 6.250.000 | 250.000 | 43,0% | 43,8%`

// Grotere verzonnen tabel voor rangorde- en kolomvragen (de fouten van 19 november: "grootste daler" en
// "groeit samen met X en Y" terwijl dat alleen in de YTD-kolom klopte).
const TABEL2 = `Account Manager | This Year | Last Year | Δ TY-LY | Last Year YTD | Δ TY-LY YTD
Anna Bakker | 1.800.000 | 1.700.000 | 100.000 | 1.500.000 | 300.000
Bram Smit | 2.500.000 | 3.100.000 | -600.000 | 2.800.000 | -300.000
Carla Vos | 3.900.000 | 5.000.000 | -1.100.000 | 4.750.000 | -850.000
Dirk Mulder | 1.200.000 | 1.250.000 | -50.000 | 1.000.000 | 200.000
Eva Peters | 2.100.000 | 2.400.000 | -300.000 | 2.050.000 | 50.000
Frans Kok | 900.000 | 1.500.000 | -600.000 | 1.300.000 | -400.000
Totaal | 12.400.000 | 14.950.000 | -2.550.000 | 13.400.000 | -1.000.000`

const KOLOM_GENOEMD = ['ytd', 'tot nu toe', 'dezelfde periode', 'heel vorig jaar', 'hele vorige jaar', 'volledig vorig jaar', 'heel jaar', 'hele jaar', 'volledige jaar']

const OPEN =`[Bijlage: dashboard.png]\n${TABEL}\n\nIk ben Jan Jansen. Analyseer mijn omzet en de omzet van het team. Ik wil 10% groei op vorig jaar halen nog dit jaar. Hoe ver ben ik?`
const ANTWOORD_OPEN = 'Je staat op 2.000.000 en vorig jaar was het 1.900.000. Je doel voor 10% groei is 1.900.000 x 1,1 = 2.090.000. Je tekort is dus 90.000. Waar komt dat vandaan?'

const CASES: Case[] = [
  {
    id: 'groeidoel',
    omschrijving: 'Groeidoel op vorig jaar, niet op de huidige stand (de fout van 18 november)',
    gesprek: [{ role: 'user', content: OPEN }],
    moet: [['2090000'], ['90000']],
    nooit: ['2200000', '110000'],
  },
  {
    id: 'groeidoel-vervolg',
    omschrijving: 'Vervolgvraag in hetzelfde gesprek met extra orders',
    gesprek: [
      { role: 'user', content: OPEN },
      { role: 'assistant', content: ANTWOORD_OPEN },
      { role: 'user', content: 'Er komt nog een order van 50k aan en ik verwacht zeker nog 30k. Waar kom ik dan uit?' },
    ],
    moet: [['2080000'], ['10000']],
    nooit: ['2200000', '2280000', '2380000'],
  },
  {
    id: 'tabel-dalers-ytd',
    omschrijving: 'Rangorde: de twee grootste dalers in de YTD-kolom',
    gesprek: [{ role: 'user', content: `[Bijlage: dashboard.png]\n${TABEL2}\n\nWie zijn de twee grootste dalers YTD?` }],
    moet: [['carla'], ['frans']],
    nooit: [],
  },
  {
    id: 'tabel-groeiers-jaar',
    omschrijving: 'Wie groeit ten opzichte van heel vorig jaar (alleen Anna)',
    gesprek: [{ role: 'user', content: `[Bijlage: dashboard.png]\n${TABEL2}\n\nWie in het team groeit ten opzichte van heel vorig jaar?` }],
    moet: [['anna']],
    nooit: ['dirk groeit', 'eva groeit', 'dirk mulder groeit', 'eva peters groeit', 'samen met dirk', 'samen met eva'],
  },
  {
    id: 'tabel-mix',
    omschrijving: 'Open vraag over het team: antwoord noemt welke kolom, en Carla is de grootste daler',
    gesprek: [{ role: 'user', content: `[Bijlage: dashboard.png]\n${TABEL2}\n\nHoe staat het team ervoor, groeit of krimpt het, en wie is de grootste daler?` }],
    moet: [['carla'], KOLOM_GENOEMD],
    nooit: ['grootste daler is frans', 'grootste daler is bram'],
  },
  {
    id: 'ytd',
    omschrijving: 'Groei op dezelfde periode vorig jaar is de YTD-kolom, niet de heel-jaar-kolom',
    gesprek: [
      { role: 'user', content: OPEN },
      { role: 'assistant', content: ANTWOORD_OPEN },
      { role: 'user', content: 'Hoeveel groei heb ik tot nu toe ten opzichte van dezelfde periode vorig jaar, in euro en procent?' },
    ],
    moet: [['300000'], ['17.6', '17.7']],
    nooit: [],
  },
  {
    id: 'aandeel',
    omschrijving: 'Aandeel in het teamtotaal',
    gesprek: [{ role: 'user', content: `${TABEL}\n\nHoeveel procent van de totale omzet dit jaar is van Jan Jansen?` }],
    moet: [['30.8', '30.77']],
    nooit: [],
  },
  {
    id: 'team-heel-jaar',
    omschrijving: 'Teamresultaat over het hele jaar in euro en procent',
    gesprek: [{ role: 'user', content: `${TABEL}\n\nHoe staat het team ervoor ten opzichte van vorig jaar over het hele jaar, in euro en procent?` }],
    moet: [['400000'], ['5.8']],
    nooit: [],
  },
  {
    id: 'marge-doel',
    omschrijving: 'Omzet die nodig is voor een margedoel bij gelijke inkoop',
    gesprek: [{ role: 'user', content: 'Mijn omzet is 500.000 en mijn inkoopkosten zijn 310.000. Wat is mijn brutomarge in procent, en hoeveel moet mijn omzet worden voor 42% brutomarge als de inkoopkosten gelijk blijven?' }],
    moet: [['38'], ['534483', '534482', '534484']],
    nooit: [],
  },
  {
    id: 'btw-verlies',
    omschrijving: 'Verkoopprijs incl. btw naar ex btw en verlies tegen inkoopprijs',
    gesprek: [{ role: 'user', content: 'Een dealer verkoopt een apparaat voor 2800 euro incl. 21% btw. Zijn inkoopprijs is 2716 euro ex btw. Hoeveel verdient of verliest hij per apparaat?' }],
    moet: [['2314.05', '2314.04'], ['401.95', '401.96']],
    nooit: [],
  },
  {
    id: 'korting',
    omschrijving: 'Kortingspercentage',
    gesprek: [{ role: 'user', content: 'Mijn klant vraagt korting. De lijstprijs is 1250 euro en ik bied het aan voor 1100. Hoeveel procent korting is dat?' }],
    moet: [['12']],
    nooit: ['13.6'],
  },
  {
    id: 'run-rate',
    omschrijving: 'Run-rate en benodigde maandomzet voor het jaardoel',
    gesprek: [{ role: 'user', content: 'Ik heb in de eerste drie maanden 84.000 omzet gedraaid. Mijn jaardoel is 400.000. Wat is mijn run-rate op jaarbasis en hoeveel moet ik de resterende negen maanden per maand halen?' }],
    moet: [['336000'], ['35111']],
    nooit: [],
  },
  {
    id: 'commissie',
    omschrijving: 'Commissie over omzet',
    gesprek: [{ role: 'user', content: 'Ik krijg 4% commissie over mijn omzet van 2.271.804. Hoeveel is dat?' }],
    moet: [['90872']],
    nooit: [],
  },
  {
    id: 'pipeline',
    omschrijving: 'Gewogen pipeline',
    gesprek: [{ role: 'user', content: 'Mijn pipeline: deal A 50.000 met 80% kans, deal B 30.000 met 50% kans, deal C 20.000 met 20% kans. Wat is de gewogen pipeline?' }],
    moet: [['59000']],
    nooit: [],
  },
  {
    id: 'gemiddelde',
    omschrijving: 'Gemiddelde dealwaarde en benodigd aantal deals',
    gesprek: [{ role: 'user', content: 'Ik heb 12 deals gesloten voor samen 186.000. Wat is mijn gemiddelde dealwaarde, en hoeveel deals van dat gemiddelde heb ik nodig voor 300.000?' }],
    moet: [['15500'], ['19.35', '20']],
    nooit: [],
  },
]

// Privé-cases (EVAL_PRIVE=pad naar json): het echte gesprek van 18 november met de echte schermafbeelding.
// Het bestand en de afbeelding staan buiten de repo, want het zijn gegevens van een echte gebruiker (namen,
// omzetten). Ook de verwachte antwoorden staan daar, zodat er geen echte namen of cijfers in de repo komen.
// Formaat: { afbeelding, beurten: [{q, a, ctx}], cases: [{ id, omschrijving, tot?, vraag?, moet, nooit }] }
//   tot = index van de beurt in het echte gesprek (met de eerdere beurten als geschiedenis), of
//   vraag = een losse vraag op alleen de afbeelding. In moet staat "@kolom" voor "de kolom is genoemd".
function laadPrive(): Case[] {
  const pad = process.env.EVAL_PRIVE
  if (!pad) return []
  const f = JSON.parse(readFileSync(pad, 'utf-8')) as {
    afbeelding: string
    beurten: { q: string; a: string; ctx: string }[]
    cases: { id: string; omschrijving: string; tot?: number; vraag?: string; moet: string[][]; nooit: string[] }[]
  }
  const bouw = (tot: number): Beurt[] => {
    const g: Beurt[] = []
    for (let i = 0; i < tot; i++) { g.push({ role: 'user', content: f.beurten[i].q }, { role: 'assistant', content: f.beurten[i].a }) }
    g.push({ role: 'user', content: f.beurten[tot].q })
    return g
  }
  return f.cases.map(c => ({
    id: c.id,
    omschrijving: c.omschrijving,
    gesprek: c.tot !== undefined ? bouw(c.tot) : [{ role: 'user' as const, content: c.vraag ?? '' }],
    moet: c.moet.map(g => g.flatMap(x => (x === '@kolom' ? KOLOM_GENOEMD : [x]))),
    nooit: c.nooit,
    afbeeldingPad: f.afbeelding,
    context: c.tot !== undefined ? f.beurten[c.tot].ctx : undefined,
  }))
}

function normaliseer(tekst: string): string {
  return tekst
    .replace(/(\d)\.(?=\d{3}(?!\d))/g, '$1')
    .replace(/(\d),(\d)/g, '$1.$2')
    .replace(/(\d)\s(?=\d{3}(?!\d))/g, '$1')
}

function beoordeelCase(c: Case, antwoord: string): { geslaagd: boolean; ontbreekt: string[]; verboden: string[] } {
  const n = normaliseer(antwoord).toLowerCase()
  const ontbreekt = c.moet.filter(groep => !groep.some(g => n.includes(g))).map(g => g.join(' / '))
  const verboden = c.nooit.filter(v => n.includes(v))
  return { geslaagd: ontbreekt.length === 0 && verboden.length === 0, ontbreekt, verboden }
}

async function main() {
  const label = process.argv[2] ?? 'basis'
  const herhalingen = Number(process.argv[3] ?? 3)
  const Anthropic = (await import('@anthropic-ai/sdk')).default
  const { buildRdsSystemPrompt } = await import('../lib/systemPrompt')
  const tools = await import('../lib/rekenTool')
  const client = new Anthropic()

  // EVAL_BASIS=1: alleen de oorspronkelijke rekentool, voor de vergelijking vóór de wijziging.
  const toolLijst = process.env.EVAL_BASIS ? [tools.REKEN_TOOL] : (tools as any).CHAT_REKENTOOLS ?? [tools.REKEN_TOOL]
  const voerUit = (tools as any).voerToolUit ?? ((naam: string, input: unknown) => (naam === 'bereken' ? tools.voerRekenToolUit(input) : { content: 'Onbekende tool.', isError: true }))
  const { maakTabelStaat } = await import('../lib/tabelTool')

  const resultaten: any[] = []
  // EVAL_ALLEEN=echt: alleen cases waarvan het id met deze tekst begint (sneller).
  const alleCases = [...CASES, ...laadPrive()].filter(c => !process.env.EVAL_ALLEEN || c.id.startsWith(process.env.EVAL_ALLEEN))
  for (const c of alleCases) {
    for (let i = 0; i < herhalingen; i++) {
      const system = buildRdsSystemPrompt('', c.context ?? '', c.gesprek.length, 'normaal', 5)
      let berichten: any[] = c.gesprek.map(b => ({ role: b.role, content: b.content }))
      if (c.afbeeldingPad) {
        const data = readFileSync(c.afbeeldingPad).toString('base64')
        berichten[0] = { role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: 'image/png', data } }, { type: 'text', text: c.gesprek[0].content }] }
      }
      let antwoord = ''
      let toolAanroepen = 0
      const expressies: string[] = []
      const tabelStaat = maakTabelStaat() // per beurt een nieuwe, zoals in de chatroute
      for (let ronde = 0; ronde < 5; ronde++) {
        const res = await client.messages.create({ model: 'claude-sonnet-4-6', max_tokens: 1450, system, messages: berichten, tools: toolLijst })
        antwoord += res.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n\n') + '\n\n'
        if (res.stop_reason !== 'tool_use') break
        const gebruik = res.content.filter((b: any) => b.type === 'tool_use')
        toolAanroepen += gebruik.length
        for (const g of gebruik) expressies.push(JSON.stringify((g as any).input))
        berichten = [...berichten, { role: 'assistant', content: res.content }, {
          role: 'user',
          content: gebruik.map((g: any) => { const r = voerUit(g.name, g.input, tabelStaat); return { type: 'tool_result', tool_use_id: g.id, content: r.content, is_error: r.isError } }),
        }]
      }
      const b = beoordeelCase(c, antwoord)
      resultaten.push({ id: c.id, poging: i + 1, ...b, toolAanroepen, expressies, antwoord: antwoord.trim() })
      console.log(`${b.geslaagd ? 'OK  ' : 'FOUT'} ${c.id} #${i + 1} tool=${toolAanroepen}${b.ontbreekt.length ? ' ontbreekt: ' + b.ontbreekt.join(' | ') : ''}${b.verboden.length ? ' verboden: ' + b.verboden.join(' | ') : ''}`)
    }
  }

  const totaal = resultaten.length
  const goed = resultaten.filter(r => r.geslaagd).length
  console.log(`\n${label}: ${goed}/${totaal} geslaagd`)
  for (const c of alleCases) {
    const r = resultaten.filter(x => x.id === c.id)
    console.log(`  ${c.id.padEnd(18)} ${r.filter(x => x.geslaagd).length}/${r.length}`)
  }
  mkdirSync('data', { recursive: true })
  writeFileSync(`data/eval-cijfers-${label}.json`, JSON.stringify({ label, datum: new Date().toISOString(), goed, totaal, resultaten }, null, 2))
}
main().catch(e => { console.error(e); process.exit(1) })
