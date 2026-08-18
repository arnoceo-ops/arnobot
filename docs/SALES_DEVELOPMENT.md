# ArnoBot Sales Development

**Laatst bijgewerkt:** 2026-08-17
**Waar we staan:** Commissiestructuur volledig vastgesteld en bevestigd, inclusief deel 2, het good-leave/bad-leave-onderscheid, de herziene stilte-regel (relatief aan eigen record, niet meer een vaste ondergrens) en de leadroutering-regel voor leads buiten de links om (telt als Deel 1, tie-breaks bevestigd). Volledig geautomatiseerd voor leads die via een eigen link binnenkomen (`command_manager=true` én `sd_agent`/`sd_attribution_method` direct bij aanmelding). Voor leads buiten de links om: handmatige toewijzing via een dropdown op `/bot/admin/gebruikers` (`SdAgentSelect.tsx`, kolom "SD AGENT", vereenvoudigd naar Geen/Agent 1/Agent 2), attributie is dus voor beide routes nu persistent vastgelegd op `approved_users`. Enige nog bewust openstaande punt: de daadwerkelijke omzetmeting/uitbetaling wacht op de keuze van een payment provider, daarna ook een realtime dashboard per sales agent. Namen van de huidige kandidaten zijn uit dit document en de gerelateerde docs gehaald (besloten 2026-08-17), zie de naamgeving-notitie hieronder. De interactieve rekentool ("Agents Fee") is een echte, wachtwoordbeveiligde pagina op `arno.bot/agents`, zie de sectie hieronder. Voor de kickoff-pitch aan de sales agents zelf: zie `docs/AGENTS_PITCH.md`.
**Eerstvolgende stap:** Arno's eigen team aanmaken op `/bot/team` en de sales agents daarin uitnodigen als lid, de commissiestructuur met hen bespreken (zie "Hoe dit te communiceren" hieronder), en het wachtwoord voor `arno.bot/agents` met hen delen. Daarna: de sd-links delen met prospects. Attributie staat inmiddels live (zie "Attributie: gebouwd" hieronder), alleen de daadwerkelijke omzetmeting/uitbetaling wacht nog op de payment provider.

**Naamgeving in dit document (besloten 2026-08-17):** de twee rolbezetters worden hierin generiek "Sales Agent 1" en "Sales Agent 2" genoemd, niet bij hun echte naam, omdat de kandidaten kunnen wijzigen zonder dat de regeling zelf verandert. De echte, huidige namen staan uitsluitend in de operationele notitie bij "De links" hieronder, geïsoleerd van de rest van het document, zodat een kandidaatwissel alleen dat ene regeltje raakt.

Dit document vervangt een eerdere, verkeerd geframede versie die uitging van het aannemen van verkopers om zelf voor Arno te werken. Het gaat om iets anders: een verkoopfunctie die actief sales teams bij bedrijven benadert om ze op ArnoBot aan te sluiten.

---

## Wat dit is

Sales development: actief, outbound sales teams bij andere bedrijven (typisch geleid door een salesbaas of commercieel directeur) benaderen, met als doel ze op ArnoBot Team te krijgen. Het middel: een gratis team-trial, geen koud verkoopgesprek over prijs.

**Rolbezetting:** twee sales agents, hierin Sales Agent 1 en Sales Agent 2 genoemd.

**Wat ze ook zelf doen:** naast het verkopen ervan gebruiken ze ArnoBot ook zelf, dat versterkt hun eigen verkoopgesprek, ze pitchen vanuit ervaring, niet vanuit een script. Zie "Waarom dit ook voor de sales agents zelf werkt" verderop.

---

## Het aanbod: gratis 30-dagen team-trial

- **Duur: 30 dagen** (besloten 2026-08-13, consistent met de bestaande individuele Basic/Pro-trial, makkelijker te communiceren dan een afwijkende termijn).
- **Doel:** conversie naar een betaald Team-abonnement na de trial, niet trial-om-de-trial.
- Prijslogica voor het gesprek ná de trial: zie `docs/SALES_BIJBEL.md`, sectie "De kernbelofte" en de Team-tarieven in `docs/PRICING_DECISIONS.md`.

