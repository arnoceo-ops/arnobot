# Openstaande punten — momentopname

**Gemaakt:** 2026-08-30, gereconcilieerd bij de eerste kwartaalcheck op 2026-09-16.
**Aard:** geconsolideerde momentopname uit `CLAUDE.md`, alle plandocumenten en het sessiegeheugen, op verzoek als sessie-overstijgende reminder. **Dit is geen live tracker.** De bron van waarheid blijft per onderwerp het betreffende plandocument en de "Openstaand"-markeringen in `CLAUDE.md`. Bij de volgende kwartaalcheck opnieuw tegen de werkelijkheid houden; overwegen dit bestand dan te verwijderen als het niks unieks meer toevoegt boven de plandocumenten.

**Bewust weggelaten:** de Android-app, plus alles wat puur op de betaalprovider-integratie wacht: dunning-flow, voice fase 3 / pricingpagina, sales-agent-omzetmeting en -uitbetaling, herhaalbare Elite-boeking. **De betaalprovider-keuze zelf is genomen (2026-09-02): Stripe voor de hele EU (B2C + B2B), Paddle voor de rest van de wereld, sequentieel. Zie `docs/PAYMENTS_PLAN.md`.**

## Vóór de commerciële livegang

- **Abonnementsvoorwaarden juridisch laten nakijken (NL SaaS + consumentenrecht).** `app/voorwaarden/page.tsx` artikel 7 klopt niet voor B2C: de jaarclausule (2 maanden opzegtermijn, anders een jaar erbij) is vermoedelijk nietig onder de Wet Van Dam, en de maandclausule botst met "Maandelijks opzegbaar" op `/prijzen`. Plus: auto-verleng-disclosure in de checkout, 14-dagen-herroepingsrecht-opt-in voor digitale content. Details en richting in `docs/PAYMENTS_PLAN.md` → "Opzegging, verlenging en consumentenrecht".
- **`/prijzen` claimt "Maandelijks opzegbaar"** terwijl artikel 7(b) een maand opzegtermijn mét doorbetaling oplegt. Intern tegenstrijdig, meenemen in de voorwaarden-herziening.
- **Btw-opzet door de boekhouder laten bevestigen** (prijs btw-inclusief voor consumenten, btw-exclusief bij een btw-nummer, OSS-drempel EU-consumenten). Weergave-besluit staat vast (kale prijzen op `/prijzen`, 2026-09-03), zie `docs/PAYMENTS_PLAN.md` → "Btw-weergave". Abacus modelleert de B2C-btw-haircut bewust niet.

---

## Harde deadlines, agenderen

- **Anthropic API-keys verlopen 6 januari 2027** (arnobot + salescanvas-app), door Anthropic afgedwongen. Ruim vooraf nieuwe keys aanmaken en uitrollen.
- **Clerk stopt 18 januari 2027 met oude CBC-mode TLS-ciphers** op custom domains. Vermoedelijk geen actie (moderne stack), bevestigen bij de maandcheck vlak vóór de deadline.
- **Claude Haiku 4.5 voorlopige pensioendatum niet vóór ~15 oktober 2026**, geen harde aankondiging (bevestigd 2026-09-16, nog geen aankondiging, deadline nadert wel). Breed in gebruik (`session-end`, RAG-queryherschrijving, `memoryEntities` e.a.), bij een officiële aankondiging tijdig een migratiepad zoeken.
- **OpenAI `whisper-1` deprecated (gevonden 2026-09-16), harde shutdown 26 februari 2027.** Migratiepad: `gpt-transcribe`. Nog niet gemigreerd, zie CLAUDE.md OpenAI-sectie.

## Technische schuld en deprecaties

