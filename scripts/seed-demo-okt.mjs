/**
 * Vervolg op seed-hippios-demo.mjs: brengt de demo-omgeving bij tot begin oktober 2026.
 *
 * Deel 1, Team Hippios (Benny, Alira, Lisa): sessies (met thema's en embedding), 1:1-logs
 * van test@arno.bot, tweewekelijkse MSA-scores, ververste coachingprofielen en een analyse
 * per lid. Het verhaal loopt door vanuit de adviezen van de 1:1's van 4 september.
 *
 * Deel 2, test@arno.bot zelf: eigen sessies, scorehistorie, coachingprofiel, analyses en
 * gesprekslog, zodat de testpersona's verkoper/teamlid/CEO/solopreneur (zie
 * app/api/admin/test-persona/route.ts) niet met een leeg account demonsteren. De eigen
 * sessies gaan over deals, prospecting en klantrelaties (profiel: software, B2B,
 * CEO's als ideale klant), zodat ze ook bij de managerpersona geloofwaardig blijven.
 *
 * Idempotent: sessies lopen op vaste session_id's (prefix `seed-okt-`), de overige rijen op
 * exacte tijdstempels. Alleen eigen rijen worden verwijderd en opnieuw gezet.
 *
 * Uitvoeren: node scripts/seed-demo-okt.mjs
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
const MEMBER = {
  benny: 'fake_benny_verwaaijen_001',
  alira: 'fake_user_alira_bretton',
  lisa: 'fake_user_lisa_bakker',
  me: ME,
}

const msa = (mn, sy, ac) => Math.max(1, Math.round((mn + sy + ac) / 15 * 100))
const at = (date, time = '10:00') => `${date}T${time}:00+00:00`

// Geloofwaardig, per gebruiker vast IP-adres voor het gesprekslog. De admin-weergave toont dit
// veld in de sessiekop, dus een letterlijke 'seed' verraadt demodata (7-10-2026).
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

// ── SESSIES ──────────────────────────────────────────────────────────────────────────────
// [who, datum, berichten, titel, thema's, samenvatting, feiten(2 regels), vraag, antwoord]
const S = (who, date, n, title, themas, summary, feiten, q, a) => ({ who, date, n, title, themas, summary, feiten, q, a })

const SESSIONS = [
  // Benny: een traject dat stilligt, afwachten in plaats van duwen
  S('benny', '2026-09-10', 6, 'Traject ligt stil, moet ik bellen?', ['PIJPLIJNBEHEER', 'DEALSTRATEGIE'],
    'Je vroeg of je moest bellen bij een traject dat al twee weken stilligt. Je merkte zelf dat je neiging om te duwen sterker is dan de reden om te duwen.',
    'Het traject ligt stil na de offerte.\nJe wilde bellen zonder nieuwe informatie te hebben.',
    'Het enterprise-traject ligt al twee weken stil. Ik wil bellen om te vragen hoe het staat.',
    'Bel je om iets te vragen of om iets te brengen? Zonder nieuwe waarde klinkt dit als druk. Stuur eerst één korte update met iets dat de klant kan gebruiken en kijk wat er terugkomt.'),
  S('benny', '2026-09-17', 5, 'Korte update gestuurd in plaats van te duwen', ['DEALSTRATEGIE', 'MINDSET'],
    'Je stuurde een korte, nuttige update in plaats van te bellen. De klant reageerde binnen twee dagen met een vraag over de implementatie.',
    'De klant reageerde op de update met een inhoudelijke vraag.\nHet voelde onwennig om niets te forceren.',
    'Ik heb alleen een korte update gestuurd over de implementatie. Ze reageerden meteen.',
    'Dat is precies het verschil. Je gaf ze iets om op te reageren in plaats van iets om te verdedigen. Onthoud dat gevoel van onwennigheid, dat is het gevoel van niet duwen.'),
  S('benny', '2026-09-24', 7, 'Inkoop reageert na stilte, hoe pak ik het op', ['PIJPLIJNBEHEER', 'ONDERHANDELING'],
    'Na drie weken stilte kwam de inkoper terug met een lijst vragen. Je wilde direct alles beantwoorden en meteen naar een voorstel gaan.',
    'De inkoper kwam zelf terug na de stilte.\nJe plande te veel in één antwoord.',
    'De inkoper heeft eindelijk gereageerd met tien vragen. Ik wil ze allemaal in één keer beantwoorden en een voorstel meesturen.',
    'Beantwoord de vragen die het traject vooruit helpen en vraag bij de rest waarom ze gesteld worden. Een inkoper die tien vragen stelt test je, die zoekt niet per se tien antwoorden.'),
  S('benny', '2026-09-30', 8, 'Offertefase doorlopen zonder te versnellen', ['CLOSING', 'DEALSTRATEGIE'],
    'De offertefase liep dit keer in tien dagen door, zonder dat je extra hoefde te duwen. De beslisser stond al vroeg in het traject en tekende mee.',
    'De beslisser was vanaf gesprek twee betrokken.\nDe offerte is zonder herziening akkoord gegaan.',
    'De offerte is akkoord, zonder aanpassingen. De financieel directeur zat er vanaf het begin bij.',
    'Dat is het resultaat van je beslisser vroeg in kaart brengen. Je doet nu standaard wat je eerder pas deed als het misging. Let op dat je dit ook volhoudt bij een traject dat minder soepel loopt.'),
  S('benny', '2026-10-02', 5, 'Ongeduld herkennen voordat ik bel', ['MINDSET', 'DISCIPLINE'],
    'Je merkte bij een nieuw traject dat je ongeduld opkwam voordat je de telefoon pakte. Je benoemde het en koos voor een korte mail.',
    'Je herkende het ongeduld vooraf.\nJe koos bewust voor een kleinere stap.',
    'Bij het nieuwe traject voelde ik dezelfde drang. Ik heb het herkend en eerst een mail gestuurd.',
    'Herkennen vóór handelen is de echte winst. Noteer wat je op dat moment voelt, dan zie je na een paar keer wanneer het opkomt en kun je het eerder zien aankomen.'),

  // Alira: de vaste vrijdagse pipeline-review
  S('alira', '2026-09-14', 6, 'Eerste vrijdagse pipeline-review', ['PIJPLIJNBEHEER', 'DISCIPLINE'],
    'Je hebt voor het eerst twintig minuten vastgezet om je open deals langs te lopen met één vraag per deal. Het voelde mechanisch maar leverde direct inzicht op.',
    'Je liep alle open deals langs in twintig minuten.\nBij vier deals stond geen vervolgstap in de agenda.',
    'Ik heb mijn eerste pipeline-review gedaan. Bij vier deals wist ik niet wat de volgende stap was.',
    'Dat is het nut van dit moment: je ziet wat eerder verborgen bleef. Zet bij elk van die vier deals een concrete volgende stap met een datum in je agenda.'),
  S('alira', '2026-09-21', 5, 'Drie deals zonder volgende stap gevonden', ['PIJPLIJNBEHEER'],
    'De tweede review liet drie deals zien zonder afgesproken vervolg. Je pakte er twee op en liet de derde bewust los.',
    'Twee van de drie deals zijn opgepakt.\nDe derde is losgelaten met een reden.',
    'Drie deals hadden geen volgende stap. Twee heb ik opgepakt en de derde laat ik gaan.',
    'Loslaten met een reden is een besluit, geen verlies. Noteer waarom je hem loslaat, dan weet je bij een volgend patroon sneller wanneer je dezelfde afweging maakt.'),
  S('alira', '2026-09-28', 6, 'Vervolgstap in de agenda zetten werkt', ['DISCIPLINE', 'CLOSING'],
    'Je zette na elk gesprek direct de volgende stap in je agenda. Twee klanten reageerden sneller omdat de afspraak al stond.',
    'Elke afspraak eindigde met een vervolgmoment in de agenda.\nTwee klanten reageerden sneller dan eerder.',
    'Sinds ik na elk gesprek de vervolgstap direct inplan, reageren klanten sneller.',
    'Je haalt de ruimte weg waarin een deal kan wegzakken. Het is geen trucje, het is structuur. Blijf het bij elk gesprek doen, ook als het gesprek goed voelt.'),
  S('alira', '2026-09-30', 7, 'Cross-sell bij de gesloten klant', ['KLANTRELATIE', 'PROSPECTING'],
    'Je overwoog bij de klant van de lang openstaande deal een tweede module voor te stellen. Je wilde eerst de implementatie laten landen.',
    'De klant is net live gegaan.\nJe zag een kans voor een tweede module.',
    'De klant waar ik drie maanden op zat is live. Ik zie een kans voor een tweede module, maar wil niet te vroeg beginnen.',
    'Wacht tot de klant zelf iets zegt over resultaat. Vraag eerst wat de implementatie al oplevert, dan komt de vraag voor de tweede module vanzelf uit hun woorden.'),
  S('alira', '2026-10-02', 5, 'Review overgeslagen, wat gebeurde er', ['DISCIPLINE', 'MINDSET'],
    'Je sloeg de vrijdagse review een keer over omdat er klantwerk tussen kwam. Je zag zelf direct dat je daarna minder overzicht had.',
    'Eén review is blijven liggen.\nJe merkte direct het verschil in overzicht.',
    'Ik heb de review van afgelopen vrijdag overgeslagen. Ik voelde meteen dat ik de draad kwijt was.',
    'Nu weet je wat het je oplevert. Zet de review voortaan als een afspraak met jezelf in je agenda, niet als iets dat je erbij doet. Dan hoef je er niet voor te kiezen.'),

  // Lisa: prijsgesprekken vanuit waarde
  S('lisa', '2026-09-08', 6, 'Prijsgesprek voorbereiden vanuit wat de klant wil', ['BEZWAARHANTERING', 'ONDERHANDELING'],
    'Je bereidde een prijsgesprek voor door op te schrijven wat de klant in het eerste gesprek wilde bereiken. Daaruit haalde je drie punten om op terug te komen.',
    'Je schreef de oorspronkelijke doelstelling van de klant uit.\nJe koos drie punten voor het prijsgesprek.',
    'Ik heb uitgeschreven wat de klant in het eerste gesprek wilde bereiken en daar mijn prijsgesprek op gebouwd.',
    'Dat geeft je een eerlijk anker. Als de klant over prijs begint, breng je het gesprek terug naar wat hij zelf wilde bereiken en laat je hem de waarde benoemen.'),
  S('lisa', '2026-09-15', 7, 'Klant vraagt tien procent korting', ['ONDERHANDELING', 'BEZWAARHANTERING'],
    'De klant vroeg tien procent korting. Je aarzelde even maar bracht het gesprek terug naar de waarde die hij zelf had genoemd.',
    'De klant vroeg om tien procent korting.\nJe verwees naar zijn eigen doelstelling.',
    'De klant vraagt tien procent korting. Ik ben begonnen over wat hij in het begin wilde bereiken.',
    'Goed dat je dat doet voordat je over het bedrag praat. Vraag hem nu wat het hem kost als hij dat doel niet haalt. Dan ligt de vergelijking niet bij de korting maar bij de uitkomst.'),
  S('lisa', '2026-09-22', 5, 'Waarde terugbrengen naar de eerste doelstelling', ['DEALSTRATEGIE', 'KLANTRELATIE'],
    'Je verwerkte de reactie van de klant op je waardeverhaal. Hij gaf toe dat de korting minder belangrijk was dan hij eerst dacht.',
    'De klant liet de kortingsvraag los.\nHij kwam zelf met een nieuwe vraag over de planning.',
    'Na mijn waardeverhaal liet hij de korting los en begon over de planning.',
    'Dat is het signaal dat het gesprek verschoof van prijs naar uitvoering. Pak die planningsvraag direct op en maak er een concrete afspraak van.'),
  S('lisa', '2026-09-29', 8, 'Deal gesloten zonder korting', ['CLOSING', 'ONDERHANDELING'],
    'De deal is gesloten zonder korting. Je hield je aan je eigen aanpak en liet de klant zijn eigen waarde benoemen.',
    'De deal is zonder korting gesloten.\nDe klant noemde zelf de reden om te tekenen.',
    'Deal binnen, zonder korting. De klant zei zelf waarom hij tekende.',
    'Dat is de bevestiging dat je werkwijze klopt. Schrijf op wat je deze keer anders deed dan bij eerdere prijsgesprekken, dan kun je het herhalen als het weer spannend wordt.'),
  S('lisa', '2026-10-05', 5, 'Loslaten-lijst bijwerken', ['PIJPLIJNBEHEER', 'DISCIPLINE'],
    'Je liep je deals langs en werkte je lijst met deals om los te laten bij. Twee nieuwe deals gingen naar duwen, één naar loslaten.',
    'Je werkte de lijst met duwen, wachten en loslaten bij.\nEén deal ging naar loslaten.',
    'Ik heb mijn lijst weer bijgewerkt. Twee deals naar duwen en één naar loslaten.',
    'Houd de lijst bij elke nieuwe deal bij, niet alleen als de pipeline vol zit. Dan blijft het een gewoonte en geen opruimactie.'),

  // test@arno.bot zelf (eigen historie, naast de twee echte sessies van 8 en 15 september)
  S('me', '2026-06-23', 6, 'Eerste gesprek met een CEO die groei zoekt', ['PROSPECTING'],
    'Je bereidde een eerste gesprek voor met een CEO die snel wil groeien. Je koos ervoor om met zijn groeidoel te openen in plaats van met je product.',
    'De CEO wil dit jaar verdubbelen.\nJe opent met zijn doel, niet met je product.',
    'Ik heb een eerste gesprek met een CEO die wil verdubbelen. Hoe open ik?',
    'Begin met zijn doel en vraag wat er nu in de weg zit. Een CEO die groeit heeft geen behoefte aan een productpresentatie, wel aan iemand die zijn knelpunt snapt.'),
  S('me', '2026-07-07', 5, 'Offerte verstuurd, klant reageert niet', ['PIJPLIJNBEHEER', 'DEALSTRATEGIE'],
    'Je stuurde een offerte en hoorde twee weken niets. Je zocht een manier om opnieuw contact te leggen zonder te duwen.',
    'De offerte is verstuurd.\nEr is twee weken geen reactie.',
    'Ik heb een offerte gestuurd en hoor niets. Wat doe ik?',
    'Stuur iets dat de klant helpt bij zijn eigen intern overleg, zoals een korte samenvatting voor zijn collega\'s. Dat is voor hem makkelijker te beantwoorden dan een vraag naar de stand van zaken.'),
  S('me', '2026-07-21', 7, 'Prijsbezwaar bij software voor de groeifase', ['BEZWAARHANTERING'],
    'Een klant in de groeifase vond de prijs hoog ten opzichte van zijn huidige budget. Je zocht naar een manier om de waarde aan zijn groeitempo te koppelen.',
    'Het budget is gebaseerd op de huidige omvang.\nDe klant verwacht snelle groei.',
    'De klant vindt het te duur voor zijn huidige omvang. Hij groeit wel hard.',
    'Rekenen op de omvang van nu is rekenen met een getal dat al verouderd is. Laat hem uitrekenen wat de oplossing kost bij de omvang die hij over een jaar verwacht.'),
  S('me', '2026-08-04', 8, 'Beslisser in kaart brengen bij een enterprise-lead', ['DEALSTRATEGIE'],
    'Je zocht uit wie bij een enterprise-lead de echte beslisser is. Je vroeg de contactpersoon wie er nog meer moet instemmen.',
    'De contactpersoon kan zelf niet tekenen.\nEr zijn nog twee anderen betrokken.',
    'Mijn contactpersoon kan zelf niet tekenen. Hoe breng ik de rest in beeld?',
    'Vraag hem hoe een besluit als dit normaal gaat en wie er nog meer meekijkt. Mensen vertellen graag hoe hun eigen organisatie werkt als je er oprecht naar vraagt.'),
  S('me', '2026-08-18', 6, 'Deal van vijfentwintigduizend bijna rond', ['CLOSING'],
    'Een deal van vijfentwintigduizend lag bijna rond, maar de klant bleef twijfelen over het moment van starten. Je koos ervoor om het risico van uitstel op tafel te leggen.',
    'De klant twijfelt over de startdatum.\nJe bespreekt wat uitstel hem kost.',
    'De deal is bijna rond maar hij blijft twijfelen over de startdatum.',
    'Vraag wat hem er nu van weerhoudt en wat uitstel hem kost. Soms is twijfel over de datum eigenlijk twijfel over iets anders. Dan helpt het om het te benoemen.'),
  S('me', '2026-09-01', 5, 'Klantrelatie herstellen na een gemiste afspraak', ['KLANTRELATIE'],
    'Je miste een afspraak met een belangrijke klant en zocht een manier om het eerlijk te herstellen zonder het groter te maken dan het is.',
    'De afspraak is niet doorgegaan.\nJe wilt de relatie niet beschadigen.',
    'Ik heb een afspraak met een belangrijke klant gemist. Hoe herstel ik dat?',
    'Benoem het kort, erken de impact en bied een concrete nieuwe afspraak aan. Geen lange verklaring, die maakt het zwaarder. Eén zin erkenning en dan door.'),
  S('me', '2026-09-22', 6, 'Pipeline opschonen', ['PIJPLIJNBEHEER', 'DISCIPLINE'],
    'Je liep je pipeline langs en haalde deals eruit die al maanden stilstonden. Je merkte dat het opschonen je meer helderheid gaf dan verwacht.',
    'Zeven deals stonden langer dan drie maanden stil.\nVier daarvan zijn losgelaten.',
    'Ik heb mijn pipeline opgeschoond. Zeven deals stonden stil, vier heb ik eruit gehaald.',
    'Een pipeline met stilstaande deals vertelt je niets meer. Nu zie je waar je werkelijk staat. Kijk bij de drie die blijven wat de eerstvolgende stap is.'),
  S('me', '2026-09-29', 7, 'Onderhandelen met een CFO over looptijd', ['ONDERHANDELING'],
    'Een CFO wilde een kortere looptijd tegen dezelfde prijs. Je zocht een voorstel dat zijn risico verkleint zonder je marge weg te geven.',
    'De CFO wil een kortere looptijd.\nHij wil dezelfde prijs.',
    'De CFO wil een kortere looptijd tegen dezelfde prijs. Hoe ga ik hiermee om?',
    'Vraag wat hij probeert te beperken. Meestal is het risico, niet de duur. Je kunt dan een opzegmogelijkheid aanbieden tegen een duidelijk tarief in plaats van de looptijd te korten.'),
  S('me', '2026-10-02', 6, 'Sparren over een stroef gesprek met een CEO', ['MINDSET', 'DEALSTRATEGIE'],
    'Je bespreekt een gesprek met een CEO dat stroef verliep. Je merkte dat je sneller ging praten naarmate hij stiller werd.',
    'De CEO werd stiller naarmate je meer praatte.\nJe herkende het patroon achteraf.',
    'Het gesprek met de CEO liep stroef. Hoe stiller hij werd, hoe meer ik ging praten.',
    'Dat is een klassiek patroon. Probeer bij de volgende keer na je vraag drie seconden te zwijgen. De stilte is niet van jou om op te vullen.'),
]

// ── 1:1-LOGS (manager = test@arno.bot) ────────────────────────────────────────────────────
const ONE_ON_ONES = [
  { who: 'benny', date: '2026-09-22', m: 5, s: 5, a: 4,
    goed: 'Je liet een stilliggend traject los en stuurde een korte, nuttige update. De klant reageerde binnen twee dagen.',
    aandacht: 'Het werkte omdat het traject niet kritiek was. Bij een deal met druk is de neiging om te duwen nog altijd sterker.',
    advies: 'Pak het eerstvolgende traject waar je ongeduldig van wordt en benoem tegen jezelf wat je voelt voordat je iets doet. Zo leer je het patroon herkennen.' },
  { who: 'benny', date: '2026-10-02', m: 4, s: 5, a: 5,
    goed: 'De offertefase liep in tien dagen door. De beslisser zat vanaf gesprek twee aan tafel, precies zoals we hadden afgesproken.',
    aandacht: 'Je ongeduld is nog zichtbaar bij nieuwe trajecten, ook al herken je het steeds sneller.',
    advies: 'Noteer bij elk nieuw traject één keer wat je voelt als het stilvalt. Na een aantal keer zie je wanneer het opkomt en kun je kiezen wat je ermee doet.' },
  { who: 'alira', date: '2026-09-22', m: 4, s: 3, a: 4,
    goed: 'Je hebt twee vrijdagse reviews gedaan en drie deals gevonden zonder vervolgstap. Twee heb je opgepakt, één bewust losgelaten.',
    aandacht: 'Het systeem draait nog op jouw discipline en niet op een vaste plek in je agenda.',
    advies: 'Zet de vrijdagse review als terugkerende afspraak in je agenda met een vaste start en eindtijd. Dan hoef je er niet elke week opnieuw voor te kiezen.' },
  { who: 'alira', date: '2026-10-02', m: 4, s: 4, a: 4,
    goed: 'Je plant na elk gesprek direct de vervolgstap in en klanten reageren daardoor sneller. Je pipeline voelt overzichtelijker.',
    aandacht: 'Eén review is blijven liggen toen er klantwerk tussen kwam. Je merkte zelf direct het verschil.',
    advies: 'Beschouw de review als een vaste afspraak met jezelf. Verplaats hem alleen naar een ander moment in plaats van hem over te slaan.' },
  { who: 'lisa', date: '2026-09-22', m: 5, s: 4, a: 5,
    goed: 'Je brengt prijsgesprekken terug naar wat de klant zelf wilde bereiken. De klant liet de kortingsvraag los en begon over de planning.',
    aandacht: 'Je aarzelt nog even bij de eerste kortingsvraag voordat je het gesprek terugbrengt naar de waarde.',
    advies: 'Bereid één zin voor die je gebruikt zodra de klant over korting begint. Dan hoef je er op dat moment niet over na te denken.' },
  { who: 'lisa', date: '2026-10-02', m: 5, s: 5, a: 5,
    goed: 'De deal is zonder korting gesloten en de klant noemde zelf de reden om te tekenen. Dat is precies de aanpak waar we naartoe werkten.',
    aandacht: 'Je lijst met deals om los te laten loopt het risico achterop te raken zodra je pipeline weer groeit.',
    advies: 'Werk de lijst met duwen, wachten en loslaten bij elke nieuwe deal bij, niet alleen op een rustig moment. Dan blijft het een gewoonte.' },
]

const buildAgenda = (o) =>
  `WAT GAAT GOED\n\n${o.goed}\n\nAANDACHTSPUNT\n\n${o.aandacht}\n\nARNO ADVISEERT\n\n${o.advies}`

// ── SCORES ───────────────────────────────────────────────────────────────────────────────
const SCORES = [
  ['benny', '2026-09-21', 5, 5, 4], ['benny', '2026-10-05', 4, 5, 5],
  ['alira', '2026-09-21', 4, 3, 4], ['alira', '2026-10-05', 4, 4, 4],
  ['lisa', '2026-09-21', 5, 4, 5], ['lisa', '2026-10-05', 5, 5, 5],
  ['me', '2026-06-22', 3, 2, 3], ['me', '2026-07-20', 3, 3, 4], ['me', '2026-08-17', 4, 3, 4],
  ['me', '2026-09-14', 5, 4, 4], ['me', '2026-10-05', 4, 4, 4],
]

// ── COACHINGPROFIELEN (alleen leden) ────────────────────────────
const COACHING = {
  benny: {
    updated_at: at('2026-10-02', '12:20'), mindset_score: 4, systeem_score: 5, actie_score: 5,
    voortgang: 'De offertefase liep in tien dagen zonder duwen, met de beslisser vanaf gesprek twee aan tafel. Je herkent je ongeduld nu vooraf en kiest bewust een kleinere stap. Volgende laag: dit volhouden bij een deal met druk.',
    mindset_diagnose: 'Doelgericht en steeds beter in staat het eigen ongeduld te herkennen voordat het gedrag stuurt. Nog niet bewezen onder druk.',
    systeem_diagnose: 'Beslissers worden standaard vroeg in kaart gebracht en de offertefase verloopt voorspelbaar.',
    actie_diagnose: 'Proactief en resultaatgericht. Kiest steeds vaker voor een korte, waardevolle update in plaats van te duwen.',
  },
  alira: {
    updated_at: at('2026-10-02', '15:05'), mindset_score: 4, systeem_score: 4, actie_score: 4,
    voortgang: 'Je vrijdagse pipeline-review geeft je overzicht en je plant na elk gesprek direct de vervolgstap in. Eén review viel weg en je merkte meteen het verschil. Volgende laag: de review vastleggen als vaste afspraak.',
    mindset_diagnose: 'Gemotiveerd en nuchter over eigen patronen. Ziet zelf wat het oplevert als de structuur even wegvalt.',
    systeem_diagnose: 'De pipeline-review en het inplannen van vervolgstappen brengen structuur. Het systeem hangt nog op discipline, nog niet op een vaste plek in de agenda.',
    actie_diagnose: 'Sterk in het openen van gesprekken en inmiddels ook in het concreet afspreken van vervolgstappen.',
  },
  lisa: {
    updated_at: at('2026-10-02', '10:40'), mindset_score: 5, systeem_score: 5, actie_score: 5,
    voortgang: 'Je sloot een deal zonder korting door het gesprek terug te brengen naar wat de klant zelf wilde bereiken. Je houdt je lijst met duwen, wachten en loslaten bij. Volgende laag: dit blijven doen als je pipeline weer groeit.',
    mindset_diagnose: 'Sterk mentaal. Gebruikt afwijzing en twijfel als informatie en laat zich niet door een kortingsvraag van de wijs brengen.',
    systeem_diagnose: 'Pipeline bewust geprioriteerd en bijgehouden. Kan de discipline verliezen als het druk wordt.',
    actie_diagnose: 'Hoge executiekracht. Brengt het gesprek consequent terug naar de waarde die de klant zelf noemde.',
  },
  // test@arno.bot ontbreekt hier bewust: zijn coachingrapport wordt live gegenereerd (en staat in
  // de history). Een seed die dat overschrijft vernietigt echt werk, dat is al een keer gebeurd.

}

// ── ANALYSES (1 per lid eind september, test@arno.bot 2) ──────────────────────────────────
const ANALYSES = [
  { who: 'benny', date: '2026-09-30', text:
`STERKE PUNTEN
Benny brengt beslissers nu vroeg in kaart en laat een traject niet meer zomaar liggen. In de laatste weken koos hij steeds vaker voor een korte, nuttige update in plaats van te duwen, en de offertefase liep in tien dagen door.

GROEIKANS
Zijn ongeduld is nog zichtbaar bij nieuwe trajecten. Hij herkent het steeds sneller, maar het is nog niet bewezen bij een deal waar echt druk op staat.

COACHING FOCUS
Oefen bij een traject met druk het moment tussen de neiging en de handeling. Eén korte notitie van wat hij voelt helpt om het patroon te zien en er bewust mee om te gaan.` },
  { who: 'alira', date: '2026-09-30', text:
`STERKE PUNTEN
Alira heeft een vaste pipeline-review ingevoerd en plant na elk gesprek direct de vervolgstap. Klanten reageren daardoor sneller en haar overzicht is zichtbaar beter.

GROEIKANS
Het systeem hangt nog op haar eigen discipline. Als er klantwerk tussen komt, valt de review weg en verliest ze direct overzicht.

COACHING FOCUS
Leg de review vast als terugkerende afspraak met een vaste start en eindtijd, zodat hij niet elke week opnieuw een keuze hoeft te zijn.` },
  { who: 'lisa', date: '2026-09-30', text:
`STERKE PUNTEN
Lisa brengt prijsgesprekken consequent terug naar wat de klant zelf wilde bereiken. De laatste deal sloot ze zonder korting en de klant benoemde zelf de reden om te tekenen.

GROEIKANS
Bij de eerste kortingsvraag aarzelt ze nog even voordat ze het gesprek terugbrengt naar de waarde. Haar lijst met duwen, wachten en loslaten moet blijven meegroeien met haar pipeline.

COACHING FOCUS
Bereid één vaste zin voor op het moment dat een klant over korting begint, zodat de aanpak ook onder druk automatisch gaat.` },
  { who: 'me', date: '2026-07-24', text:
`STERKE PUNTEN
Je opent gesprekken met het doel van de ander in plaats van met je product, en je zoekt bij een bezwaar naar wat erachter zit. Dat geeft je gesprekken vaker richting.

GROEIKANS
Je pipeline mist nog een vast ritme. Offertes blijven soms liggen zonder duidelijk vervolg, waardoor deals wegzakken.

COACHING FOCUS
Zet na elke offerte direct een vervolgmoment vast, voordat je het gesprek afsluit.` },
  { who: 'me', date: '2026-10-02', text:
`STERKE PUNTEN
Je schoonde je pipeline op en liet stilstaande deals bewust los. Bij een CFO zocht je een voorstel dat zijn risico verkleint zonder je marge weg te geven, wat laat zien dat je verder kijkt dan de prijs.

GROEIKANS
In gesprekken met stille beslissers vul je de stilte nog op met meer praten. Daardoor krijg je minder informatie dan je zou kunnen.

COACHING FOCUS
Laat na een belangrijke vraag een stilte vallen en wacht het antwoord af voordat je verder gaat.` },
]

// ─────────────────────────────────────────────────────────────────────────────────────────
async function run() {
  const counts = { sessies: 0, rds: 0, scores: 0, oneOnOne: 0, coaching: 0, analyses: 0 }
  const idsByWho = {}

  // Opruimen: rijen van een eerdere versie van dit script die inmiddels op andere datums staan.
  const GEEN_SESSIES = ['benny-2026-10-03', 'lisa-2026-10-04', 'me-2026-10-03', 'alira-2026-09-09', 'alira-2026-09-16', 'alira-2026-09-23']
  for (const k of GEEN_SESSIES) {
    const who = k.split('-')[0]
    await supabase.from('arnobot_blog_sessions').delete().eq('user_id', MEMBER[who]).eq('session_id', `seed-okt-${k}`)
    await supabase.from('arnobot_rds_logs').delete().eq('user_id', MEMBER[who]).eq('session_id', `seed-okt-${k}`)
  }
  await supabase.from('arnobot_coaching_scores').delete().eq('user_id', ME).eq('created_at', at('2026-10-04'))
  await supabase.from('arnobot_analyses').delete().eq('user_id', ME).in('created_at', [at('2026-09-26', '09:00'), at('2026-09-25', '09:00'), at('2026-09-25', '17:00')])
  for (const who of ['benny', 'alira', 'lisa']) await supabase.from('arnobot_analyses').delete().eq('user_id', MEMBER[who]).eq('created_at', at('2026-09-30', '09:00'))
  await supabase.from('arnobot_analyses').delete().eq('user_id', ME).eq('created_at', at('2026-07-24', '09:00'))

  // 1. sessies + gesprekslog
  for (const s of SESSIONS) {
    const user_id = MEMBER[s.who]
    const session_id = `seed-okt-${s.who}-${s.date}`
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

  // 3. 1:1-logs
  for (const o of ONE_ON_ONES) {
    const created_at = at(o.date, '09:00')
    const member_id = MEMBER[o.who]
    await supabase.from('arnobot_1on1_log').delete().eq('manager_id', ME).eq('member_id', member_id).eq('created_at', created_at)
    const { error } = await supabase.from('arnobot_1on1_log').insert({
      manager_id: ME, member_id, team_id: TEAM_ID, created_at,
      mindset_score: o.m, systeem_score: o.s, actie_score: o.a,
      aandachtspunt: o.aandacht, agenda: buildAgenda(o),
    })
    if (error) throw new Error(`1on1 ${o.who} ${o.date}: ${error.message}`)
    counts.oneOnOne++
  }

  // 4. coachingprofielen
  for (const [key, c] of Object.entries(COACHING)) {
    const user_id = MEMBER[key]
    const { data: bestaand } = await supabase.from('arnobot_coaching').select('id').eq('user_id', user_id).maybeSingle()
    const { error } = bestaand
      ? await supabase.from('arnobot_coaching').update(c).eq('user_id', user_id)
      : await supabase.from('arnobot_coaching').insert({ user_id, created_at: at('2026-07-20'), ...c })
    if (error) throw new Error(`coaching ${key}: ${error.message}`)
    counts.coaching++
  }

  // 5. analyses
  for (const a of ANALYSES) {
    const user_id = MEMBER[a.who]
    const created_at = at(a.date, a.time || '17:00')
    await supabase.from('arnobot_analyses').delete().eq('user_id', user_id).eq('created_at', created_at)
    // Alleen gesprekken van vóór de analyse zelf, anders verwijst de analyse naar de toekomst.
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