---

## Praktisch: hoe een trial wordt geactiveerd

**Twee routes: via een eigen link (volledig geautomatiseerd), of buiten de links om (handmatige routering, zie de aparte sectie verderop).**

**Route 1, via een eigen link (gebouwd 2026-08-13).** Eerdere versies van dit document beschreven eerst een handmatige Supabase-bewerking, daarna een handmatige klik door Arno. Beide klopten niet meer: Arno wilde geen enkele leemte tussen aanmelden en teamleden uitnodigen, dus is er een persoonlijke link per sales agent gebouwd die dit automatisch regelt.

**De links (niet delen buiten de twee sales agents zelf, functioneren als een wachtwoord):**
- Link Sales Agent 1: `https://arno.bot/aanmelden?sd=e53a3dfd5ab974b85baea67d6c6b1f1e`
- Link Sales Agent 2: `https://arno.bot/aanmelden?sd=36aabe733fc2e17baab60325dcbca996`

*Huidige bezetting (operationeel, apart van de regeling zelf): Sales Agent 1 = Stefanie, Sales Agent 2 = Anniek. Bij een kandidaatwissel alleen deze regel aanpassen, en de bijbehorende link/env var opnieuw uitgeven aan de nieuwe kandidaat.*

**Hoe het werkt:**
1. De sales agent stuurt haar eigen link naar een prospect (in een outbound-mail, LinkedIn-bericht, etc.).
2. De prospect klikt de link (zet een cookie, stuurt door naar de gewone inlogpagina) en meldt zich aan zoals elke andere gebruiker.
3. Bij het aanmaken van het account herkent het systeem de cookie en zet `command_manager=true` meteen mee, in dezelfde stap, geen aparte handeling van wie dan ook nodig.
4. Arno krijgt de gebruikelijke Telegram-melding van een nieuwe gebruiker, nu met erbij vermeld via welke sales agent deze binnenkwam, dat geeft meteen ook attributie/tracking zonder dat daar apart iets voor gebouwd hoefde te worden.
5. De manager kan direct door naar `/bot/team`, team aanmaken, teamleden uitnodigen (`/bot/team/join`, elk lid krijgt automatisch Pro-niveau). Geen wachttijd, geen tussenstap.
6. Na 30 dagen: gesprek over conversie naar een echte betaalde Team-deal. Dát traject blijft wél volledig handmatig (`plan='team'`, facturatie, zie `docs/ABONNEMENTEN.md`, sectie "Team-aanvraagflow"), maar dat gebeurt pas bij een daadwerkelijke aankoop, niet tijdens de trial zelf.

**Beveiliging:** de tokens in de links zijn lange, willekeurige strings (niet een simpele naam of code), zodat ze niet te raden zijn. Alleen wie de link letterlijk heeft, kan 'm gebruiken. Serverside opgeslagen als de environment-variabelen `SD_TOKEN_STEFANIE`/`SD_TOKEN_ANNIEK` (historische namen uit de eerste opzet, niet gekoppeld aan wie de link nu daadwerkelijk gebruikt, hernoemen in Vercel is bewust niet gedaan: puur cosmetisch, geen functioneel voordeel, wel een risico op een kapotte koppeling tijdens het hernoemen zelf). Moeten in zowel `.env.local` als Vercel gezet worden vóórdat dit in productie werkt.

**Status:** env vars staan al in Vercel (bevestigd door Arno, 2026-08-13), dit werkt dus al in productie.

**Route 2, buiten de links om: zie de sectie "Leadroutering voor leads buiten de links om" verderop in dit document.**

---

## Het verkoopverhaal zelf

Niet hier dupliceren. Voor het daadwerkelijke gesprek met een prospect: `docs/SALES_BIJBEL.md`, met name de sectie "De kernbelofte" (wat een manager, hoe goed ook, structureel nooit alleen kan) als opening, en de USP-lijst daaronder als onderbouwing.

---

## Waarom dit ook voor de sales agents zelf werkt

Ze zijn niet alleen verkoper van dit product, ze zijn ook zelf gebruiker ervan. Dat is een authenticiteit die geen andere sales-rol biedt:

