# ArnoBot abonnementsstructuur — basic/pro/team (elite intern)

Referentiedocument voor de huidige plan-structuur, zodat besluiten hierover niet telkens opnieuw uit git-geschiedenis of losse sessies opgezocht hoeven te worden. **Bij elke wijziging aan de abonnementsstructuur dit document in dezelfde commit bijwerken.**

**Bron van waarheid voor bedragen, features en onderbouwing is `docs/PRICING_DECISIONS.md`.** Dit document (ABONNEMENTEN.md) is het overzichtsdocument: status, technische implementatie, historie en openstaande inconsistenties. Bij een afwijking tussen de twee documenten: PRICING_DECISIONS.md wint, en dit document wordt gecorrigeerd.

---

## Status

**Laatst bijgewerkt:** 2026-08-10
**Waar we staan:** `/prijzen`, `/bot/doorgaan` en `/team` (voorheen `/command`) tonen nu allemaal consistent Basic/Pro/Team met de nieuwe tarieven. Het referralprogramma (7 bestanden + FAQ) is bijgewerkt naar de nieuwe trigger- en plafondregel (zie "Referralprogramma" hieronder). Belangrijkste openstaande punt: de database-kolommen `niveau`/`cyclus` op `arnobot_command_requests` bestaan nog uit de oude Command-staffelflow en krijgen nu een vaste filler-waarde, zie "Team-aanvraagflow" hieronder.
**Eerstvolgende stap:** geen vaste volgorde afgesproken:
- `[ ]` `/prijzen` koppelen aan `lib/kostenTarieven.ts` in plaats van eigen hardgecodeerde bedragen
- `[ ]` Besluiten of de wekelijkse Team Spotlight-bullet terugkomt op de Team-kaart
- `[ ]` Verifiëren of de upgrade-flow individuele Pro-trial → Team al functioneel bestaat in de app
- `[ ]` Besluiten of Elite nog actief aan nieuwe klanten aangeboden wordt nu de tier niet meer op `/prijzen` of `/bot/doorgaan` als publieke keuze staat (zie "Elite" hieronder)
- `[ ]` Overwegen of `arnobot_command_requests` en de `niveau`/`cyclus`-kolommen ooit een echte schema-opschoning verdienen (geen migratie nu, zie "Team-aanvraagflow")

---

## De tiers (marketingnaam / databasewaarde)

| | **Basic** (`basis`) | **Pro** (`premium`) | **Team** (`team`) | **Elite** (`elite`) |
|---|---|---|---|---|
| Prijs | €19/mnd bij jaarbetaling (€228/jr), €29/mnd maandelijks | €39/mnd bij jaarbetaling (€468/jr), €59/mnd maandelijks | €97/mnd platformtarief + €49/gebruiker/mnd, vanaf 3 gebruikers, alleen maandelijks | €397/maand, alleen maandelijks, individueel |
| Zichtbaar op `/prijzen` | Ja | Ja | Ja, zonder staffel | **Nee**, sinds de 2026-08-02 redesign niet meer als kaart getoond |
| Trial | 30 dagen gratis | 30 dagen gratis | Geen aparte trial: manager start zelf als Pro (zie hieronder) | N.v.t., alleen handmatig toegekend |
| Coaching | Nee | Ja (mindset/systeem/actie) | Ja (erft alle Pro-functionaliteit) | Ja |
| Gesproken antwoorden | Nee | Ja | Ja | Ja |
| Command/Team-managerdashboard | Nee | Nee | Ja | Nee |
| Extra | — | Volledig archief, uitgebreider geheugen, ArnoBot-app (Android) | Teamoverzicht, teamtrends, vroegsignalering, AI-voorbereiding 1:1's, leiderschapsaccount voor de manager | 1x/maand gesprek met Arno (nog niet herhaalbaar), Telegram-toegang (live), Elite Member Community (nog niet gebouwd) |

**Trial-standaard:** iedere nieuwe gebruiker krijgt bij aanmelden `plan='premium'` (=Pro) (`proxy.ts`), ongeacht welke kaart hij op `/prijzen` aanklikt. Alle "Start nu"-knoppen linken naar dezelfde generieke `/sign-up`. De definitieve keuze (Basic/Pro, of Elite via een aparte route) volgt pas bij `/bot/doorgaan`.

Volledige onderbouwing van deze bedragen (waarom €97 platformtarief, waarom geen staffel meer, waarom geen jaaroptie bij Team, feature-taal-logica) staat in `docs/PRICING_DECISIONS.md`, niet hier gedupliceerd.

