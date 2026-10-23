# Openstaande punten — momentopname

**Gemaakt:** 2026-08-30, gereconcilieerd bij de eerste kwartaalcheck op 2026-09-16.
**Aard:** geconsolideerde momentopname uit `CLAUDE.md`, alle plandocumenten en het sessiegeheugen, op verzoek als sessie-overstijgende reminder. **Dit is geen live tracker.** De bron van waarheid blijft per onderwerp het betreffende plandocument en de "Openstaand"-markeringen in `CLAUDE.md`. Bij de volgende kwartaalcheck opnieuw tegen de werkelijkheid houden; overwegen dit bestand dan te verwijderen als het niks unieks meer toevoegt boven de plandocumenten.

**Bewust weggelaten:** de Android-app, plus alles wat puur op de betaalprovider-integratie wacht: dunning-flow, voice fase 3 / pricingpagina, sales-agent-omzetmeting en -uitbetaling, herhaalbare Elite-boeking. **De betaalprovider-keuze zelf is genomen (2026-09-02): Stripe voor de hele EU (B2C + B2B), Paddle voor de rest van de wereld, sequentieel. Zie `docs/PAYMENTS_PLAN.md`.**

## Actielijst 2026-10-23 (samengevoegd uit de sessie van 22 en 23 oktober)

Voortgang hier afvinken. Wie: **Arno** of **Claude**.

**Blok 1. Toegang en betaalketen**
- [x] **1. Redirect-loop** voor afgelopen en gedeactiveerde gebruikers: **gebouwd en getest 2026-10-23 (`fd0134ff`)**. Test A (gedeactiveerd) en B (verlopen `expires_at`) met `test@arno.bot` geslaagd, account daarna hersteld (`expires_at` 2035). Daarbij ook de afrekenpagina aangepast: kop "Ga door met ArnoBot." en een tekstvariant voor afgelopen toegang (`0c308c19`). De variant voor de proefperiode is niet apart getest. Oorspronkelijke beschrijving: Gekozen: wie geen actieve toegang heeft gaat naar `/bot/doorgaan`, en `/bot/doorgaan`, `/bot/herstart` en `/bot/account` blijven bereikbaar (beslislogica in `lib/toegang.ts`, 12 tests). Betalen zet toegang altijd weer aan, ook na TOEGANG INTREKKEN (besluit Arno). Verworpen: een kolom `deactivated_reason` en een aparte pagina "geen toegang", want niet nodig zolang betalen altijd mag. Bijeffect: TOEGANG INTREKKEN houdt niemand meer buiten die kan betalen of herstarten. **Nog te doen: testen met een intern testaccount** (zet het uit en aan via het admin-betaalpaneel, controleer dat `/bot` naar `/bot/doorgaan` gaat en geen loop geeft).
- [x] **2. Dag-25-belofte versus toegang na dag 30: opgelost door de toegang op dag 30 te laten eindigen (besluit Arno 2026-10-23).** Gekozen: geen uitloop, betalen via Mollie, anders is het over en uit. Verworpen: een uitloop van 5 dagen na de trial voor wie op doorgaan klikte (gebouwd in `21862803`, daarna volledig teruggedraaid), want er zijn geen handmatige betalers en met Mollie kost betalen twee minuten. De onjuiste zin "je toegang blijft actief totdat de factuur is voldaan" is uit de dag-25-mail gehaald.
- [x] **3. Handmatig betaalden: vervallen (besluit Arno 2026-10-23).** Er zijn geen handmatige betalers en er komen er niet. Direct door naar Mollie. Verworpen: een bevestigings-, herinnerings- en eindemail voor betalers via factuur, want die groep bestaat niet.
- [ ] **4. Mailteksten voor de sleutelwissel:** dag 25, betaalwaarschuwing, geblokkeerd en trial afgelopen spreken over een factuur en "mail Arno". Daarbij vervalt de factuurroute ("Je ontvangt dan een factuur", "mail Arno"): de mailteksten en de tekstvariant zonder Mollie op `/bot/doorgaan` moeten naar online betalen. Claude, tekst eerst aan Arno.

