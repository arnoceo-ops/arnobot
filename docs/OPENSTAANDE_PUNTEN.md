# Openstaande punten — momentopname

**Gemaakt:** 2026-08-30
**Aard:** geconsolideerde momentopname uit `CLAUDE.md`, alle plandocumenten en het sessiegeheugen, op verzoek als sessie-overstijgende reminder. **Dit is geen live tracker.** De bron van waarheid blijft per onderwerp het betreffende plandocument en de "Openstaand"-markeringen in `CLAUDE.md`. Bij de eerstvolgende kwartaalcheck (punt 11) tegen de werkelijkheid houden en daarna verwijderen of verversen, niet eindeloos laten meelopen.

**Bewust weggelaten:** de Android-app, plus alles wat puur op de betaalprovider-integratie wacht: dunning-flow, voice fase 3 / pricingpagina, sales-agent-omzetmeting en -uitbetaling, herhaalbare Elite-boeking. **De betaalprovider-keuze zelf is genomen (2026-09-02): Stripe voor de hele EU (B2C + B2B), Paddle voor de rest van de wereld, sequentieel. Zie `docs/PAYMENTS_PLAN.md`.**

## Vóór de commerciële livegang

- **Abonnementsvoorwaarden juridisch laten nakijken (NL SaaS + consumentenrecht).** `app/voorwaarden/page.tsx` artikel 7 klopt niet voor B2C: de jaarclausule (2 maanden opzegtermijn, anders een jaar erbij) is vermoedelijk nietig onder de Wet Van Dam, en de maandclausule botst met "Maandelijks opzegbaar" op `/prijzen`. Plus: auto-verleng-disclosure in de checkout, 14-dagen-herroepingsrecht-opt-in voor digitale content. Details en richting in `docs/PAYMENTS_PLAN.md` → "Opzegging, verlenging en consumentenrecht".
- **`/prijzen` claimt "Maandelijks opzegbaar"** terwijl artikel 7(b) een maand opzegtermijn mét doorbetaling oplegt. Intern tegenstrijdig, meenemen in de voorwaarden-herziening.

---

## Harde deadlines, agenderen

- **Anthropic API-keys verlopen 6 januari 2027** (arnobot + salescanvas-app), door Anthropic afgedwongen. Ruim vooraf nieuwe keys aanmaken en uitrollen.
- **Clerk stopt 18 januari 2027 met oude CBC-mode TLS-ciphers** op custom domains. Vermoedelijk geen actie (moderne stack), bevestigen bij de maandcheck vlak vóór de deadline.
- **Claude Haiku 4.5 voorlopige pensioendatum niet vóór ~15 oktober 2026**, geen harde aankondiging. Breed in gebruik (`session-end`, RAG-queryherschrijving, `memoryEntities` e.a.), bij een officiële aankondiging tijdig een migratiepad zoeken.

## Technische schuld en deprecaties

- **Voyage embedding-modellen zijn deprecated.** `voyage-3-large` (kennisbank-RAG) en `voyage-multilingual-2` (sessie-geheugen). Her-embedding naar `voyage-4-large` is onderzocht en **geparkeerd** (2026-09-02, `docs/VOYAGE_REEMBED_PLAN.md`): geen aantoonbare retrieval-verbetering. Hervatten zodra Voyage een echte EOL-datum aankondigt; de maandcheck (sectie 4, Voyage) checkt daarop.
- **`proxy.ts` gebruikt nog `createRouteMatcher()`** (Clerk), sinds `@clerk/nextjs` 7.5.14 gedeprecate ten gunste van `auth.protect()` per route. Geen verwijderdatum, wel migreren zodra opgepakt.
- **Hoofdchat draait op `claude-sonnet-4-6` i.p.v. Sonnet 5.** Sonnet 5 gaf bij lange vragen een leeg antwoord (thinking mode zonder text block), maar is inmiddels structureel goedkoper. Hercheck of Anthropic dit heeft aangepast, of schakel extended thinking bewust in met `budget_tokens`. Eerst op staging testen, minimaal een week na de commerciële livegang.
- **Multi-tenant RLS.** RLS staat aan op alle ~41 tabellen maar zonder policies; de isolatie tussen gebruikers hangt volledig af van een `.eq('user_id', userId)`-filter per route plus de CI-check `check-missing-user-filter.mjs`. Een echte Clerk-JWT-policy-implementatie per tabel is een groot apart traject, bewust nog niet opgepakt.
- **Leeg-antwoord-bescherming ontbreekt** op `cron/refresh-openers`, `bot/sessions*`, `admin/feedback-analyse` e.a. Bewust overgeslagen (kortere prompts, Haiku zonder thinking, of al gedeeltelijke bescherming). Herbeoordelen bij een maandcheck als een prompt qua lengte groeit.