- **Voyage embedding-modellen zijn deprecated.** `voyage-3-large` (kennisbank-RAG) en `voyage-multilingual-2` (sessie-geheugen). Her-embedding naar `voyage-4-large` is onderzocht en **geparkeerd** (2026-09-02, `docs/VOYAGE_REEMBED_PLAN.md`): geen aantoonbare retrieval-verbetering. Hervatten zodra Voyage een echte EOL-datum aankondigt; de maandcheck (sectie 4, Voyage) checkt daarop.
- **`proxy.ts` gebruikt nog `createRouteMatcher()`** (Clerk), sinds `@clerk/nextjs` 7.5.14 gedeprecate ten gunste van `auth.protect()` per route. Geen verwijderdatum, wel migreren zodra opgepakt.
- **Hoofdchat draait op `claude-sonnet-4-6` i.p.v. Sonnet 5.** Sonnet 5 gaf bij lange vragen een leeg antwoord (thinking mode zonder text block), maar is inmiddels structureel goedkoper. Hercheck of Anthropic dit heeft aangepast, of stem `thinking: {type: "adaptive"}` + `output_config.effort` af (`budget_tokens` bestaat niet meer op Sonnet 5, geeft een 400-fout). Eerst op staging testen, minimaal een week na de commerciële livegang.
- **Multi-tenant RLS.** RLS staat aan op alle ~41 tabellen maar zonder policies; de isolatie tussen gebruikers hangt volledig af van een `.eq('user_id', userId)`-filter per route plus de CI-check `check-missing-user-filter.mjs`. Een echte Clerk-JWT-policy-implementatie per tabel is een groot apart traject, bewust nog niet opgepakt.
- **Leeg-antwoord-bescherming ontbreekt** op `cron/refresh-openers`, `bot/sessions*`, `admin/feedback-analyse` e.a. Bewust overgeslagen (kortere prompts, Haiku zonder thinking, of al gedeeltelijke bescherming). Herbeoordelen bij een maandcheck als een prompt qua lengte groeit.
- **Dependabot-auto-merge werkt structureel niet (gevonden 2026-09-16).** De `workflow_run`-listener in `.github/workflows/dependabot-auto-merge.yml` triggert nooit op een Dependabot-PR-branch (vermoedelijk een GitHub Actions-beperking rond het read-only token waarmee Dependabot-workflows draaien). Vier veilige, groene minor-PR's (#46-#49) stonden hierdoor al 5+ weken vast. Nodig: trigger-mechanisme herzien (bv. de merge-stap direct in de Security Audit-workflow met een `dependabot[bot]`-actor-guard i.p.v. een losse `workflow_run`-listener).

## Gated op de 50-gebruikers-milestone (auto-bewaakt via `cron/milestone-check`)

- Vercel Firewall aanzetten.
- Supabase PITR aanzetten (~$100/maand) plus in dezelfde actie een restore-test.
- Clerk inactivity timeout inschakelen (vereist betaald plan).
- Apart Supabase-project voor de E2E-suite heroverwegen (op 2026-08-30 bewust verworpen wegens schema-sync-last; zie `CLAUDE_HISTORY.md`).

## Productfeatures, nog niet gebouwd

- **PostHog in de ingelogde `/bot`-omgeving: gebouwd 2026-08-30.** Pseudonieme productanalyse (identify met Clerk-ID, veilige person-properties, event-whitelist, genormaliseerde pageviews), feature flags en surveys operationeel, `team_id` als super-property i.p.v. de betaalde group-analytics-add-on. Nog te doen door Arno:
  - **PostHog DPA opvragen** via de PostHog-app, inclusief bevestiging sub-verwerkersketen. Vóór ondertekening met een corporate klant.
  - **Bewaartermijn:** afgevangen. "Maximaal 12 maanden" staat in de privacyverklaring (= vaste auto-expiry op het PostHog-plan), session-weergaven 30 dagen.
  - **ePrivacy:** besloten (keuze B, 2026-08-30). Geen toestemmingsbanner: `persistence: 'localStorage'` (geen cookie), IP niet bewaard, grondslag gerechtvaardigd belang met bezwaarrecht, artikel 9 van de privacyverklaring. Actie voor Arno: in PostHog "Discard client IP data" aanzetten.
  - **Session replay staat AAN sinds 2026-08-30**, dubbel gemaskeerd (PostHog-projectinstelling "mask all" + code `maskTextSelector: '*'`), beperkt tot 6 shell-pagina's. Visuele verificatie op 2026-08-30 niet gelukt (te veel browserblockers + `is_intern`-filtering van Arno's eigen account). Streefdatum was 2026-09-06, dat is inmiddels **10 dagen overdue (bevestigd bij de kwartaalcheck van 2026-09-16)**. **Openstaand, nu urgent: één echte gebruikersopname openen en bevestigen dat alle tekst gemaskeerd is.** Niet gemaskeerd → `SESSION_REPLAY_ENABLED` terug op false.
