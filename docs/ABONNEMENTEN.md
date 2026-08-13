# ArnoBot abonnementsstructuur — basic/pro/team (elite intern)

Referentiedocument voor de huidige plan-structuur, zodat besluiten hierover niet telkens opnieuw uit git-geschiedenis of losse sessies opgezocht hoeven te worden. **Bij elke wijziging aan de abonnementsstructuur dit document in dezelfde commit bijwerken.**

**Bron van waarheid voor bedragen, features en onderbouwing is `docs/PRICING_DECISIONS.md`.** Dit document (ABONNEMENTEN.md) is het overzichtsdocument: status, technische implementatie, historie en openstaande inconsistenties. Bij een afwijking tussen de twee documenten: PRICING_DECISIONS.md wint, en dit document wordt gecorrigeerd.

---

## Status

**Laatst bijgewerkt:** 2026-08-13
**Waar we staan:** `/prijzen`, `/bot/doorgaan` en `/team` (voorheen `/command`) tonen nu allemaal consistent Basic/Pro/Team met de nieuwe tarieven, inclusief een nieuwe jaaroptie voor Team (~20% korting, €77+€39/gebruiker maand-equivalent). Het referralprogramma (7 bestanden + FAQ) is bijgewerkt naar de nieuwe trigger- en plafondregel (zie "Referralprogramma" hieronder). Abacus (`/abacus`) is deze sessie grondig doorgelicht door twee onafhankelijke audit-agents (formules + UI-laag), 10 bevestigde bugs gefixed, incl. een kritieke: tab 3 (Business case) gebruikte altijd vaste standaardaannames i.p.v. tab 1's live ingestelde aannames, nu écht gedeeld. `/prijzen` haalt zijn bedragen uit `lib/kostenTarieven.ts` (zelfde bron als Abacus), niet meer los hardgecodeerd. **Besloten (2026-08-11):** Team Spotlight staat als 2e bullet op de `/prijzen`-Team-kaart; Elite blijft bewust alleen handmatig/op-aanvraag toekenbaar (geen publieke kaart), en is teruggebracht als optie binnen de `/team`-offerte-aanvraag met een vastgesteld surplus-tarief van €338/maand per Elite-teamlid (`lib/teamPricing.ts`, `TEAM_ELITE_SURPLUS_PER_MAAND`), inmiddels ook direct verwerkt in de getoonde prijs op `/team` zelf (niet alleen als toelichtende tekst). Uitvoering (het maandelijkse gesprek) kan door Arno zelf of een door hem aangewezen coach gebeuren, geen aparte publieke vermelding hiervan. **Elite-ervaring in de app (besloten 2026-08-11):** een Elite-gebruiker ziet in de app bewust hetzelfde als een Pro-gebruiker (geen aparte Elite-UI); Arno behandelt Elite-relaties zelf buiten de app om via losse afspraken. **Besloten (2026-08-13):** het eenmalige gesprek met Arno is nu expliciet Pro-only én alleen na betaling (`plan === 'premium' && paid`, naast de bestaande coachingdocument-drempel en team-uitsluiting; trials starten al standaard op `plan='premium'`, dus zonder de betaal-check zouden onbetaalde trials ook meetellen). Dezelfde vijf voorwaarden zijn in dezelfde ronde ook server-side afgedwongen op `/bot/gesprek` zelf (had voorheen geen enkele plan/betaalcheck, alleen een inlog-check, dus voor iedereen met de URL rechtstreeks bereikbaar). Calendly-agenda voor dit event ingesteld op een rolling 90-dagen-cap plus een schoon uur-ritme (60 min increments, 45 min gesprek, 15 min buffer); bij structurele volboeking binnen die 90 dagen is dat het signaal voor ArnoBot Coaches ABC, niet eerder. `/prijzen` heeft een nieuwe Pro-bullet ("Eén gesprek met Arno zelf"). Zie de nieuwe sectie "Gesprek met Arno (eenmalig, Pro)" verderop in dit document voor de volledige gating.
**Gevonden bij de financiële doorlichting (2026-08-10):** `/bot/upgrade` (bestaande gebruikers die willen upgraden) verwees nog naar "Premium" i.p.v. "Pro", en zei bij Team "prijs op aanvraag" terwijl Team al een echte berekende prijs heeft. Naam gecorrigeerd, Team-knop linkt nu naar `/team` i.p.v. een kale mailto.
**Eerstvolgende stap:**
- `[ ]` **Bewust aangehouden (2026-08-13), geen openstaande actie:** marketinguitingen laten kloppen met de nieuwe Pro-only-gating (knoptekst coachingpagina "Elke gebruiker krijgt één gratis gesprek", homepage-claim "vanaf dag één" in `app/page.tsx`, ontbrekende Pro-bullet op `/prijzen`). Twee tekstvoorstellen voor de homepage-zin lagen al klaar (sober-correct vs. "verdien het"-framing), Arno wilde dit voorlopig laten rusten, geen van beide is doorgevoerd. Basic is hoe dan ook al uitgesloten via de bestaande coachingpagina-blokkade, dus geen risico op een misleidende belofte richting Basic-gebruikers in de tussentijd, alleen richting Pro-gebruikers die de pagina nog niet bereikt hebben (homepage) blijft de oude, te ruime tekst voorlopig staan.
- `[ ]` Overwegen of `arnobot_command_requests` en de vestigiale `niveau`-kolom ooit een echte schema-opschoning verdienen (geen migratie nu, zie "Team-aanvraagflow"). Puur interne naamgeving, geen zichtbaar "Command"-restje voor gebruikers.
- `[ ]` **Openstaand bij Arno (niet code):** Supabase PITR nog niet aangezet ondanks Pro-upgrade op 2026-08-10, zie CLAUDE.md-milestone-sectie voor de restore-test die daarna hoort.

