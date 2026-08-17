# ArnoBot Sales Development

**Laatst bijgewerkt:** 2026-08-14
**Waar we staan:** Volledig geautomatiseerd. Een persoonlijke link per SDR (Stefanie/Anniek) zet bij aanmelding automatisch `command_manager=true`, geen handmatige stap meer van Arno nodig, geen wachttijd voor de prospect. Inclusief automatische attributie via de bestaande Telegram-melding. Beschrijft de sales-development-functie: sales teams bij andere bedrijven binnenhalen als ArnoBot-klant via outbound en een gratis 30-dagen team-trial. Commissiestructuur nu volledig vastgesteld, inclusief deel 2 (gedeeld aandeel in de rest van het bedrijf, met plafond en dezelfde stilte-regel) en het good-leave/bad-leave-onderscheid (2026-08-14), zie de sectie hieronder. **De stilte-regel zelf is diezelfde dag (2026-08-14) herzien:** niet langer een vaste "minimaal 1 aanmelding per 3 maanden"-ondergrens (bleek trivial haalbaar terwijl het tempo feitelijk instort), maar relatief aan iemands eigen persoonlijk record (hoogste 3-maandstotaal ooit), met een opstartperiode van 6 maanden en een bodemwaarde tegen ruis bij kleine aantallen, zie "Wat 'actief' betekent" in de commissiesectie hieronder. De interactieve rekentool, inmiddels hernoemd naar **"Agents Fee"** (was achtereenvolgens "Wat Je Verdient" en "Performance Fee"), is een echte, wachtwoordbeveiligde pagina op `arno.bot/agents`, geen los artifact meer, live en getest, één inlogscherm met zowel het SDR-wachtwoord als Arno's eigen adminwachtwoord, zie de sectie hieronder. De ArnoBot-weergave daarin (admin-only) is op 2026-08-14 in twee stappen herbouwd: eerst van "bedrijfsdeel over eigen klanten alleen" naar drie tegels (totale omzet, uitkering aan de agents, wat ArnoBot overhoudt) op bedrijfsbrede (verdubbelde) cijfers, daarna is de agent-persoonlijke content (top-kengetallen, beide agent-grafieken, detailtegels) uit die weergave gehaald en vervangen door één eigen bedrijfsgrafiek, zie de sectie hieronder. De rekenvoorbeeld-disclaimer onderaan de pagina is sindsdien ook alleen nog zichtbaar op de Sales Agent-weergave, niet meer op de ArnoBot-weergave. Voor de kickoff-pitch aan Stefanie en Anniek zelf (los van de commissieregeling hieronder): zie `docs/AGENTS_PITCH.md`, een NotebookLM-instructie plus uitgeschreven tekstblok over wat de rol hun persoonlijk, zakelijk en financieel oplevert. Een apart demoteam waarin Stefanie en Anniek zelf manager zijn (voor hun eigen rehearsal én als bron voor de pre-demo video) is bewust uitgesteld naar een later stadium, zie de sectie hieronder.
**Eerstvolgende stap:** Arno's eigen team aanmaken op `/bot/team` (nu mogelijk, `command_manager=true` staat sinds 2026-08-13 op zijn echte LinkedIn-account) en Stefanie en Anniek daarin uitnodigen als lid. De commissiestructuur met hen bespreken (zie "Hoe dit te communiceren" hieronder), en het wachtwoord voor `arno.bot/agents` met hen delen. Daarna: de sd-links delen met prospects. Alle benodigde env vars staan in Vercel (bevestigd, live getest 2026-08-14). `.env.local` is alleen nog nodig als lokaal getest moet worden, niet voor productiegebruik.

Dit document vervangt een eerdere, verkeerd geframede versie die uitging van het aannemen van verkopers om zelf voor Arno te werken. Het gaat om iets anders: een verkoopfunctie die actief sales teams bij bedrijven benadert om ze op ArnoBot aan te sluiten.

---

## Wat dit is

Sales development: actief, outbound sales teams bij andere bedrijven (typisch geleid door een salesbaas of commercieel directeur) benaderen, met als doel ze op ArnoBot Team te krijgen. Het middel: een gratis team-trial, geen koud verkoopgesprek over prijs.

**Rolbezetting:** Stefanie en Anniek.