- **Ze pitchen vanuit eigen ervaring**, niet vanuit een script. Een prospect voelt het verschil tussen "ik heb dit bestudeerd" en "ik gebruik dit zelf".
- **Het maakt hen zelf beter**, los van deze functie: 24/7 sparring, accountability-tracking, een eigen coachingsdiagnose.
- **Het is makkelijker te verkopen dan een gemiddeld product.** De kernbelofte in de Sales Bijbel is een sterk verhaal met weinig prijsweerstand, dat betekent voor hen concreet minder tijd kwijt aan bezwaren pareren.
- **Ze maken zelf een echt teamlidmaatschap mee, niet alleen een demo.** `command_manager=true` staat sinds 2026-08-13 op Arno's eigen account (zelfde mechanisme als bij elke andere manager), zodat hij zelf een team kan aanmaken en de sales agents als lid kan uitnodigen. **Nog niet uitgevoerd**, Arno moet dat team nog daadwerkelijk aanmaken via `/bot/team`.

### Managerervaring voor de sales agents (bewust uitgesteld)

Lidmaatschap alleen laat zien hoe het is om gecoacht te worden, niet hoe het is om zelf manager te zijn, en juist dát verkopen ze aan een prospect. Besloten (2026-08-13, Arno): een apart, klein demoteam voor de twee sales agents samen, met een paar fake teamleden met realistische activiteit (zelfde recept als "Team Hippios"), waarin beiden manager zijn en dus een echt gevuld managerdashboard zien. Uitgesteld naar een later stadium, geen huidige actie.

**Technische reden voor een apart team, niet gecombineerd met bovenstaand lidmaatschap:** iemand kan maar in één team tegelijk zitten (`/api/bot/team/create` en `/team/join` blokkeren allebei expliciet een tweede lidmaatschap). Manager zijn op hetzelfde kleine team als waar ze zelf lid van zijn levert bovendien een bijna leeg dashboard op, managers worden zelf uitgesloten van de ledenlijst die ze te zien krijgen.

Zie ook `docs/DEMO_VIDEO_SCRIPT.md`: het script voor de pre-demo video die de sales agents naar een prospect sturen vóór het live gesprek, staat al klaar en wordt opgenomen zodra dit demoteam er is (opnemen tegen fake data, nooit tegen echte klantdata).

---

## Commissiestructuur (vastgesteld 2026-08-13, uitgebreid met deel 2 zelfde dag, leadroutering toegevoegd 2026-08-17)

Bestaat uit twee delen: wat een sales agent verdient over haar eigen aangebrachte klanten, en een gedeeld aandeel in de rest van het bedrijf. Wat als "eigen aangebrachte klant" telt, is sinds 2026-08-17 niet meer alleen "via haar eigen link binnengekomen", zie de leadroutering-sectie verderop.

### Deel 1: eigen aangebrachte klanten

**Fase 1, jaar 1 van een aangebrachte klant:** 40% van de gefactureerde omzet, vanaf de eerste betaalde factuur (dus na de gratis trial, niet vanaf het moment van aanmelden).

**Fase 2, jaar 2 en verder:** 20%, zolang de sales agent actief blijft.

**Wat "actief" betekent (herzien 2026-08-14):** niet langer een vaste ondergrens zoals "minimaal 1 aanmelding per 3 maanden". Die test alleen of iemand niet volledig gestopt is, niet of iemand nog serieus werft, een sales agent die precies elk kwartaal één deal binnenhaalt zou daarmee voor altijd op het volledige tarief blijven staan terwijl het tempo feitelijk is ingestort. In plaats daarvan relatief aan iemands eigen record:

