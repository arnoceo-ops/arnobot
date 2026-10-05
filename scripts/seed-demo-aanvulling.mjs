/**
 * Aanvulling op seed-demo-okt.mjs, na een volledige gatenanalyse van de demo-pagina's.
 * Vult wat de eerdere seeds leeg lieten:
 *   - arnobot_coaching (Benny, Alira, Lisa): richting-velden, ontwikkelpunten en signalen,
 *     anders toont de coachingpagina lege MSA-tegels en een leeg ontwikkelpunten-blok.
 *   - arnobot_coaching_history: twee eerdere rapportages per persoon (het ARCHIEF).
 *   - arnobot_sparring_sessions (test@arno.bot): vier gedebriefde sparsessies met transcript.
 *   - arnobot_team_notifications: drie ongelezen meldingen voor de manager (belletje).
 *
 * Bewust NIET gedaan: een verse arnobot_team_analyses-rij. De teamanalyse blokkeert nieuwe
 * generatie 7 dagen na de laatste, dus een geseede rij zou de live-demo van de teamanalyse
 * onmogelijk maken.
 *
 * Idempotent op exacte tijdstempels / session_id's (prefix `seed-spar-`).
 * Uitvoeren: node scripts/seed-demo-aanvulling.mjs
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
const ME = 'user_3HFvMfJ8ztQxatkJg3SWdSJPz4D'
const U = { benny: 'fake_benny_verwaaijen_001', alira: 'fake_user_alira_bretton', lisa: 'fake_user_lisa_bakker', me: ME }
const at = (date, time = '10:00') => `${date}T${time}:00+00:00`

// ── 1. coachingprofielen: ontbrekende velden ─────────────────────────────────────────────
const COACHING_EXTRA = {
  benny: {
    mindset_richting: 'dalend', systeem_richting: 'stabiel', actie_richting: 'stijgend',
    ontwikkelpunten: [
      { tekst: 'Kies bij een stilliggend traject bewust voor een korte, waardevolle update in plaats van te bellen.', pijlar: 'actie' },
      { tekst: 'Noteer bij elk nieuw traject wat je voelt op het moment dat het stilvalt, zodat je je ongeduld eerder ziet aankomen.', pijlar: 'mindset' },
      { tekst: 'Breng bij elk nieuw traject al in het eerste gesprek de beslisser in kaart, ook als het traject soepel loopt.', pijlar: 'systeem' },
    ],
    signalen: ['Je mindset-score zakte een punt terwijl systeem en actie stegen. Dat past bij het ongeduld dat je zelf benoemt.'],
  },
  alira: {
    mindset_richting: 'stabiel', systeem_richting: 'stijgend', actie_richting: 'stabiel',
    ontwikkelpunten: [
      { tekst: 'Leg de vrijdagse pipeline-review vast als terugkerende afspraak in je agenda in plaats van als iets dat je erbij doet.', pijlar: 'systeem' },
      { tekst: 'Zet na elk gesprek direct de vervolgstap met een datum in je agenda, ook als het gesprek goed voelt.', pijlar: 'actie' },
      { tekst: 'Vraag bij een bezwaar eerst door op wat erachter zit voordat je je eigen aanpak toelicht.', pijlar: 'mindset' },
    ],
    signalen: ['Eén gemiste review kostte je direct overzicht. Dat laat zien hoe sterk je systeem nog op jouw discipline leunt.'],
  },
  lisa: {
    mindset_richting: 'stabiel', systeem_richting: 'stijgend', actie_richting: 'stabiel',
    ontwikkelpunten: [
      { tekst: 'Bereid één vaste zin voor op het moment dat een klant om korting vraagt en breng het gesprek terug naar zijn eigen doelstelling.', pijlar: 'actie' },
      { tekst: 'Werk je lijst met duwen, wachten en loslaten bij elke nieuwe deal bij, ook als je pipeline vol zit.', pijlar: 'systeem' },
      { tekst: 'Schrijf na elke gesloten deal op wat je anders deed dan bij een eerdere prijsdiscussie, zodat je het onder druk kunt herhalen.', pijlar: 'mindset' },
    ],
    signalen: ['Klanten benoemen steeds vaker zelf de reden om te tekenen. Dat is een duidelijk teken dat je waardeaanpak werkt.'],
  },
}

// ── 2. coaching_history (ARCHIEF) ────────────────────────────────────────────────────────
const H = (who, date, m, s, a, md, sd, ad, voortgang) => ({ who, date, m, s, a, md, sd, ad, voortgang })
const HISTORY = [
  H('benny', '2026-08-05', 5, 4, 4,
    'Veerkrachtig en doelgericht. Een verloren deal houdt hem niet lang vast.',
    'Beslissers worden vaker vroeg betrokken, maar het is nog geen vaste gewoonte.',
    'Proactief en snel. Neigt naar duwen als een traject stilvalt.',
    'Je escaleert nu eerder naar de beslisser, wat in het logistieke traject direct het budgetkader op tafel bracht. Volgende laag: het niet laten afhangen van een soepel traject.'),
  H('benny', '2026-09-07', 5, 5, 4,
    'Sterk mentaal en consistent, ook na een stroef traject.',
    'Pipeline-opvolging is scherper en beslissers staan vroeg in beeld.',
    'Resultaatgericht, met nog steeds de neiging om te duwen als het stilligt.',
    'Sterke maand: de beslisser staat nu standaard vroeg in beeld en twee trajecten gingen sneller door de offertefase. Volgende laag: je ongeduld in trajecten die even stilliggen.'),
  H('alira', '2026-08-05', 3, 3, 4,
    'Gemotiveerd, maar verdedigt haar aanpak nog sneller dan ze doorvraagt.',
    'De pipeline krijgt meer overzicht, maar opvolging blijft wisselend.',
    'Sterk in het openen van gesprekken en rapport bouwen.',
    'Je begint scherper door te vragen en dat levert andere antwoorden op van klanten. De pipeline-opvolging heeft nog geen vaste structuur.'),
  H('alira', '2026-09-07', 4, 3, 4,
    'Meer bereid om eerst te luisteren voordat ze haar aanpak verdedigt.',
    'Opvolging mist nog een vaste plek in de agenda.',
    'Sluit steeds concreter op vervolgstappen.',
    'Doorbraak in augustus: de deal die drie maanden vastzat is gesloten. De pipeline-opvolging mist nog structuur.'),
  H('lisa', '2026-08-05', 5, 4, 4,
    'Sterk mentaal, afwijzing is voor haar informatie.',
    'Pipeline is vol en wordt bewuster geprioriteerd.',
    'Hoge executiekracht, soms sneller dan de klant kan volgen.',
    'Je bouwt bewust tussenstappen in en de klant beweegt mee in plaats van af te haken. Prijsgesprekken kunnen nog vanuit waarde.'),
  H('lisa', '2026-09-07', 5, 4, 5,
    'Zeldzaam sterk mentaal, ook in lastige gesprekken.',
    'Prioriteren gebeurt zichtbaar, de discipline kan onder druk nog verslappen.',
    'Beweegt niet meer te snel voor de klant uit.',
    'Je prioriteert nu zichtbaar en je energie zit bij de deals die kunnen sluiten. Prijsgesprekken kunnen nog vanuit waarde in plaats van vanuit de prijs.'),
  H('me', '2026-07-22', 3, 3, 4,
    'Gemotiveerd en gericht op groei, maar reageert nog snel vanuit spanning.',
    'De pipeline mist een vast ritme en offertes blijven soms liggen.',
    'Pakt kansen direct aan en opent gesprekken sterk.',
    'Je opent gesprekken sterk met het doel van de ander. De pipeline heeft nog geen vast ritme en offertes blijven soms zonder vervolg liggen.'),
  H('me', '2026-08-19', 4, 3, 4,
    'Meer rust in gesprekken met beslissers, ook als het spannend wordt.',
    'De pipeline krijgt meer overzicht, het onderhoud gebeurt nog op gevoel.',
    'Kiest vaker voor concrete voorstellen en brengt de beslisser in beeld.',
    'Je brengt bij een enterprise-lead de beslisser eerder in beeld en legt bij twijfel het risico van uitstel op tafel. Volgende laag: een vast ritme voor je pipeline-opvolging.'),
]

// ── 3. sparsessies test@arno.bot ─────────────────────────────────────────────────────────
const SPAR = [
  { id: 'seed-spar-1', date: '2026-08-12', rol: 'verkoper', persona: 'cfo', weerstand: 'stevig', favoriet: false,
    transcript: [
      ['arno', 'Ik heb tien minuten. Jullie software kost 48.000 euro per jaar. Waarom zou ik dat goedkeuren?'],
      ['user', 'Omdat je team hierdoor ongeveer een kwart minder tijd kwijt is aan handmatige rapportage.'],
      ['arno', 'Ongeveer een kwart. Op basis waarvan? Ik wil een getal dat ik kan terugvinden in mijn eigen cijfers.'],
      ['user', 'Bij vergelijkbare klanten zagen we dat. Ik kan de cijfers van hun implementatie sturen.'],
      ['arno', 'Vergelijkbaar is niet gelijk aan mijn bedrijf. Wat kost het mij als ik niets doe?'],
      ['user', 'Dat kan ik pas zeggen als ik weet hoeveel uur jouw team nu aan rapportage besteedt. Mag ik dat eerst van je horen?'],
    ],
    debrief: `Je durfde aan het eind een vraag te stellen in plaats van een getal te verzinnen. Dat is precies wat een CFO respecteert.

Het kritieke moment was jouw zin "Bij vergelijkbare klanten zagen we dat." Daar gaf je een claim zonder eigen cijfer en liet je de CFO het gesprek sturen.

Het patroon: je begint met een algemeen argument en stelt pas daarna de vraag die het gesprek echt draagt.

Tip voor het volgende gesprek: begin bij een CFO met de vraag naar zijn eigen cijfers en bouw je getal daarop, in plaats van met een gemiddelde van andere klanten.` },
  { id: 'seed-spar-2', date: '2026-08-26', rol: 'verkoper', persona: 'dga', weerstand: 'zwaar', favoriet: true,
    transcript: [
      ['arno', 'Weer een verkoper. Ik heb vorige maand drie van jullie weggestuurd. Wat is er bij jou anders?'],
      ['user', 'Ik begin niet met mijn product maar met wat je dit jaar wilt bereiken. Wat staat er bovenaan?'],
      ['arno', 'Dat ik niet nog meer tijd kwijt ben aan mensen die iets willen verkopen.'],
      ['user', 'Begrijpelijk. Dan houd ik het kort: wat kost het je als je groei stokt door gebrek aan tijd?'],
      ['arno', 'Dat weet ik niet precies. Veel. Wat stel je voor?'],
      ['user', 'Ik stel voor dat we een gesprek van twintig minuten plannen waarin ik jouw situatie doorloop, zonder presentatie.'],
    ],
    debrief: `Je opende met zijn doel in plaats van met je product en je ging niet in de verdediging toen hij je afwees. Dat is het juiste begin bij een DGA die al drie verkopers heeft weggestuurd.

Het kritieke moment: "Dat weet ik niet precies. Veel." Hij liet zelf een opening zien en jij sprong direct naar een voorstel.

Het patroon: zodra de ander een barst toont, ga je naar de volgende stap in plaats van de barst te onderzoeken.

Tip: stel na "Veel" nog één vraag, bijvoorbeeld "Wat is veel voor jou?". Pas als hij het getal zelf noemt, heb je een reden voor je voorstel.` },
  { id: 'seed-spar-3', date: '2026-09-17', rol: 'salesbaas', persona: 'underperformer', weerstand: 'licht', favoriet: false,
    transcript: [
      ['arno', 'Je wilde me spreken. Ik weet al waar het over gaat. De markt zit tegen en de leads zijn slecht.'],
      ['user', 'Ik wil het niet over de markt hebben maar over je laatste vijf deals. Wat gebeurde er bij de laatste?'],
      ['arno', 'De klant haakte af na de offerte. Dat ligt echt niet aan mij.'],
      ['user', 'Wat deed je in de twee weken na de offerte?'],
      ['arno', 'Ik heb een mailtje gestuurd. Eén keer.'],
      ['user', 'Dan is dat het eerste dat we gaan veranderen. Wat zou jij doen als het jouw deal was?'],
    ],
    debrief: `Je bleef bij concrete deals en liet je niet meenemen in het verhaal over de markt. Dat houdt het gesprek feitelijk en veilig.

Het kritieke moment: "Dan is dat het eerste dat we gaan veranderen." Je besliste voor hem wat er moest veranderen, nog voordat hij het zelf had benoemd.

Het patroon: je neemt de oplossing over zodra je het probleem ziet, waardoor de ander weinig eigenaarschap voelt.

Tip: vraag na "Eén keer" wat hij zelf zou doen bij een volgende offerte en laat hem de eerste stap benoemen.` },
  { id: 'seed-spar-4', date: '2026-10-01', rol: 'verkoper', persona: 'inkoopmanager', weerstand: 'stevig', favoriet: false,
    transcript: [
      ['arno', 'Ik heb drie aanbieders op de shortlist. Jullie zijn niet de goedkoopste. Wat is jullie argument?'],
      ['user', 'Klopt, we zijn niet de goedkoopste. Wat is voor jou het belangrijkst in deze keuze?'],
      ['arno', 'Prijs, en dat ik bij problemen niet drie weken op een antwoord wacht.'],
      ['user', 'Over het tweede kan ik concrete afspraken geven. Welke reactietijd heb je nu bij je huidige leverancier?'],
      ['arno', 'Twee dagen, als het goed gaat. Staat dat in jullie SLA?'],
      ['user', 'In onze SLA staat vier uur voor kritieke problemen. Ik neem dat mee in het voorstel.'],
    ],
    debrief: `Je ontkende niet dat je duurder bent en vroeg direct wat voor hem het zwaarst weegt. Daardoor bleef het gesprek open.

Het kritieke moment: hij zei "Prijs" en jij liet dat voorbijgaan om op zijn tweede punt in te gaan.

Het patroon: je beantwoordt eerst het criterium waar je sterk in bent en laat het lastige criterium liggen.

Tip: kom terug op de prijs met een vraag, bijvoorbeeld wat het verschil in prijs hem kost tegenover twee dagen wachten bij een storing.` },
]

// ── 4. meldingen voor de manager ─────────────────────────────────────────────────────────
const NOTIFS = [
  { type: 'coaching_gegenereerd', member: 'benny', name: 'Benny Verwaaijen', created_at: at('2026-10-02', '12:20') },
  { type: 'coaching_gegenereerd', member: 'alira', name: 'Alira Bretton', created_at: at('2026-10-02', '15:05') },
  { type: 'coaching_gegenereerd', member: 'lisa', name: 'Lisa Bakker', created_at: at('2026-10-02', '10:40') },
]

async function run() {
  const c = { coaching: 0, history: 0, sparring: 0, meldingen: 0 }

  // Opruimen van rijen uit de eerste versie (weekenddatums).
  for (const who of ['benny', 'alira', 'lisa']) {
    await supabase.from('arnobot_coaching_history').delete().eq('user_id', U[who]).eq('created_at', at('2026-09-05', '14:00'))
  }
  for (const [who, t] of [['benny', at('2026-10-04', '12:20')], ['alira', at('2026-10-03', '15:05')], ['lisa', at('2026-10-04', '09:40')]]) {
    await supabase.from('arnobot_team_notifications').delete().eq('manager_id', ME).eq('member_id', U[who]).eq('created_at', t)
  }

  for (const [key, extra] of Object.entries(COACHING_EXTRA)) {
    const { error } = await supabase.from('arnobot_coaching')
      .update({ ...extra, weinig_voortgang: false, stagnatie: false }).eq('user_id', U[key])
    if (error) throw new Error(`coaching ${key}: ${error.message}`)
    c.coaching++
  }

  for (const h of HISTORY) {
    const created_at = at(h.date, '14:00')
    await supabase.from('arnobot_coaching_history').delete().eq('user_id', U[h.who]).eq('created_at', created_at)
    const { error } = await supabase.from('arnobot_coaching_history').insert({
      user_id: U[h.who], created_at,
      mindset_score: h.m, mindset_diagnose: h.md, systeem_score: h.s, systeem_diagnose: h.sd,
      actie_score: h.a, actie_diagnose: h.ad, voortgang: h.voortgang,
    })
    if (error) throw new Error(`history ${h.who} ${h.date}: ${error.message}`)
    c.history++
  }

  for (const s of SPAR) {
    const transcript = s.transcript.map(([role, content]) => ({ role, content }))
    const { error } = await supabase.from('arnobot_sparring_sessions').upsert({
      user_id: ME, session_id: s.id, rol_categorie: s.rol, persona: s.persona, weerstand: s.weerstand,
      debrief: s.debrief, message_count: transcript.length, favoriet: s.favoriet, transcript,
      created_at: at(s.date, '16:00'),
    }, { onConflict: 'session_id' })
    if (error) throw new Error(`sparring ${s.id}: ${error.message}`)
    c.sparring++
  }

  for (const n of NOTIFS) {
    await supabase.from('arnobot_team_notifications').delete()
      .eq('manager_id', ME).eq('member_id', U[n.member]).eq('created_at', n.created_at)
    const { error } = await supabase.from('arnobot_team_notifications').insert({
      team_id: TEAM_ID, manager_id: ME, type: n.type, member_id: U[n.member],
      member_name: n.name, ref_id: null, created_at: n.created_at, read_at: null,
    })
    if (error) throw new Error(`melding ${n.member}: ${error.message}`)
    c.meldingen++
  }

  // 1:1-acties: een echte 1:1 heeft een afgesproken actie en later een terugkoppeling
  // (ja/deels/nee). De eerdere seeds lieten `actie` leeg, waardoor OPENSTAAND en de
  // follow-through op de leiderschapspagina niets te tonen hadden. De actie is de
  // "ARNO ADVISEERT"-tekst uit de agenda, de status volgt het verhaal per lid. De nieuwste
  // 1:1 van elk lid blijft bewust open (net gehouden).
  const STATUS = {
    benny: { '2026-07-22': 'ja', '2026-08-19': 'ja', '2026-09-04': 'ja', '2026-09-22': 'ja' },
    alira: { '2026-08-12': 'nee', '2026-08-20': 'deels', '2026-09-04': 'ja', '2026-09-22': 'deels' },
    lisa: { '2026-07-22': 'nee', '2026-08-19': 'ja', '2026-09-04': 'ja', '2026-09-22': 'ja' },
  }
  const { data: logs } = await supabase.from('arnobot_1on1_log')
    .select('id, member_id, created_at, agenda, actie, actie_status')
    .eq('manager_id', ME).gte('created_at', at('2026-07-10'))
  c.acties = 0
  for (const l of logs ?? []) {
    const key = Object.keys(U).find(k => U[k] === l.member_id)
    if (!key || key === 'me') continue
    const update = {}
    if (!l.actie && l.agenda?.includes('ARNO ADVISEERT')) {
      update.actie = l.agenda.split('ARNO ADVISEERT')[1].replace(/^\s+/, '').trim()
    }
    const status = STATUS[key]?.[l.created_at.slice(0, 10)]
    if (status && (update.actie || l.actie) && !l.actie_status) update.actie_status = status
    if (Object.keys(update).length === 0) continue
    const { error } = await supabase.from('arnobot_1on1_log').update(update).eq('id', l.id)
    if (error) throw new Error(`1on1 actie ${key} ${l.created_at}: ${error.message}`)
    c.acties++
  }

  console.log('Klaar.', JSON.stringify(c))
}

run().catch(err => { console.error(err); process.exit(1) })