**Wat ze ook zelf doen:** naast het verkopen ervan gebruiken ze ArnoBot ook zelf, dat versterkt hun eigen verkoopgesprek, ze pitchen vanuit ervaring, niet vanuit een script. Zie "Waarom dit ook voor Stefanie en Anniek zelf werkt" verderop.

---

## Het aanbod: gratis 30-dagen team-trial

- **Duur: 30 dagen** (besloten 2026-08-13, consistent met de bestaande individuele Basic/Pro-trial, makkelijker te communiceren dan een afwijkende termijn).
- **Doel:** conversie naar een betaald Team-abonnement na de trial, niet trial-om-de-trial.
- Prijslogica voor het gesprek ná de trial: zie `docs/SALES_BIJBEL.md`, sectie "De kernbelofte" en de Team-tarieven in `docs/PRICING_DECISIONS.md`.

---

## Praktisch: hoe een trial wordt geactiveerd

**Volledig geautomatiseerd (gebouwd 2026-08-13).** Eerdere versies van dit document beschreven eerst een handmatige Supabase-bewerking, daarna een handmatige klik door Arno. Beide klopten niet meer: Arno wilde geen enkele leemte tussen aanmelden en teamleden uitnodigen, dus is er een persoonlijke link per SDR gebouwd die dit automatisch regelt.

**De links (niet delen buiten Stefanie/Anniek, functioneren als een wachtwoord):**
- Stefanie: `https://arno.bot/aanmelden?sd=e53a3dfd5ab974b85baea67d6c6b1f1e`
- Anniek: `https://arno.bot/aanmelden?sd=36aabe733fc2e17baab60325dcbca996`

**Hoe het werkt:**
1. Stefanie of Anniek stuurt haar eigen link naar een prospect (in een outbound-mail, LinkedIn-bericht, etc.).
2. De prospect klikt de link (zet een cookie, stuurt door naar de gewone inlogpagina) en meldt zich aan zoals elke andere gebruiker.
3. Bij het aanmaken van het account herkent het systeem de cookie en zet `command_manager=true` meteen mee, in dezelfde stap, geen aparte handeling van wie dan ook nodig.
4. Arno krijgt de gebruikelijke Telegram-melding van een nieuwe gebruiker, nu met erbij vermeld via wie (Stefanie of Anniek) deze binnenkwam, dat geeft meteen ook attributie/tracking zonder dat daar apart iets voor gebouwd hoefde te worden.
5. De manager kan direct door naar `/bot/team`, team aanmaken, teamleden uitnodigen (`/bot/team/join`, elk lid krijgt automatisch Pro-niveau). Geen wachttijd, geen tussenstap.
6. Na 30 dagen: gesprek over conversie naar een echte betaalde Team-deal. Dát traject blijft wél volledig handmatig (`plan='team'`, facturatie, zie `docs/ABONNEMENTEN.md`, sectie "Team-aanvraagflow"), maar dat gebeurt pas bij een daadwerkelijke aankoop, niet tijdens de trial zelf.

**Beveiliging:** de tokens in de links zijn lange, willekeurige strings (niet een simpele naam of code), zodat ze niet te raden zijn. Alleen wie de link letterlijk heeft, kan 'm gebruiken. Serverside opgeslagen als de environment-variabelen `SD_TOKEN_STEFANIE`/`SD_TOKEN_ANNIEK`, moeten in zowel `.env.local` als Vercel gezet worden vóórdat dit in productie werkt.

**Status:** env vars staan al in Vercel (bevestigd door Arno, 2026-08-13), dit werkt dus al in productie.

---

## Het verkoopverhaal zelf

Niet hier dupliceren. Voor het daadwerkelijke gesprek met een prospect: `docs/SALES_BIJBEL.md`, met name de sectie "De kernbelofte" (wat een manager, hoe goed ook, structureel nooit alleen kan) als opening, en de USP-lijst daaronder als onderbouwing.

---

## Waarom dit ook voor Stefanie en Anniek zelf werkt

Ze zijn niet alleen verkoper van dit product, ze zijn ook zelf gebruiker ervan. Dat is een authenticiteit die geen andere sales-rol biedt:

