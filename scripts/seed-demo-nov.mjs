/**
 * Vervolg op seed-demo-okt.mjs: brengt de demo-omgeving bij tot half november 2026.
 *
 * Team Apex (Benny, Alira, Lisa): sessies (met thema's en embedding) van 6 oktober tot 14
 * november, 1:1-logs (voor alle drie de managers van het team), tweewekelijkse MSA-scores,
 * ververste coachingprofielen en een analyse per lid. Het verhaal loopt door vanuit het
 * oktober-script: Benny onder druk, Alira met de review als vast ritme, Lisa en haar groei.
 * test@arno.bot krijgt alleen extra sessies; zijn coachingrapport, scores en analyses zijn
 * echt werk en blijven onaangeroerd.
 *
 * Idempotent: sessies lopen op vaste session_id's (prefix `seed-nov-`), de overige rijen op
 * exacte tijdstempels. Alleen eigen rijen worden verwijderd en opnieuw gezet.
 *
 * Uitvoeren: node scripts/seed-demo-nov.mjs
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
const ME = 'user_3HFvMfJ8ztQxatkJg3SWdSJPz4D' // test@arno.bot
const MANAGERS = [ME, 'user_3EiyfRK85W4Vx4ebqbxbTys79LC', 'user_3FSTb9JBKzm8pDziEVqLBlcco3N'] // Arno, Thijs, Ger
const MEMBER = {
  benny: 'fake_benny_verwaaijen_001',
  alira: 'fake_user_alira_bretton',
  lisa: 'fake_user_lisa_bakker',
  me: ME,
}

const msa = (mn, sy, ac) => Math.max(1, Math.round((mn + sy + ac) / 15 * 100))
const at = (date, time = '10:00') => `${date}T${time}:00+00:00`
const clamp = (n) => Math.min(5, Math.max(1, n))

const fakeIp = (userId) => {
  const h = [...userId].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7)
  return `84.${(h % 200) + 20}.${((h >> 8) % 250) + 1}.${((h >> 16) % 250) + 1}`
}

// Zelfde model als lib/rag.ts embedSessionText (voyage-multilingual-2), tekst identiek samengesteld.
async function embed(title, summary, feiten) {
  const text = [title, summary, feiten].filter(Boolean).join('\n')
  const res = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.VOYAGE_API_KEY}` },
    body: JSON.stringify({ input: [text], model: 'voyage-multilingual-2' }),
  })
  if (!res.ok) throw new Error(`Voyage: ${await res.text()}`)
  return (await res.json()).data[0].embedding
}

// [who, datum, berichten, titel, thema's, samenvatting, feiten(2 regels), vraag, antwoord]
const S = (who, date, n, title, themas, summary, feiten, q, a) => ({ who, date, n, title, themas, summary, feiten, q, a })

const SESSIONS = [
  // Benny: de eerste deal met echte druk, en wat hij daarvan leert
  S('benny', '2026-10-13', 7, 'Deal met einddatum, klant zwijgt', ['PIJPLIJNBEHEER', 'MINDSET'],
    'Een deal moet voor het einde van het kwartaal rond en de klant zwijgt al een week. Je merkte dat je drie keer bijna belde zonder iets te brengen.',
    'De deal moet dit kwartaal nog rond.\nDe klant heeft een week niet gereageerd.',
    'Deze deal moet nog dit kwartaal rond en de klant reageert niet meer. Ik wil bellen.',
    'Dit is precies de deal waar je ongeduld het hardst werkt. Bel alleen als je iets te brengen hebt. Wat weet je dat de klant nog niet weet en dat hem helpt beslissen?'),
  S('benny', '2026-10-20', 6, 'Gebeld, en het ging mis', ['MINDSET', 'DEALSTRATEGIE'],
    'Je belde toch, zonder nieuwe informatie. De inkoper werd kort van stof en zei dat hij zelf zou terugkomen. Je zag direct dat het precies het oude patroon was.',
    'Je belde zonder nieuwe informatie.\nDe inkoper reageerde afhoudend.',
    'Ik heb toch gebeld. De inkoper werd afhoudend. Dat had ik kunnen weten.',
    'Je weet het nu uit ervaring en niet meer uit de theorie. Schrijf op wat je op het moment van bellen voelde. Dat is het signaal om voortaan eerst een korte mail te sturen.'),
  S('benny', '2026-11-03', 8, 'Terugkomen met iets nuttigs, klant pakt op', ['DEALSTRATEGIE', 'CLOSING'],
    'Je liet de klant twee weken met rust en stuurde daarna een vergelijking van de implementatietijd bij twee soortgelijke klanten. De klant plande binnen een dag een gesprek.',
    'Je stuurde een vergelijking van twee soortgelijke klanten.\nDe klant plande zelf een gesprek.',
    'Ik heb twee weken gewacht en toen die vergelijking gestuurd. Hij belde zelf terug.',
    'Dat is het verschil tussen bellen en iets brengen. Hij hoefde niets te verdedigen, hij kon alleen reageren. Gebruik dit bij de volgende stilte opnieuw.'),
  S('benny', '2026-11-12', 7, 'Nieuw traject, beslisser meteen erbij', ['DEALSTRATEGIE', 'PROSPECTING'],
    'Bij een nieuwe enterprise-lead vroeg je in het eerste gesprek wie er nog meer meekijkt. De financieel directeur schuift volgende week aan.',
    'De financieel directeur sluit volgende week aan.\nJe vroeg dit in gesprek een, niet in gesprek drie.',
    'Bij de nieuwe lead heb ik in het eerste gesprek gevraagd wie er nog meer bij hoort. De FD komt volgende week.',
    'Je doet nu in gesprek een wat je eerder pas deed toen het misging. Vraag de FD voor het gesprek wat hij van het voorstel wil weten, dan kom je voorbereid binnen.'),

  // Alira: de review wordt een vast ritme, daarna een nieuw gat
  S('alira', '2026-10-09', 5, 'Review als vaste afspraak in de agenda', ['DISCIPLINE', 'PIJPLIJNBEHEER'],
    'Je zette de vrijdagse review als terugkerende afspraak in je agenda, met een vaste start en eindtijd. Je hoeft er niet meer voor te kiezen.',
    'De review staat als terugkerende afspraak in je agenda.\nJe verplaatst hem in plaats van hem over te slaan.',
    'De review staat nu elke vrijdag vast in mijn agenda. Ik merk dat het rustiger voelt.',
    'Dat is de bedoeling. Een afspraak met jezelf die je alleen verplaatst, valt niet meer weg. Let op of de review ook echt alle deals bevat, niet alleen de drukke.'),
  S('alira', '2026-10-16', 6, 'Vier weken review zonder overslaan', ['DISCIPLINE'],
    'Je hebt vier weken achter elkaar de review gedaan, ook in een drukke week. Eén keer verplaatst naar maandag, niet overgeslagen.',
    'Vier reviews achter elkaar.\nEén keer verplaatst naar maandag.',
    'Vier weken achter elkaar gedaan. Eén keer naar maandag verplaatst omdat vrijdag niet kon.',
    'Dat laat zien dat de structuur nu draagt. Het volgende wat je kunt kijken is niet of je het doet, maar wat je uit de review haalt. Welke deal zou je anders zijn kwijtgeraakt?'),
  S('alira', '2026-10-30', 7, 'Tweede module voorgesteld, klant is geïnteresseerd', ['KLANTRELATIE', 'PROSPECTING'],
    'De klant die in september live ging noemde zelf dat de rapportages tijd besparen. Daarna stelde je de tweede module voor. Hij wil een demo.',
    'De klant noemde zelf het resultaat.\nHij vroeg om een demo van de tweede module.',
    'De klant zei zelf dat de rapportages veel tijd besparen. Toen heb ik de tweede module genoemd. Hij wil een demo.',
    'Je wachtte op zijn woorden en gebruikte ze. Dat maakt het een vervolg in plaats van een verkooppraatje. Vraag in de demo eerst wie van zijn team de rapportages gebruikt.'),
  S('alira', '2026-11-06', 6, 'Weinig nieuwe gesprekken in de pipeline', ['PROSPECTING', 'PIJPLIJNBEHEER'],
    'Je review liet zien dat er weinig nieuwe gesprekken bij zijn gekomen sinds september. De pipeline is overzichtelijk, maar smaller dan je wilt.',
    'Er zijn weinig nieuwe gesprekken bijgekomen.\nDe bestaande deals zijn goed bijgehouden.',
    'Mijn review is op orde, maar ik zie dat er maar twee nieuwe gesprekken bij zijn gekomen. Wat doe ik?',
    'Je hebt je structuur voor bestaande deals gebouwd. Bouw nu hetzelfde voor nieuwe: een vast blok per week waarin je alleen nieuwe gesprekken opent, vooraf in je agenda gezet.'),
  S('alira', '2026-11-13', 5, 'Eerste prospectingblok gedaan', ['PROSPECTING', 'DISCIPLINE'],
    'Je hebt voor het eerst een prospectingblok van negentig minuten vastgezet. Je opende zes gesprekken en kreeg twee afspraken.',
    'Je opende zes gesprekken in een vast blok.\nDat leverde twee afspraken op.',
    'Ik heb een blok van anderhalf uur gedaan. Zes gesprekken geopend, twee afspraken.',
    'Je gebruikt dezelfde aanpak als bij de review, en het werkt weer. Zet het blok terugkerend in je agenda en kijk over een maand hoeveel afspraken het oplevert.'),

  // Lisa: groei van de pipeline, steeds meer zelfvertrouwen, valkuil is overbelasting
  S('lisa', '2026-10-13', 6, 'Pipeline groeit, lijst wordt langer', ['PIJPLIJNBEHEER', 'DISCIPLINE'],
    'Na de gesloten deal kwamen er vier nieuwe kansen bij. Je liep je lijst met duwen, wachten en loslaten langs en zette twee deals op wachten.',
    'Vier nieuwe kansen in de pipeline.\nTwee deals staan nu op wachten.',
    'Er zijn vier nieuwe deals bij gekomen. Ik heb mijn lijst bijgewerkt. Twee staan op wachten.',
    'Goed dat je de lijst bijwerkt nu hij groeit, niet pas als het te veel wordt. Kijk bij de wachtdeals wat de datum is waarop je ze opnieuw bekijkt.'),
  S('lisa', '2026-10-20', 7, 'Eerste kortingsvraag met voorbereide zin', ['BEZWAARHANTERING', 'ONDERHANDELING'],
    'Een nieuwe klant vroeg om korting. Je gebruikte je voorbereide zin en de klant liet de vraag binnen een minuut los zonder dat je aarzelde.',
    'Je gebruikte je voorbereide zin bij de kortingsvraag.\nDe klant liet de vraag direct los.',
    'De klant vroeg om korting en ik had mijn zin klaar. Hij liet het meteen los.',
    'Geen aarzeling meer, dat is precies waar je naartoe werkte. Schrijf de zin en de reactie op in je notities, zodat je ze kunt delen met een collega die hetzelfde nodig heeft.'),
  S('lisa', '2026-11-03', 6, 'Twee deals tegelijk in de laatste fase', ['PIJPLIJNBEHEER', 'CLOSING'],
    'Twee deals kwamen tegelijk in de laatste fase. Je merkte dat je aandacht verdeeld raakte en koos er één om eerst af te ronden.',
    'Twee deals zaten tegelijk in de laatste fase.\nJe koos er één om eerst af te ronden.',
    'Twee deals zitten tegelijk in de laatste fase. Ik heb er één gekozen om eerst af te maken.',
    'Kiezen is hier verstandiger dan verdelen. Zeg de tweede klant eerlijk wanneer je hem weer oppakt, zodat hij niet gaat twijfelen aan je aandacht.'),
  S('lisa', '2026-11-10', 5, 'Collega vraagt hoe ik prijsgesprekken doe', ['KLANTRELATIE', 'MINDSET'],
    'Een collega vroeg hoe je prijsgesprekken aanpakt. Je liet hem je aanpak zien en merkte dat uitleggen je eigen aanpak scherper maakte.',
    'Een collega vroeg om je aanpak.\nJe merkte dat het uitleggen je zelf scherper maakte.',
    'Een collega vroeg hoe ik prijsgesprekken doe. Ik heb mijn aanpak uitgelegd.',
    'Uitleggen is de beste toets van of je het echt snapt. Let wel op dat je eigen deals niet de tijd verliezen die je in je collega steekt.'),

  // test@arno.bot zelf
  S('me', '2026-10-14', 6, 'CEO wil sneller beslissen, CFO remt', ['DEALSTRATEGIE', 'ONDERHANDELING'],
    'Een CEO wilde snel door, zijn CFO vroeg om een extra ronde. Je zocht een manier om beide kanten te bedienen zonder het traject te vertragen.',
    'De CEO wil snel starten.\nDe CFO wil eerst een extra ronde.',
    'De CEO wil snel starten maar zijn CFO remt. Hoe ga ik hiermee om?',
    'Vraag de CFO wat hij nog moet zien om ja te kunnen zeggen en bied dat aan als één compact document. Dan krijgt de CEO tempo en de CFO zijn zekerheid.'),
  S('me', '2026-10-28', 5, 'Gesprek met stille beslisser, nu met stiltes', ['MINDSET', 'PROSPECTING'],
    'Je paste je nieuwe aanpak toe en liet na je vraag drie seconden stilte vallen. De CEO vertelde uit zichzelf waar zijn grootste knelpunt zat.',
    'Je liet na een vraag drie seconden stilte.\nDe CEO noemde zelf zijn grootste knelpunt.',
    'Ik heb na mijn vraag gezwegen. Hij begon vanzelf over zijn knelpunt.',
    'Dat is waarom stilte werkt: de ander vult hem met wat er echt toe doet. Schrijf het knelpunt in zijn eigen woorden op, dat gebruik je in je voorstel.'),
  S('me', '2026-11-05', 7, 'Offerte met drie opties of één', ['DEALSTRATEGIE', 'CLOSING'],
    'Je twijfelde of je een klant drie opties of één voorstel moest sturen. Je koos voor één voorstel met een duidelijke aanbeveling.',
    'Je koos voor één voorstel.\nJe voegde een duidelijke aanbeveling toe.',
    'Moet ik drie opties sturen of één voorstel?',
    'Drie opties laten de klant kiezen, één voorstel laat hem beslissen. Bij een beslisser die weinig tijd heeft werkt een heldere aanbeveling beter. Leg erbij uit waarom je deze kiest.'),
  S('me', '2026-11-12', 6, 'Klant die vertrekt naar concurrent', ['KLANTRELATIE', 'BEZWAARHANTERING'],
    'Een bestaande klant liet doorschemeren dat hij naar een concurrent kijkt. Je koos ervoor om eerst te vragen wat hem bezighoudt voordat je iets aanbood.',
    'De klant kijkt naar een concurrent.\nJe vroeg eerst naar zijn zorg.',
    'Een klant kijkt naar een concurrent. Wat doe ik?',
    'Vraag eerst wat hij zoekt dat hij nu mist. Een aanbod voordat je dat weet, voelt als verdedigen. Als je zijn reden kent, kun je aansluiten of eerlijk zeggen dat het niet past.'),
]

// ── 1:1-LOGS (voor elk van de drie managers) ──────────────────────────────────────────────
const ONE_ON_ONES = [
  { who: 'benny', date: '2026-10-16', m: 3, s: 4, a: 4,
    goed: 'Je herkende bij de deal met een einddatum dat je wilde bellen en stelde het uit. Je stuurde eerst een korte mail.',
    aandacht: 'Je belde een paar dagen later alsnog zonder iets te brengen. Onder echte druk wint de oude reflex nog.',
    advies: 'Spreek met jezelf af dat je bij een deal met een einddatum pas belt als je iets nieuws hebt. Schrijf op wat dat dan is voordat je de telefoon pakt.' },
  { who: 'benny', date: '2026-10-30', m: 4, s: 5, a: 4,
    goed: 'Je hebt de les van het misgelopen telefoontje omgezet in een werkwijze. Je liet de klant twee weken met rust en kwam terug met een vergelijking.',
    aandacht: 'Het werkte omdat je het kon plannen. Bij een onverwachte stilte moet je het nog bewijzen.',
    advies: 'Maak een korte lijst met drie dingen die je kunt sturen als een klant stil valt. Dan hoef je er op het moment zelf niet over na te denken.' },
  { who: 'benny', date: '2026-11-13', m: 5, s: 5, a: 5,
    goed: 'De klant belde zelf terug na jouw vergelijking, en bij de nieuwe lead heb je de beslisser in het eerste gesprek betrokken. Je doet standaard wat je eerder alleen deed als het misging.',
    aandacht: 'Je bent nu consistent, maar de volgende test is een deal die tegenzit zonder dat je er wat aan kunt veranderen.',
    advies: 'Noteer hoe je bij de volgende tegenvaller reageert. Je weet nu wat je moet doen, laat zien dat je het ook doet als het geen rustig traject is.' },
  { who: 'alira', date: '2026-10-16', m: 4, s: 4, a: 4,
    goed: 'De review staat nu als vaste afspraak in je agenda. Je hebt hem vier weken achter elkaar gedaan en één keer verplaatst in plaats van overgeslagen.',
    aandacht: 'Je review gaat nog vooral over de deals die er al zijn. Er komt weinig nieuw bij.',
    advies: 'Voeg aan de review één vraag toe: hoeveel nieuwe gesprekken zijn er deze week bijgekomen? Dan zie je het gat voordat het groot wordt.' },
  { who: 'alira', date: '2026-10-30', m: 4, s: 4, a: 5,
    goed: 'Je wachtte tot de klant zelf het resultaat noemde en stelde toen de tweede module voor. Hij vroeg om een demo.',
    aandacht: 'Het aantal nieuwe gesprekken blijft achter. Je pipeline is netjes, maar smal.',
    advies: 'Zet een vast prospectingblok in je agenda, net zoals je met de review deed. Kies een moment waarop je meestal energie hebt.' },
  { who: 'alira', date: '2026-11-13', m: 5, s: 4, a: 5,
    goed: 'Je hebt voor het eerst een prospectingblok gedaan: zes gesprekken geopend en twee afspraken. Je gebruikt dezelfde aanpak als bij de review.',
    aandacht: 'Het is één blok. Of het een gewoonte wordt, blijkt de komende weken.',
    advies: 'Zet het blok terugkerend in je agenda en tel elke week hoeveel afspraken het oplevert. Na een maand kijken we samen wat je ervan leert.' },
  { who: 'lisa', date: '2026-10-16', m: 5, s: 4, a: 5,
    goed: 'Je pipeline groeide na de gesloten deal en je werkte je lijst met duwen, wachten en loslaten direct bij. Twee deals staan nu bewust op wachten.',
    aandacht: 'Met meer deals wordt aandacht verdelen lastiger. Je lijst helpt, maar het kost tijd.',
    advies: 'Geef elke wachtdeal een datum waarop je hem opnieuw bekijkt. Zo blijft wachten een keuze en wordt het geen vergeten deal.' },
  { who: 'lisa', date: '2026-10-30', m: 5, s: 5, a: 5,
    goed: 'Je gebruikte je voorbereide zin bij een kortingsvraag en de klant liet het meteen los. De aarzeling is weg.',
    aandacht: 'Je zit op een niveau waarop de valkuil verschuift: niet meer techniek, maar te veel tegelijk oppakken.',
    advies: 'Kies per week maximaal twee deals waar je actief op duwt. Alles daarbuiten staat op wachten of loslaten.' },
  { who: 'lisa', date: '2026-11-13', m: 5, s: 4, a: 5,
    goed: 'Je koos bij twee deals in de laatste fase er één om eerst af te ronden, en je legde de tweede klant uit wanneer je terugkomt. Je collega vroeg om jouw aanpak.',
    aandacht: 'Je steekt tijd in je collega, wat goed is, maar je eigen systeem kreeg die week iets minder aandacht.',
    advies: 'Plan het delen van je aanpak als één vast moment in de week. Dan blijft er ruimte voor je eigen deals en je lijst.' },
]

const buildAgenda = (o) =>
  `WAT GAAT GOED\n\n${o.goed}\n\nAANDACHTSPUNT\n\n${o.aandacht}\n\nARNO ADVISEERT\n\n${o.advies}`

// ── SCORES (alleen de leden; test@arno.bot heeft eigen echte scores) ──────────────────────
const SCORES = [
  ['benny', '2026-10-19', 3, 4, 4], ['benny', '2026-11-02', 4, 5, 4], ['benny', '2026-11-16', 5, 5, 5],
  ['alira', '2026-10-19', 4, 4, 4], ['alira', '2026-11-02', 4, 4, 5], ['alira', '2026-11-16', 5, 4, 5],
  ['lisa', '2026-10-19', 5, 4, 5], ['lisa', '2026-11-02', 5, 5, 5], ['lisa', '2026-11-16', 5, 4, 5],
]

// ── COACHINGPROFIELEN (alleen leden) ──────────────────────────────────────────────────────
const COACHING = {
  benny: {
    updated_at: at('2026-11-13', '12:20'), mindset_score: 5, systeem_score: 5, actie_score: 5,
    voortgang: 'Na een misgelopen telefoontje bij een deal met een einddatum maakte je er een werkwijze van: de klant met rust laten en terugkomen met iets nuttigs. Dat werkte, en bij de nieuwe lead haalde je de beslisser in het eerste gesprek erbij. Volgende laag: laten zien dat dit ook standhoudt bij een deal die tegenzit.',
    mindset_diagnose: 'Leert van een eigen misser en zet het om in gedrag. Het ongeduld is nog aanwezig, maar stuurt je niet meer.',
    systeem_diagnose: 'Beslissers staan vroeg in beeld en je hebt een vaste aanpak voor stilte.',
    actie_diagnose: 'Resultaatgericht en consequent. Kiest steeds vaker voor iets brengen in plaats van duwen.',
  },
  alira: {
    updated_at: at('2026-11-13', '15:05'), mindset_score: 5, systeem_score: 4, actie_score: 5,
    voortgang: 'De vrijdagse review draait nu als vaste afspraak, en je koppelde een tweede module aan wat de klant zelf zei. Je zag zelf dat er weinig nieuwe gesprekken bijkomen en zette een prospectingblok neer, met twee afspraken als resultaat. Volgende laag: het blok volhouden.',
    mindset_diagnose: 'Nuchter en eerlijk over eigen patronen. Ziet het gat in de pipeline zelf en handelt daarop.',
    systeem_diagnose: 'De review werkt. Voor nieuwe gesprekken bouw je nu hetzelfde ritme op, maar dat is nog maar een week oud.',
    actie_diagnose: 'Sterk in het openen van gesprekken en inmiddels ook in het plannen daarvan.',
  },
  lisa: {
    updated_at: at('2026-11-13', '10:40'), mindset_score: 5, systeem_score: 4, actie_score: 5,
    voortgang: 'Je gebruikte je voorbereide zin bij een kortingsvraag zonder aarzeling en koos bij twee deals tegelijk bewust er één om eerst af te ronden. Je collega vroeg om jouw aanpak. Volgende laag: je eigen systeem bijhouden terwijl je anderen helpt.',
    mindset_diagnose: 'Sterk en rustig bij kortingsvragen. De uitdaging is niet meer techniek maar het bewaken van de eigen aandacht.',
    systeem_diagnose: 'Pipeline en lijst staan er, maar met meer deals en een collega die meekijkt is het lastiger om alles bij te houden.',
    actie_diagnose: 'Hoge executiekracht. Kiest bewust welke deal eerst moet.',
  },
}

// ── ANALYSES (1 per lid, half november) ───────────────────────────────────────────────────
const ANALYSES = [
  { who: 'benny', date: '2026-11-11', text:
`STERKE PUNTEN
Benny maakte van een misgelopen telefoontje een werkwijze. Bij een stille klant wacht hij nu en komt hij terug met iets nuttigs, en bij een nieuwe lead haalt hij de beslisser in het eerste gesprek erbij.

GROEIKANS
Zijn ongeduld is minder dominant, maar nog niet bewezen bij een deal die tegenzit buiten zijn invloed. De vraag is of de nieuwe aanpak ook standhoudt als er niets te sturen valt.

COACHING FOCUS
Maak een korte lijst met dingen die hij kan sturen bij een stilte, zodat hij er onder druk niet over hoeft na te denken.` },
  { who: 'alira', date: '2026-11-11', text:
`STERKE PUNTEN
Alira doet de vrijdagse review nu als vaste afspraak en koppelde een tweede module aan wat de klant zelf zei. Ze zag zelf dat er weinig nieuwe gesprekken bijkwamen en handelde daar direct op.

GROEIKANS
Haar structuur is sterk voor bestaande deals, maar nieuwe gesprekken hebben nog geen vast ritme. Het eerste prospectingblok was één week.

COACHING FOCUS
Leg het prospectingblok vast als terugkerende afspraak, net zoals de review, en tel wekelijks het aantal nieuwe afspraken.` },
  { who: 'lisa', date: '2026-11-11', text:
`STERKE PUNTEN
Lisa gebruikt een voorbereide zin bij kortingsvragen en aarzelt niet meer. Ze koos bij twee deals tegelijk bewust één om eerst af te ronden en legde de andere klant uit wanneer ze terugkomt.

GROEIKANS
Met een groeiende pipeline en een collega die haar aanpak vraagt, loopt haar eigen systeem het risico minder aandacht te krijgen. De valkuil is niet techniek maar overbelasting.

COACHING FOCUS
Kies per week maximaal twee deals waarop ze actief duwt en plan het delen van haar aanpak als één vast moment.` },
]

async function run() {
  const counts = { sessies: 0, rds: 0, scores: 0, oneOnOne: 0, coaching: 0, analyses: 0 }
  const idsByWho = {}

  // 1. sessies + gesprekslog
  for (const s of SESSIONS) {
    const user_id = MEMBER[s.who]
    const session_id = `seed-nov-${s.who}-${s.date}`
    const created_at = at(s.date)
    const entry = { id: null, created_at }
    ;(idsByWho[s.who] ||= []).push(entry)

    await supabase.from('arnobot_blog_sessions').delete().eq('user_id', user_id).eq('session_id', session_id)
    await supabase.from('arnobot_rds_logs').delete().eq('user_id', user_id).eq('session_id', session_id)

    const embedding = await embed(s.title, s.summary, s.feiten)
    const { data, error } = await supabase.from('arnobot_blog_sessions').insert({
      user_id, session_id, title: s.title, summary: s.summary, feiten: s.feiten,
      message_count: s.who === 'me' ? 1 : s.n, created_at, blog_suggestions: [], uitdaging: null, uitdaging_done: false,
      themas: s.themas, excuustaal: false, actie_erkend: false, community_excluded: false, embedding,
    }).select('id').single()
    if (error) throw new Error(`sessie ${s.who} ${s.date}: ${error.message}`)
    entry.id = data.id
    counts.sessies++

    const { error: e2 } = await supabase.from('arnobot_rds_logs').insert({
      user_id, session_id, question: s.q, answer: s.a, created_at: at(s.date, '10:05'), ip: fakeIp(user_id),
    })
    if (e2) throw new Error(`rds_logs ${s.who} ${s.date}: ${e2.message}`)
    counts.rds++
  }

  // 2. scores
  for (const [key, date, mn, sy, ac] of SCORES) {
    const user_id = MEMBER[key]
    const created_at = at(date)
    await supabase.from('arnobot_coaching_scores').delete().eq('user_id', user_id).eq('created_at', created_at)
    const { error } = await supabase.from('arnobot_coaching_scores').insert({
      user_id, created_at, mindset_score: mn, systeem_score: sy, actie_score: ac, msa_score: msa(mn, sy, ac),
    })
    if (error) throw new Error(`scores ${key} ${date}: ${error.message}`)
    counts.scores++
  }

  // 3. 1:1-logs, per manager (de drie managers hebben bewust dezelfde demo, met kleine verschillen)
  for (const [mi, manager_id] of MANAGERS.entries()) {
    for (const [oi, o] of ONE_ON_ONES.entries()) {
      const created_at = at(o.date, '09:00')
      const member_id = MEMBER[o.who]
      const wiggle = mi === 0 ? 0 : ((oi + mi) % 3 === 0 ? -1 : 0)
      await supabase.from('arnobot_1on1_log').delete().eq('manager_id', manager_id).eq('member_id', member_id).eq('created_at', created_at)
      const { error } = await supabase.from('arnobot_1on1_log').insert({
        manager_id, member_id, team_id: TEAM_ID, created_at,
        mindset_score: clamp(o.m + wiggle), systeem_score: o.s, actie_score: clamp(o.a + (mi === 2 ? wiggle : 0)),
        aandachtspunt: o.aandacht, agenda: buildAgenda(o),
      })
      if (error) throw new Error(`1on1 ${o.who} ${o.date}: ${error.message}`)
      counts.oneOnOne++
    }
  }

  // 4. coachingprofielen
  for (const [key, c] of Object.entries(COACHING)) {
    const user_id = MEMBER[key]
    const { error } = await supabase.from('arnobot_coaching').update(c).eq('user_id', user_id)
    if (error) throw new Error(`coaching ${key}: ${error.message}`)
    counts.coaching++
  }

  // 5. analyses
  for (const a of ANALYSES) {
    const user_id = MEMBER[a.who]
    const created_at = at(a.date, a.time || '17:00')
    await supabase.from('arnobot_analyses').delete().eq('user_id', user_id).eq('created_at', created_at)
    const ids = (idsByWho[a.who] || []).filter(e => e.id && e.created_at < created_at).map(e => e.id)
    const { error } = await supabase.from('arnobot_analyses').insert({
      user_id, created_at, analyse_text: a.text, session_count: ids.length, session_ids: ids,
    })
    if (error) throw new Error(`analyse ${a.who} ${a.date}: ${error.message}`)
    counts.analyses++
  }

  console.log('Klaar.', JSON.stringify(counts))
}

run().catch(err => { console.error(err); process.exit(1) })