**Blok 2. Koppelingen Mollie en Moneybird**
- [x] **5. Gezondheidscheck:** gebouwd en bevestigd 2026-10-23 (`29e8c092`, verplaatst naar bovenaan in `781b5189`). Dagelijkse controle in de billing-cron (05:00 UTC, Telegram bij een fout) en tegel BETALEN EN FACTUREN bovenaan `/bot/admin/status`. Code in `lib/billing/gezondheid.ts`, alleen leesaanroepen. In productie gezien: Mollie "Verbonden, testmodus" (oranje tot de sleutelwissel), Moneybird "Verbonden". Na de sleutelwissel wordt Mollie groen.
- [ ] **6. Resterende tests met de testsleutel:** mislukte betaling, vervolgbetaling (herhaalincasso, nog nooit gedraaid: alle 9 testbetalingen zijn "eerste"), zakelijke flow, Team end-to-end. Arno, Claude schrijft de stappen.
- [ ] **7. Sleutelwissel naar live**, pas na 5 en 6. Zie `docs/MOLLIE_PLAN.md`. Arno.

**Blok 3. Product en gedrag**
- [ ] **8. Hero-regel op `/bot`:** Arno scherpt de hero aan. Kandidaten: "ArnoBot is je coach, geen schrijfmachine. Hier word je scherper." en "Geen taalmodel dat je werk overneemt. Een coach die je sterker maakt." Niets bouwen zonder akkoord op de exacte tekst.
- [ ] **9. Spraak op iPhone:** Robel laten testen of de foutmelding nog verschijnt terwijl de tekst al staat (fix `628562dd`). Arno.
- [ ] **10. Nieuwe chat-regels** (plan-weigering, "één richting") over een paar dagen bekijken in echte gesprekken. Claude, Arno zegt wanneer.
- [ ] **11. Net gemaakte analyse** toont het veld "Mist er iets?" pas na herladen (de analyse staat dan bovenaan als "NIEUW GEGENEREERD"). Beslissing Arno: laten of aanpassen.