- **Ze pitchen vanuit eigen ervaring**, niet vanuit een script. Een prospect voelt het verschil tussen "ik heb dit bestudeerd" en "ik gebruik dit zelf".
- **Het maakt hen zelf beter**, los van deze functie: 24/7 sparring, accountability-tracking, een eigen coachingsdiagnose.
- **Het is makkelijker te verkopen dan een gemiddeld product.** De kernbelofte in de Sales Bijbel is een sterk verhaal met weinig prijsweerstand, dat betekent voor hen concreet minder tijd kwijt aan bezwaren pareren.
- **Ze maken zelf een echt teamlidmaatschap mee, niet alleen een demo.** Sinds 2026-08-13 staat `command_manager=true` op Arno's eigen account (zelfde mechanisme als bij elke andere manager), zodat hij zelf een team kan aanmaken en Stefanie en Anniek als lid kan uitnodigen. **Nog niet uitgevoerd**, Arno moet dat team nog daadwerkelijk aanmaken via `/bot/team`.

### Managerervaring voor Stefanie en Anniek (bewust uitgesteld)

Lidmaatschap alleen laat zien hoe het is om gecoacht te worden, niet hoe het is om zelf manager te zijn, en juist dát verkopen ze aan een prospect. Besloten (2026-08-13, Arno): een apart, klein demoteam voor Stefanie en Anniek samen, met een paar fake teamleden met realistische activiteit (zelfde recept als "Team Hippios"), waarin beiden manager zijn en dus een echt gevuld managerdashboard zien. Uitgesteld naar een later stadium, geen huidige actie.

**Technische reden voor een apart team, niet gecombineerd met bovenstaand lidmaatschap:** iemand kan maar in één team tegelijk zitten (`/api/bot/team/create` en `/team/join` blokkeren allebei expliciet een tweede lidmaatschap). Manager zijn op hetzelfde kleine team als waar ze zelf lid van zijn levert bovendien een bijna leeg dashboard op, managers worden zelf uitgesloten van de ledenlijst die ze te zien krijgen.

Zie ook `docs/DEMO_VIDEO_SCRIPT.md`: het script voor de pre-demo video die Stefanie en Anniek naar een prospect sturen vóór het live gesprek, staat al klaar en wordt opgenomen zodra dit demoteam er is (opnemen tegen fake data, nooit tegen echte klantdata).

---

## Commissiestructuur (vastgesteld 2026-08-13, uitgebreid met deel 2 zelfde dag)

Bestaat uit twee delen: wat een SDR verdient over haar eigen aangebrachte klanten, en een gedeeld aandeel in de rest van het bedrijf.

### Deel 1: eigen aangebrachte klanten

**Fase 1, jaar 1 van een aangebrachte klant:** 40% van de gefactureerde omzet, vanaf de eerste betaalde factuur (dus na de gratis trial, niet vanaf het moment van aanmelden).

**Fase 2, jaar 2 en verder:** 20%, zolang de SDR actief blijft.

**Wat "actief" betekent (herzien 2026-08-14):** niet langer een vaste ondergrens zoals "minimaal 1 aanmelding per 3 maanden". Die test alleen of iemand niet volledig gestopt is, niet of iemand nog serieus werft, een SDR die precies elk kwartaal één deal binnenhaalt zou daarmee voor altijd op het volledige tarief blijven staan terwijl het tempo feitelijk is ingestort. In plaats daarvan relatief aan iemands eigen record:

- ArnoBot houdt per SDR de hoogste som van nieuwe aanmeldingen bij die ze ooit in 3 aaneengesloten maanden heeft gehaald, haar "persoonlijk record".
- Zodra dat record minstens 12 aanmeldingen in 3 maanden bedraagt (gelijk aan het uitgangstempo van 4 per maand in de rekentool), geldt de echte toets: zakt het lopende 3-maandstotaal onder 25% van dat persoonlijk record, dan is ze automatisch inactief.
- **Opstartperiode:** in de eerste 6 maanden is er nog geen betrouwbaar record om tegen af te zetten. Tot die tijd geldt de simpele ondergrens: minimaal 1 aanmelding in de lopende 3 maanden.
- **Bodemwaarde tegen ruis:** blijft iemands record onder de 12-in-3-maanden-drempel (dus nooit een sterke periode gehad), dan blijft ook daarna de simpele "niet nul"-toets gelden in plaats van de 25%-toets. Voorkomt een vals alarm bij kleine aantallen (bijvoorbeeld van 4 naar 1 in een kwartaal).
- Zelfde gevolg als voorheen zodra inactief: automatische terugval naar de 5%-uitloop hieronder. Geen beoordeling nodig, geen gesprek dat dit hoeft te bepalen.

