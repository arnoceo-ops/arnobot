/**
 * Seed / verversing van de demo-dataset van Team Hippios.
 *
 * Team Hippios (`TEST_TEAM_ID`) is de vaste demo-database: 3 fake teamleden met historie,
 * bekeken door test@arno.bot en thijs@tenshare.nl als managers. De data was tot nu toe
 * volledig met de hand ingevoerd in Supabase en nergens vastgelegd, waardoor hij bij elke
 * demo verder achterloopt. Dit script legt de recente maanden vast en is idempotent: het
 * verwijdert alleen de rijen op de exacte tijdstempels die het zelf beheert en zet ze
 * opnieuw, dus veilig om vaker te draaien. Bestaande, oudere hand-ingevoerde data blijft.
 *
 * Verlengt drie tabellen tot begin september 2026:
 *   - arnobot_coaching_scores : de team-brede MSA-trend op /bot/team
 *   - arnobot_1on1_log        : de progressiegrafiek per lid (manager = test@arno.bot)
 *   - arnobot_coaching        : het coachingprofiel + synthese per lid (updated_at ververst)
 *
 * Uitvoeren: node scripts/seed-hippios-demo.mjs
 */

import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf-8').split('\n')) {
  const m = line.match(/^([^#=]+)=(.*)$/)
  if (m) process.env[m[1].trim()] = m[2].trim().replace(/^"|"$/g, '')
}

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const TEAM_ID = '5b29bd9b-762b-4834-a532-d40efa87a43f'
const MANAGER_ID = 'user_3HFvMfJ8ztQxatkJg3SWdSJPz4D' // test@arno.bot
const MEMBER = {
  benny: 'fake_benny_verwaaijen_001',
  alira: 'fake_user_alira_bretton',
  lisa: 'fake_user_lisa_bakker',
}

const msa = (mn, sy, ac) => Math.max(1, Math.round((mn + sy + ac) / 15 * 100))

// ── 1. arnobot_coaching_scores (tweewekelijks, doorlopend vanaf 29 juni) ──────────────────
// [key, datum, mindset, systeem, actie]
const SCORES = [
  ['benny', '2026-07-13', 4, 4, 4], ['benny', '2026-07-27', 4, 4, 4], ['benny', '2026-08-10', 5, 4, 4], ['benny', '2026-08-24', 5, 5, 4], ['benny', '2026-09-07', 5, 5, 4],
  ['alira', '2026-07-13', 3, 2, 4], ['alira', '2026-07-27', 3, 2, 4], ['alira', '2026-08-10', 3, 3, 4], ['alira', '2026-08-24', 4, 3, 4], ['alira', '2026-09-07', 4, 3, 4],
  ['lisa',  '2026-07-13', 5, 3, 4], ['lisa',  '2026-07-27', 5, 3, 4], ['lisa',  '2026-08-10', 5, 4, 4], ['lisa',  '2026-08-24', 5, 4, 4], ['lisa',  '2026-09-07', 5, 4, 5],
]

// ── 2. arnobot_1on1_log (manager = test@arno.bot) ────────────────────────────────────────
// Benny en Lisa liepen dood na begin juli, Alira tot 20 augustus. Aangevuld tot 4 september.
const ONE_ON_ONES = [
  {
    who: 'lisa', date: '2026-07-22', m: 5, s: 3, a: 4,
    goed: 'Je mindset blijft je sterkste kaart. Waar een ander vastloopt na een lastig gesprek, haal jij er de informatie uit en ga je door.',
    aandacht: 'Je pipeline is vol, maar je stuurt er niet op. Elke deal krijgt evenveel aandacht, waardoor de deals die er echt toe doen niet vooruitkomen.',
    advies: 'Neem samen je tien grootste open deals door en zet er per deal één woord bij: duwen, wachten of loslaten. De deals in de categorie loslaten kosten je nu de energie die de duwen-deals nodig hebben.',
  },
  {
    who: 'lisa', date: '2026-08-19', m: 5, s: 4, a: 4,
    goed: 'Je hebt voor het eerst bewust een tussenstap ingebouwd in plaats van meteen door te stoten naar de afspraak. De klant bewoog mee in plaats van af te haken.',
    aandacht: 'Het werkte één keer. De vraag is of je het ook doet als je onder druk staat en de neiging voelt om te versnellen.',
    advies: 'Pak het gesprek waarin je bijna weer te snel ging en benoem hardop het moment waarop je twijfelde. Dat twijfelmoment is precies waar je nieuwe gewoonte getest wordt.',
  },
  {
    who: 'lisa', date: '2026-09-04', m: 5, s: 4, a: 5,
    goed: 'Je prioriteert nu zichtbaar. De deals die je vorige maand als loslaten bestempelde liggen stil en je energie zit waar hij hoort.',
    aandacht: 'Je pareert prijsbezwaren nog vanuit de prijs zelf in plaats van vanuit de waarde die de klant al heeft gezien.',
    advies: 'Schrijf voor je drie lopende deals op wat de klant je in het eerste gesprek zei dat hij wilde bereiken. Dat is je munitie bij het volgende prijsgesprek, niet een kortingspercentage.',
  },
  {
    who: 'benny', date: '2026-07-22', m: 4, s: 4, a: 4,
    goed: 'Je bent proactief en resultaatgericht. Je laat deals niet liggen en je houdt tempo.',
    aandacht: 'In het enterprise-traject van vorige maand kwam de echte beslisser pas laat in beeld. Je was al drie gesprekken bezig met iemand die het niet kon tekenen.',
    advies: 'Stel bij elk nieuw traject in gesprek één de vraag: als we het eens worden, wie zet er dan een handtekening en wie moet daar nog ja tegen zeggen. Ongemakkelijk om te vragen, maar het scheelt je weken.',
  },
  {
    who: 'benny', date: '2026-08-19', m: 5, s: 4, a: 4,
    goed: 'Je hebt bij het logistiek traject al in het tweede gesprek de inkoopdirecteur erbij gehaald. Het budgetkader lag daardoor veel eerder op tafel.',
    aandacht: 'Je deed het in een traject dat soepel liep. Het echte bewijs komt als een deal stroef gaat en de verleiding groot is om terug te vallen in je oude patroon.',
    advies: 'Pak een recenter moeilijk traject en vraag jezelf af bij wie je eigenlijk in gesprek zat en wie de echte beslisser was. Zoek het moment waarop je eerder had kunnen escaleren.',
  },
  {
    who: 'benny', date: '2026-09-04', m: 5, s: 5, a: 4,
    goed: 'Je brengt de beslisser nu standaard vroeg in kaart. Twee trajecten deze maand gingen daardoor sneller door de offertefase.',
    aandacht: 'Je bent soms ongeduldig in langere trajecten. Als het even stilligt ga je duwen, terwijl afwachten soms sterker is.',
    advies: 'Kies één traject dat nu stilligt en doe bewust niets forcerends. Stuur alleen een korte, waardevolle update en kijk wat er terugkomt.',
  },
  {
    who: 'alira', date: '2026-09-04', m: 4, s: 3, a: 4,
    goed: 'Na drie maanden heb je de deal gesloten waar je lang op vastzat. En belangrijker: je vroeg scherper door in plaats van je eigen aanpak te verdedigen.',
    aandacht: 'Je pipeline-opvolging heeft nog steeds geen vaste structuur. Deze deal kwam er ondanks je systeem, niet dankzij.',
    advies: 'Zet elke vrijdag twintig minuten vast om je open deals langs te lopen met één vraag per deal: wat is de afgesproken volgende stap en staat die in je agenda. Geen structuur, geen herhaling van dit succes.',
  },
]

const buildAgenda = (o) =>
  `WAT GAAT GOED\n\n${o.goed}\n\nAANDACHTSPUNT\n\n${o.aandacht}\n\nARNO ADVISEERT\n\n${o.advies}`

// ── 3. arnobot_coaching (coachingprofiel per lid, updated_at ververst) ───────────────────
const COACHING = {
  benny: {
    updated_at: '2026-09-05T10:00:00+00:00',
    mindset_score: 5, systeem_score: 5, actie_score: 4,
    voortgang: 'Sterke maand. Je brengt de beslisser nu standaard vroeg in kaart, wat in twee trajecten direct tijd scheelde. Volgende laag: je ongeduld in trajecten die even stilliggen.',
    mindset_diagnose: 'Veerkrachtig en doelgericht. Laat zich niet ontmoedigen en houdt tempo, ook na een verloren deal.',
    systeem_diagnose: 'Pipeline-opvolging is scherper geworden. Beslissers worden nu vroeg in kaart gebracht in plaats van halverwege ontdekt.',
    actie_diagnose: 'Proactief en resultaatgericht. Nog steeds de neiging om te duwen als een traject stilligt, waar afwachten soms sterker is.',
  },
  alira: {
    updated_at: '2026-09-05T10:00:00+00:00',
    mindset_score: 4, systeem_score: 3, actie_score: 4,
    voortgang: 'Doorbraak in augustus: de deal die drie maanden vastzat is gesloten, en je vroeg zichtbaar scherper door in plaats van je eigen aanpak te verdedigen. De pipeline-opvolging mist nog structuur.',
    mindset_diagnose: 'Gemotiveerd en steeds meer bereid om eerst te luisteren voordat ze haar aanpak verdedigt. Duidelijke groei sinds het voorjaar.',
    systeem_diagnose: 'Pipeline-opvolging ontbreekt nog steeds vaste structuur. Recente successen kwamen er ondanks het systeem, niet dankzij.',
    actie_diagnose: 'Sterk in het openen van gesprekken en het bouwen van rapport. Sluit sinds kort ook concreter op vervolgstappen.',
  },
  lisa: {
    updated_at: '2026-09-05T10:00:00+00:00',
    mindset_score: 5, systeem_score: 4, actie_score: 5,
    voortgang: 'Je prioriteert nu zichtbaar: de deals die er niet toe doen liggen stil, je energie zit bij de deals die kunnen sluiten. En je bouwt bewust tussenstappen in plaats van door te stoten. Prijsgesprekken kunnen nog vanuit waarde in plaats van vanuit de prijs.',
    mindset_diagnose: 'Sterk mentaal. Afwijzing raakt haar niet, ze gebruikt het als informatie. Zeldzame eigenschap.',
    systeem_diagnose: 'Pipeline was vol en ongestructureerd, is nu bewuster geprioriteerd. Kan de discipline nog verliezen onder druk.',
    actie_diagnose: 'Hoge executiekracht. Beweegt niet meer te snel voor de klant uit sinds ze bewust tussenstappen inbouwt.',
  },
}

async function run() {
  let scoresN = 0, oneOnOneN = 0, coachingN = 0

  // 1. coaching_scores
  for (const [key, date, mn, sy, ac] of SCORES) {
    const created_at = `${date}T10:00:00+00:00`
    const user_id = MEMBER[key]
    await supabase.from('arnobot_coaching_scores').delete().eq('user_id', user_id).eq('created_at', created_at)
    const { error } = await supabase.from('arnobot_coaching_scores').insert({
      user_id, created_at, mindset_score: mn, systeem_score: sy, actie_score: ac, msa_score: msa(mn, sy, ac),
    })
    if (error) throw new Error(`coaching_scores ${key} ${date}: ${error.message}`)
    scoresN++
  }

  // 2. 1on1_log
  for (const o of ONE_ON_ONES) {
    const created_at = `${o.date}T09:00:00+00:00`
    const member_id = MEMBER[o.who]
    await supabase.from('arnobot_1on1_log').delete()
      .eq('manager_id', MANAGER_ID).eq('member_id', member_id).eq('created_at', created_at)
    const { error } = await supabase.from('arnobot_1on1_log').insert({
      manager_id: MANAGER_ID, member_id, team_id: TEAM_ID, created_at,
      mindset_score: o.m, systeem_score: o.s, actie_score: o.a,
      aandachtspunt: o.aandacht, agenda: buildAgenda(o),
    })
    if (error) throw new Error(`1on1_log ${o.who} ${o.date}: ${error.message}`)
    oneOnOneN++
  }

  // 3. coaching (bestaande rij per lid bijwerken)
  for (const [key, c] of Object.entries(COACHING)) {
    const { error } = await supabase.from('arnobot_coaching').update(c).eq('user_id', MEMBER[key])
    if (error) throw new Error(`coaching ${key}: ${error.message}`)
    coachingN++
  }

  console.log(`Klaar. ${scoresN} scores, ${oneOnOneN} 1:1-logs, ${coachingN} coachingprofielen bijgewerkt.`)
}

run().catch(err => { console.error(err); process.exit(1) })