---

## De tiers (marketingnaam / databasewaarde)

| | **Basic** (`basis`) | **Pro** (`premium`) | **Team** (`team`) | **Elite** (`elite`) |
|---|---|---|---|---|
| Prijs | €19/mnd bij jaarbetaling (€228/jr), €29/mnd maandelijks | €39/mnd bij jaarbetaling (€468/jr), €59/mnd maandelijks | €97/mnd + €49/gebruiker/mnd, of €77/mnd-equiv. + €39/gebruiker/mnd-equiv. bij jaarbetaling (~20% korting), vanaf 3 gebruikers | €397/maand, alleen maandelijks, individueel |
| Zichtbaar op `/prijzen` | Ja | Ja | Ja, zonder staffel | **Nee**, sinds de 2026-08-02 redesign niet meer als kaart getoond |
| Trial | 30 dagen gratis | 30 dagen gratis | Geen aparte trial: manager start zelf als Pro (zie hieronder) | N.v.t., alleen handmatig toegekend |
| Coaching | Nee | Ja (mindset/systeem/actie) | Ja (erft alle Pro-functionaliteit) | Ja |
| Gesproken antwoorden | Nee | Ja | Ja | Ja |
| Command/Team-managerdashboard | Nee | Nee | Ja | Nee |
| Extra | — | Volledig archief, uitgebreider geheugen, ArnoBot-app (Android), 1x gesprek met Arno (alleen betaald, na coachingdocument, zie sectie hieronder) | Teamoverzicht, teamtrends, vroegsignalering, AI-voorbereiding 1:1's, leiderschapsaccount voor de manager | 1x/maand gesprek met Arno (nog niet herhaalbaar), Telegram-toegang (live), Elite Member Community (nog niet gebouwd) |

**Trial-standaard:** iedere nieuwe gebruiker krijgt bij aanmelden `plan='premium'` (=Pro) (`proxy.ts`), ongeacht welke kaart hij op `/prijzen` aanklikt. Alle "Start nu"-knoppen linken naar dezelfde generieke `/sign-up`. De definitieve keuze (Basic/Pro, of Elite via een aparte route) volgt pas bij `/bot/doorgaan`.