**Verworpen: rollende vergelijking met alleen de 3 maanden ervoor** (in plaats van met het persoonlijk record). Bij een geleidelijke, stapsgewijze terugval (bijvoorbeeld 8 naar 6 naar 4 naar 3 naar 2 per maand) blijft elk kwartaal net onder de 25%-daling ten opzichte van het vorige kwartaal, waardoor de trigger nooit afgaat, ook al staat iemand na een jaar nog maar op een kwart van waar ze begon. Een vast persoonlijk record voorkomt dat de baseline meezakt met de eigen terugval.

**Fase 3, uitloop bij inactiviteit:** zodra een SDR inactief wordt, vallen alle klanten die op dat moment nog 40% of 20% opleverden automatisch terug naar 5%, met een maximum van één jaar per klant. Na dat jaar: 0% voor die klant.

**Good leave versus bad leave (toegevoegd 2026-08-14):** de fase-3-uitloop hierboven geldt bij een "good leave", het normale geval waarin een SDR stopt met werven zonder dat daar iets mis mee is. Bij een "bad leave" (bijvoorbeeld ernstig vertrouwensmisbruik) stopt alles per direct, geen 5%-uitloop, geen maximum-van-een-jaar-afbouw. Beoordeling hiervan is aan Arno, dezelfde discretionaire logica als de handmatige herbeoordeling hieronder, maar dan in de andere richting.

**Nieuwe klant tijdens inactiviteit:** brengt een inactieve SDR toch nog een nieuwe klant aan, dan levert die specifieke klant, vanaf zijn eerste factuur, 20% op voor één jaar (niet 40%, en dit maakt de SDR niet automatisch weer actief voor toekomstige klanten). Na dat jaar valt ook deze klant terug naar de 5%-uitloop, met zijn eigen maximum van één jaar vanaf dat moment, daarna 0%.

**Handmatige herbeoordeling:** laat een inactieve SDR weer een duidelijk patroon van regelmaat zien, dan kan Arno op eigen inzicht besluiten haar terug te zetten op de volledige actieve structuur (fase 1/fase 2). Geen automatische regel hiervoor, puur zijn eigen beoordeling.

**De link zelf:** blijft altijd bruikbaar, ook na volledige stopzetting van actieve inzet. Er is geen moment waarop een link technisch wordt gedeactiveerd, dat hoeft ook niet, het bepaalt alleen welke fase van toepassing is.

### Deel 2: gedeeld aandeel in de rest van het bedrijf

Naast hun eigen klanten krijgen Stefanie en Anniek ook een aandeel in alle overige nieuwe omzet van ArnoBot: Team- én Solo-klanten die via een ander kanaal binnenkomen dan hun eigen link, bijvoorbeeld organisch, via Arno zelf, of via andere marketingkanalen.

**Verdeling:** die totale "buiten hen om"-omzet wordt 50/50 verdeeld tussen Stefanie en Anniek. Elk krijgt daarover 40% commissie, dus feitelijk 20% van de totale buiten-hen-om-omzet per persoon, 40% van het totaal samen.

**Plafond:** iemands aandeel uit dit gedeelde deel kan nooit hoger zijn dan haar eigen commissiebedrag (dus ná toepassing van fase 1/2/3 hierboven, niet de ruwe klantomzet) over haar eigen aangebrachte klanten. Met andere woorden: maximaal een verdubbeling van wat ze al aan eigen commissie verdient, nooit meer. Geen eigen aanbreng, dan ook geen aanspraak op dit gedeelde deel.

**Zelfde stilte-regel geldt hier ook:** wordt een SDR inactief (zie "Wat 'actief' betekent" hierboven), dan valt ook haar aandeel in het gedeelde deel automatisch terug naar de 5%-uitloop (max één jaar), precies zoals bij haar eigen klanten. Bewuste keuze om niet twee verschillende afbouwmechanismen naast elkaar te hebben: één regel die overal geldt, in plaats van een aparte regel per onderdeel. Het good-leave/bad-leave-onderscheid hierboven geldt hier op dezelfde manier: bij een bad leave stopt ook het gedeelde deel per direct.

