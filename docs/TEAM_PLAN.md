# Team-module — projectplan

**Laatst bijgewerkt:** 2026-08-21
**Waar we staan:** Fase 1 staat live. Van de bouwvolgorde manager-zelfcoaching-gat zijn **punt 7, 6, 1 en 5 afgerond en getest** (punt 5 zelfs live end-to-end met een echte Anthropic-call, zie "Punt 5 — ontwerp" hieronder), en **2A (De Spiegel) is gebouwd en gepusht, maar nog niet met echte productiedata geverifieerd** (zie de tabel hieronder voor wat elk punt concreet toevoegde, en de sectie "Raamwerk: rollen × disciplines" voor de volledige Strategy People Execution-herziening die daarbij hoorde). Onderweg een RLS-beveiligingsincident gevonden en volledig gefixt (zie CLAUDE.md sectie 1, los van dit traject maar wel dezelfde dag ontdekt). Bij het voorbereiden van punt 5 bleek Fase 2A/2B/2C (zie die sectie hieronder, nu volledig uitgewerkt) geen los, later traject te zijn zoals eerder aangenomen, maar een directe versterking van punt 5 zelf.
**Besluit (2026-08-20): 2A/2B/2C en de resterende punten worden één traject, in herziene volgorde.** 2A → 5 → 4 → 2B → 2C, met punt 2 (instelbare topics) los ertussen op elk gewenst moment. Reden: 2A heeft geen enkele afhankelijkheid van punt 5/6/1 (bouwt alleen op de al-live drill-down + Spotlight), en zou punt 5 dubbel werk kosten als 5 eerst dun gebouwd wordt en daarna alsnog verrijkt moet worden zodra 2A er is. Zie de Fase 2A/2B/2C-sectie voor het risico dat 2B/2C pas na weken tot maanden echte data hun waarde tonen, dat is geen reden om de bouw uit te stellen, wel iets om in de UI netjes op te vangen ("nog te weinig data").
**Besluit (2026-08-21), dubbel-profiel-vraagstuk afgesloten:** ArnoBot ondersteunt bewust niet iemand die zowel zelf verkoopt als zijn team coacht, het is het een of het ander (Arno's expliciete besluit). Zie de sectie "Raamwerk: rollen × disciplines" voor het volledige besluit en het verworpen alternatief (twee gescheiden profielen).
**2A-ontwerp (2026-08-21, na afweging bij het bouwen):** vaste thema-taxonomie (10 labels, `lib/themas.ts`) i.p.v. hergebruik van `arnobot_memory_entities`' vrije thema-naamgeving, gekozen omdat vrije tekst een fuzzy-matching-stap zou vereisen om teambreed te tellen én omdat thema's daar concurreren met personen/bedrijven om een gedeeld extractiebudget van 5 slots per sessie. Extractie als 4e, niet-kritieke Haiku-call in `session-end/route.ts` (eigen kolom `themas` op `arnobot_blog_sessions`). Aggregatie (`app/api/bot/team/spiegel/route.ts`) is bewust **pure code, geen LLM-call**: dominant thema + trend (nieuw/opkomend/afnemend/aanhoudend) wordt deterministisch berekend uit tellingen, om hallucinatierisico op cijfers (zie `RULE_NO_INVENTED_DETAILS` elders in de app) volledig uit te sluiten. Drempel: 30+ sessies teambreed met een herkenbaar thema, anders toont de UI "nog te weinig data".
**Eerstvolgende stap:** punt 4 is geschrapt (zie hieronder). Door naar **punt 2B** (De Tijdlijn). 2A verder los daarvan verifiëren zodra er echte teamdata is (drempel 30 sessies teambreed nog niet gehaald bij Thijs' team, dus visueel nog niet te testen).

**Belangrijke correctie tijdens het punt-5-gesprek (2026-08-20):** niet elke sales baas is ook verkoper. Thijs test toevallig met een verkoper-rolchipje, maar de gemiddelde teambaas verkoopt zelf nooit. Strategy People Execution is voor hem dus geen aanvullend profiel naast een verkoperprofiel, het is zijn enige, primaire coachingprofiel. De databronnen voor punt 5 (1:1-log, teamresultaten) hingen al niet af van een eigen verkoperprofiel, dus dit raakt de bouw van punt 5 zelf niet, maar wel de framing in de UI (geen "óók je ontwikkeling als manager", gewoon "je ontwikkeling als leidinggevende").

**Besluit (2026-08-21): het dubbel-profiel-vraagstuk is geen open punt meer, maar afgesloten met een principekeuze.** Arno: ArnoBot is niet geschikt voor iemand die zowel zelf verkoopt als zijn team coacht, het is het een of het ander. Iemand die als teambaas fungeert, wordt dus niet ook nog op het Mindset/Systeem/Actie-verkoopprofiel gescoord, zijn coaching loopt volledig via Strategy People Execution (punt 5, hieronder). Geen aparte "twee petten tegelijk"-logica nodig. **Verworpen alternatief:** twee gescheiden profielen bijhouden voor iemand die beide rollen combineert (zoals Thijs' eigen testprofiel), verworpen omdat het product zelf al die combinatie niet ondersteunt, dus de vraag is niet meer relevant.

**Bevestigd (2026-08-21):** de behoefte "wie zijn team coacht, moet zelf ook gecoacht worden" zit al in de bouwvolgorde, dat is precies wat **punt 5** doet (Strategy People Execution-synthese gericht op de teambaas zelf), geen los punt nodig.

## Bouwvolgorde manager-zelfcoaching-gat + Fase 2 (herzien 2026-08-20, samengevoegd tot één traject)

| # | Wat | Status |
|---|---|---|
| 7 | PDF-export teamniveau | **Live, bevestigd** (commits 2c0936af t/m 8655444d) |
| 6 | Teamcoaching-data koppelen aan Strategy People Execution, gegated op echte teambaas-status | **Gebouwd, 2026-08-20** (`arnobot_salesbaas_coaching` + `lib/teamAccess.ts`) |
| 1 | Terugkoppeling op eigen 1:1's + acties | **Gebouwd en getest, 2026-08-20** |
| 2A | De Spiegel (thema-labels per sessie, teambrede patroonherkenning) | **Gebouwd, 2026-08-21** (`lib/themas.ts`, `app/api/bot/team/spiegel/route.ts`, kaart in `TeamClient.tsx`). Nog niet visueel geverifieerd, drempel van 30 sessies teambreed nog niet gehaald |
| 5 | Coachende rol richting de teambaas zelf (via Strategy People Execution) | **Gebouwd en end-to-end getest, 2026-08-21** (`app/api/bot/team/zelfcoaching/route.ts`, `lib/spiegel.ts`, `computeSpeScore` in `lib/msa.ts`, kaart "JOUW LEIDERSCHAP" in `TeamClient.tsx`). Live geverifieerd met een echte Anthropic-call op geseede testdata, zie hieronder |
| 4 | ~~Actieve sturing/handvatten (cultuur-pijler)~~ | **Besloten: niet bouwen (2026-08-21)**, zie hieronder |
| 2B | De Tijdlijn (maandelijkse teamsnapshots) | Volgt, bouwt op 2A |
| 2C | Manager als Variabele (patroon bij 3+ leden = mogelijk systemisch) | Volgt, bouwt op 2A + 2B, gevoeligste van de drie |
| 2 | Instelbare vaste topics per teamlid | Los, kan op elk moment tussendoor |
| 3 | Instelling "wat MOET gedeeld worden" | **Besloten: niet bouwen**, zie hieronder |

**Waarom deze volgorde:** 7 is een losstaande, laag-risico quick win. 6 is geen zichtbare feature maar de architecturale voorwaarde voor 1/5: zonder een expliciete koppeling aan het juiste pijler-raamwerk zou Thijs' eigen coaching-als-verkoper (Mindset/Systeem/Actie) vervuild raken met zijn coaching-als-sales-baas (Strategy People Execution), zie de sectie hieronder voor de volledige toedracht. **2A vóór 5 (herzien 2026-08-20):** 2A heeft geen afhankelijkheid van 5/6/1 en maakt 5's synthese inhoudelijk sterker (teambrede thema's i.p.v. alleen 1:1-administratie), dus eerst 2A bouwen voorkomt dat 5 later herbouwd moet worden. **4 is geschrapt (2026-08-21)**, zie de aparte sectie hieronder. 2B/2C volgen op 2A, in die volgorde omdat 2C zelf weer op 2A + 2B bouwt en door Arno zelf als "de meeste rijping vereisend" is aangemerkt. Punt 2 staat los en kan op elk moment.

## Punt 5 — ontwerp (2026-08-21)

**Belangrijke correctie tijdens dit gesprek:** Thijs is zelf verkoper en test de Team-module met fake teamleden, hij is geen echte sales baas. Het ontwerp van punt 5 moet daarom redeneren vanuit een generieke sales baas die verantwoordelijkheid draagt over een team accountmanagers/inside sales, niet vanuit Thijs' eigen situatie. Geverifieerd dat het ontwerp hier al rolneutraal was (gate op `isConfirmedTeambaas`, niet op `profiel.rol`, precies om deze reden al zo gekozen bij punt 6), dus geen wijziging nodig, alleen scherper geformuleerd. Thijs' account blijft bruikbaar om de UI/mechaniek te testen, de inhoudelijke synthese zal voor hem persoonlijk minder kloppen, dat is een testbeperking, geen ontwerpfout.

**Databronnen:**
1. Eigen 1:1-log (`arnobot_1on1_log`): agenda, aandachtspunten, acties, `actie_status` (follow-through)
2. Teambrede scoretrend (`arnobot_coaching_scores` van alle leden)
3. Per lid het laatste coachingprofiel (mindset/systeem/actie-diagnose), al bestaande manager-zichtbare data, nog niet eerder gebundeld ingezet
4. De Spiegel (2A): dominant teambreed thema + trend
5. Bestaande Team Spotlight-teksten (`arnobot_team_analyses`), hergebruikt als context

**Gate:** `isConfirmedTeambaas(userId)`, eerste echte gebruiker van deze helper (was tot nu toe ongebruikt sinds punt 6).

**Trigger (besloten):** tweewekelijkse cooldown + minimaal 3 nieuwe 1:1's sinds de vorige synthese, analoog aan de precheck/minimum-eis van de individuele coaching. Verworpen alternatief: wekelijks zoals Team Spotlight, verworpen omdat 1:1-materiaal trager opstapelt dan gesprekken.

**Output** (`arnobot_salesbaas_coaching`): `strategy_score/diagnose`, `people_score/diagnose`, `execution_score/diagnose` (schaal 1-5), `voortgang`, `used_1on1_ids`. Nieuw: `computeSpeScore()` in `lib/msa.ts`, analoog aan `computeMsaScore` maar met de 40/30/30-weging (People 40 · Strategy 30 · Execution 30, zie "Raamwerk: rollen × disciplines" hieronder).

**UI:** nieuwe sectie in `TeamClient.tsx` op `/bot/team`, direct na "JOUW 1:1-RITME" en vóór "TEAMLEDEN" (beide "over jou"-secties gaan over de teambaas zelf, niet over het team, en staan daarom bij elkaar). Visuele preview gebouwd en gedeeld (Artifact, 2026-08-21) met 4 titelopties live vergelijkbaar in context. **Titel bevestigd (2026-08-21): "JOUW LEIDERSCHAP".**

**Pijlerdefinities, bevestigd (2026-08-21).** Bron mede `data/arnobot_video_kennisbank.txt`, de Rockefeller Habits/Scaling Up-serie van Verne Harnish, letterlijk de herkomst van "Strategy People Execution": hoofdstuk 2 "De juiste mensen" → People, hoofdstuk 3 "De planningspiramide" → Strategy, hoofdstuk 6 en 8 (ritme/vergaderstructuur) → Execution.

**STRATEGY (30%)**
Kernvraag: vertaalt de sales baas de bedrijfsstrategie naar een helder, onderscheidend plan voor zíjn team? Niet: bedenkt hij de strategie zelf (CEO-taak).
- Vertaalt "hoe onderscheiden we ons, waar zijn we beter in" naar het team
- Signaleert omhoog (naar het MT, voor zover hij daar zelf geen deel van uitmaakt) of de strategie in de praktijk werkt
- Signaal: teamleden kunnen hun toegevoegde waarde t.o.v. de concurrentie niet verwoorden, of veel verloren deals → indicatie van slecht doorvertaalde strategie. Geen apart datapunt (geen win/loss-tracking), kwalitatief te herkennen in bestaande sessiesamenvattingen/feiten.

**PEOPLE (40%)**
Kernvraag: heeft de sales baas de juiste mensen op de juiste plek, en ontwikkelt hij ze structureel?
- A-players aangenomen? Zo niet: B-players actief upgraden (blinde vlekken zien én aanpakken, mét hun sterke punten verder uitbouwen, niet alleen zwaktes repareren)
- C-players (niet upgradebaar): tijdig genoeg afscheid nemen?
- Signaal: een teamlid waarbij één MSA-pijler over meerdere metingen structureel niet groeit = indicatie van een C-player. Relevant is niet alleen de stagnatie zelf, maar of de sales baas daarop acteert.

**EXECUTION (30%)**
Kernvraag: doen teamleden ook echt de dingen die ertoe doen, worden plannen tot resultaat gebracht?
- Strategie komt pas tot uiting als goede mensen ook daadwerkelijk actief zijn, primair gericht op klanten en op het marktdeel waar het team maximale bereikbaarheid/waarde kan laten zien
- Niet activiteit in het algemeen, activiteit op de juiste plek

**Ontwerpkeuze synthese-prompt (2026-08-21):** vaste, hardgecodeerde kern zoals hierboven (analoog aan Mindset/Systeem/Actie in `coaching/route.ts`, niet RAG-afhankelijk, anders zou de scoringsmaatstaf van run tot run kunnen verschuiven en de trendvergelijking ondermijnen), **aangevuld met een live RAG-lookup naar de video-kennisbank** (`arnobot_video_kennisbank.txt`, al doorzoekbaar via `blog_chunks`) om de diagnose-tekst te onderbouwen met echte fragmenten uit Rockefeller Habits, exact het patroon dat `coaching/route.ts` al gebruikt voor blogaanbevelingen bij ontwikkelpunten (`getRelevantChunks`). **Verworpen alternatief:** alleen de vaste definitie, geen RAG-verrijking, verworpen omdat de diagnose dan alleen op parafrase leunt in plaats van op echt gegronde bronverwijzingen.

**Gebouwd en getest (2026-08-21).** `app/api/bot/team/zelfcoaching/route.ts`: GET (laatste synthese) + POST (nieuwe synthese genereren), gegated op `isConfirmedTeambaas`, cooldown 14 dagen + minimaal 3 nieuwe 1:1's sinds de vorige synthese (`used_1on1_ids`). Databronnen: eigen 1:1-log, per teamlid het laatste coachingprofiel, teamresultaten-trend (maandgemiddelden), De Spiegel-signaal (via nieuwe gedeelde `lib/spiegel.ts`, uitgefactored uit `team/spiegel/route.ts` om dubbele logica te voorkomen), laatste Team Spotlight-analyse, en 3 parallelle RAG-lookups (één per pijler) naar de video-kennisbank voor gegronde diagnose-fragmenten. Model `claude-fable-5` (zelfde afweging als de individuele coaching-hoofdsynthese: belangrijkste synthese van het traject, kosten geen factor). `computeSpeScore()` toegevoegd aan `lib/msa.ts` (30/40/30-weging). UI-kaart "JOUW LEIDERSCHAP" in `TeamClient.tsx`, tussen "JOUW 1:1-RITME" en "TEAMLEDEN".

**Live end-to-end geverifieerd** (niet alleen typecheck): eigen teststandaard, geseede testdata (fake teamlid, 3 1:1-logs, coachingprofiel, sessies) via een losse Playwright-sessie tegen een lokale dev-server met de ECHTE Anthropic-API (bewust niet de gemockte E2E-testomgeving, om echte output te kunnen beoordelen). Resultaat: SPE-score rekenkundig correct (2×0,3 + 3×0,4 + 3×0,3 = 2,7 → 54/100), en de diagnose-teksten reflecteerden de pijlerdefinities concreet en specifiek (bijv. Strategy-diagnose benoemde letterlijk het "deals verliezen op prijs"-signaal). Testdata en dev-server na afloop volledig opgeruimd.

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

## Punt 4 — besloten, niet bouwen (2026-08-21)

**Wat het zou zijn geweest:** "cultuur-pijler"-handvatten bovenop punt 5, ArnoBot zou een concreet signaal uit 1:1's/analyses koppelen aan een specifieke kernwaarde en een bijpassende tactiek voorstellen (bijv. storytelling, koppelen aan een functioneringsgesprek), gebaseerd op hoofdstuk 4 van `arnobot_video_kennisbank.txt` ("Kernwaarden onder de knie krijgen").

**Onderzocht en verworpen, twee varianten:**
- **Optie A: de sales baas legt zelf de kernwaarden van zijn team vast** (bijv. via een Missie-naar-Mars-achtige vragenflow), waarna signalen daaraan gekoppeld worden. Verworpen: vereist een nieuwe onboardingstap en een nieuw dataveld, Arno's eigen woorden: "nodeloos complex."
- **Optie B: een vaste, generieke kernwaardenlijst** (voorgesteld: afgeleid van Gazelles' zes kernwaarden uit hoofdstuk 4, herschreven naar DOE WAT JE ZEGT / KLANTEN VERRASSEN / KWALITEIT ZONDER OMWEGEN / WAARDEER EXPERTISE / EIGENAARSCHAP / NOOIT OPGEVEN). Ook verworpen: Arno's expliciete besluit, "laat dit stuk maar helemaal achterwege."

**Besluit:** punt 4 vervalt volledig uit de bouwvolgorde, geen van beide varianten wordt gebouwd. De bouwvolgorde gaat direct door naar punt 2B.

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

### Fase 2A/2B/2C — volledige beschrijving (uitgewerkt door Arno, 2026-08-20, vervangt de eerdere korte versie)

**2A — De Spiegel**, "Wat je team je niet vertelt." De meest waardevolle van de drie. ArnoBot ziet patronen over het hele team die individueel onzichtbaar blijven: een teamlid zegt in één gesprek niet "ik heb moeite met closing", maar over 10 gesprekken heen komt closing steeds terug. Technisch: per sessie met Haiku één of twee thema-labels extraheren (bijv. BEZWAARHANTERING, PIPELINE, MINDSET, CLOSING, PROSPECTING), opgeslagen als metadata bij de sessie (nieuwe thema-kolom op `arnobot_blog_sessions` of een aparte tagging-tabel, plus een cron die na elke sessie een label toewijst). Na voldoende data (circa 30+ sessies teambreed) frequentieanalyse: welke thema's domineren, groeien, verdwijnen. Signaal aan de manager, bijv.: "Closing is de afgelopen 3 weken het dominante thema geworden bij 4 van je 6 leden." Vergelijkbaar met wat BetterUp "team insights" noemt. Vereist geen extra input van de gebruiker of actie van de manager, groeit automatisch mee. Bouwt op 1.1 (drill-down) + Spotlight.

**2B — De Tijdlijn**, "Zo was je team 3 maanden geleden. Zo nu." Het geheugen van het team. Maandelijkse snapshot van de collectieve staat: gemiddelde scores per dimensie (mindset/systeem/actie), dominante thema's, actieve/inactieve leden (nieuwe tabel `arnobot_team_snapshots`, maandelijkse cron, tijdlijn-view in het dashboard). Na 3 maanden kan de manager zien: "In april scoorde het team gemiddeld 2.8 op actie, nu 3.4." Of: "In april was prospecting het dominante thema, nu bezwaarhantering." Toont beweging, dat bewijst coaching pas echt. Technisch het eenvoudigste van de drie. **Risico:** de tijdlijn is leeg tot er 2-3 maanden data is, bewust niet tonen tot dan, of vervangen door een "eerste meting"-UI. Bouwt op 2A (gelabelde data nodig).

**2C — De Manager als Variabele**, "Dit is geen individu-probleem." Het slimste van de drie, en het moeilijkst uit te leggen aan een gebruiker. Als 3 of meer teamleden onafhankelijk van elkaar hetzelfde thema laten zien, is de kans groot dat de manager de gemeenschappelijke variabele is, niet de teamleden. Voorbeeld: als drie leden in hun sessies allemaal "te weinig steun bij grote deals" noemen, en ze zitten in hetzelfde team met dezelfde manager, is de vraag niet meer individueel maar systemisch. 2A toont het patroon, 2C stelt de vraag wie de oorzaak is. **Confronterend, moet voorzichtig gebracht worden:** geen beschuldiging, wel een hypothese, bijv.: "Er is een patroon dat bij 3+ leden terugkomt. Dat kan toeval zijn, maar het kan ook betekenen dat er iets systemisch speelt in hoe het team werkt. Wil je dit bespreken?" Technisch: bouwt voort op 2A (thema-labels), detecteert of hetzelfde label bij 3+ leden in dezelfde periode dominant is, dan een signaal aan de manager. Vereist de meeste rijping, zowel in data als in vertrouwen van de manager. Dit is fase 3, niet fase 2. Bouwt op 2A + 2B.

**Belangrijke productinzicht voor 2B, vastgelegd op Arno's expliciete verzoek (2026-08-20, "kom er GEGARANDEERD op terug, dit is superbelangrijk"):** De Tijdlijn bouwt niet alleen een groeiverhaal, het bouwt een **dossier**, en dat dossier heeft ook waarde in het slechte geval: een teamlid dat niet groeit, ondanks structurele 1:1's en opvolging. De manager kan daarmee aantonen dat hij er alles aan heeft gedaan om die persoon te ondersteunen, zowel via de app als via de 1:1-gesprekken zelf. Dit is, hoe ongemakkelijk ook, een reële waarde van het product naast de primaire ontwikkelingsdoelstelling.

**Consequentie voor het ontwerp van 2B, zodra het wordt opgepakt:** De Tijdlijn moet nadrukkelijk niet alleen groei tonen. Stagnatie ondanks consistente coaching-inspanning is zelf een geldig, waardevol resultaat om eerlijk en neutraal weer te geven, niet iets om te verbloemen richting een positiever verhaal. Dit raakt geen nieuw privacyprobleem (de manager ziet nu al uitsluitend het gesynthetiseerde coachingprofiel, nooit ruwe gesprekken, zie het privacymodel hierboven), maar wel een expliciete toon-/ontwerpkeuze: neutrale documentatie van inspanning en resultaat, niet alleen positieve framing.

**Prioriteit, herzien (2026-08-20):** de eerdere aanname ("apart, later traject") is verlaten. 2A/2B/2C zijn samengevoegd met het coaching-op-de-coach-traject, zie de bouwvolgorde-tabel hierboven (2A → 5 → 4 → 2B → 2C). Reden: 2A versterkt punt 5 direct en heeft geen eigen afhankelijkheden, dus uitstellen zou alleen dubbel werk opleveren.