Volledige onderbouwing van deze bedragen (waarom €97 platformtarief, waarom geen staffel meer, waarom Team een kleinere jaarkorting krijgt dan Basic/Pro, feature-taal-logica) staat in `docs/PRICING_DECISIONS.md`, niet hier gedupliceerd.

---

## Functionele grenzen per tier (code-realiteit, niet marketingtaal)

De marketingcopy op `/prijzen` gebruikt bewust kwalificatieve taal ("onbeperkt", "uitgebreider") in plaats van kale getallen, zie `docs/PRICING_DECISIONS.md`. Dit zijn de daadwerkelijke, in code afgedwongen grenzen erachter, losgetrokken van die copy zodat de twee nooit per ongeluk uit elkaar lopen in dit document:

| Functionaliteit | Basic | Pro | Team (per lid) |
|---|---|---|---|
| Chatberichten/dag | 25 | 100 | 100, erft van Pro |
| Gespreksanalyses/dag | 1 | Onbeperkt | Onbeperkt |
| Sessiegeheugen (vorige gesprekken als context) | 10 | 25 | 25 |
| Coachingdocument (mindset/systeem/actie-scores) | **Nee, harde blokkade (403)** | Ja | Ja |
| Gesproken antwoorden (voice) | **Nee, geen toegang** | Ja, momenteel geen maandcap, **tijdelijk uitgezet voor iedereen buiten Arno's eigen accounts, zie `docs/VOICE_PLAN.md`** | Ja, zelfde tijdelijke uitzetting |
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

**Besloten (2026-08-11):** Elite blijft bewust alleen handmatig/op-aanvraag toekenbaar, zoals de oude verborgen Basis-retentietier, geen publieke kaart op `/prijzen`. Wel weer zichtbaar als optie binnen de `/team`-offerte-aanvraag (zie "Team-aanvraagflow" hieronder), niet als zelfstandige publieke keuze.

**1 uur/maand gesprek met Arno:** nog niet gebouwd, bestaande boekingsinfrastructuur (`/bot/gesprek`, `arno_call_booked_at`) ondersteunt maar één boeking ooit. Uitbreiding naar herhaalbare boekingen wacht op een betaald Calendly-account.

**Elite Member Community:** nog niet gebouwd, wordt later Circle, bewust achteraan gepland.

---

## Gesprek met Arno (eenmalig, Pro)

**Besloten (2026-08-13):** het eenmalige gratis gesprek met Arno (`/bot/gesprek`, Calendly-boeking, zie hierboven) is expliciet een Pro-only feature, en sinds dezelfde dag verder aangescherpt tot **betalende** Pro-klanten (niet trialgebruikers, zie hieronder). Eerder stond de knop op de coachingpagina open voor iedereen die geen teamlid was, ongeacht plan; Team-managers (`plan='team'`) konden 'm bijvoorbeeld ook bereiken.

**Gating, alle vijf moeten kloppen** (`app/bot/coaching/CoachingClient.tsx`, en sinds 2026-08-13 identiek server-side afgedwongen op `app/bot/gesprek/page.tsx` zelf, zie "Server-side afgedwongen" hieronder):
1. `doc` — er moet al een coachingdocument bestaan (minimaal 5 sessies gevoerd, zie de coaching-drempel elders in de code). **Bewuste keuze, niet een technische bijkomstigheid:** Arno wil eerst aantoonbare activiteit zien (sessies gevoerd, coachingdocument aangevraagd en gelezen) voordat iemand met hem in gesprek kan.
2. `plan === 'premium'` — alleen Pro. Basic bereikt de coachingpagina sowieso al niet (harde blokkade, zie functionele-grenzen-tabel hierboven).
3. **`paid` (`paid_at` niet leeg)** — toegevoegd 2026-08-13. Zonder deze check zou elke trialgebruiker al meetellen: de trial-standaardwaarde is namelijk óók `plan='premium'` (zie hierboven), dus `plan === 'premium'` alleen sluit trials niet uit. Besluit: "wie het eerst betaalt" heeft voorrang op "wie het eerst aanmeldt", juist omdat Arno's beschikbare tijd de knellende factor is (zie "Beperkte capaciteit" hieronder), niet het aantal accounts.
4. `!isTeamMember` — teamleden zien deze knop nooit, ook niet als ze zelf een coachingdocument hebben. Een gesprek met Arno voor een teamlid verloopt bewust via de manager, buiten de app om; geen in-app equivalent gepland (bevestigd 2026-08-13).
5. `!gesprekBookedAt` — verdwijnt na de eerste boeking (eenmalig, net als bij Elite hierboven, dezelfde onderliggende infrastructuur).

