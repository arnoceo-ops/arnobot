# Openstaande punten — momentopname

**Gemaakt:** 2026-08-30
**Aard:** geconsolideerde momentopname uit `CLAUDE.md`, alle plandocumenten en het sessiegeheugen, op verzoek als sessie-overstijgende reminder. **Dit is geen live tracker.** De bron van waarheid blijft per onderwerp het betreffende plandocument en de "Openstaand"-markeringen in `CLAUDE.md`. Bij de eerstvolgende kwartaalcheck (punt 11) tegen de werkelijkheid houden en daarna verwijderen of verversen, niet eindeloos laten meelopen.

**Bewust weggelaten:** de Android-app en de keuze van een betaalprovider (Arno houdt die zelf bij), plus alles wat puur daarop wacht: dunning-flow, voice fase 3 / pricingpagina, sales-agent-omzetmeting en -uitbetaling, herhaalbare Elite-boeking.

---

## Harde deadlines, agenderen

- **Anthropic API-keys verlopen 6 januari 2027** (arnobot + salescanvas-app), door Anthropic afgedwongen. Ruim vooraf nieuwe keys aanmaken en uitrollen.
- **Clerk stopt 18 januari 2027 met oude CBC-mode TLS-ciphers** op custom domains. Vermoedelijk geen actie (moderne stack), bevestigen bij de maandcheck vlak vóór de deadline.
- **Claude Haiku 4.5 voorlopige pensioendatum niet vóór ~15 oktober 2026**, geen harde aankondiging. Breed in gebruik (`session-end`, RAG-queryherschrijving, `memoryEntities` e.a.), bij een officiële aankondiging tijdig een migratiepad zoeken.

## Technische schuld en deprecaties

- **Voyage embedding-modellen zijn deprecated.** `voyage-3-large` (kennisbank-RAG) en `voyage-multilingual-2` (sessie-geheugen). Upgrade naar de voyage-4-serie vereist een volledige her-embedding van respectievelijk de kennisbank en alle bestaande sessies. Apart gepland, nog niet gestart. Grootste losse klus.
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

- **PostHog uitbreiden naar ingelogde `/bot`-gebruikers, plus een Data Warehouse-koppeling met Stripe/Supabase.** Arno noemt dit "essentieel". Vereist een eigen scope- en privacybeoordeling vooraf.
- **Manager-zelfcoaching-gat.** Thijs' punten over een open, veilige, ambitieuze, lerende omgeving en actieve handvatten van ArnoBot richting de manager zelf als coach (niet als verkoper). Substantiële Team-feature met privacymodel-impact, apart projectplan nodig vóór bouwen. Los van de al gebouwde SPE-zelfcoaching (punt 5).
- **TEAM_PLAN stap 3: Solopreneur-profiel** (nog niet ontworpen), plus de open vraag welke rol/profiel een uitgenodigd teamlid (niet de manager) krijgt, nooit in de profielherziening meegenomen.
- **TEAM_PLAN 2B (De Tijdlijn) en 2C (Manager als Variabele).** Het statusblok in `TEAM_PLAN.md` spreekt zichzelf tegen (noemt 2B/2C zowel "af" als "eerstvolgend"). Verse controle nodig, zie onderaan.
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

- **Verse controle van het `TEAM_PLAN.md`-statusblok tegen de code** (subagent zonder de aannames van de bouwsessie). Het blok is intern tegenstrijdig over 2B/2C.
- **Voice:** een echte proefboeking om de Calendly-webhook-matching end-to-end te bevestigen (bewust overgeslagen, Arno vertrouwt de logica; kan alsnog als losse verificatie).
- **Embedding-consistentiecheck** (maandcheck-item): steekproefsgewijs verifiëren dat alle `arnobot_blog_sessions.embedding`-rijen uit hetzelfde model komen.

## Voorgestelde eerste drie

1. **Verse TEAM_PLAN-statuscontrole** (subagent tegen de code). Cheap, en pas daarna weet je zeker wat er van dat traject echt nog open is.
2. **PostHog naar `/bot`-gebruikers.** Arno noemt het essentieel, geen externe blokker.
3. **Voyage her-embedding plannen.** Het deprecation-risico groeit en het is de grootste losse klus.