## Gated op de 50-gebruikers-milestone (auto-bewaakt via `cron/milestone-check`)

- Vercel Firewall aanzetten.
- Supabase PITR aanzetten (~$100/maand) plus in dezelfde actie een restore-test.
- Clerk inactivity timeout inschakelen (vereist betaald plan).
- Apart Supabase-project voor de E2E-suite heroverwegen (op 2026-08-30 bewust verworpen wegens schema-sync-last; zie `CLAUDE_HISTORY.md`).

## Productfeatures, nog niet gebouwd

- **PostHog in de ingelogde `/bot`-omgeving: gebouwd 2026-08-30.** Pseudonieme productanalyse (identify met Clerk-ID, veilige person-properties, event-whitelist, genormaliseerde pageviews), feature flags en surveys operationeel, `team_id` als super-property i.p.v. de betaalde group-analytics-add-on. Nog te doen door Arno:
  - **Session replay staat uit** achter `SESSION_REPLAY_ENABLED` in `lib/posthog.ts`. Aanzetten na verificatie van de maskeerconfig (alle tekst + alle invoer gemaskeerd, alleen shell-pagina's). In de PostHog-projectinstellingen ook masking op "mask all" zetten als extra laag.
  - **PostHog DPA opvragen** via de PostHog-app, inclusief bevestiging sub-verwerkersketen. Vóór ondertekening met een corporate klant.
  - **Bewaartermijn:** afgevangen. "Maximaal 12 maanden" staat in de privacyverklaring (= vaste auto-expiry op het PostHog-plan), session-weergaven 30 dagen.
  - **ePrivacy:** besloten (keuze B, 2026-08-30). Geen toestemmingsbanner: `persistence: 'localStorage'` (geen cookie), IP niet bewaard, grondslag gerechtvaardigd belang met bezwaarrecht, artikel 9 van de privacyverklaring. Actie voor Arno: in PostHog "Discard client IP data" aanzetten.
  - **Session replay:** `SESSION_REPLAY_ENABLED` op true gezet 2026-08-30, dubbel gemaskeerd (PostHog-projectinstelling "mask all" + code `maskTextSelector: '*'`). Visuele verificatie op 2026-08-30 niet gelukt: Arno's browsers hebben te veel blockers (Ghostery/Privacy Badger/uBlock) en hij is bovendien via `is_intern` uit de views gefilterd. **Openstaand: rond 2026-09-06 één echte gebruikersopname openen en bevestigen dat alle tekst gemaskeerd is.** Niet gemaskeerd -> `SESSION_REPLAY_ENABLED` terug op false.
- **PostHog Data Warehouse-koppeling.** Stripe: geblokkeerd tot er een betaalprovider is (samen met dunning). Supabase: bewust niet als directe connector (nieuw dataoppervlak), de veilige productvelden gaan al als person-properties mee; eventueel later een read-only curated view.
- **Manager-zelfcoaching-gat.** Uitgewerkt tot "de actie-helft van 2C" in `TEAM_PLAN.md` (sectie onderaan, 2026-08-31). Stuk A (toon aanscherpen: hypothesetaal, circle of influence, niet-schuldig-wel-verantwoordelijk) is **gebouwd**. Stuk B (signaalgedreven handvatten + terugkoppellus) is een **projectplan met vijf beslispunten** dat op Arno's akkoord wacht (B1 vaste set vs. B2 LLM, en een SQL-migratie op `arnobot_salesbaas_coaching`). Stuk C (team-onboarding vertrouwenslagen) geparkeerd.
- ~~**TEAM_PLAN stap 3: Solopreneur-profiel + teamlid-rol.**~~ **Afgehandeld 2026-09-03.** Solopreneur-profiel gebouwd (`app/bot/profiel/page.tsx`, eigen tak met positionering / acquisitie / inkomensdoel, 12 blokken). Teamlid-profiel: besloten geen eigen tak (= verkoperprofiel). Profielherziening per rol is af. Nog apart genoteerd: eigen SPE-coaching voor de solopreneur (ziet nu nog de MSA-pagina), en het kwartaalthema doorgeven aan de ArnoBot van een teamlid.
- ~~**TEAM_PLAN 2B (De Tijdlijn) en 2C (Manager als Variabele).**~~ **Afgehandeld 2026-08-31.** Verse controle uitgevoerd: beide zijn echt gebouwd (`computeThemaMaandTrend`, `formatSystemischSignaal`, `formatVroegSignaal` in `lib/spiegel.ts`, aangeroepen door `team/spotlight`, `team/dashboard` en `team/zelfcoaching`). De tegenstrijdigheid zat alleen in achterhaalde planningstaal in oudere secties van `TEAM_PLAN.md` ("Niet gestart" in de Fase 1/2-tabel, "fase 3, niet fase 2"), die is rechtgezet. Geen codewerk open.
- **Sparring preformatted-scenario-kaarten.** Bouwen zodra er 5 scenario's liggen, nu 1/5.
- **Referral-tegoed-automatisering.** `status='converted'` wordt nergens gezet, de hele flow is handmatig.
- **SYSTEEMPROMPT-upgrade golf 1 evalueren**, gepland 2026-09-16 (cron-herinnering `golf1-evaluatie-herinnering` staat). Daarna beslissen over golf 2 (patroonherkenning + samengevoegde accountability/consistentie-regel).
- **Sessie-geheugen hybride retrieval.** Gebouwd 2026-08-12, nog niet live geobserveerd of het in de praktijk werkt.
- **BetterUp-inzichten toepassen op team-bouwsteen 1.3.**
- **GTM outbound-tool** (zelfbouw NL-outbound, apart van premium ArnoBot, hoort bij de volume-tier).
- **Elite Member Community** (later via Circle) en **ABC / Man & Machine** (gecertificeerde coach levert een menselijk contactmoment): bewust achteraan, nog niet bouwen.

## Non-code, Arno's terrein

- **Sales agents onboarden:** eigen team aanmaken op `/bot/team`, de sales agents als lid uitnodigen, de commissiestructuur bespreken, het wachtwoord voor `arno.bot/agents` delen. Daarna de sd-links met prospects delen.
- **DPA afronden vóór ondertekening** (`docs/dpa-input.md`, sectie "Openstaand vóór ondertekening").
- **SALES_BIJBEL aanvullen:** bezwaarafhandeling, prijsargumentatie, pitch-scripts; case studies wachten op input van Arno.
- **Demo-video opnemen** (`docs/DEMO_VIDEO_SCRIPT.md`), wacht op het demoteam met fake teamleden.
- **AGENTS_PITCH** via NotebookLM genereren en beoordelen vóór de kickoff met de sales agents.
- **BUSINESS_HANDOVER-invulpunten** en **LAPTOP_OVERDRACHT-punten** afwerken.

## Kleine hygiëne (opgemerkt op 2026-08-30)

- `arnobot_openers` heeft geen `updated_at`/`last_refreshed_at`, dus aan de tabel zie je niet wanneer de openers voor het laatst ververst zijn.
- `test@arno.bot` is `manager_id` in `arnobot_1on1_log` (Team Hippios) maar staat niet in `arnobot_team_members`; de manager daar is een ander account (`user_3Eiy...`).

## Verificaties die CLAUDE.md vraagt

- ~~**Verse controle van het `TEAM_PLAN.md`-statusblok tegen de code**~~ **Gedaan 2026-08-31.** 2B/2C zijn echt gebouwd en aangeroepen; tegenstrijdigheid was achterhaalde planningstaal, rechtgezet in `TEAM_PLAN.md`.
- **Voice:** een echte proefboeking om de Calendly-webhook-matching end-to-end te bevestigen (bewust overgeslagen, Arno vertrouwt de logica; kan alsnog als losse verificatie).
- **Embedding-consistentiecheck** (maandcheck-item): steekproefsgewijs verifiëren dat alle `arnobot_blog_sessions.embedding`-rijen uit hetzelfde model komen.

## Voorgestelde eerste drie

1. **PostHog `/bot`: afronden** (session replay-vlag omzetten na verificatie, DPA opvragen, bewaartermijn). Kern is gebouwd 2026-08-30.
2. **Voyage her-embedding plannen.** Het deprecation-risico groeit en het is de grootste losse klus.
3. **Manager-zelfcoaching-gat Stuk B**: akkoord geven op de vijf beslispunten in het projectplan (`TEAM_PLAN.md`), dan bouwen. Stuk A is al gebouwd.

*(Verse TEAM_PLAN-statuscontrole en het Stuk-B-projectplan afgerond 2026-08-31, zie hierboven.)*