- ArnoBot houdt per sales agent de hoogste som van nieuwe aanmeldingen bij die ze ooit in 3 aaneengesloten maanden heeft gehaald, haar "persoonlijk record".
- Zodra dat record minstens 12 aanmeldingen in 3 maanden bedraagt (gelijk aan het uitgangstempo van 4 per maand in de rekentool), geldt de echte toets: zakt het lopende 3-maandstotaal onder 25% van dat persoonlijk record, dan is ze automatisch inactief.
- **Opstartperiode:** in de eerste 6 maanden is er nog geen betrouwbaar record om tegen af te zetten. Tot die tijd geldt de simpele ondergrens: minimaal 1 aanmelding in de lopende 3 maanden.
- **Bodemwaarde tegen ruis:** blijft iemands record onder de 12-in-3-maanden-drempel (dus nooit een sterke periode gehad), dan blijft ook daarna de simpele "niet nul"-toets gelden in plaats van de 25%-toets. Voorkomt een vals alarm bij kleine aantallen (bijvoorbeeld van 4 naar 1 in een kwartaal).
- Zelfde gevolg als voorheen zodra inactief: automatische terugval naar de 5%-uitloop hieronder. Geen beoordeling nodig, geen gesprek dat dit hoeft te bepalen.

**Verworpen: rollende vergelijking met alleen de 3 maanden ervoor** (in plaats van met het persoonlijk record). Bij een geleidelijke, stapsgewijze terugval (bijvoorbeeld 8 naar 6 naar 4 naar 3 naar 2 per maand) blijft elk kwartaal net onder de 25%-daling ten opzichte van het vorige kwartaal, waardoor de trigger nooit afgaat, ook al staat iemand na een jaar nog maar op een kwart van waar ze begon. Een vast persoonlijk record voorkomt dat de baseline meezakt met de eigen terugval.

**Fase 3, uitloop bij inactiviteit:** zodra een sales agent inactief wordt, vallen alle klanten die op dat moment nog 40% of 20% opleverden automatisch terug naar 5%, met een maximum van één jaar per klant. Na dat jaar: 0% voor die klant.

**Good leave versus bad leave (toegevoegd 2026-08-14):** de fase-3-uitloop hierboven geldt bij een "good leave", het normale geval waarin een sales agent stopt met werven zonder dat daar iets mis mee is. Bij een "bad leave" (bijvoorbeeld ernstig vertrouwensmisbruik) stopt alles per direct, geen 5%-uitloop, geen maximum-van-een-jaar-afbouw. Beoordeling hiervan is aan Arno, dezelfde discretionaire logica als de handmatige herbeoordeling hieronder, maar dan in de andere richting.

**Nieuwe klant tijdens inactiviteit:** brengt een inactieve sales agent toch nog een nieuwe klant aan, dan levert die specifieke klant, vanaf zijn eerste factuur, 20% op voor één jaar (niet 40%, en dit maakt de sales agent niet automatisch weer actief voor toekomstige klanten). Na dat jaar valt ook deze klant terug naar de 5%-uitloop, met zijn eigen maximum van één jaar vanaf dat moment, daarna 0%. **Zelfde regel geldt voor een lead die via de leadroutering hieronder aan een inactieve sales agent wordt toegewezen.**

**Handmatige herbeoordeling:** laat een inactieve sales agent weer een duidelijk patroon van regelmaat zien, dan kan Arno op eigen inzicht besluiten haar terug te zetten op de volledige actieve structuur (fase 1/fase 2). Geen automatische regel hiervoor, puur zijn eigen beoordeling.

**De link zelf:** blijft altijd bruikbaar, ook na volledige stopzetting van actieve inzet. Er is geen moment waarop een link technisch wordt gedeactiveerd, dat hoeft ook niet, het bepaalt alleen welke fase van toepassing is.

### Deel 2: gedeeld aandeel in de rest van het bedrijf

Naast hun eigen klanten krijgen de sales agents ook een aandeel in alle overige nieuwe omzet van ArnoBot: Solo-klanten, en Team-klanten die niet via een leadroutering aan een specifieke sales agent zijn toegewezen (zie hieronder, dit laatste is sinds 2026-08-17 een kleinere categorie dan voorheen).

**Verdeling:** die totale "buiten hen om"-omzet wordt 50/50 verdeeld tussen de twee sales agents. Elk krijgt daarover 40% commissie, dus feitelijk 20% van de totale buiten-hen-om-omzet per persoon, 40% van het totaal samen.