**Nuance teamleden vs. plan-veld:** een teamlid erft bij het joinen het `plan` van zijn team (`premium` of `elite`, zie `app/api/bot/team/join/route.ts`), dus puur op het `plan`-veld afgaan zou teamleden per ongeluk meenemen. Vandaar dat `!isTeamMember` een aparte, noodzakelijke voorwaarde is, niet overbodig naast de plan-check.

**Server-side afgedwongen (2026-08-13):** `/bot/gesprek` zelf had tot deze datum geen enkele plan/betaalcheck, alleen een inlog-check. De knop op de coachingpagina was dus het enige slot op de deur: elke ingelogde gebruiker die de URL kende (Basic, onbetaalde trial, teamlid) kon rechtstreeks een Calendly-afspraak boeken. Gevonden bij het doorvoeren van de `paid`-check, in dezelfde ronde gefixt: dezelfde vijf voorwaarden worden nu ook server-side op de pagina zelf gecontroleerd, met een duidelijke uitlegtekst i.p.v. de boekingsflow voor wie niet in aanmerking komt. Wie al geboekt heeft (`arno_call_booked_at` gezet) ziet gewoon zijn boekingsbevestiging, ongeacht huidige plan/betaalstatus, dat blijft ongewijzigd.

**Beperkte capaciteit, Calendly-instelling (2026-08-13):** het Calendly-event achter `ARNO_BOOKING_URL` (`https://calendly.com/arnobot/ab`, intern "ArnoLive" genoemd, hetzelfde event als voor demo-aanvragen en het betaalde ArnoLive-product, zie "Doorverwijzing 'Vraag een demo aan'" hierboven) is ingesteld op een rolling date range van 90 dagen (niet verder dan circa 3 maanden vooruit boekbaar), plus start time increments van 60 minuten met een buffer van 15 minuten na elk gesprek (45 minuten gesprek + 15 minuten buffer = een schoon uur-ritme, geen los tussenliggend gat). Reden: Arno's beschikbare tijd voor deze gesprekken groeit niet mee met het aantal gebruikers. Zodra de agenda binnen die 90 dagen structureel vol loopt, is dat het signaal om over te stappen naar ArnoBot Coaches ABC (gecertificeerde coaches die gesprekken overnemen, onderdeel van het bredere "man & machine"-concept, zie geheugen `project-abc-man-machine`), niet eerder.

**Nog niet gedaan:** de knoptekst zelf ("Elke gebruiker krijgt één gratis gesprek") en de homepage-claim ("Bij elk account is één persoonlijk gesprek met Arno inbegrepen, vanaf dag één", `app/page.tsx`) zijn nog niet bijgewerkt naar deze betaalde-Pro-only, na-coachingdocument-realiteit. `/prijzen` heeft inmiddels wel een correcte bullet ("Eén gesprek met Arno zelf") op de Pro-kaart (2026-08-13). Homepage/knoptekst: bewust aangehouden op Arno's verzoek, zie het statusblok bovenaan dit document.

---

## Bekende inconsistenties, nog open

- **`arnobot_command_requests`-kolommen `niveau`/`cyclus`:** deze tabel (en zijn kolomnamen) is niet hernoemd/gemigreerd bij de `/command` → `/team`-rename (zie "Team-aanvraagflow" hieronder), om geen Supabase-migratie nodig te hebben voor iets dat puur intern is. De app stuurt nu altijd de vaste waarde `'premium'` voor `niveau` in, ook al bestaat die keuze niet meer in de UI. Cosmetisch, geen functioneel probleem, wel iets om ooit op te schonen.