---

## Functionele grenzen per tier (code-realiteit, niet marketingtaal)

De marketingcopy op `/prijzen` gebruikt bewust kwalificatieve taal ("onbeperkt", "uitgebreider") in plaats van kale getallen, zie `docs/PRICING_DECISIONS.md`. Dit zijn de daadwerkelijke, in code afgedwongen grenzen erachter, losgetrokken van die copy zodat de twee nooit per ongeluk uit elkaar lopen in dit document:

| Functionaliteit | Basic | Pro | Team (per lid) |
|---|---|---|---|
| Chatberichten/dag | 25 | 100 | 100, erft van Pro |
| Gespreksanalyses/dag | 1 | Onbeperkt | Onbeperkt |
| Sessiegeheugen (vorige gesprekken als context) | 10 | 25 | 25 |
| Coachingdocument (mindset/systeem/actie-scores) | **Nee, harde blokkade (403)** | Ja | Ja |
| Gesproken antwoorden (voice) | **Nee, geen toegang** | Ja, momenteel geen maandcap | Ja |
| Rollenspel/sparring | Ja | Ja | Ja |
| Teamoverzicht, 1:1-voorbereiding, leiderschapsaccount | Nee | Nee | Ja, exclusief manager-laag |

**Belangrijk onderscheid:** bij Basic is coachingdocument en voice niet een afgeslankte versie, het is een harde nul (expliciete blokkade/geen toegang). Dit is een principieel verschil, geen gradueel verschil, en hoort dus ook zo in copy terug te komen (niet als "minder", maar als "niet inbegrepen").

**Kanttekening:** deze cijfers zijn de huidige code-realiteit onder de bestaande `basis`/`premium`-plan-waarden, nog niet herbouwd onder de naam Basic/Pro zelf (zie "Bekende inconsistenties" hieronder voor waar de naamgeving nog niet is doorgevoerd). Ze zijn wel de beste beschikbare basis om nu mee te werken, bron: directe code-inspectie plus `docs/PRICING_DECISIONS.md`, sectie "Onderliggende technische realiteit".

---

## Elite: nog actief, maar nergens meer publiek kiesbaar

Elite (`plan='elite'`) is niet verwijderd, maar sinds 2026-08-10 ook niet meer publiek kiesbaar: `/prijzen` toont de tier al sinds 2026-08-02 niet meer, en `/bot/doorgaan` bood tot 2026-08-10 nog een Premium/Elite-keuze bij trial-einde, die is bij het synchroniseren met Basic/Pro vervangen (Elite is uit die keuze verdwenen, niet bewust een besluit om Elite af te bouwen, gewoon een gevolg van 1:1 overnemen van de nieuwe `/prijzen`-structuur). De tier bestaat verder nog volledig:
- Nog toekenbaar via de admin `PlanToggle.tsx` (`/bot/admin/gebruikers`)
- Capaciteitscap van 50 actieve Elite-klanten blijft gelden, zichtbaar als teller in de admin-gebruikerslijst
- Telegram-toegang (`t.me/arnodiepeveen`) blijft live voor Elite-klanten via `/bot/account`

**Nog niet expliciet besloten, nu urgenter:** met Elite nergens meer publiek zichtbaar, kan een nieuwe klant het niet meer zelf kiezen, alleen via een handmatige toekenning door Arno. Is dat gewenst (Elite wordt bewust alleen nog handmatig/op aanvraag toegekend, zoals de oude verborgen Basis-retentietier), of moet Elite ergens terugkomen als zichtbare keuze? Bij twijfel eerst aan Arno voorleggen voordat hierop verder gebouwd wordt.

**1 uur/maand gesprek met Arno:** nog niet gebouwd, bestaande boekingsinfrastructuur (`/bot/gesprek`, `arno_call_booked_at`) ondersteunt maar één boeking ooit. Uitbreiding naar herhaalbare boekingen wacht op een betaald Calendly-account.

**Elite Member Community:** nog niet gebouwd, wordt later Circle, bewust achteraan gepland.

---

## Bekende inconsistenties, nog open (2026-08-10)