**Plafond:** iemands aandeel uit dit gedeelde deel kan nooit hoger zijn dan haar eigen commissiebedrag (dus ná toepassing van fase 1/2/3 hierboven, niet de ruwe klantomzet) over haar eigen aangebrachte klanten. Met andere woorden: maximaal een verdubbeling van wat ze al aan eigen commissie verdient, nooit meer. Geen eigen aanbreng, dan ook geen aanspraak op dit gedeelde deel.

**Zelfde stilte-regel geldt hier ook:** wordt een sales agent inactief (zie "Wat 'actief' betekent" hierboven), dan valt ook haar aandeel in het gedeelde deel automatisch terug naar de 5%-uitloop (max één jaar), precies zoals bij haar eigen klanten. Bewuste keuze om niet twee verschillende afbouwmechanismen naast elkaar te hebben: één regel die overal geldt, in plaats van een aparte regel per onderdeel. Het good-leave/bad-leave-onderscheid hierboven geldt hier op dezelfde manier: bij een bad leave stopt ook het gedeelde deel per direct.

**Bewust niet apart meegerekend:** organische groei binnen een klant die een sales agent zelf heeft aangebracht (bijvoorbeeld doordat de klant zelf seats toevoegt zonder actieve inzet van de sales agent) telt niet mee in dit gedeelde deel en wordt niet apart berekend. Arno middelt dit in de praktijk tegen churn. Zou dit wel apart meegerekend worden, dan zou een sales agent via het gedeelde deel meeprofiteren van klanten die haar collega aanbracht, wat niet de bedoeling is.

**Afbakening: precies twee personen (toegevoegd 2026-08-14).** Deze hele regeling (50/50-verdeling, plafond, stilte-regel) rekent met exact twee sales agents. Zij kunnen onderling besluiten een derde persoon te betrekken en die uit hun eigen deel te betalen, dat is hun eigen interne afspraak. Arno en ArnoBot faciliteren, tracken of erkennen die derde persoon niet apart, de pool en het plafond blijven berekend alsof er twee personen zijn.

### Leadroutering voor leads buiten de links om (toegevoegd 2026-08-17)

**De regel, in Arno's eigen woorden:** komt er een lead binnen bij ArnoBot en niet via een van de twee links, dan verifieert Arno eerst of die lead afkomstig is van een contact van een van de sales agents. Is dat zo, dan gaat de lead naar de betreffende sales agent. Kennen beide sales agents de lead niet, dan wordt de lead om en om aan hen doorgegeven.

**Interpretatie voor de commissieberekening (bevestigd door Arno, 2026-08-17):** een lead die via deze routering aan een sales agent wordt toegewezen, telt vanaf dat moment als haar eigen aangebrachte klant, dus Deel 1 (40% jaar 1, 20% daarna), niet als Deel 2. Reden: Deel 1 beloont wie de daadwerkelijke sales-inspanning levert om een trial naar een betaalde klant te converteren, en dat is bij een toegewezen lead evengoed de ontvangende sales agent, ook al kwam de eerste aanmelding niet via haar eigen link binnen.

**Gevolg voor Deel 2:** de pool "team-omzet buiten de links om" wordt hierdoor structureel kleiner dan voorheen. Vrijwel elke teamlead wordt nu individueel aan een sales agent toegewezen (via contactherkenning of round robin), dus alleen leads die Arno bewust niet toewijst (indien dat ooit voorkomt) blijven in de Deel 2-pool vallen. Solo-omzet buiten de links om blijft ongewijzigd volledig in Deel 2 vallen, deze routeringsregel gaat over teamleads.

**Twee deelvragen bij deze regel, beide bevestigd door Arno (2026-08-17):**
- **Een lead die bij beide sales agents bekend is:** geen automatische regel, Arno maakt hier per geval een besluit. Vervangt de eerder voorgestelde default (meelopen in de round robin), Arno gaf expliciet de voorkeur aan eigen beoordeling boven een vaste regel op dit punt.
- **Volgorde van de round robin:** strikte afwisseling, geen systeem nodig bij dit volume, Arno houdt dit zelf bij.

### Attributie: gebouwd (2026-08-17)