**Opgelost (2026-08-10):** `/bot/doorgaan` synchroon met Basic/Pro, `/command` verplaatst naar `/team` met de vlakke Team-prijs (geen staffel, geen niveau-keuze) inclusief een nieuwe jaaroptie (~20% korting), en de referral-copy (7 bestanden + FAQ) bijgewerkt naar de nieuwe trigger- en plafondregel (zie "Referralprogramma" hieronder).
**Opgelost (2026-08-10):** `/prijzen` hardcodete eerder zijn eigen bedragen los van `lib/kostenTarieven.ts`. Haalt nu dezelfde constanten op als Abacus (`SCENARIO_PRIJZEN`, `SCENARIO_TEAM_PRIJS`), geen losse hardgecodeerde bedragen meer.
**Opgelost (2026-08-11):** Team Spotlight-bullet toegevoegd aan `/prijzen`, Elite publieke status besloten (handmatig/op-aanvraag), Elite-surplustarief vastgesteld en gebouwd in de `/team`-aanvraagflow (zie "Team-aanvraagflow" hieronder voor de nog openstaande SQL-actie).

---

## Team (voorheen "Command"), marketingnaam versus databasewaarde

Besloten (2026-07-23): de site noemde dit plan een tijd lang overal "Command"; sinds de 2026-08-02 redesign heet de marketingnaam weer "Team" (zie tabel hierboven). **Uitgebreid (2026-08-10):** ook de publieke aanvraagpagina zelf is hernoemd, `/command` bestaat niet meer, is nu `/team` (`app/team/page.tsx`, API-route `app/api/team-aanvraag/route.ts`). De onderliggende Supabase-waarde `plan='team'` en de tabelnaam `arnobot_command_requests` zijn bewust **niet** meegehernoemd, geen datamigratie nodig voor iets dat puur marketing/URL is. Bij toekomstig werk aan deze tier: zoek in de database op `team`/`arnobot_command_requests`, niet op `command`.

### Command-managerdashboard: toegang losgekoppeld van `plan`

Dashboardtoegang draait op een losse kolom **`command_manager`** (boolean op `approved_users`, naam bewust ongewijzigd, zelfde reden als hierboven), niet op `plan` zelf. `/bot/team` (pagina + team-aanmaak-API) checkt `command_manager === true`, naast de bouwer-uitzondering. `/api/bot/plan` geeft zowel `plan` als `commandManager` terug; `BotNav.tsx`/`SparClient.tsx` tonen de TEAM-link op basis van `commandManager`.

**Waarom losgekoppeld:** ten tijde van dit ontwerp kon een Team-groep volledig Pro-niveau óf volledig Elite-niveau zijn (via de oude `/command`-staffelflow), en met `plan==='team'` als enige schakelaar was er geen manier om iemand tegelijk Elite-functies te geven én toegang tot het managerdashboard. Inmiddels (2026-08-10) heeft Team geen niveau-keuze meer, maar de kolom blijft losgekoppeld, geen reden om dat terug te draaien.