- **`lib/kostenTarieven.ts` vs. `/prijzen`:** `/prijzen` hardcodet zijn eigen bedragen, verwijst niet naar `TARIEVEN.prijsBasisEur`/`prijsPremiumEur` (die wel al op de nieuwe 29/59 staan). Twee plekken die bij een volgende prijswijziging uit elkaar kunnen lopen. Geen gebruikersgerichte pagina, interne Abacus-koppeling, apart traject.
- **`arnobot_command_requests`-kolommen `niveau`/`cyclus`:** deze tabel (en zijn kolomnamen) is niet hernoemd/gemigreerd bij de `/command` → `/team`-rename (zie "Team-aanvraagflow" hieronder), om geen Supabase-migratie nodig te hebben voor iets dat puur intern is. De app stuurt nu altijd de vaste waarden `'premium'`/`'maandelijks'` in, ook al bestaat die keuze niet meer in de UI. Cosmetisch, geen functioneel probleem, wel iets om ooit op te schonen.

**Opgelost (2026-08-10):** `/bot/doorgaan` synchroon met Basic/Pro, `/command` verplaatst naar `/team` met de vlakke Team-prijs (geen staffel, geen niveau-keuze, geen jaaroptie), en de referral-copy (7 bestanden + FAQ) bijgewerkt naar de nieuwe trigger- en plafondregel (zie "Referralprogramma" hieronder).

---

## Team (voorheen "Command"), marketingnaam versus databasewaarde

Besloten (2026-07-23): de site noemde dit plan een tijd lang overal "Command"; sinds de 2026-08-02 redesign heet de marketingnaam weer "Team" (zie tabel hierboven). **Uitgebreid (2026-08-10):** ook de publieke aanvraagpagina zelf is hernoemd, `/command` bestaat niet meer, is nu `/team` (`app/team/page.tsx`, API-route `app/api/team-aanvraag/route.ts`). De onderliggende Supabase-waarde `plan='team'` en de tabelnaam `arnobot_command_requests` zijn bewust **niet** meegehernoemd, geen datamigratie nodig voor iets dat puur marketing/URL is. Bij toekomstig werk aan deze tier: zoek in de database op `team`/`arnobot_command_requests`, niet op `command`.

### Command-managerdashboard: toegang losgekoppeld van `plan`

Dashboardtoegang draait op een losse kolom **`command_manager`** (boolean op `approved_users`, naam bewust ongewijzigd, zelfde reden als hierboven), niet op `plan` zelf. `/bot/team` (pagina + team-aanmaak-API) checkt `command_manager === true`, naast de bouwer-uitzondering. `/api/bot/plan` geeft zowel `plan` als `commandManager` terug; `BotNav.tsx`/`SparClient.tsx` tonen de TEAM-link op basis van `commandManager`.

**Waarom losgekoppeld:** ten tijde van dit ontwerp kon een Team-groep volledig Pro-niveau óf volledig Elite-niveau zijn (via de oude `/command`-staffelflow), en met `plan==='team'` als enige schakelaar was er geen manier om iemand tegelijk Elite-functies te geven én toegang tot het managerdashboard. Inmiddels (2026-08-10) heeft Team geen niveau-keuze meer, maar de kolom blijft losgekoppeld, geen reden om dat terug te draaien.

