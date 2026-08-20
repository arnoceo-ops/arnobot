# Team-module — projectplan

**Laatst bijgewerkt:** 2026-08-20
**Waar we staan:** Fase 1 staat al live. **Punt 7 (PDF-export teamniveau) afgerond.** **Punt 6 gebouwd**: tabel `arnobot_salesbaas_coaching` + gedeelde `isConfirmedTeambaas(userId)`-helper (`lib/teamAccess.ts`), zie de sectie "Raamwerk: rollen × disciplines" hieronder voor de volledige herziening. RLS-incident onderweg gevonden en volledig gefixt (zie CLAUDE.md sectie 1). **Punt 1 gebouwd (2026-08-20):** `arnobot_1on1_log` uitgebreid met `actie`/`actie_status` (kolommen, waarden 'ja'/'nee'/'skip', zelfde vocabulaire als `arnobot_blog_sessions.actie_status`). Bij een nieuwe 1:1-agenda toont `app/bot/team/lid/[userId]/page.tsx` nu eerst een expliciete GEDAAN/NIET GEDAAN/OVERSLAAN-vraag als de vorige actie nog onbeantwoord is, en een "NIEUWE ACTIE"-invoerveld bij het opslaan. `TeamClient.tsx` toont een nieuw, bewust feitelijk (geen AI-tekst) blok "JOUW 1:1-RITME": 1:1's laatste 30 dagen, follow-through-percentage, aantal openstaande acties ouder dan 2 weken, gevoed door een nieuwe berekening in `app/api/bot/team/dashboard/route.ts`. Typecheck schoon, dev-server getest zonder crash. **Niet visueel geverifieerd in de browser** (vereist een echt ingelogd manager-account met teamleden en 1:1-historie, niet beschikbaar in deze sessie), zie het openstaand actiepunt hieronder.
**Eerstvolgende stap:** punt 5 (coachende rol richting Thijs zelf als coach), bouwt op 1 + 6. Nog niet gestart. **Eerst:** Arno visueel controleren dat punt 1 goed rendert (zie hierboven), en de PDF-export (`DownloadOneOnOneButton`/`OneOnOnePdfDocument.tsx`) toont `actie`/`actie_status` nog niet, bewust nog niet meegenomen, apart oppakken indien gewenst.

## Bouwvolgorde manager-zelfcoaching-gat (besloten 2026-08-19)

| # | Wat | Status |
|---|---|---|
| 7 | PDF-export teamniveau | **Live, bevestigd** (commits 2c0936af t/m 8655444d) |
| 6 | Teamcoaching-data koppelen aan Strategy People Execution, gegated op echte teambaas-status | **Gebouwd, 2026-08-20** (`arnobot_salesbaas_coaching` + `lib/teamAccess.ts`) |
| 1 | Terugkoppeling op eigen 1:1's + acties | **Gebouwd, 2026-08-20**, nog niet visueel gecontroleerd door Arno |
| 5 | Coachende rol richting Thijs zelf als coach (via Strategy People Execution) | Volgt, bouwt op 1 + 6 |
| 4 | Actieve sturing/handvatten (cultuur-pijler) | Volgt, contentlaag bovenop 5 |
| 2 | Instelbare vaste topics per teamlid | Volgt, zelfstandig |
| 3 | Instelling "wat MOET gedeeld worden" | **Besloten: niet bouwen**, zie hieronder |

**Waarom deze volgorde:** 7 is een losstaande, laag-risico quick win. 6 is geen zichtbare feature maar de architecturale voorwaarde voor 1/4/5: zonder een expliciete koppeling aan het juiste pijler-raamwerk zou Thijs' eigen coaching-als-verkoper (Mindset/Systeem/Actie) vervuild raken met zijn coaching-als-sales-baas (Strategy People Execution), zie de nieuwe sectie hieronder voor de volledige toedracht. 4 is inhoudelijk een contentlaag bovenop 5's synthese, geen aparte plek in de UI. 2 staat los en kan op elk moment.