**Blok 4. Opruimen en bijhouden**
- [x] **12. Documentatie** (`ARNOBOT_OVERZICHT.md`, `TECHNICAL_HANDOVER.md`, PDF's) bijgewerkt voor de analyse-aanvulling, de plan-weigering en de stand van Mollie, 2026-10-23.
- [x] **17. Uitloop na de sleutelwissel: vervallen, de uitloop bestaat niet meer (besluit Arno 2026-10-23).** Zie punt 2.
- [ ] **18. Factuurroute opruimen na de sleutelwissel (punt 7):** `/api/bot/confirm-renewal` (POST met mail aan Arno), de tekstvariant zonder Mollie op `/bot/doorgaan`, de betaalwaarschuwing en blokkademails in `cron/trial-emails` en `renewal_requested_at`. Claude, pas na de sleutelwissel.
- [ ] **13. `admin_derde_trial`:** mailtype dat nergens wordt verstuurd. Beslissing Arno: verbinden of verwijderen.
- [ ] **15. Verkeerde mail bij zelf opzeggen:** zodra de toegang eindigt stuurt `cron/trial-emails` (loop 2) "Je betaling is niet ontvangen, je toegang is tijdelijk geblokkeerd" naar iemand die bewust opzegde, naast het juiste "abonnement afgelopen" van de billing-cron. Eerst controleren of beide echt vuren, dan de loop-2-mail aanpassen of overslaan. Claude, na akkoord.
- [ ] **16. Menu zonder toegang:** wie geen toegang heeft ziet het volledige menu, maar ANALYSES en COACHING sturen terug naar `/bot/doorgaan`. Optioneel: menu korter maken. Beslissing Arno.
- [x] **19. Balk "proefperiode loopt af"** op `/bot` vanaf 5 dagen voor het einde, alleen trial zonder betaling en geen team (`TrialBalk.tsx`, `/api/bot/trial-status`). Gebouwd en door Arno goedgekeurd 2026-10-23. Voorbeeld via `?trialbalk=5`. Gekozen: onderin, zonder amber lijn, alleen op `/bot`. Verworpen: balk onder het menu (bedekt de eerste regel inhoud), aparte knop (nu is de tweede regel de link).
- [x] **20. Abonnement gaat in op het einde van de proefperiode** als er tijdens de trial wordt betaald (`eerstePeriodeStart`, `trialEinde`): periode, contracteinde, Mollie-startdatum en factuurperiode. Afrekenstap toont "Je abonnement gaat in op [datum]. Dat betekent dat je de volledige proefperiode behoudt." Gebouwd en met een testbetaling bevestigd 2026-10-23 (periode 27-10-2026 tot 27-10-2027 op abonnement en Moneybird-factuur).
- [x] **21. Moneybird-contact bij een particulier** neemt geen oude bedrijfs-, KvK-, btw- en adresgegevens meer mee van een eerdere zakelijke afrekening (`bouwContactWijziging`).
- [x] **22. Coaching 504 en thought of the day** 2026-10-23: tijdslimiet van `coaching` en `zelfcoaching` naar 300 seconden, wachttekst "Dit kan tot twee minuten duren. Laat deze pagina open." bij COACH ME, thought of the day beperkt op woorden (max 50, ongeveer vier regels) in plaats van tokens en nooit een afgekapte zin (`lib/uitdagingTekst.ts`). Open: dezelfde wachttekst op de teamversie van de coaching (SPE), alleen als Arno dat wil.
- [x] **23. Facturen en mails:** vragenadres overal `admin@arno.bot` (Moneybird-workflow door Arno aangepast, workflow gecontroleerd 2026-10-23: herinneringen staan op niet-automatisch).

- [ ] **14. Resend-daglimiet van 100** deelt alle mails (trial, billing, blog). Schaalpunt, hoort bij de Pro-milestone, geen actie nu.

**Besloten en niet meer open:** de planmails (Q4, voorjaar, zomer) zijn op 2026-10-22 verworpen. Gekozen: ArnoBot stelt de plan-vragen alleen in het gesprek. Verworpen: seizoensmails en een controle-mail, op Arno's besluit.

---

## Vóór de commerciële livegang

- (DEELS OPGELOST 2026-10-10: opzegtermijn en bedenktijd live, verlenging volgt) **Abonnementsvoorwaarden juridisch laten nakijken (NL SaaS + consumentenrecht).** `app/voorwaarden/page.tsx` artikel 7 klopt niet voor B2C: de jaarclausule (2 maanden opzegtermijn, anders een jaar erbij) is vermoedelijk nietig onder de Wet Van Dam, en de maandclausule botst met "Maandelijks opzegbaar" op `/prijzen`. Plus: auto-verleng-disclosure in de checkout, 14-dagen-herroepingsrecht-opt-in voor digitale content. Details en richting in `docs/PAYMENTS_PLAN.md` → "Opzegging, verlenging en consumentenrecht".
- (OPGELOST 2026-10-10, labels aangepast) **`/prijzen` claimt "Maandelijks opzegbaar"** terwijl artikel 7(b) een maand opzegtermijn mét doorbetaling oplegt. Intern tegenstrijdig, meenemen in de voorwaarden-herziening.
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
- ~~**SYSTEEMPROMPT-upgrade golf 1/golf 2 — status onduidelijk.**~~ **Afgehandeld 2026-09-26.** Met Arno besproken en opgelost: golf 1 regel 1 is bewust herzien (verzoektype i.p.v. aanleiding als trigger), zie `docs/SYSTEEMPROMPT_UPGRADE.md` "Besluit 2026-09-26". Geen losse evaluatie meer nodig, golf 2 was al lang ingevouwen.
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

1. **Session replay-maskering verifiëren.** Inmiddels 20 dagen over de eigen streefdatum (16-9: al 10 dagen over), één echte opname openen en bevestigen.
2. ~~**Golf 1/golf 2-verwarring uitpraten met Arno.**~~ **Afgehandeld 2026-09-26.**
3. **Manager-zelfcoaching-gat Stuk B**: akkoord geven op de vijf beslispunten in het projectplan (`TEAM_PLAN.md`), dan bouwen. Stuk A is al gebouwd.

*(Verse TEAM_PLAN-statuscontrole en het Stuk-B-projectplan afgerond 2026-08-31. PostHog-kern en Dependabot-trigger afgerond bij de kwartaalcheck van 2026-09-16, zie hierboven.)*