**Het gat:** er bestond geen enkele persistente koppeling tussen een klant en de sales agent die hem aanbracht, geverifieerd in de code zelf (`proxy.ts`): de attributie via een eigen link (`sdSource`) werd alleen gebruikt om `command_manager: true` te zetten en om in de Telegram-melding te vermelden, nooit weggeschreven naar `approved_users` of enige andere tabel. Voor de handmatige leadroutering (contactherkenning, round robin) bestond helemaal geen vastleggingsmoment.

**Oplossing, twee dingen losgekoppeld:**

1. **Wie krijgt het krediet (attributie) wordt nu vastgelegd**, los van wanneer er daadwerkelijk commissie op uitbetaald wordt. Reden: de attributiebeslissing zelf (welk contact, welke ronde) is een moment-gebonden feit dat verloren gaat als het niet meteen wordt vastgelegd, terwijl betaalbedragen later nog te reconstrueren zijn zodra er een payment provider is.
2. **Hoeveel commissie dat oplevert (het reken- en uitbetaalgedeelte) blijft terecht wachten op een payment provider**, zie hieronder. Bewust aparte, latere stap.

**Implementatie:**
- **Schema:** twee kolommen op `approved_users`, door Arno zelf toegevoegd via SQL (bevestigd 2026-08-17): `sd_agent` (`sales_agent_1` / `sales_agent_2` / leeg, met een CHECK-constraint) en `sd_attribution_method` (`link` / `manual` / leeg, ook met een CHECK-constraint). Geverifieerd met een schrijf-lees-terugzet-test tegen het E2E-testaccount, werkt correct. **Vereenvoudigd, zelfde dag:** eerst drie methodes (`link`/`contact_match`/`round_robin`), maar het onderscheid tussen contactherkenning en round robin bleek in de praktijk niet de moeite waard om vast te leggen, dus teruggebracht naar twee (`link`/`manual`). De CHECK-constraint is opnieuw gezet (dynamisch de oude constraint opgezocht en vervangen, geen aanname over de automatisch gegenereerde naam), en getest dat de oude waardes nu correct geweigerd worden.
- **Linkroute, automatisch:** `proxy.ts` zet `sd_agent`/`sd_attribution_method: 'link'` nu in dezelfde insert als `command_manager: true`, geen aparte stap nodig.
- **Handmatige routes (contactherkenning, round robin):** `app/bot/admin/gebruikers/SdAgentSelect.tsx`, een dropdown per gebruikersrij op `/bot/admin/gebruikers` (kolom "SD AGENT"), zelfde patroon als de bestaande `CommandManagerToggle`/`PlanToggle` op diezelfde pagina. Drie keuzes: Geen, Agent 1, Agent 2, elke handmatige toewijzing krijgt method `manual`. Een via de linkroute automatisch gezette rij toont in plaats van de dropdown een statische badge ("AGENT 1 (LINK)" / "AGENT 2 (LINK)"), om te voorkomen dat een betrouwbare automatische toewijzing per ongeluk handmatig overschreven wordt.
- **API-route:** `app/api/admin/sd-agent/route.ts`, zelfde auth-patroon (`arnobot_admin`-cookie) en validatie als de bestaande admin-routes, getest op zowel de 401 (geen cookie) als de 400 (ongeldige waarde) route.

### Deel-2-meting en uitbetaling: wacht op payment provider (toegevoegd 2026-08-17)

**Bevestigd door Arno:** de daadwerkelijke omzetmeting (nodig voor zowel Deel 1- als Deel 2-uitbetaling) kan pas zodra er een payment provider gekozen is. Bewust nog even in de wacht, geen actie nu. Zodra die keuze gemaakt is, komt er ook een dashboard voor realtime omzet per sales agent, zodat dit niet handmatig hoeft te worden nagerekend. De keuze van een payment provider is niet uniek voor sales development, ook de dunning-flow (betalingsherinneringen bij mislukte betaling) staat hierop te wachten.

---

## De "Agents Fee"-tool (`arno.bot/agents`)

Interactieve rekentool waarmee een sales agent haar eigen scenario's kan verkennen: hoeveel klanten per maand, hoe groot, churn, groei in wervingstempo, en de solo-/teamomzet buiten de links om (in de tool "non-agent omzet" genoemd). Rekent live door met exact dezelfde formules als de commissiestructuur hierboven (per-cohort simulatie met churn en groei, het plafond, de 20%-per-persoon-pool). Heette tot 2026-08-14 achtereenvolgens "Wat Je Verdient" en "Performance Fee", uiteindelijk **Agents Fee** op zowel de loginpagina als de tool zelf.