## Raamwerk: rollen × disciplines (verduidelijkt 2026-08-20, Arno's eigen productmodel)

Dit gaat verder dan alleen de teammodule, het is het onderliggende model achter heel ArnoBot. Vastgelegd omdat het punt 6 en 5 herontwerpt en om te voorkomen dat een volgende sessie de eerdere, foute aanname ("verkoper-persona vs. coach-persona") weer oppakt.

**Vier rollen die ArnoBot aanspreekt:** verkoper, solopreneur, CEO, sales baas. Elke rol krijgt te maken met drie disciplines.

**Strategy People Execution (bedrijfsniveau, geldt voor alle vier de rollen):**
- **Strategy**: in hoeverre ben je onderscheidend ten opzichte van andere aanbieders.
- **People**: de mensen die nodig zijn om die strategie om te zetten in een plan.
- **Execution**: het plan omzetten in resultaat.

Dit zijn de drie disciplines die een bedrijf (in welke rol dan ook) af te leggen heeft. **Besluit (2026-08-20): de Engelse naam blijft bewust onvertaald**, "Strategy People Execution" is de letterlijke term uit Scaling Up (Verne Harnish, onderdeel van diens 4 Decisions-model: People/Strategy/Execution/Cash), en blijft daarmee herkenbaar voor iedereen die die methode kent, zelfde precedent als "Scaling Up" zelf nooit vertaald wordt, en zoals Arno bepaalde vaste Engelse termen (bijv. "skin in the game") bewust onvertaald laat staan in blogs. **Verworpen alternatief:** "Strategie/Mensen/Executie", volledige Nederlandse vertaling, verworpen omdat dat de herkenbaarheid vanuit Scaling Up verliest. Dit is geen afwijking van de reguliere taalregel (geen Engelse woorden waar Nederlands volstaat, `lib/systemPrompt.ts` regel 23), die regel geldt voor ArnoBot's coachingtaal in lopende gesprekken; dit is een vakterm/naam, vergelijkbaar met hoe "Scaling Up" zelf ook nooit vertaald wordt.

**Gewichtsverdeling per rol (2026-08-20, concreet gemaakt na vondst hieronder):** niet elke rol legt evenveel gewicht op elke pijler. Een sales baas is vooral gericht op People en Execution: mensen in beweging krijgen om een strategie tot resultaat te brengen. Strategy zelf definiëren is doorgaans niet zijn taak (eerder die van een CEO), Strategy is voor een sales baas context (voert hij uit binnen een heldere strategie of ontbreekt die), niet het hoofdonderwerp van de coaching.

**Concrete weging, hergebruikt uit het (verwijderde) RDS Canvas-verkoopplan** (`components/canvas/CanvasPdfDocument.tsx`, vóór verwijdering nog teruggevonden, zie sectie hieronder): **People 40% · Strategy 30% · Execution 30%**. Dit was daar de kwaliteitsweging van een compleet verkoopplan, niet ontworpen als coachingsynthese-weging, maar Arno heeft bevestigd (2026-08-20) dat dezelfde verdeling ook de basis wordt voor punt 5's sales-baas-synthese. **Consequentie voor punt 5:** de synthese voor Thijs-als-sales-baas weegt People het zwaarst (40%), Strategy en Execution gelijk (elk 30%), niet de drie pijlers gelijk (33/33/33) behandelen.

**Mindset / Systeem / Actie (bestaand raamwerk, specifiek voor de verkoopfunctie):** de drie pijlers die nodig zijn om succesvol te zijn in sales zelf, gebruikt in `arnobot_coaching` (`mindset_score`/`systeem_score`/`actie_score`) en de teamspotlight. Toegevoegd omdat ArnoBot primair een sales-coachingsapp is. Dit raamwerk verandert niet en blijft de basis voor ieders individuele verkoopcoaching, inclusief die van een sales baas die ook zelf nog verkoopt.