**Belangrijk, ongewijzigd:** dit blijft losstaand van de collaboration-teamfunctie zelf (`arnobot_teams`/`arnobot_team_members`, tot 25 leden, gaat over gezamenlijke coaching-dashboards/1:1's). Geen technische koppeling tussen "aantal seats waarvoor betaald is" en "aantal leden in het collaboration-team".

### Team-aanvraagflow (`/team`, tot 2026-08-10 `/command`)

**Volledig herzien (2026-08-10):** geen niveau-keuze meer (Premium/Elite is vervallen), geen jaaroptie meer, geen gestaffelde prijs meer. Nu: vlakke prijs €97 platformtarief + €49 per gebruiker/maand, vanaf 3 gebruikers, uitsluitend maandelijks. Rekenlogica in `lib/teamPricing.ts` (`berekenTeamPrijsPerMaand`), vervangt het oude `lib/commandPricing.ts` (verwijderd).

Publieke pagina (geen `/bot`-prefix, geen inlog vereist). Formulier: bedrijfsnaam, KvK-nummer, btw-nummer, factuuradres, aanvrager, bestelnummer (optioneel), aantal gebruikers, live berekende prijs excl. btw.

Opslag: tabel `arnobot_command_requests` (Supabase, naam bewust ongewijzigd), plus e-mailmelding naar `arno@arno.bot` per aanvraag (`app/api/team-aanvraag/route.ts`).

**Vestigiale kolommen `niveau`/`cyclus`:** deze tabel heeft nog kolommen uit de oude staffelflow die niet meer overeenkomen met wat de UI aanbiedt. De route stuurt nu altijd `niveau: 'premium'` en `cyclus: 'maandelijks'` mee als vaste, geldige filler-waarden, zodat er geen Supabase-schema-migratie nodig is. Puur cosmetisch record-technisch, geen functionele impact, zie ook "Bekende inconsistenties" hierboven.

**Supabase-inrichting na aanvraag: volledig handmatig, blijvend.** Arno zoekt de aanvrager na akkoord handmatig op in `approved_users`, zet `command_manager=true` en `plan`, en `paid_at` zodra de factuur betaald is.

**Afgerond en losgelaten: DocuSeal-offerte-automatisering.** Was gebouwd en getest, maar het brondocument-template liep vast op opmaakproblemen en heeft nooit echt gedraaid. Besloten (2026-08-01): niet hervatten. Arno gebruikt DocuSeal niet meer en heeft geen account meer. De code (`lib/docusealOffer.ts` en de aanroep ervan) is verwijderd.

**Openstaand: seat-wijzigingen ná ondertekening.** Zie geheugen `project-team-pricing` voor de volledige uitwerking. Volledig handmatig voorlopig, het onderliggende gat (geen koppeling tussen `/bot/team`-lidmaatschap en betaalde seats) moet eerder opgelost worden dan de facturatielogica zelf. **Ook nog niet besloten (2026-08-10):** of Team ooit een jaaroptie krijgt. Technisch eenvoudig, maar bewust uitgesteld vanwege fluctuerende teamgrootte en het ontbreken van een betaalprovider (handmatige facturatie maakt een true-up bij tussentijdse seat-wijzigingen extra handwerk). Bij concrete vraag van een klant: jaarprijs vastzetten op het aantal seats bij tekenen, nieuwe seats apart maandelijks bijfactureren tot de volgende jaarvernieuwing, weggevallen seats niet terugbetalen (gangbare aanpak).

**Doorverwijzing "Vraag een demo aan":** knop op `/prijzen` en `/bot/doorgaan`, linkt naar de bestaande Calendly-boeking (`ARNO_BOOKING_URL`), niet naar `/team`. Arno gebruikt voorlopig hetzelfde Calendly-event voor demo-aanvragen en de losse "gratis gesprek"-boeking tijdens de trial.

**PostHog/Pageview-tracking (2026-08-10):** `/command` stond in de `UITGESLOTEN_PREFIXES`-lijst van `PostHogTracker.tsx`/`PageviewTracker.tsx`, zonder duidelijke reden hiervoor terug te vinden (de eerdere PostHog-scope-notitie in CLAUDE.md noemt alleen `/bot`, `/abacus`, `/api` en auth-routes als bedoelde uitsluitingen). Bij de rename is dit niet meegenomen naar `/team`: de pagina wordt nu getrackt, net als `/prijzen`. Als dit een bewuste, ongedocumenteerde keuze was, moet `/team` alsnog teruggezet worden in beide uitsluitingslijsten.

---

## Trial-einde-flow (`/bot/doorgaan`)

**Gesynchroniseerd met Basic/Pro (2026-08-10).** Biedt nu dezelfde keuze als `/prijzen`: Basic en Pro, met een gedeelde jaarlijks/maandelijks-toggle boven de twee kaarten (niet meer twee losse toggles per kaart zoals de oude Premium/Elite-versie). Elite is uit deze flow verdwenen (geen bewust besluit om Elite af te bouwen, gevolg van 1:1 overnemen van `/prijzen`, zie "Elite" hierboven). Zet bij het kiezen `plan` op de gekozen waarde (`POST /api/bot/confirm-renewal` accepteert nu `'basis'` of `'premium'` als `plan`-parameter, was `'premium'`/`'elite'`).

**Stijluitzondering, vastgelegd in CLAUDE.md:** deze pagina (en toekomstige vergelijkbare conversiemomenten binnen `/bot`) gebruikt de marketingstijl (Figtree/Oswald, zoals `/prijzen` en de homepage), niet de standaard `/bot`-stijl (Space Mono/Bebas Neue). Reden: dit is inhoudelijk een conversiemoment, geen gewone in-app functionaliteit.

Technisch gesplitst in een server `page.tsx` (leest `ARNO_BOOKING_URL` server-side) en een `DoorgaanClient.tsx` (interactieve logica).

Preview-modus: `?preview=idle` in de URL toont de plankeuze ongeacht de echte renewal-status van de ingelogde gebruiker, zonder Supabase aan te raken.

**Vaste regel:** in alle factuur-gerelateerde copy is **ArnoBot** de afzender, nooit de persoon Arno ("ArnoBot stuurt je een factuur"). Geldt niet voor support-verwijzingen ("mail naar arno@arno.bot bij vragen").

---

## Referralprogramma, herzien na de Basic/Pro/Team-rename (2026-08-10)

Volledige onderbouwing en de discussie die tot deze regel leidde staat in het geheugen `project-referral-basic-exclusion`, hier alleen de vastgestelde regel:

- **Trigger:** er ontstaat alleen tegoed voor de referrer als de nieuw geworven gebruiker zelf voor Pro of Team kiest. Kiest die voor Basic, dan ontstaat er geen tegoed, voor niemand.
- **Plafond:** het tegoed is nooit hoger dan wat de referrer zelf per maand betaalt op zijn eigen abonnement: Basic €19 of €29, Pro €39 of €59, Team €49.
- **Nieuwe gebruiker (ongewijzigd):** krijgt altijd de eerste betaalmaand gratis, ongeacht welk abonnement gekozen wordt. Dat staat los van de referrer-trigger hierboven.

**Doorgevoerd in 8 plekken:** `app/bot/qa/QAClient.tsx` (hoofdprijs-FAQ + 2 referral-FAQ's), `app/referrals/page.tsx` (spelregels-document, versie 1.3 → 1.4), `app/bot/profiel/ReferralSection.tsx`, `app/api/bot/referral/route.ts`, `lib/email-templates.ts` (`referral_aanmelding`-template), `app/evaluatie/page.tsx`.

**Niet aangepast, bewust:** het Supabase-veld `referral_credit` op `approved_users` wordt nergens in de code automatisch opgehoogd, alleen uitgelezen. Het toekennen van tegoed is en blijft volledig handmatig (Arno berekent en vult het zelf in), deze wijziging verandert daar niets aan, alleen de copy die uitlegt hoeveel dat tegoed hoort te zijn.

---

## Technische implementatie

- Kolom `plan` (`text`, `NOT NULL`, `DEFAULT 'premium'`, `CHECK (plan IN ('basis','premium','elite','team'))`) op Supabase-tabel `approved_users`. **Blijft intern `basis`/`premium`/`elite`/`team`, geen migratie naar `basic`/`pro`** (besloten 2026-08-02): alleen de naar buiten getoonde tekst op `/prijzen` is Basic/Pro, dat staat los in de pagina's zelf. Zelfde patroon als Command/Team.
- Admin-beheer: `/bot/admin/gebruikers`, toggle-knop per gebruiker (`PlanToggle.tsx` → `POST /api/admin/plan`, waarden basis/premium/elite, `team` niet meer actief toekenbaar via deze toggle), plus de Elite-capaciteitsteller. Command-managerschap apart via `CommandManagerToggle`.
- Route `/api/bot/plan` (GET): geeft `plan` én `commandManager` van de ingelogde gebruiker terug, gebruikt door client-side navigatie (`BotNav`, `SparClient`).
- Gating-logica: `app/api/chat/route.ts`, `app/api/bot/coaching*`, `lib/voice.ts` (`hasVoiceAccess`) — allemaal "alles behalve basis", geen aparte code nodig per nieuw plan (dus `elite` viel hier al automatisch onder toen de waarde bestond).
- Alle betalingen blijven handmatig geregistreerd, voor elke tier, geen payment provider aangesloten.

---

## Openstaande vragen / nog niet besloten

**Bewust uitgesteld, met reden:**
- Seat-wijzigingen ná ondertekening (zie geheugen `project-team-pricing`)
- Herhaalbare maandelijkse boeking voor Elite (nu maar één boeking ooit mogelijk): wacht op een betaald Calendly-account
- Elite Member Community (Circle): bewust als allerlaatste in de bouwvolgorde
- Betaalprovider/Stripe: bewust helemaal achteraan, na alle andere onderdelen

**Nog te beoordelen:**
- Of en wanneer bestaande betalende klanten geïnformeerd worden over prijswijzigingen die hen raken sinds de vorige migratie
- Status van Elite nu de tier nergens meer publiek kiesbaar is (zie "Elite" hierboven)
- Of Team ooit een jaaroptie krijgt (zie "Team-aanvraagflow" hierboven)
- Alle punten uit de "Eerstvolgende stap"-lijst bovenaan dit document