**Toegang, gelaagd, één inlogscherm met twee mogelijke wachtwoorden:**
- De sales agents loggen in met hun eigen, gedeelde wachtwoord (env var `SD_VERDIEN_PASSWORD`), zet de cookie `arnobot_sd_verdien`, zien alleen hun eigen scenario.
- Arno logt in op hetzelfde scherm met zijn eigen, al bestaande adminwachtwoord (`ARNOBOT_ADMIN_KEY`). De inlogroute herkent dat en zet in plaats daarvan de bestaande `arnobot_admin`-cookie, hetzelfde cookie als `/bot/admin` gebruikt. Daarmee is hij in één stap ook op de rest van het adminpaneel ingelogd, en krijgt hij op `/agents` automatisch de schakelaar "ArnoBot-weergave" te zien. Die schakelaar is voor de sales agents onzichtbaar, niet alleen verborgen maar functioneel niet bereikbaar zonder het admin-wachtwoord. **Besloten (2026-08-14):** de eerdere opzet (eerst apart inloggen op `/bot/admin`, dan pas naar `/agents`) bleek in de praktijk te omslachtig, vandaar dit ene inlogscherm met twee wachtwoorden.
- **ArnoBot-weergave, inhoud (tweede iteratie, 2026-08-14):** gaat uit van twee symmetrische sales agents, met exact dezelfde ingevulde cijfers. Toont drie getallen, voor de gemarkeerde maand en cumulatief over 5 jaar: de totale omzet (klantenboek van beide sales agents samen plus de gedeelde pool, die zelf al bedrijfsbreed is en niet verdubbelt), de uitkering aan de sales agents (hun gecombineerde eigen commissie plus hun gecombineerde, elk apart geplafonneerde aandeel uit de pool), en wat ArnoBot zelf overhoudt (het verschil). Daaronder één grafiek ("Omzet ArnoBot en afdracht agents, totaal") die dit over 60 maanden uitzet: gestapelde staaf van afdracht aan de agents plus wat ArnoBot overhoudt, met een cumulatieve lijn van de totale omzet.
- **Bewust géén dubbeling van de agent-persoonlijke content:** de eerste iteratie voegde de drie tegels alleen toe BOVEN de rest van de pagina, die verder ongewijzigd bleef, dus de twee agent-grafieken en de "Plus: jouw aandeel"-detailtegels bleven zichtbaar en op één-agent-cijfers staan, ook in ArnoBot-weergave. Gecorrigeerd: die hele agent-persoonlijke sectie (top-kengetallen, beide grafieken, detailtegels) is nu alleen zichtbaar in Sales Agent-weergave, vervangen door de ene bedrijfsgrafiek hierboven in ArnoBot-weergave. De twee invoervelden die daarvoor nog in die sectie stonden (Nieuwe Solo-omzet, Nieuwe Team-omzet) zijn verplaatst naar de altijd-zichtbare invoersectie bovenaan, zodat ze in beide weergaves bereikbaar blijven. De rekenvoorbeeld-disclaimer onderaan is sinds diezelfde datum ook alleen nog zichtbaar op de Sales Agent-weergave.
- Losstaand van `/bot` en `/bot/admin` qua route: geen Clerk-login nodig, eigen cookie-auth per pagina (`app/agents/page.tsx`).

**Status (2026-08-14):** live in productie, `SD_VERDIEN_PASSWORD` staat in Vercel, login en toegangsscheiding bevestigd werkend via een test op de live omgeving (niet alleen lokaal).

**Voorgeschiedenis:** begon als los Claude-artifact, maar een artifact heeft geen login en geen gedeelde state tussen pagina's. Toen bleek dat de sales agents anders ook de geplande ArnoBot-alleen-weergave zouden zien, is het omgezet naar een echte pagina in de codebase, wat zowel de toegangsscheiding als de gedeelde berekening in één keer oploste.