- **PostHog Data Warehouse-koppeling.** Stripe: geblokkeerd tot er een betaalprovider is (samen met dunning). Supabase: bewust niet als directe connector (nieuw dataoppervlak), de veilige productvelden gaan al als person-properties mee; eventueel later een read-only curated view.
- **Manager-zelfcoaching-gat.** Uitgewerkt tot "de actie-helft van 2C" in `TEAM_PLAN.md` (sectie onderaan, 2026-08-31). Stuk A (toon aanscherpen: hypothesetaal, circle of influence, niet-schuldig-wel-verantwoordelijk) is **gebouwd**. Stuk B (signaalgedreven handvatten + terugkoppellus) is een **projectplan met vijf beslispunten** dat op Arno's akkoord wacht (B1 vaste set vs. B2 LLM, en een SQL-migratie op `arnobot_salesbaas_coaching`). Stuk C (team-onboarding vertrouwenslagen) geparkeerd.
- ~~**TEAM_PLAN stap 3: Solopreneur-profiel + teamlid-rol.**~~ **Afgehandeld 2026-09-03.** Solopreneur-profiel gebouwd (`app/bot/profiel/page.tsx`, eigen tak met positionering / acquisitie). Teamlid-profiel: besloten geen eigen tak (= verkoperprofiel). Profielherziening per rol is af. Nog apart genoteerd: eigen SPE-coaching voor de solopreneur (ziet nu nog de MSA-pagina). **Update 2026-09-08:** intake ingekort, zie `TEAM_PLAN.md` blok "Intake-inkorting". `inkomensdoel`, `kwartaalthema` (was dood veld), `target_3_jaar` en `jaardoel` verwijderd; `target_dit_jaar` blijft alleen voor de teammanager-variant. Teamgrootte voor de teammanager (per ongeluk verdwenen op 24-08) is teruggezet. `arnobot_team_waitlist` gedropt in Supabase (bevestigd 2026-09-08).
- ~~**TEAM_PLAN 2B (De Tijdlijn) en 2C (Manager als Variabele).**~~ **Afgehandeld 2026-08-31.** Verse controle uitgevoerd: beide zijn echt gebouwd (`computeThemaMaandTrend`, `formatSystemischSignaal`, `formatVroegSignaal` in `lib/spiegel.ts`, aangeroepen door `team/spotlight`, `team/dashboard` en `team/zelfcoaching`). De tegenstrijdigheid zat alleen in achterhaalde planningstaal in oudere secties van `TEAM_PLAN.md` ("Niet gestart" in de Fase 1/2-tabel, "fase 3, niet fase 2"), die is rechtgezet. Geen codewerk open.
- **Sparring preformatted-scenario-kaarten.** Bouwen zodra er 5 scenario's liggen, nu 1/5.
- **HubSpot (of vergelijkbaar CRM) voor team-leads.** Capability-sweep gedaan 2026-09-15: gratis tier volstaat qua volume/API-limieten, integratie zou via de HubSpot REST API rechtstreeks vanuit `lib/teamLeadNotify.ts` gaan (Contact + Deal aanmaken), niet via een ingesloten formulier. Ambitieuze versie: dezelfde pipeline ook gebruiken voor de outbound sd-links van Stefanie/Anniek (`project_sales_development`), zodat beide aanlooproutes uit `docs/SALES_BIJBEL.md` voor het eerst samenkomen, plus owner-rotatie zodra Arno de lead-routing wil loslaten (nu bewust nog handmatig, besloten 2026-09-15). Vereist een nieuwe sub-verwerker in privacypagina/beveiligings-PDF/DPA bij een echte bouw. **Checkpoint: herbeoordelen circa 3 maanden na de commerciële livegang**, op basis van het daadwerkelijke aantal team-leads per maand tot dan.
- **Referral-tegoed-automatisering, deels gefixt.** Commit `7f82ed6a` registreert `status='converted'` inmiddels bij een handmatige betaling. Alleen het bedrag en de 3-maanden-regel blijven handmatig.
- **SYSTEEMPROMPT-upgrade golf 1/golf 2 — status onduidelijk, met Arno te bespreken.** De golf1-evaluatie-herinnering stond gepland op 2026-09-16 (vandaag), maar commit `b0a8cc76` (2026-09-01) heeft golf 2 (patroonherkenning + samengevoegde accountability/consistentie-regel) al ingevouwen in de hoofdpersona-prompt, vóór de geplande evaluatiedatum. Onduidelijk wat er nog te evalueren valt nu golf 2 al gebouwd is.
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
- **`lib/kostenTarieven.ts`: Clerk Pro-tarief staat op $100, live is $25/mnd** (gevonden 2026-09-16). Nu zonder praktisch effect (`clerkProActief: false`), maar corrigeren vóór activatie, anders rekent Abacus de vaste kosten 4x te hoog.
- **UI-stijlsweep (2026-09-16), drie concrete afwijkingen:** `app/bot/admin/gebruikers/SdAgentSelect.tsx` (11px i.p.v. 12px in de admin-sectie), `app/bot/account/page.tsx` (gedempte tekst via `opacity` i.p.v. `#6b7280`), `app/bot/admin/ArnoBotPdfDocument.tsx` (10px + `#4b5563` als echte tekstkleur, niet als placeholder).
- **Telegram-notificaties bewust niet gedocumenteerd als sub-verwerker (besloten 2026-09-16).** `lib/cron-notify.ts` en diverse cron-routes/webhooks sturen IP's, Clerk user-ID's en teamdata naar de Telegram Bot API. Arno heeft er bewust voor gekozen dit niet toe te voegen aan privacypagina/DPA-concept/security-PDF. Vastgelegd als expliciet besluit, geen open actiepunt, wel een bewust geaccepteerd AVG-risico (ongedocumenteerde sub-verwerker).