**Bewust niet apart meegerekend:** organische groei binnen een klant die een SDR zelf heeft aangebracht (bijvoorbeeld doordat de klant zelf seats toevoegt zonder actieve inzet van de SDR) telt niet mee in dit gedeelde deel en wordt niet apart berekend. Arno middelt dit in de praktijk tegen churn. Zou dit wel apart meegerekend worden, dan zou een SDR via het gedeelde deel meeprofiteren van klanten die haar collega aanbracht, wat niet de bedoeling is.

**Afbakening: precies twee personen (toegevoegd 2026-08-14).** Deze hele regeling (50/50-verdeling, plafond, stilte-regel) rekent met exact twee SDR's, Stefanie en Anniek. Zij kunnen onderling besluiten een derde persoon te betrekken en die uit hun eigen deel te betalen, dat is hun eigen interne afspraak. Arno en ArnoBot faciliteren, tracken of erkennen die derde persoon niet apart, de pool en het plafond blijven berekend alsof er twee personen zijn.

### Nog te bouwen voordat dit systeem daadwerkelijk toegepast kan worden

Een blijvend opgeslagen koppeling tussen een klant en de SDR die hem aanbracht. Staat nu alleen in een Telegram-melding, niet opvraagbaar of automatisch te controleren. Toevoegen zodra er een eerste deal is om op toe te passen, niet eerder, zie ook de eerdere afweging tegen een CRM-systeem hiervoor (te zwaar voor dit volume, een simpele kolom volstaat). Voor deel 2 is bovendien een manier nodig om de totale nieuwe omzet buiten Stefanie/Anniek om te meten, nog niet ontworpen.

---

## De "Agents Fee"-tool (`arno.bot/agents`)

Interactieve rekentool waarmee een SDR haar eigen scenario's kan verkennen: hoeveel klanten per maand, hoe groot, churn, groei in wervingstempo, en de solo-/teamomzet buiten de links om (in de tool "non-agent omzet" genoemd). Rekent live door met exact dezelfde formules als de commissiestructuur hierboven (per-cohort simulatie met churn en groei, het plafond, de 20%-per-persoon-pool). Heette tot 2026-08-14 achtereenvolgens "Wat Je Verdient" en "Performance Fee", uiteindelijk **Agents Fee** op zowel de loginpagina als de tool zelf.

**Toegang, gelaagd, één inlogscherm met twee mogelijke wachtwoorden:**
- Stefanie en Anniek loggen in met hun eigen wachtwoord (env var `SD_VERDIEN_PASSWORD`, wachtwoord "stefanniek"), zet de cookie `arnobot_sd_verdien`, zien alleen hun eigen scenario.
- Arno logt in op hetzelfde scherm met zijn eigen, al bestaande adminwachtwoord (`ARNOBOT_ADMIN_KEY`). De inlogroute herkent dat en zet in plaats daarvan de bestaande `arnobot_admin`-cookie, hetzelfde cookie als `/bot/admin` gebruikt. Daarmee is hij in één stap ook op de rest van het adminpaneel ingelogd, en krijgt hij op `/agents` automatisch de schakelaar "ArnoBot-weergave" te zien. Die schakelaar is voor Stefanie/Anniek onzichtbaar, niet alleen verborgen maar functioneel niet bereikbaar zonder het admin-wachtwoord. **Besloten (2026-08-14):** de eerdere opzet (eerst apart inloggen op `/bot/admin`, dan pas naar `/agents`) bleek in de praktijk te omslachtig, vandaar dit ene inlogscherm met twee wachtwoorden.
- **ArnoBot-weergave, inhoud (tweede iteratie, 2026-08-14):** gaat uit van twee symmetrische agents (Stefanie en Anniek, met exact dezelfde ingevulde cijfers). Toont drie getallen, voor de gemarkeerde maand en cumulatief over 5 jaar: de totale omzet (klantenboek van beide agents samen plus de gedeelde pool, die zelf al bedrijfsbreed is en niet verdubbelt), de uitkering aan de agents (hun gecombineerde eigen commissie plus hun gecombineerde, elk apart geplafonneerde aandeel uit de pool), en wat ArnoBot zelf overhoudt (het verschil). Daaronder één grafiek ("Omzet ArnoBot en afdracht agents, totaal") die dit over 60 maanden uitzet: gestapelde staaf van afdracht aan de agents plus wat ArnoBot overhoudt, met een cumulatieve lijn van de totale omzet.
- **Bewust géén dubbeling van de agent-persoonlijke content:** de eerste iteratie voegde de drie tegels alleen toe BOVEN de rest van de pagina, die verder ongewijzigd bleef, dus de twee agent-grafieken en de "Plus: jouw aandeel"-detailtegels bleven zichtbaar en op één-agent-cijfers staan, ook in ArnoBot-weergave. Gecorrigeerd: die hele agent-persoonlijke sectie (top-kengetallen, beide grafieken, detailtegels) is nu alleen zichtbaar in Sales Agent-weergave, vervangen door de ene bedrijfsgrafiek hierboven in ArnoBot-weergave. De twee invoervelden die daarvoor nog in die sectie stonden (Nieuwe Solo-omzet, Nieuwe Team-omzet) zijn verplaatst naar de altijd-zichtbare invoersectie bovenaan, zodat ze in beide weergaves bereikbaar blijven.
- Losstaand van `/bot` en `/bot/admin` qua route: geen Clerk-login nodig, eigen cookie-auth per pagina (`app/agents/page.tsx`).