---

## Hoe dit te communiceren aan de sales agents

Spreektaal, geen intern jargon zoals "fase 1" of "SDR":

"Jullie krijgen 40 procent van wat een klant betaalt, in het eerste jaar. Blijft die klant daarna, dan krijgen jullie 20 procent, zolang jullie zelf actief blijven werven. Wat actief blijven precies inhoudt, lees je verderop.

Daarnaast krijgen jullie samen ook een deel van de rest van het bedrijf, dus ook van klanten die niet via jullie eigen link binnenkomen. Dat wordt eerlijk tussen jullie tweeën verdeeld, en jullie krijgen daar allebei 40 procent commissie over jullie eigen helft. Wel zit er een grens op: dat deel kan nooit meer zijn dan wat je al aan je eigen klanten verdient, dus hooguit een verdubbeling, nooit meer.

Komt er een lead binnen die niet via jullie eigen link kwam, dan kijk ik eerst of die iemand is die een van jullie al kent. Is dat zo, dan gaat die lead naar diegene. Kennen jullie hem geen van beiden, dan verdeel ik hem om en om, en dan telt die net als een lead via je eigen link.

Actief blijven is niet een quotum, maar wel gerelateerd aan jullie eigen beste periode. Zodra jullie drie maanden achter elkaar structureel op minder dan een kwart van je eigen beste kwartaal ooit zit, gaat de vergoeding op alles wat er dan nog loopt, ook dat gedeelde deel, automatisch omlaag naar 5 procent, voor maximaal nog een jaar, daarna stopt het voor die klanten. In de eerste zes maanden geldt gewoon: zolang er af en toe iemand binnenkomt, blijft alles op de volledige regeling.

Jullie link blijft altijd werken, ook daarna. Breng je in die periode alsnog iemand nieuw aan, dan krijg je daar gewoon 20 procent van voor een jaar.

En als jullie op een gegeven moment weer regelmatig gaan werven, kijken we gewoon samen of dat weer terug kan naar de volledige regeling."

---

## Wat je niet moet beloven

- Geen kenmerken noemen die nog GEPLAND zijn in `docs/SALES_BIJBEL.md`, alleen LIVE.
- De commissiestructuur exact communiceren zoals hierboven vastgelegd, geen andere percentages, voorwaarden of garanties toezeggen.

---

## Zijn er nog gaten in de regeling? (analyse 2026-08-17, bevestigingen zelfde dag verwerkt)

Bij het nalopen van de volledige regeling, inclusief de nieuwe leadroutering, gevonden en vervolgens met Arno doorgenomen:

1. **Attributie leeft nog nergens persistent.** Was het belangrijkste openstaande punt, inmiddels gebouwd, zie "Attributie: gebouwd" hierboven.
2. **Deel-2-meetmethode nog niet ontworpen.** Bevestigd: bewust in de wacht tot er een payment provider gekozen is, zie "Deel-2-meting en uitbetaling" hierboven. Daarna ook een realtime dashboard per sales agent gepland.
3. **Interpretatie leadroutering (Deel 1 versus Deel 2).** Bevestigd: telt als Deel 1.
4. **Tie-break bij een lead die bij beide sales agents bekend is.** Bevestigd: geen automatische regel, Arno beslist per geval.
5. **Volgorde van de round robin.** Bevestigd: strikte afwisseling, geen systeem nodig.
6. **Geen gedefinieerd moment waarop de leadroutering-toewijzing zelf vastligt** (bijvoorbeeld een later gebleken foutieve toewijzing). Bevestigd: zelfde discretie als "Handmatige herbeoordeling", geen aparte regel.

Alleen punt 2 heeft nog echte bouw-impact, bewust uitgesteld tot de keuze van een payment provider. Punt 1 is gebouwd.

---

## Nog toe te voegen

- Een lijst van doelbedrijven/wie ze actief gaan benaderen
- Beslissing of de sales agents eigen adminpagina-toegang krijgen
- De kickoff-pitch uit `docs/AGENTS_PITCH.md` daadwerkelijk in NotebookLM invoeren, de gegenereerde presentatie beoordelen, en toetsen met de sales agents zelf