**Belangrijk, ongewijzigd:** dit blijft losstaand van de collaboration-teamfunctie zelf (`arnobot_teams`/`arnobot_team_members`, tot 25 leden, gaat over gezamenlijke coaching-dashboards/1:1's). Geen technische koppeling tussen "aantal seats waarvoor betaald is" en "aantal leden in het collaboration-team".

### Team-aanvraagflow (`/team`, tot 2026-08-10 `/command`)

**Volledig herzien (2026-08-10):** geen niveau-keuze meer (Premium/Elite is vervallen als publieke keuze op deze pagina, zie open punt hieronder), geen gestaffelde prijs meer. Nu: vlakke prijs €97 platformtarief + €49/gebruiker/maand, of €77 + €39/gebruiker/maand-equivalent bij jaarlijkse vooruitbetaling (~20% korting, toegevoegd later dezelfde dag), vanaf 3 gebruikers. Rekenlogica in `lib/teamPricing.ts` (`berekenTeamPrijsPerMaand`), vervangt het oude `lib/commandPricing.ts` (verwijderd).

**Elite-optie (besloten en gebouwd 2026-08-11, nog niet live):** `/team` heeft nu een checkbox "Ook Elite-niveau voor een deel van je team" plus een aantal-veld, met een vast surplus van €338/maand per Elite-teamlid (`TEAM_ELITE_SURPLUS_PER_MAAND` in `lib/teamPricing.ts`, = verschil tussen solo Elite €397 en solo Pro €59, geen aparte jaarkorting op dit bedrag). De API-route (`app/api/team-aanvraag/route.ts`) valideert en slaat dit op in een nieuwe kolom `elite_aantal` op `arnobot_command_requests`, en vermeldt het in de offerte-notificatiemail.

**Actie vereist van Arno vóór dit live gaat:** voer de volgende SQL uit in Supabase (SQL Editor, project wxrsmmzqbmoeackirsxc):
```sql
ALTER TABLE arnobot_command_requests ADD COLUMN elite_aantal integer;
```
Bevestig na uitvoering dat de kolom is aangemaakt (bijv. via Table Editor), pas daarna wordt deze wijziging gecommit en gepusht — zonder de kolom faalt elke `/team`-aanvraag stil op de insert.

Publieke pagina (geen `/bot`-prefix, geen inlog vereist). Formulier: bedrijfsnaam, KvK-nummer, btw-nummer, factuuradres, aanvrager, bestelnummer (optioneel), aantal gebruikers, jaarlijks/maandelijks-toggle, live berekende prijs excl. btw.

Opslag: tabel `arnobot_command_requests` (Supabase, naam bewust ongewijzigd), plus e-mailmelding naar `arno@arno.bot` per aanvraag (`app/api/team-aanvraag/route.ts`).

**Vestigiale kolom `niveau`, `cyclus` weer betekenisvol:** de tabel heeft nog een `niveau`-kolom uit de oude staffelflow die niet meer overeenkomt met wat de UI aanbiedt (geen niveau-keuze meer), de route stuurt hiervoor nu altijd `'premium'` als vaste, geldige filler-waarde, geen Supabase-migratie nodig. `cyclus` is sinds de jaaroptie weer een echte, betekenisvolle waarde (`'maandelijks'`/`'jaarlijks'`), niet langer vestigiaal.

**Supabase-inrichting na aanvraag: volledig handmatig, blijvend.** Arno zoekt de aanvrager na akkoord handmatig op in `approved_users`, zet `command_manager=true` en `plan`, en `paid_at` zodra de factuur betaald is.

**Afgerond en losgelaten: DocuSeal-offerte-automatisering.** Was gebouwd en getest, maar het brondocument-template liep vast op opmaakproblemen en heeft nooit echt gedraaid. Besloten (2026-08-01): niet hervatten. Arno gebruikt DocuSeal niet meer en heeft geen account meer. De code (`lib/docusealOffer.ts` en de aanroep ervan) is verwijderd.

**Openstaand: seat-wijzigingen ná ondertekening.** Zie geheugen `project-team-pricing` voor de volledige uitwerking. Volledig handmatig voorlopig, het onderliggende gat (geen koppeling tussen `/bot/team`-lidmaatschap en betaalde seats) moet eerder opgelost worden dan de facturatielogica zelf. **Jaaroptie alsnog gebouwd (2026-08-10):** eerder bewust uitgesteld vanwege fluctuerende teamgrootte, op Arno's verzoek alsnog toegevoegd met een true-up-model: jaarprijs staat vast op het aantal gebruikers bij tekenen, nieuwe gebruikers worden apart maandelijks bijgefactureerd tot de volgende jaarvernieuwing, weggevallen gebruikers worden niet terugbetaald. Dit true-up-proces zelf is (nog) niet in code afgedwongen, blijft net als de rest van de facturatie handmatig.

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
- Elite terugbrengen als keuze binnen de `/team`-aanvraagflow, incl. het surplus-tarief (zie "Team-aanvraagflow" hierboven)
- Alle punten uit de "Eerstvolgende stap"-lijst bovenaan dit document