## Verificaties die CLAUDE.md vraagt

- ~~**Verse controle van het `TEAM_PLAN.md`-statusblok tegen de code**~~ **Gedaan 2026-08-31.** 2B/2C zijn echt gebouwd en aangeroepen; tegenstrijdigheid was achterhaalde planningstaal, rechtgezet in `TEAM_PLAN.md`.
- **Voice:** een echte proefboeking om de Calendly-webhook-matching end-to-end te bevestigen (bewust overgeslagen, Arno vertrouwt de logica; kan alsnog als losse verificatie).
- **Embedding-consistentiecheck** (maandcheck-item): steekproefsgewijs verifiëren dat alle `arnobot_blog_sessions.embedding`-rijen uit hetzelfde model komen.

## Voorgestelde eerste drie (bijgewerkt bij de kwartaalcheck van 2026-09-16)

1. **Session replay-maskering verifiëren.** 10 dagen over de eigen streefdatum, één echte opname openen en bevestigen.
2. **Golf 1/golf 2-verwarring uitpraten met Arno.** Golf 2 blijkt al gebouwd vóór de geplande golf1-evaluatie van vandaag.
3. **Manager-zelfcoaching-gat Stuk B**: akkoord geven op de vijf beslispunten in het projectplan (`TEAM_PLAN.md`), dan bouwen. Stuk A is al gebouwd.

*(Verse TEAM_PLAN-statuscontrole en het Stuk-B-projectplan afgerond 2026-08-31. PostHog-kern en Dependabot-trigger afgerond bij de kwartaalcheck van 2026-09-16, zie hierboven.)*