**Waarom ArnoBot ook voor een CEO werkt (bewust niet extern zo gepositioneerd, wel bespreekbaar in een persoonlijk gesprek):** de strategie- en mensenfunctie zitten er al in, vooral de strategiefunctie. De scaling-up- en methode-content staat al in de kennisbank (RAG-bibliotheek). **Niet meenemen in publieke marketingcopy** (`/prijzen`, `ABONNEMENTEN.md`, `SALES_BIJBEL.md`) zonder expliciete opdracht van Arno, dit is bewust interne/1-op-1-positionering, geen aangekondigde feature.

**Consequentie voor punt 6:** het onderscheid dat nodig is, is niet "welke identiteit heeft deze persoon" maar "welk pijler-raamwerk is van toepassing op dit stuk data". Verkoopwerk (van iedereen, ook een sales baas die zelf ook verkoopt) blijft Mindset/Systeem/Actie in het bestaande `arnobot_coaching`-profiel. Werk als sales baas (teamcoaching, 1:1's, punt 1 en 5) krijgt een eigen synthese op basis van Strategy People Execution. De naamgeving loopt hierdoor ook niet meer door elkaar: "Actie" (verkoopfunctie, Nederlands) en "Execution" (bedrijfsniveau, Engels) zijn nu duidelijk te onderscheiden, in plaats van dat beide raamwerken een pijler "Actie" deelden.

**Gebouwd (2026-08-20):** tabel `arnobot_salesbaas_coaching` (kolommen: `strategy_score`/`strategy_diagnose`, `people_score`/`people_diagnose`, `execution_score`/`execution_diagnose`, `voortgang`, `used_1on1_ids`), en `lib/teamAccess.ts` met `isConfirmedTeambaas(userId)`. **RLS:** de aanvankelijke "policy dupliceren van `arnobot_coaching`"-vraag bleek een groter, los incident, RLS stond op vrijwel de hele database uit, niet alleen op deze nieuwe tabel. Volledig onderzocht en gefixt, zie CLAUDE.md sectie 1 ("Incident gevonden en gefixt 2026-08-20") voor de complete toedracht. `arnobot_salesbaas_coaching` heeft nu, net als alle andere tabellen, RLS aan (zonder policies, voldoende zolang alles via de service-role-key loopt).

**Besluit (2026-08-20): gate op echte teambaas-status, niet op `profiel.rol`.** De drie bestaande gates (lidmaatschap `arnobot_team_members` + `command_manager` + `profiel.gebruik`, zie `app/api/bot/team/status/route.ts`) bepalen wanneer Strategy People Execution van toepassing is. **Verworpen alternatief:** `profiel.rol` (het onboarding-chipje: Sales Director/VP of Sales/CEO/DGA) gebruiken om te bepalen wanneer iemand als sales baas wordt aangesproken. Reden verwerping: bewezen onbetrouwbaar, Thijs' eigen testprofiel staat op "verkoper", niet op sales baas, terwijl hij feitelijk manager is. Iemand kan bovendien beide petten tegelijk dragen (verkoper voor zichzelf, sales baas voor zijn team), dus het is sowieso geen exclusieve keuze.

## Bestaande rol/discipline-infrastructuur (gevonden 2026-08-20, was eerder gemist)

Bij het eerste ontwerp van punt 6 werd ten onrechte aangenomen dat er nog niets bestond dat op dit raamwerk lijkt. Een grondigere, case-insensitive sweep (na terechte correctie van Arno) vond twee bestaande, losse mechanismen in `app/bot/SparClient.tsx`, beide relevant als hergebruikbare basis voor punt 6, geen van beide doet al wat punt 6 nodig heeft:

1. **De discipline-picker** (regel ~2195-2207, zichtbaar op de hoofdchat als "of kies een discipline"): drie knoppen, gevuld door de `refresh-openers`-cron (`app/api/cron/refresh-openers/route.ts`) met AI-gegenereerde vragen per categorie: strategisch (CEO/DGA, VP of Sales), organisatorisch (Sales Director), operationeel (AE/AM/Inside Sales). **Op 2026-08-20 omgezet naar de Engelse naamgeving** (STRATEGY / PEOPLE / EXECUTION i.p.v. STRATEGIE/ORGANISATIE/SALES), consistent met het Strategy People Execution-besluit hierboven. Alleen de zichtbare labels zijn gewijzigd, de interne state-waarden (`openerModus`: `strategisch`/`organisatorisch`/`sales`) en de `dynamicOpeners`-JSON-sleutels van de cron (`strategisch`/`organisatorisch`/`operationeel`) zijn bewust ongewijzigd gelaten, dat zijn implementatiedetails zonder gebruikersimpact en wijzigen ervan zou de cron-output en gecachete data moeten migreren zonder zichtbaar voordeel.
2. **`rolCategorie`** (regel ~201-204): al precies de vier rollen (`verkoper`/`salesbaas`/`eindbaas`/`solopreneur`), maar uitsluitend gebruikt om de sparringtegenstander te kiezen, opgeslagen als `rol_categorie` per sparringsessie, en in `coaching/route.ts` alleen als beschrijvende tekst mee de Mindset/Systeem/Actie-synthese in gegeven. Nooit gebruikt om tussen pijler-raamwerken te schakelen.

**Bug gevonden en gefixt (2026-08-20):** `ORGANISATORISCH_ROLLEN` en `SALESBAAS_ROLLEN_SPAR` checkten op de string `'Sales Manager/Director'`, die niet bestaat als selecteerbare onboarding-optie (`app/bot/profiel/page.tsx` heeft alleen `'Sales Director'`). Gevolg: een echte Sales Director kreeg nooit automatisch het ORGANISATIE-tabblad (viel stil terug op SALES/EXECUTION). Gecorrigeerd naar `'Sales Director'` in beide constantes, en de bijbehorende categorie-uitleg in `refresh-openers/route.ts` (was ook "Sales Manager/Director") meegecorrigeerd.

**Consequentie voor de bouw van punt 6:** hergebruik `rolCategorie`'s vier categorieën (of de onderliggende `_ROLLEN`-constantes) als basis voor rolherkenning in plaats van iets nieuws te verzinnen, en houd de teambaas-gate (bestaande drie gates) als aanvullende, betrouwbaardere check voor wanneer Strategy People Execution daadwerkelijk actief wordt getoond (zie het besluit hierboven: `profiel.rol` alleen is niet genoeg).

## Herkomst van het raamwerk: RDS Canvas (gevonden en opgeruimd 2026-08-20)

Bij een tweede, verplichte grondigere sweep (Arno vroeg expliciet "heb je echt alles gecheckt") kwamen twee dingen boven die de eerste sweep miste:

1. **Eigen bug geïntroduceerd en direct gecorrigeerd:** `e2e/auth.setup.ts` gebruikte hetzelfde niet-bestaande rolchipje (`'Sales Manager/Director'`) in het representatieve testprofiel. Door de eerdere fix (verwijdering van die string uit `SALESBAAS_ROLLEN_SPAR`) matchte dit testprofiel met geen enkele rolcategorie meer. Gecorrigeerd naar `'Sales Director'`.
2. **De echte herkomst van Strategy People Execution gevonden:** `components/canvas/CanvasPdfDocument.tsx` (dode code, RDS Canvas was al verwijderd, dit bestand + `PageHero.tsx` stonden nog wel in de repo, nergens meer geïmporteerd) bleek het oude RDS Canvas-verkoopplan te zijn: drie secties Strategie/Mensen/Uitvoering, met een letterlijke, gedocumenteerde kwaliteitsweging: **Mensen 40% · Strategie 30% · Uitvoering 30%**. Dit is dus geen nieuw raamwerk dat vandaag is bedacht, het bestond al in een eerdere tool, alleen de coachingtoepassing (punt 5/6) is nieuw.

**Besluit (2026-08-20):** de 40/30/30-weging wordt hergebruikt voor punt 5's sales-baas-synthese (zie de sectie hierboven). `components/canvas/CanvasPdfDocument.tsx` en `PageHero.tsx` zijn verwijderd, bevestigd dode code sinds de eerdere RDS Canvas-verwijdering (zie CLAUDE.md-notitie "Achterhaald 2026-07-23" bij het model-inventaris), deze commit sluit die opruiming af.

## Punt 3 — besloten, niet bouwen (2026-08-19)

Arno's expliciete besluit: **optie A**, geen wijziging aan de bestaande belofte. Het join-scherm zegt nu al hard: "je manager ziet nooit wat je bespreekt, tenzij je het zelf deelt." Dat blijft ongewijzigd. Geen "moet delen"-instelling voor de manager, geen technische afdwinging. Als een teamlid niets deelt, is dat niets, punt.

**Verworpen alternatief:** een echte verplichte deel-categorie (optie B), met transparante communicatie vooraf op het join-scherm. Reden verwerping: dit tornt aan de kernbelofte die het vertrouwen in de hele Team-module draagt, en die belofte is de USP, niet een detail.

## Wat er al bestaat (onderzocht 2026-08-19, vóór dit traject startte)

**Frontend:** `app/bot/team/TeamClient.tsx` (managerdashboard), `app/bot/team/lid/[userId]/page.tsx` (teamlid-detail incl. 1:1-voorbereiding), `app/bot/team/join/page.tsx` (join-flow met het trust-scherm).

**Backend:** `app/api/bot/team/{create,join,status,dashboard,lid,1on1,1on1/save,1on1/note,ritme,scores,spotlight,share-analyse,notifications,dismiss-prompt}/route.ts`.

**1:1-voorbereiding (bouwsteen 1.3) nu:** `POST /api/bot/team/1on1` genereert een agenda (WAT GAAT GOED / AANDACHTSPUNT / ARNO ADVISEERT) op basis van coachingprofiel + laatste 2 analyses + laatste 3 `arnobot_1on1_log`-rijen + laatste 3 sessiesamenvattingen (nooit ruwe transcripten). Wordt pas opgeslagen na expliciete "BEWAAR DEZE 1:1"-klik. Geen gestructureerd actie/status-veld, alleen een vrij `notitie`-tekstveld. Geen feedback-naar-de-manager-over-zichzelf-als-coach bestaat nog niet.

**Privacy-/gate-mechanisme (bestaand, moet intact blijven bij elke volgende stap):** service-role key overal, autorisatie volledig in route-logica (geen RLS zichtbaar in de code). Manager-facing routes halen uitsluitend samenvattende velden op (`arnobot_coaching`, `arnobot_shared_analyses`, `arnobot_1on1_log`), nooit ruwe `arnobot_blog_sessions`-inhoud voor weergave. `arnobot_shared_analyses` is het enige bestaande "lid deelt zelf iets extra met manager"-mechanisme (opt-in, intrekbaar). `profiel.gebruik === 'individueel'` houdt iemand volledig buiten de team-UI, ook als hij lid is.

**Ontbreekt structureel (bevestigd, geen aanname):** geen mechanisme dat bepaalt welk pijler-raamwerk (Mindset/Systeem/Actie of Strategie/Mensen/Actie, zie de sectie hierboven) van toepassing is op een stuk data. `arnobot_coaching`, `arnobot_coaching_scores`, `arnobot_coaching_history`, `arnobot_blog_sessions`, `arnobot_analyses` zijn allemaal puur op `user_id` gesleuteld, ongeacht welke rol/discipline er speelt. Dit is precies wat punt 6 oplost. Belangrijk: dit is geen "verkoper vs. manager"-identiteitsvraag (ArnoBot spreekt iedereen al rolbewust aan vanaf het eerste bericht, zie `lib/systemPrompt.ts` regel 102, een CEO wordt nooit als verkoper aangesproken), maar een vraag welk raamwerk een specifiek stuk coachingdata moet gebruiken.

**PDF-exportpatroon (nu tweemaal toegepast, teamlid- en teamniveau):** `@react-pdf/renderer`, dynamisch geïmporteerd in een losse download-knop-component (`DownloadOneOnOneButton.tsx` / `DownloadTeamPdfButton.tsx`), los PDF-documentcomponent met `@ts-nocheck` (react-pdf's typing-eigenaardigheden, bestaand, geaccepteerd patroon, ESLint staat op continue-on-error in dit repo), client-side blob-download. Bij een volgende PDF-export dit patroon hergebruiken, niet opnieuw uitvinden.

### Les uit punt 7: react-pdf-paginering (belangrijk voor elke volgende PDF met variabele lengte)

Het team-rapport (`TeamPdfDocument.tsx`) kostte een lange reeks iteraties omdat meerdere aannames over react-pdf niet klopten en pas bij daadwerkelijk lokaal renderen + visueel inspecteren aan het licht kwamen (nooit vertrouwen op "de code ziet er goed uit"):
1. Een SVG-breedte die 1-op-1 van de webversie was overgenomen (`MiniChart`) paste niet in de daadwerkelijk beschikbare kolombreedte van een 3-koloms PDF-layout, met overlopende grafieken tot gevolg. Altijd de echte beschikbare breedte narekenen, niet de webwaarde kopiëren.
2. Middenuitgelijnde tekstlabels op het eerste/laatste datapunt van een grafiek kunnen de rand van hun eigen SVG-viewBox overschrijden. Rand-labels lijnen naar binnen uit (start/end), niet gecentreerd.
3. **De belangrijkste:** react-pdf herhaalt de padding van `<Page>` zelf betrouwbaar op elke automatisch gegenereerde vervolgpagina. De padding van een geneste `<View>` die over een paginagrens heen loopt NIET. Dit verklaarde zowel "geen ruimte bovenaan op pagina 2" als "content botst met de vaste footer" (de footer, `position:absolute`+`fixed`, telt niet mee in de flow-hoogteberekening, dus zonder een op Page-niveau gereserveerde `paddingBottom` kan tekst er zo tegenaan lopen). Oplossing: marge op Page-niveau zetten (`paddingTop`/`paddingBottom`), een full-bleed cover-sectie ontsnapt daaraan met een negatieve `marginTop`.
4. Een geforceerde `break` vóór een sectie (in plaats van natuurlijke doorloop) lost het "content past niet"-probleem oppervlakkig op maar creëert een nieuw probleem: een halflege eerste pagina, in plaats van dat de content het beschikbare papier gewoon vult en netjes doorbreekt. Bij twijfel: natuurlijke flow, geen kunstmatige splitsing (tenzij inhoudelijk een harde nieuwe sectie hoort te beginnen, zoals `ArnoBotPdfDocument.tsx` doet tussen sessies).

**Werkwijze die hierbij hoort, ook voor toekomstig PDF-werk:** bij een react-pdf-wijziging altijd eerst kijken hoe de bestaande documenten (`OneOnOnePdfDocument.tsx`, `CanvasPdfDocument.tsx`, `ArnoBotPdfDocument.tsx`) iets oplossen vóórdat je zelf iets verzint, en na elke wijziging lokaal renderen (`renderToStream` naar een tijdelijk bestand, nooit gecommit) en met de Read-tool visueel inspecteren, ook met bewust lange testtekst die een pagina-overloop forceert. Code die er "logisch" uitziet bleek in deze ronde meermaals niet te kloppen met wat er daadwerkelijk gerenderd werd.

## Fase 1/2 (ouder, uit projectgeheugen, hier overgenomen voor volledigheid)

Privacymodel (fundament van alles): Verkoper ziet eigen gesprekken + eigen coaching-profiel + wat manager over hem ziet. Manager ziet coaching-profiel per lid (patronen, groeirichting), NOOIT gesprekken/quotes/klantnamen. ArnoBot admin (Arno) ziet alles. ArnoBot is de buffer: gesprek → synthese → coaching-profiel → manager.

| Stap | Wat | Status |
|---|---|---|
| 0 | Join-flow trust screen | Live |
| 1.1 | Per-lid drill-down | Live |
| 1.2 | Activiteitssignalen | Live |
| 1.3 | 1:1-voorbereiding | Live |
| 1.4 | Teamritme | Live |
| 2A | De Spiegel | Niet gestart |
| 2B | De Tijdlijn | Niet gestart |
| 2C | Manager als variabele | Niet gestart |

**Why:** Teamversie is een belangrijke uitbreiding van ArnoBot. Vertrouwen is de USP, zie punt 3 hierboven, breek dat en het hele product valt.
**How to apply:** nooit manager-toegang tot ruwe gesprekken geven, ook niet indirect. Altijd via de synthese-laag.

### Fase 2A/2B/2C — volledige beschrijving (overgenomen uit projectgeheugen, 2026-08-20, was nog niet in dit document opgenomen)

**2A — De Spiegel**, "Wat je team je niet vertelt." Vereist thema-extractie bij het opslaan van coachingsessies (labels: kwalificatie, bezwaar, afsluiting, zelfvertrouwen). Bouwt op 1.1 (drill-down) + Spotlight.

**2B — De Tijdlijn**, "Zo was je team 3 maanden geleden. Zo nu." Vereist maandelijkse thema-snapshots per lid en team. Bouwt op 2A (gelabelde data nodig).

**2C — De Manager als Variabele**, "Dit is geen individu-probleem." Wanneer 3+ leden hetzelfde patroon tonen, richt ArnoBot de spiegel op het systeem (de manager/de aansturing), niet op de individuen. Bouwt op 2A + 2B.

**Belangrijke productinzicht voor 2B, vastgelegd op Arno's expliciete verzoek (2026-08-20, "kom er GEGARANDEERD op terug, dit is superbelangrijk"):** De Tijdlijn bouwt niet alleen een groeiverhaal, het bouwt een **dossier**, en dat dossier heeft ook waarde in het slechte geval: een teamlid dat niet groeit, ondanks structurele 1:1's en opvolging. De manager kan daarmee aantonen dat hij er alles aan heeft gedaan om die persoon te ondersteunen, zowel via de app als via de 1:1-gesprekken zelf. Dit is, hoe ongemakkelijk ook, een reële waarde van het product naast de primaire ontwikkelingsdoelstelling.

**Consequentie voor het ontwerp van 2B, zodra het wordt opgepakt:** De Tijdlijn moet nadrukkelijk niet alleen groei tonen. Stagnatie ondanks consistente coaching-inspanning is zelf een geldig, waardevol resultaat om eerlijk en neutraal weer te geven, niet iets om te verbloemen richting een positiever verhaal. Dit raakt geen nieuw privacyprobleem (de manager ziet nu al uitsluitend het gesynthetiseerde coachingprofiel, nooit ruwe gesprekken, zie het privacymodel hierboven), maar wel een expliciete toon-/ontwerpkeuze: neutrale documentatie van inspanning en resultaat, niet alleen positieve framing.

**Prioriteit:** bewust NIET nu opgepakt. Het lopende traject (coaching-op-de-coach, punt 5 is de eerstvolgende stap) wordt eerst afgemaakt. Fase 2A/2B/2C is een apart, later traject. Arno heeft dit bevestigd na een directe vergelijking van beide opties.
