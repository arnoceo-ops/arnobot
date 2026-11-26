# Open punten

Momentopname 2026-11-15, samengesteld uit het oude `docs/OPENSTAANDE_PUNTEN.md` (verwijderd, staat in git) en alleen de punten die nog kloppen. Per onderwerp blijft het betreffende document de bron; dit is het overzicht.

## Harde deadlines
- **Anthropic API-keys verlopen op 6 januari 2027** (arnobot en salescanvas-app, afgedwongen door Anthropic). Ruim vooraf nieuwe keys aanmaken en uitrollen.
- **Clerk stopt op 18 januari 2027 met oude CBC-TLS-ciphers** op custom domains. Vermoedelijk geen actie, bevestigen vlak vóór de deadline.
- **Claude Haiku 4.5:** nog geen pensioendatum aangekondigd; breed in gebruik. De cron `model-check` (1e van de maand) bewaakt dit; bij een aankondiging tijdig een migratiepad zoeken.

## Privacy en juridisch
- **Session replay staat AAN** (`SESSION_REPLAY_ENABLED = true`, `lib/posthog.ts`) en de maskering is sinds 2026-08-30 nooit visueel bevestigd. Eén echte gebruikersopname openen en controleren dat alle tekst gemaskeerd is; zo niet, de vlag op `false`.
- **PostHog:** in het dashboard "Discard client IP data" aanzetten (Arno, status onbekend).
- **DPA:** nog te doen vóór een corporate klant tekent, zie `docs/DPA.md` (onderaan: werkaantekeningen). DPA's opvragen bij Voyage AI, Upstash en PostHog.
- **Telegram als niet-gedocumenteerde sub-verwerker:** bewust geaccepteerd (besluit Arno 2026-09-16), geen actie.
- **OSS (btw):** zodra de omzet aan particulieren buiten Nederland samen boven €10.000 per kalenderjaar komt, btw van het land van de klant rekenen en aangeven via OSS. Er wordt nog niet bijgehouden hoeveel dat is; Mollie toont het land per betaling. Controleer de actuele regels op belastingdienst.nl.

## Technische schuld
- **Android: terugknop (volgende app-versie, besluit 2026-11-26):** de schil handelt de terugknop niet af (niets gevonden in de Android-code van `@capacitor/android`, `@capacitor/app` zit er niet in), niet op een toestel nagemeten. Gewenst: terug gaat een pagina terug, pas op het beginscherm verlaat je de app. Vraagt `@capacitor/app` en een nieuwe Android-build. Juridische links openen los daarvan al in een browservenster (`AppVensterLink`). Verworpen als oplossing daarvoor: een eigen terugknop op die pagina's (helpt niet bij de beveiligings-PDF) en openen in losse Chrome (je verlaat de app).
- **Hoofdchat draait op `claude-sonnet-4-6`** omdat Sonnet 5 bij lange vragen geen tekstblok gaf. Periodiek hercontroleren (zie `docs/MODELINVENTARIS.md`).
- **`proxy.ts` gebruikt `createRouteMatcher()`**, in Clerk gedeprecieerd ten gunste van `auth.protect()` per route. Geen verwijderdatum.
- **Multi-tenant RLS:** RLS staat aan zonder policies; isolatie hangt af van `.eq('user_id', ...)` plus de CI-check `check-missing-user-filter.mjs`. Een echte JWT-policy-implementatie is een groot apart traject, bewust niet opgepakt.
- **Leeg-antwoord-bescherming ontbreekt** op `cron/refresh-openers`, `bot/sessions*` en `admin/feedback-analyse`. Herbeoordelen als een prompt groeit.
- **Sessie-sluiter:** een echte run waarbij de cron zelf een verlaten gesprek afsluit is nog niet gezien (7 tests dekken de route). Controle: een rij in `arnobot_blog_sessions` met `onderwerp` en een geslaagde run van `/api/cron/sessies-afsluiten` in Vercel.
- **Voice:** live dicteren nog testen op een echte iPhone (Safari) en Android (Chrome); een echte proefboeking om de Calendly-webhookmatching te bevestigen is bewust overgeslagen.
- **Architectuuraudit 2026-09-01 (PR 67, getoetst 2026-11-16), twee laagrisico-restpunten:** (1) drie losse schrijvers van `blog_chunks.embedding` (`app/api/cron/rss-ingest/route.ts`, `scripts/embed-chunks.mjs`, `scripts/embed-single-doc.mjs`), nu allemaal `voyage-3-large`: afdwingen met één Vitest-test die de vier bestanden (die drie plus `lib/rag.ts`) op dezelfde modelstring controleert, of één gedeelde `embedKennisbankDocumenten()` in `lib/rag.ts` voor de TS-kant. (2) `app/api/bot/profiel/route.ts` slaat het profiel op zonder merge met het bestaande: alleen aanpassen (`{...bestaand, ...profiel}`) als er een profielveld bijkomt dat niet op de profielpagina staat.

## Product
- **Manager-zelfcoaching, stuk B** (signaalgedreven handvatten en terugkoppellus) wacht op Arno's akkoord op vijf beslispunten, zie `docs/archief/TEAM_PLAN.md`. Stuk C (team-onboarding vertrouwenslagen) geparkeerd.
- **Sales agents onboarden, SALES_BIJBEL aanvullen** (bezwaarafhandeling, prijsargumentatie, pitch-scripts) en de invulpunten in `docs/BUSINESS_HANDOVER.md`. Zie `docs/SALES_DEVELOPMENT.md`.
- **Bewust later:** sparring-scenariokaarten (nu 1 van 5), HubSpot voor team-leads (checkpoint circa 3 maanden na livegang), GTM-outboundtool, BetterUp-inzichten (team-bouwsteen 1.3), Elite Member Community, ABC / Man & Machine, PostHog Data Warehouse.
- **Op de gebruikersmijlpalen** (50, 75 en 150 actieve gebruikers): zie `CLAUDE.md` en `docs/CAPACITEIT.md`.