**Status (2026-08-14):** live in productie, `SD_VERDIEN_PASSWORD` staat in Vercel, login en toegangsscheiding bevestigd werkend via een test op de live omgeving (niet alleen lokaal). Bij het instellen zijn per ongeluk kort de waardes van `SD_TOKEN_STEFANIE`/`SD_TOKEN_ANNIEK` overschreven (verward met dit nieuwe wachtwoord), hersteld naar de originele waardes, zie "De links" hierboven.

**Voorgeschiedenis:** begon als los Claude-artifact, maar een artifact heeft geen login en geen gedeelde state tussen pagina's. Toen bleek dat Stefanie/Anniek anders ook de geplande ArnoBot-alleen-weergave zouden zien, is het omgezet naar een echte pagina in de codebase, wat zowel de toegangsscheiding als de gedeelde berekening in één keer oploste.

---

## Hoe dit te communiceren aan Stefanie en Anniek

Spreektaal, geen intern jargon zoals "fase 1" of "SDR":

"Jullie krijgen 40 procent van wat een klant betaalt, in het eerste jaar. Blijft die klant daarna, dan krijgen jullie 20 procent, zolang jullie zelf actief blijven werven. Wat actief blijven precies inhoudt, lees je verderop.

Daarnaast krijgen jullie samen ook een deel van de rest van het bedrijf, dus ook van klanten die niet via jullie eigen link binnenkomen. Dat wordt eerlijk tussen jullie tweeën verdeeld, en jullie krijgen daar allebei 40 procent commissie over jullie eigen helft. Wel zit er een grens op: dat deel kan nooit meer zijn dan wat je al aan je eigen klanten verdient, dus hooguit een verdubbeling, nooit meer.

Actief blijven is niet een quotum, maar wel gerelateerd aan jullie eigen beste periode. Zodra jullie drie maanden achter elkaar structureel op minder dan een kwart van je eigen beste kwartaal ooit zit, gaat de vergoeding op alles wat er dan nog loopt, ook dat gedeelde deel, automatisch omlaag naar 5 procent, voor maximaal nog een jaar, daarna stopt het voor die klanten. In de eerste zes maanden geldt gewoon: zolang er af en toe iemand binnenkomt, blijft alles op de volledige regeling.

Jullie link blijft altijd werken, ook daarna. Breng je in die periode alsnog iemand nieuw aan, dan krijg je daar gewoon 20 procent van voor een jaar.

En als jullie op een gegeven moment weer regelmatig gaan werven, kijken we gewoon samen of dat weer terug kan naar de volledige regeling."

---

## Wat je niet moet beloven

- Geen kenmerken noemen die nog GEPLAND zijn in `docs/SALES_BIJBEL.md`, alleen LIVE.
- De commissiestructuur exact communiceren zoals hierboven vastgelegd, geen andere percentages, voorwaarden of garanties toezeggen.

---

## Nog toe te voegen

- Een lijst van doelbedrijven/wie ze actief gaan benaderen
- Beslissing of Stefanie/Anniek eigen adminpagina-toegang krijgen
- De kickoff-pitch uit `docs/AGENTS_PITCH.md` daadwerkelijk in NotebookLM invoeren, de gegenereerde presentatie beoordelen, en toetsen met Stefanie en Anniek zelf
