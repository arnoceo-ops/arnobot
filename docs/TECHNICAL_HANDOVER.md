# ArnoBot — Technische overdracht

Dit document beschrijft de volledige technische structuur van ArnoBot. Het is bedoeld voor een developer die het project overneemt zonder voorkennis. Bewaar dit document in de GitHub-repo (`docs/TECHNICAL_HANDOVER.md`) zodat het altijd naast de code staat.

Sectie **AI-modellen** en **Package-versies** worden automatisch bijgewerkt op de 1e van elke maand door de `update-handover` cron.

<!-- AUTO:UPDATED -->
Laatste automatische update: 2026-08-01
<!-- /AUTO:UPDATED -->

---

## Wat doet de app

ArnoBot is een AI-coachingplatform voor salesprofessionals. Gebruikers voeren gesprekken met een op maat gemaakte versie van Claude (Anthropic). Na meerdere gesprekken genereert de app een coachingrapport met scores op mindset, systeem en actie. Managers kunnen een teammodule gebruiken om inzicht te krijgen in hun verkopers en automatisch 1:1-agenda's te laten genereren.

**Live URL:** https://arno.bot  
**GitHub:** https://github.com/arnoceo-ops/arnobot  
**Vercel project:** arnobot (op account arnoceo-ops)

---

## Tech stack

| Component | Technologie | Versie |
|---|---|---|
| Framework | Next.js (App Router) | ^16 |
| Taal | TypeScript | ^5 |
| Authenticatie | Clerk | ^7 |
| Database | Supabase (PostgreSQL) | ^2 |
| Hosting | Vercel | Pro |
| AI | Anthropic Claude | via SDK ^0.109 |
| E-mail | Resend | ^6 |
| Rate limiting | Upstash Redis | ^1 / ^2 |
| CMS (BIEB) | Sanity | ^6 |
| Embeddings | VoyageAI | ^0.4 |
| Admin notificaties | Telegram Bot API | directe fetch |
| PDF export | jsPDF + @react-pdf/renderer | ^4 |

---

## Hoe deployment werkt

Elke `git push origin master` triggert automatisch een Vercel-deploy. Er is geen handmatige stap nodig.

1. Code staat op GitHub (`arnoceo-ops/arnobot`, branch `master`)
2. Vercel luistert op die branch en bouwt automatisch
3. Build: `next build --webpack`
4. Environment variables staan in het Vercel-dashboard (zie sectie Externe diensten)
5. Cron jobs worden beheerd via `vercel.json` in de root van de repo

**Rollback:** In het Vercel-dashboard kun je op elk moment terugzetten naar een eerdere deployment. Dit is de snelste manier om een kapotte deploy ongedaan te maken.

**Lokale ontwikkeling:**
```bash
npm install
npm run dev
```
Vereist een `.env.local` bestand met alle environment variables (zie Externe diensten).

---

## Gebruikersflow

De volledige flow van aanmelding tot coaching:

```
Aanmelding (arno.bot/aanmelden of LinkedIn OAuth)
    ↓
approved_users record aangemaakt (pending_ prefix bij e-mailaanmelding, direct bij LinkedIn)
    ↓
Eerste inlog → /bot/welkom (welkomspagina, welcome_seen gezet)
    ↓
/bot/profiel (salescontext invullen, onboarding_done gezet)
    ↓
/bot (hoofdchat — gesprekken via arnobot_rds_logs + arnobot_blog_sessions)
    ↓
Elke sessie → /api/bot/session-end (synthese: title + summary + feiten + uitdaging)
    ↓
Na 5+ gesprekken → /api/cron/auto-analyse (BIEB-analyse aangemaakt in arnobot_analyses)
    ↓
/bot/coaching → /api/bot/coaching (coachingrapport in arnobot_coaching)
    ↓
/bot/bieb (alle gesprekken + analyse zichtbaar)
```

**Teamflow (aanvullend):**
```
Manager maakt team aan → /api/bot/team/create
    ↓
Teamleden accepteren uitnodiging → /bot/team/join
    ↓
Manager ziet teamoverzicht → /bot/team
    ↓
Manager vraagt 1:1-agenda op per lid → /api/bot/team/1on1
    ↓
Manager slaat notitie op → /api/bot/team/1on1/save
    ↓
Maandelijks: Spotlight (teamanalyse) → /api/bot/team/spotlight
```

---

## Pagina-overzicht

### Bot-pagina's (achter login, `/bot/*`)

| Pagina | Pad | Functie |
|---|---|---|
| Hoofdchat | `/bot` | Centrale gesprekspagina met ArnoBot |
| Welkom | `/bot/welkom` | Eenmalige welkomspagina, eerste inlog |
| Profiel | `/bot/profiel` | Salescontext invullen (onboarding) |
| Coaching | `/bot/coaching` | Coachingrapport aanvragen en bekijken |
| BIEB | `/bot/bieb` | Alle gesprekken + AI-analyses |
| Account | `/bot/account` | Abonnement, referral, account verwijderen |
| Q&A | `/bot/qa` | Veelgestelde vragen |
| Team | `/bot/team` | Teamoverzicht (alleen voor managers) |
| Team aansluiten | `/bot/team/join` | Teamuitnodiging accepteren |
| Teamlid | `/bot/team/lid/[userId]` | Individueel lid: scores, analyse, 1:1-agenda |
| Herstart | `/bot/herstart` | Herstarten na abonnementsprobleem |
| Doorgaan | `/bot/doorgaan` | Doorgaan na blokkering |

### Admin-pagina's (`/bot/admin/*`)

Beveiligd via cookie (`arnobot_admin`), niet via Clerk. Login via `/bot/admin/login`.

| Pagina | Functie |
|---|---|
| `/bot/admin` | Overzicht actieve gebruikers, stats |
| `/bot/admin/gebruikers` | Gebruikerslijst beheren |
| `/bot/admin/emails` | E-mail templates testen |
| `/bot/admin/emails/overzicht` | E-mail lifecycle PDF |
| `/bot/admin/evaluaties` | Gebruikersfeedback bekijken |
| `/bot/admin/idee` | Ideeënbox |
| `/bot/admin/widget` | Widget preview |

### Publieke pagina's

| Pagina | Pad | Functie |
|---|---|---|
| Landingspagina | `/` | Marketingpagina |
| Aanmelden | `/aanmelden` | Trial aanvragen |
| Privacy | `/privacy` | Privacyverklaring |
| Voorwaarden | `/voorwaarden` | Gebruiksvoorwaarden |
| Beveiliging PDF | via `/api/beveiliging-pdf` | Downloadbaar beveiligingsdocument |
| Opt-out | `/optout/[userId]` | Afmelden voor marketingmails |

---

## API-routes

### Kern-AI-routes

| Route | Doel |
|---|---|
| `/api/chat` | Hoofdgesprek met ArnoBot |
| `/api/bot/session-end` | Synthese aan einde gesprek (title, summary, uitdaging) |
| `/api/bot/coaching` | Coachingrapport genereren |
| `/api/bot/coaching-analyse` | BIEB-analyse genereren |
| `/api/bot/uitdaging` | Uitdaging/actie genereren na gesprek |
| `/api/bot/analyse` | Analyse aanvragen |
| `/api/bot/team/spotlight` | Maandelijkse teamanalyse |
| `/api/bot/team/1on1` | 1:1-agenda genereren |
| `/api/sparring/chat` | Sparringsmodus (oefengesprek) |
| `/api/sparring/debrief` | Debrief na sparring |

### Gebruikersbeheer

| Route | Doel |
|---|---|
| `/api/bot/profiel` | Profiel opslaan/ophalen |
| `/api/bot/sessions` | Gesprekken ophalen |
| `/api/bot/session` | Individuele sessie |
| `/api/bot/sessions/search` | Zoeken in gesprekken |
| `/api/bot/share-session` | Gesprek deelbaar maken |
| `/api/bot/export` | Data exporteren |
| `/api/bot/delete-account` | Account verwijderen |
| `/api/bot/referral` | Referralstatus ophalen |
| `/api/bot/cancel-subscription` | Abonnement opzeggen |
| `/api/bot/confirm-renewal` | Verlenging bevestigen |
| `/api/bot/nudge-opt-out` | Afmelden marketingmails |

### Team

| Route | Doel |
|---|---|
| `/api/bot/team/create` | Team aanmaken |
| `/api/bot/team/join` | Team aansluiten via uitnodigingscode |
| `/api/bot/team/status` | Teamstatus ophalen |
| `/api/bot/team/dashboard` | Teamdashboard data |
| `/api/bot/team/scores` | Teamscores |
| `/api/bot/team/lid` | Ledenbeheer |
| `/api/bot/team/1on1/save` | 1:1-notitie opslaan |
| `/api/bot/team/1on1/note` | Notitie ophalen |
| `/api/bot/team/ritme` | Ritme-indicator |
| `/api/bot/team/notifications` | Teamnotificaties |
| `/api/bot/team/share-analyse` | Analyse met manager delen |

### Admin

| Route | Doel |
|---|---|
| `/api/admin` | Admin stats ophalen |
| `/api/admin/tier` | Gebruiker tier aanpassen |
| `/api/admin/payment` | Betaling registreren |
| `/api/admin/test-email` | E-mail testen |
| `/api/arnobot-admin-login` | Admin inloggen (cookie) |
| `/api/admin/logout` | Admin uitloggen |

### Infrastructuur

| Route | Doel |
|---|---|
| `/api/optout/[userId]` | Opt-out marketingmails verwerken |
| `/api/csp-report` | CSP-schendingen ontvangen |
| `/api/beveiliging-pdf` | Beveiligings-PDF genereren |
| `/api/feedback` | Feedbackformulier |
| `/api/tts` | Text-to-speech |
| `/api/transcribe` | Spraakherkenning |
| `/api/bot/openers` | Gespreksopeners ophalen |
| `/api/bot/backfill-embeddings` | Embeddings backfill (cron, dagelijks 04:05) |
| `/api/bot/actieopvolging` | Actieopvolging |

---

## Cron jobs

Alle crons vereisen de `Authorization: Bearer {CRON_SECRET}` header. Vercel stuurt deze automatisch. Handmatig aanroepen kan via de admin emailpagina of met een directe HTTP-call met de header.

| Pad | Schema | Doel |
|---|---|---|
| `/api/cron/trial-emails` | Dagelijks 04:05 | Lifecycle e-mails: dag1, dag4, dag14, dag25, first_conversation, first_coaching |
| `/api/cron/inactivity-nudge` | Dagelijks 03:00 | Inactiviteitsmails: 7d (gepersonaliseerd), 21d, 45d, 60d |
| `/api/cron/daily-activity` | Dagelijks 03:00 | Dagelijks activiteitsrapport naar arno@arno.bot |
| `/api/cron/weekly-top-users` | Zaterdag 04:05 | Top 10 actieve gebruikers naar arno@arno.bot |
| `/api/cron/auto-analyse` | Dagelijks 04:05 | BIEB-analyse aanmaken als gebruiker 5+ nieuwe gesprekken heeft |
| `/api/bot/backfill-embeddings` | Dagelijks 04:05 | Embeddings aanvullen voor zoekfunctie |
| `/api/cron/refresh-openers` | 1e vd maand 04:05 | Gespreksopeners vernieuwen met verse AI-output |
| `/api/cron/model-check` | 1e vd maand 04:05 | Modelkwaliteitscheck: testgesprek per model, rapport naar model@arno.bot |
| `/api/cron/competitie` | 1e vd maand 04:05 | Competitierapport (meest actieve gebruikers) naar arno@arno.bot |
| `/api/cron/data-cleanup` | 1e vd maand 04:05 | Verwijderde gesprekken opschonen, inactieve users flaggen |
| `/api/cron/milestone-check` | 1e vd maand 04:05 | Alert als 50+ actieve gebruikers bereikt (Pro-upgrade trigger) |
| `/api/cron/kwartaal-doel` | 1e vd maand 04:05 | Kwartaaldoelcheck en rapport |
| `/api/cron/rss-ingest` | Zaterdag 00:00 | RSS-feeds inladen voor BIEB-contentverrijking |
| `/api/cron/update-handover` | 1e vd maand 04:10 | Overdrachts­documenten bijwerken (dit bestand) |

---

## Database-tabellen

De database draait op Supabase (PostgreSQL). Elke query op gebruikersdata vereist altijd een `.eq('user_id', userId)` filter om IDOR te voorkomen.

### `approved_users`
Centrale gebruikerstabel. Elk account staat hier.

| Kolom | Type | Inhoud |
|---|---|---|
| `user_id` | text (PK) | Clerk user ID (`user_xxx`) of `pending_xxx` bij e-mailaanmelding |
| `email` | text | E-mailadres |
| `voornaam` | text | Voornaam |
| `achternaam` | text | Achternaam |
| `is_active` | bool | Of het account actief is |
| `trial_start` | timestamptz | Startdatum trial (30 dagen gratis) |
| `paid_at` | timestamptz | Datum van betaling (maandelijks abonnement) |
| `expires_at` | timestamptz | Verloopdatum abonnement |
| `welcome_seen` | bool | Welkomspagina gezien? |
| `onboarding_done` | bool | Profiel ingevuld? |
| `nudge_opt_out` | bool | Afgemeld voor marketingmails? |
| `referral_code` | text | Eigen referralcode |
| `linkedin` | text | LinkedIn-profiellink |
| `tier` | text | `free`, `trial`, `paid`, `team` |

### `arnobot_rds_logs`
Alle ruwe gespreksnachrichten. Elke regel = één berichtblokje.

| Kolom | Inhoud |
|---|---|
| `user_id` | Clerk user ID |
| `role` | `user` of `assistant` |
| `content` | Berichttekst |
| `session_id` | UUID van de sessie |
| `created_at` | Timestamp |

### `arnobot_blog_sessions`
Gesprekssessies na afsluiting, met synthese.

| Kolom | Inhoud |
|---|---|
| `user_id` | Clerk user ID |
| `title` | AI-gegenereerde sessietitel |
| `summary` | Samenvatting van het gesprek |
| `feiten` | Kernpunten (bullets) |
| `uitdaging` | Actie/uitdaging voor de gebruiker |
| `embedding` | Vector (voyage-multilingual-2) van title+summary+feiten, voor semantisch zoeken. Drie schrijvers: `session-end/route.ts` (bij sessie-einde), `sessions/route.ts` (backfill bij het laden van de Bieb-pagina) en `backfill-embeddings/route.ts` (dagelijkse cron, vangnet voor de rest). Allemaal via de gedeelde `embedSessionText()` in `lib/rag.ts`, nooit rechtstreeks een embedding-functie aanroepen. Doorzoekbaar via de Supabase-functie `match_sessions` (user-gescoped, filtert sinds 2026-08-12 ook `deleted_at`). Gebruikt in `chat/route.ts` als aanvulling op de recency-geheugeninjectie (`findSemanticallyRelevantOlderSessions`, top 3 Basic/top 8 Pro+Team). |
| `deleted_at` | Soft delete timestamp. Twee schrijvers: de Basic-retentiecap (`sessions/route.ts`) en de handmatige DELETE (`session/route.ts`, enkelvoud). Beide roepen ook `pruneEntitiesForDeletedSessions()` aan (zie `arnobot_memory_entities` hieronder), zodat verwijderde sessies ook uit het entiteitengeheugen verdwijnen. |

### `arnobot_memory_entities`
Patroongeheugen over sessies heen: namen, bedrijven en terugkerende thema's die een gebruiker vaker noemt. Toegevoegd 2026-08-12, gedeelde logica in `lib/memoryEntities.ts` (RLS aan, zelfde patroon als `arnobot_blog_sessions`).

| Kolom | Inhoud |
|---|---|
| `user_id` | Clerk user ID |
| `entity_name` | Naam van de entiteit, uniek per gebruiker (`UNIQUE(user_id, entity_name)`) |
| `entity_type` | `persoon` / `bedrijf` / `thema`, vrije tekst, geen enum-dwang |
| `session_ids` | Array van sessie-ids waarin deze entiteit genoemd is |
| `mention_count` | Lengte van `session_ids`, opnieuw berekend bij elke wijziging i.p.v. los bijgehouden, voorkomt drift |
| `first_mentioned_at` / `last_mentioned_at` | Voor weergave, niet voor retentie-logica |

**Schrijvers (extractie):** `session-end/route.ts` en de wees-sessie-reparatie in `sessions/route.ts`, allebei via `extractAndStoreEntities()`. **Schrijvers (pruning):** de twee `deleted_at`-schrijvers hierboven, via `pruneEntitiesForDeletedSessions()`. Geen enkele plek roept de onderliggende Haiku-extractie of tabel-writes rechtstreeks aan, precies om de fout van vanochtend (losse aanroepen die uit de pas gaan lopen) niet te herhalen. **Lezer:** `chat/route.ts` via `findRecurringEntitiesInQuestion()`, case-insensitive substring-match van bekende entiteitsnamen in de nieuwe vraag.

### `arnobot_analyses`
BIEB-analyses. Elke analyse dekt de afgelopen gesprekken.

| Kolom | Inhoud |
|---|---|
| `user_id` | Clerk user ID |
| `analyse_text` | Volledige analysetekst |
| `created_at` | Aanmaakdatum |

### `arnobot_coaching`
Meest recente coachingprofiel per gebruiker (upsert, niet append).

| Kolom | Inhoud |
|---|---|
| `user_id` | Clerk user ID |
| `mindset_score` | Score 1-5 |
| `mindset_diagnose` | Diagnose-tekst |
| `systeem_score` | Score 1-5 |
| `systeem_diagnose` | Diagnose-tekst |
| `actie_score` | Score 1-5 |
| `actie_diagnose` | Diagnose-tekst |
| `voortgang` | Voortgangstekst |

### `arnobot_coaching_scores`
Historische coachingscores voor trendanalyse.

### `arnobot_1on1_log`
Opgeslagen 1:1-gespreksnotities door managers.

| Kolom | Inhoud |
|---|---|
| `manager_id` | Clerk user ID van de manager |
| `member_id` | Clerk user ID van het teamlid |
| `aandachtspunt` | Geëxtraheerd aandachtspunt |
| `mindset_score` / `systeem_score` / `actie_score` | Scores op moment van gesprek |
| `notitie` | Vrijwillige notitie van de manager |

### `arnobot_blog_profiles`
Salescontext per gebruiker (bedrijf, sector, doelgroep, etc.).

### `arnobot_team_members`
Koppeling gebruiker aan team met rol.

| Kolom | Inhoud |
|---|---|
| `user_id` | Clerk user ID |
| `team_id` | UUID van het team |
| `role` | `manager` of `member` |

### `arnobot_referrals`
Referraltracking: wie heeft wie uitgenodigd.

### `inactivity_nudge_log`
Bijhouden welke inactiviteitsmails (dag21/dag45/dag60) al verstuurd zijn per gebruiker.

---

## Authenticatie en autorisatie

**Gebruikersauthenticatie:** Clerk (`@clerk/nextjs`). Gebruikers loggen in via e-mail/wachtwoord of LinkedIn OAuth.

**Toegangslogica (proxy.ts):**
1. Scanner-requests (`.env`, `wp-admin`, etc.) → direct 404
2. Admin-routes (`/bot/admin/*`) → cookie-gebaseerd (`arnobot_admin`)
3. Bot-routes (`/bot/*`) → Clerk auth vereist + `approved_users` check
4. Toegangsstatus op basis van: `paid_at` aanwezig → altijd toegang; anders `expires_at` in toekomst; anders `trial_start` + 30 dagen niet verstreken
5. `welcome_seen` niet waar → redirect `/bot/welkom`
6. `onboarding_done` niet waar → redirect `/bot/profiel`

**Admin-authenticatie:** Aparte cookie (`arnobot_admin`). Login via `/bot/admin/login` met het `ARNOBOT_ADMIN_KEY` environment variable als wachtwoord. Niet via Clerk.

**API-route beveiliging:** Alle `/api/bot/*` routes roepen `auth()` aan (Clerk server-side). Crons controleren `Authorization: Bearer {CRON_SECRET}`.

---

## Beveiliging

- **CSP (Content Security Policy):** Gegenereerd per request met nonce in `proxy.ts`. Blokkeert inline scripts zonder nonce.
- **Security headers:** `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Strict-Transport-Security`, `Referrer-Policy`, `Permissions-Policy`.
- **Rate limiting:** Upstash Redis via `@upstash/ratelimit`. Actief op AI-routes.
- **Prompt injection detectie:** Regex-check op inkomende berichten in `/api/chat` voor veelgebruikte injectionpatronen (NL + EN).
- **User-filter op queries:** Elke Supabase-query op gebruikersdata vereist `.eq('user_id', userId)`. userId altijd uit Clerk `auth()`, nooit uit de request body.
- **Disposable e-mails:** `disposable-email-domains` package filtert wegwerpmail bij aanmelding.
- **CSP-rapportage:** Schendingen worden gelogd via `/api/csp-report`.

**Pre-launch taak (nog open):** RLS inschakelen in Supabase als defense-in-depth. Zie CLAUDE.md voor details.

---

## AI-modellen en routering

<!-- AUTO:MODELS -->
| Route | Model | Reden | Laatste check |
|---|---|---|---|
| `app/api/chat/route.ts` (hoofdchat, streaming) | `claude-sonnet-4-6` | Sonnet 5 teruggedraaid: bij lange/complexe vragen geen text block in response (thinking mode zonder output). Deze call gebruikt `.messages.stream(`, niet `.messages.create(` — werd bij de eerste 2026-07-fixronde over het hoofd gezien omdat die alleen op `.messages.create(` zocht, en had daardoor als enige hoog-volume route nog geen retry/fallback. Alsnog voorzien van retry-bij-leeg-antwoord ná het einde van de stream (`finalMessage()`) plus een zichtbare fallbackzin, zodat er nooit een leeg antwoord in `arnobot_rds_logs`/`arno_blog_widget_logs` terechtkomt. Hercheck of Sonnet 5 zelf ooit weer bruikbaar wordt. | 2026-07 |
| `app/api/chat/route.ts` (RAG-queryherschrijving/checks) | `claude-haiku-4-5-20251001` | Korte classificatie/herschrijfstappen binnen de hoofdchat, met expliciete fallbacks. | 2026-07 |
| `app/api/bot/uitdaging/route.ts` | `claude-fable-5` | Grammaticale kwaliteit en voortgangsherkenning vereisen Fable. max_tokens 600 (thinking telt mee). Prompt uitgebreid met taalcontrole en progressie-instructie. Had wel een refusal-check maar geen check op een leeg-maar-niet-refusal antwoord; nu alsnog retry-bij-leeg-antwoord en een expliciete foutrespons (niet opgeslagen) bij aanhoudend leeg antwoord. **Getest tegen `claude-opus-5` (2026-07-26, `scripts/test-opus5-vs-fable5.mjs`, blinde vergelijking op echte data):** Fable 5 gehandhaafd. Fable 5's vraag was korter en directer (1 zin vs. 2), sloot beter aan bij Arno's stem. Verworpen: overstap naar Opus 5.
| `app/api/bot/session-end/route.ts` (synthese/feiten/uitdaging) | `claude-haiku-4-5-20251001` | Drie parallelle batch-calls per sessie. Had geen individuele leeg-check: een stil leeg antwoord (geen exception) werd altijd opgeslagen in `arnobot_blog_sessions`, zichtbaar in de Bieb. Nu per call retry-bij-leeg-antwoord; de samenvatting (het zichtbare terugblik-veld) krijgt bovendien een tekstuele fallback bij aanhoudend leeg antwoord, feiten/uitdaging blijven bewust optioneel leeg (niet kritiek voor de gebruiker). | 2026-07 |
| `app/api/bot/coaching/route.ts` (precheck) | `claude-sonnet-5` | Alleen ja/nee-vraag, Fable 5 overkill | 2026-07 |
| `app/api/bot/coaching/route.ts` (hoofdsynthese) | `claude-fable-5` | Hoogste kwaliteit voor de belangrijkste synthese. max_tokens 4000 (was 1600): thinking telt mee in het token budget, 1600 was te krap. Refusal check toegevoegd. getText() handelt thinking-blocks correct af. **Getest tegen `claude-opus-5` (2026-07-26, `scripts/test-opus5-vs-fable5.mjs`, blinde vergelijking op echte data):** Fable 5 gehandhaafd. Inhoudelijk nagenoeg gelijkwaardig, maar Opus 5 liet in deze testrun de drie verplichte `mindset_richting`/`systeem_richting`/`actie_richting`-velden uit het JSON-antwoord weg (schema-afwijking, risico op kapotte richting-badge in de UI), Fable 5 leverde ze correct. Verworpen: overstap naar Opus 5. Eén testrun, geen herhaalde meting; bij een volgende poging eerst opnieuw draaien om te zien of dit een patroon is.
| `app/api/bot/coaching/route.ts` (blog-synthese) | `claude-haiku-4-5-20251001` | Korte label per blog, Haiku volstaat | 2026-07 |
| `app/api/bot/coaching-analyse/route.ts` (BIEB-analyse) | `claude-sonnet-4-6` | Gemigreerd van Sonnet 5 (2026-07-audit): kon bij langere prompts stil een leeg antwoord teruggeven dat direct als analyse werd opgeslagen. Nu retry-bij-leeg-antwoord, en bij aanhoudend leeg antwoord een zichtbare foutmelding i.p.v. een lege analyse. | 2026-07 |
| `app/api/bot/team/spotlight/route.ts` (team spotlight) | `claude-sonnet-4-6` | Zelfde migratie/reden als coaching-analyse hierboven. Cruciale boodschap voor manager, mag niet stil leeg blijven. | 2026-07 |
| `app/api/bot/team/1on1/route.ts` (1:1 agenda) | `claude-haiku-4-5-20251001` | Sonnet 5 teruggedraaid: thinking-mode kapt output af midden in een zin (zelfde probleem als hoofdchat). Haiku doet geen thinking, is 5-10x sneller en volstaat voor gestructureerde agenda op basis van aangeleverde data. | 2026-07 |
| `app/api/sparring/debrief/route.ts` | `claude-sonnet-4-6` | **Bevestigde bug (2026-07):** stond nog op Sonnet 5, gaf bij lange sparring-transcripten (24-28 berichten) een lege debrief terug die stil werd opgeslagen (live geconstateerd: een testgebruiker had 2 sparsessies met een lege debrief, waardoor ArnoBot niet wist dat er gesparred was). Ontbrak eerder in deze tabel. Nu retry-bij-leeg-antwoord plus een zichtbare fallbacktekst i.p.v. een lege debrief. | 2026-07 |
| `app/api/sparring/chat/route.ts` (live sparring-gesprek) | `claude-sonnet-4-6` | Zelfde sessie/oorzaak als sparring/debrief hierboven, ontbrak eveneens in deze tabel. **Bevestigde bug (2026-07, testfeedback Thijs):** bij een leeg antwoord (bv. lastige rolomschrijving bij de "anders"-persona) toonde de route een in-karakter noodzin i.p.v. een echte foutmelding, en de client checkte `res.ok` niet, dus de gebruiker zag stil een nietszeggend "Er ging iets mis." zonder duidelijke oorzaak of vervolgstap. Nu try/catch + Sentry.captureException om de aanroep zelf (dekt ook een gooiende aanroep, niet alleen leeg), route geeft een expliciete 502 i.p.v. een nepantwoord, client toont een eerlijke uit-karakter melding met concrete vervolgstap. | 2026-07 |
| `app/api/sparring/open/route.ts` (opening van een sparring-gesprek) | `claude-sonnet-4-6` | Ontbrak volledig in deze tabel. Zelfde bug en fix als sparring/chat hierboven (zelfde testfeedback-sessie), inclusief de fallback-opening ("Kom binnen. Ga zitten.") die verving door een expliciete 502-foutrespons. | 2026-07 |
| `app/api/cron/auto-analyse/route.ts` | `claude-sonnet-4-6` | Batchanalyse over max 20 gesprekken per gebruiker, zelfde risico als coaching-analyse. Ontbrak eerder in deze tabel. Bij aanhoudend leeg antwoord wordt die gebruiker overgeslagen i.p.v. een lege analyse op te slaan en een foutieve "bijgewerkt"-mail te versturen. | 2026-07 |
| `app/api/admin/analyse-evaluaties/route.ts` | `claude-sonnet-4-6` | Interne evaluatie-analyse, ontbrak eerder in deze tabel. Bevatte ook een tijdgebonden instructie in de prompt ("wat je morgen moet aanpakken"), losstaand gecorrigeerd naar tijdsneutrale taal. | 2026-07 |
| `lib/rag.ts` (queryherschrijving RAG) | `claude-haiku-4-5-20251001` | Genereert 3 zoekzinnen per vraag (multi-query expansion), eenvoudige herschrijftaak, Haiku volstaat | 2026-07 |
| `lib/rag.ts` (embedding, kennisbank RAG) | `voyage-3-large` | Legacy model, geen gratis toelage. Upgrade naar `voyage-4-large` bewust NIET losstaand gedaan: breekt de kennisbank-zoekfunctie volledig (0 treffers, live geverifieerd), want de hele kennisbank is met dit model vooraf ge-embed. Vereist eerst volledige her-embedding, zie openstaand actiepunt hierboven. | 2026-07 |
| `lib/rag.ts` (rerank, kennisbank RAG) | `rerank-2.5` | Geüpgraded van `rerank-2` (legacy): door Voyage zelf bevestigd als strikt beter op kwaliteit, contextlengte, latency en throughput, zelfde prijs | 2026-07 |
| `lib/rag.ts` (`embedSessionText`, sessie-geheugen) | `voyage-multilingual-2` | **Bug gevonden en gefixt (2026-08-12):** `session-end/route.ts` schreef sinds 10 juni 2026 embeddings weg met `voyage-3-large` i.p.v. `voyage-multilingual-2`, een gemiste migratie. Alle 88 bestaande sessies opnieuw geëmbed, alle schrijvers geconsolideerd naar deze ene gedeelde functie. Zie CLAUDE.md sectie 3 ("Embedding-consistentiecheck") voor de volledige toedracht. Nog niet gecheckt op een nieuwere modelgeneratie, apart actiepunt. | 2026-08-12 |
| `app/api/bot/coaching-precheck/route.ts` | `claude-sonnet-4-6` | Losse ja/nee-check, expliciete fallback (`'nee'`), laag risico door korte prompt. Stond hier eerder foutief als `claude-sonnet-5` vermeld (2026-07-audit-drift, code was al gemigreerd, deze tabelrij niet). | 2026-07 |
| `app/api/bot/verfijn/route.ts` | `claude-sonnet-4-6` | Herschrijft een gebruikersvraag, expliciete fallback (de originele vraag), input gemaximeerd op 2000 tekens. Stond hier eerder foutief als `claude-sonnet-5` vermeld (2026-07-audit-drift). | 2026-07 |
| `app/api/bot/search-linkedin-profile/route.ts` | `claude-sonnet-4-6` (+ web_search tool) | Losse opzoektaak met expliciete "niet gevonden"-afhandeling. Stond hier eerder foutief als `claude-sonnet-5` vermeld (2026-07-audit-drift). | 2026-07 |
| `app/api/bot/sessions/route.ts` | `claude-haiku-4-5-20251001` | Ontbrak eerder in deze tabel, nog niet beoordeeld op leeg-antwoord-risico. | 2026-07 |
| `app/api/bot/sessions/search/route.ts` | `claude-haiku-4-5-20251001` | JSON-fallback (`[]`) bij parse-fout aanwezig. Ontbrak eerder in deze tabel. | 2026-07 |
| `lib/memoryEntities.ts` (`extractAndStoreEntities`) | `claude-haiku-4-5-20251001` | Nieuw (2026-08-12): extraheert namen/bedrijven/thema's per sessie voor `arnobot_memory_entities`. JSON-fallback (`[]`) bij parse-fout, hele extractie faalt stil (try/catch, geen retry, laag risico: optioneel patroongeheugen, geen kritiek pad). | 2026-08-12 |
| `app/api/cron/refresh-openers/route.ts` | `claude-sonnet-4-6` | Expliciete check op geldige JSON-structuur aanwezig. Stond hier eerder foutief als `claude-sonnet-5` vermeld (2026-07-audit-drift). | 2026-07 |
| `app/api/cron/rss-ingest/route.ts` | `claude-haiku-4-5-20251001` | Expliciete fallback-tekst aanwezig. Ontbrak eerder in deze tabel. | 2026-07 |
| `app/api/cron/inactivity-nudge/route.ts` | `claude-haiku-4-5-20251001` | Valt terug op generieke e-mailtemplate bij een fout, nog niet expliciet bij een leeg (maar niet-foutend) antwoord. Ontbrak eerder in deze tabel. | 2026-07 |
| `app/api/cron/model-check/route.ts` (eigen adviesgeneratie, e-mail only) | `claude-haiku-4-5-20251001` | De modelcheck-cron zelf, genereert het adviesgedeelte van de maandelijkse e-mail. Bevatte een eigen, verouderde `INVENTORY`-kopie die afweek van zowel de code als CLAUDE.md (zie "Gedaan"-notities hieronder); ontbrak zelf ook als aparte rij in deze tabel. Ontbrak eerder in deze tabel. | 2026-07 |
| `app/api/admin/feedback-analyse/route.ts` | `claude-haiku-4-5-20251001` | Nog geen expliciete leeg-check. Ontbrak eerder in deze tabel. | 2026-07 |
| `scripts/embed-chunks.mjs` (contextgeneratie per chunk) | `claude-haiku-4-5-20251001` | Offline script dat de kennisbank (`blog_chunks`) vult. Heeft een try/catch-fallback (`Fragment uit: ...`) maar geen check op een leeg-maar-niet-foutend antwoord; resultaat wordt permanent in de kennisbank opgeslagen. Ontbrak volledig in deze tabel (2026-07-audit-verificatie). | 2026-07 |
| `scripts/translate-knowledge-base.mjs` | `claude-opus-5` | Offline vertaalscript, enige plek in de codebase die Opus gebruikt. Gebruikt `tool_choice` om een tool_use te forceren; ontbrekende tool_use wordt afgevangen (post overgeslagen). Geüpgraded van `claude-opus-4-8`: Opus 5 kost hetzelfde ($5/$25 per miljoen tokens, gelijk aan Opus 4.8) maar presteert flink beter, onafhankelijk bevestigd door Artificial Analysis (#1 op Intelligence Index en Agentic Index, vóór Fable 5). | 2026-07 |
| `app/api/admin/blogs-analyse/route.ts` | `claude-sonnet-4-6` | Redactionele briefing, direct opgeslagen in `arnobot_idee_analyses`. Had geen retry/leeg-check (2026-07-audit-verificatie); nu retry-bij-leeg-antwoord met expliciete foutrespons (niet opgeslagen) bij aanhoudend leeg antwoord. | 2026-07 |
| `app/api/admin/meta-analyse/route.ts` (zelfbeoordeling + expertpanel) | `claude-sonnet-4-6` | Twee parallelle calls, direct opgeslagen in `arnobot_meta_analyses`. Hadden geen retry/leeg-check (2026-07-audit-verificatie); nu elk individueel retry-bij-leeg-antwoord, met expliciete foutrespons (niet opgeslagen) als één van beide na retry leeg blijft. | 2026-07 |
| `app/api/cron/meta-analyse/route.ts` (zelfbeoordeling + expertpanel) | `claude-sonnet-4-6` | Geautomatiseerde maandelijkse tegenhanger van admin/meta-analyse, draait zonder mens die het resultaat voor opslag ziet. Had geen retry/leeg-check (2026-07-audit-verificatie); nu elk individueel retry-bij-leeg-antwoord, analyse wordt overgeslagen (niet opgeslagen, geen mail) als één van beide na retry leeg blijft. | 2026-07 |
| `app/api/admin/test-email/route.ts` | `claude-haiku-4-5-20251001` | Admin-testtool, geen gebruikersgerichte output. Ontbrak eerder in deze tabel. | 2026-07 |
| `app/api/transcribe/route.ts` | `whisper-1` (OpenAI, rauwe fetch, geen SDK) | Spraak-naar-tekst voor voice-input. Ontbrak volledig uit deze tabel én uit de privacypagina/beveiligingsdocument (2026-07-audit-verificatieronde, zie OpenAI-sectie hierboven). | 2026-07 |
| `app/api/tts/route.ts` | `tts-1-hd` (OpenAI, stem `onyx`, rauwe fetch, geen SDK) | Tekst-naar-spraak. Ontbrak volledig uit deze tabel én uit de privacypagina/beveiligingsdocument (2026-07-audit-verificatieronde, zie OpenAI-sectie hierboven). | 2026-07 |
| `app/api/chat-voice/route.ts` (ArnoBot Voice, echte gebruikers, `plan` premium/team) | `claude-sonnet-4-6` | Eigen, korte voice-systeeminstructie (`buildVoiceSystemPrompt` in `lib/systemPrompt.ts`, doellengte 400-600 tekens, gespreksachtig). Niet-streamend (`.messages.create()`), want bij zulke korte antwoorden weegt de streaming-boilerplate niet op tegen de winst. Claude-call-plus-retry-logica in `lib/voice.ts` (`getVoiceAnswer`), gedeeld met de admin-testroute. Eigen Upstash-rate-limiter (30/uur per gebruiker, `arnobot:voice-chat`), los van de hoofdchat-limiter. | 2026-07 |
| `app/api/tts-voice/route.ts` (ArnoBot Voice, echte gebruikers, `plan` premium/team) | `eleven_flash_v2_5` (ElevenLabs, rauwe fetch, geen SDK) | Streaming tekst-naar-spraak, ElevenLabs-fetch-logica in `lib/voice.ts` (`fetchElevenLabsSpeech`), gedeeld met de admin-testroute. Verbruik gelogd in `arnobot_elevenlabs_usage` met de echte Clerk `userId`. Eigen rate-limiter (60/uur, `arnobot:voice-tts`). | 2026-07 |
| `app/api/admin/voice-test/chat/route.ts` (ArnoBot Voice, admin-only testfase) | `claude-sonnet-4-6` | Interne testroute voor stem/latency/stijl, blijft bestaan naast de publieke route. Gebruikt dezelfde `getVoiceAnswer()` uit `lib/voice.ts`. Alleen bereikbaar via `/bot/admin/voice-test`, geen Clerk-auth. | 2026-07 |
| `app/api/admin/voice-test/tts/route.ts` (ArnoBot Voice, admin-only testfase) | `eleven_flash_v2_5` (ElevenLabs, rauwe fetch, geen SDK) | Interne testroute, gebruikt dezelfde `fetchElevenLabsSpeech()` uit `lib/voice.ts`. Verbruik gelogd met de vaste waarde `'admin-voice-test'`. | 2026-07 |
<!-- /AUTO:MODELS -->

**Beslissingsvolgorde:** kwaliteit eerst, kosten tweed. Een goedkoper model wordt alleen gekozen als de kwaliteit aantoonbaar gelijkwaardig is voor die specifieke taak.

**Openstaand actiepunt:** Hercheck of Sonnet 5 de thinking-mode truncatie heeft opgelost. Test op staging. Niet uitvoeren rond 1 augustus (livegang). Zie CLAUDE.md voor details.

---

## Package-versies

<!-- AUTO:VERSIONS -->
| Package | Versie |
|---|---|
| next | ^16.2.12 |
| react | ^19.2.8 |
| @anthropic-ai/sdk | ^0.109.1 |
| @clerk/nextjs | ^7.5.12 |
| @supabase/supabase-js | ^2.110.8 |
| resend | ^6.17.1 |
| @upstash/ratelimit | ^2.0.8 |
| @upstash/redis | ^1.38.0 |
| sanity | ^6.7.0 |
| @react-pdf/renderer | ^4.3.3 |
| jspdf | ^4.2.0 |
| typescript | ^6 |
<!-- /AUTO:VERSIONS -->

---

## Externe diensten

Voor elk van deze diensten heb je toegang nodig om de app te runnen. Zie BUSINESS_HANDOVER.md voor waar de inloggegevens staan.

### Vercel
**Doel:** Hosting, serverless functions, cron jobs, environment variables.  
**Dashboard:** https://vercel.com/arnoceo-ops/arnobot  
**Kritieke acties:**
- Environment variables beheren (Settings > Environment Variables)
- Deployments bekijken en terugdraaien (Deployments)
- Vercel Logs bekijken voor errors en cron output (Logs)
- Cron jobs monitoren (Settings > Crons)

**Environment variables die vereist zijn:**
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role key (admin toegang)
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` — Clerk publieke key
- `CLERK_SECRET_KEY` — Clerk geheime key
- `ANTHROPIC_API_KEY` — Anthropic API key
- `RESEND_API_KEY` — Resend API key
- `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` — Upstash Redis
- `CRON_SECRET` — Geheime token voor cron autorisatie
- `ARNOBOT_ADMIN_KEY` — Admin paneel wachtwoord
- `ARNOBOT_OWNER_USER_ID` — Clerk user ID van Arno (voor admin-functies)
- `GITHUB_TOKEN` — GitHub PAT voor update-handover cron
- `TELEGRAM_NEW_USER_BOT_TOKEN` + `TELEGRAM_NEW_USER_CHAT_ID` — Telegram notificaties
- `NEXT_PUBLIC_SANITY_PROJECT_ID` + `SANITY_API_TOKEN` — Sanity CMS

### Supabase
**Doel:** PostgreSQL database, alle gebruikersdata.  
**Dashboard:** https://supabase.com/dashboard  
**Kritieke acties:**
- SQL Editor: directe queries uitvoeren
- Table Editor: data bekijken en bewerken
- Gebruiker toevoegen: INSERT in `approved_users`
- Gebruiker deactiveren: `UPDATE approved_users SET is_active = false WHERE user_id = '...'`
- API-keys bekijken (Settings > API)
- Database backups (Settings > Backups) — automatisch dagelijks op Pro plan

**Openstaande taak:** RLS (Row Level Security) inschakelen voor Supabase met Clerk JWT-integratie. Zie CLAUDE.md voor details. Dit moet vóór livegang (1 augustus 2026) gedaan worden.

### Clerk
**Doel:** Authenticatie, gebruikersbeheer, LinkedIn OAuth.  
**Dashboard:** https://dashboard.clerk.com  
**Kritieke acties:**
- Gebruikers zoeken en bekijken (Users)
- User ID opzoeken voor Supabase-queries
- OAuth providers beheren (LinkedIn)
- Clerk custom domain: `clerk.arno.bot` (via DNS)

**Let op:** Zorg dat je niet per ongeluk een production-instance verwisselt met een development-instance. Development instances zijn gratis maar werken niet op arno.bot.

### Anthropic
**Doel:** Claude AI API.  
**Dashboard:** https://console.anthropic.com  
**Kritieke acties:**
- API-key beheren (API Keys)
- Gebruik en kosten bekijken (Usage)
- Workspaces en rate limits (Organization)

### Resend
**Doel:** E-mail verzending.  
**Dashboard:** https://resend.com  
**Kritieke acties:**
- Verzonden e-mails bekijken (Emails)
- DKIM-status controleren (Domains > arno.bot)
- API-key beheren (API Keys)
- Bounces en errors bekijken

**Verzendend adres:** `ArnoBot <info@arno.bot>`  
**Opt-out gaat naar:** `/optout/[userId]` (publieke route, geen login nodig)

### Upstash
**Doel:** Redis voor rate limiting op AI-routes.  
**Dashboard:** https://console.upstash.com  
**Kritieke acties:** REST URL en token bekijken, gebruik monitoren

### Sanity
**Doel:** CMS voor BIEB-content (artikelen, inzichten).  
**Dashboard:** https://sanity.io/manage  
**Studio:** Via de app (`/studio` als die route actief is) of direct op sanity.io  
**Kritieke acties:** Content beheren, dataset bekijken

### VoyageAI
**Doel:** Embedding-API voor semantisch zoeken in gesprekken.  
**Dashboard:** https://dash.voyageai.com  
**Kritieke acties:** API-key beheren, gebruik bekijken

### GitHub
**Doel:** Source code, CI/CD trigger voor Vercel.  
**Repo:** https://github.com/arnoceo-ops/arnobot  
**Kritieke acties:** Code bekijken, branches beheren, commits terugdraaien

### Telegram
**Doel:** Notificaties bij nieuwe gebruikersinschrijvingen.  
**Setup:** Een Telegram-bot (`TELEGRAM_NEW_USER_BOT_TOKEN`) stuurt berichten naar een chat (`TELEGRAM_NEW_USER_CHAT_ID`). Beheren via @BotFather op Telegram.

---

## Veelvoorkomende operaties

### Gebruiker handmatig toevoegen (trial)
```sql
INSERT INTO approved_users (user_id, email, voornaam, achternaam, is_active, trial_start)
VALUES ('pending_[willekeurige-string]', 'email@example.com', 'Voornaam', 'Achternaam', true, now());
```
De gebruiker logt in via Clerk en het pending-record wordt automatisch bijgewerkt.

### Gebruiker betaald zetten
Ga naar `/bot/admin/gebruikers`, zoek de gebruiker op, of gebruik de admin payment route:
```
POST /api/admin/payment
{ "userId": "user_xxx", "months": 1 }
```

### Gebruiker deactiveren
```sql
UPDATE approved_users SET is_active = false WHERE user_id = 'user_xxx';
```

### Cron handmatig draaien
Ga naar `/bot/admin/emails` en gebruik de "STUUR TEST" knoppen voor admin crons. Of roep de route direct aan:
```
curl -H "Authorization: Bearer [CRON_SECRET]" https://arno.bot/api/cron/[naam]
```

### Deployment terugdraaien
Vercel dashboard > Deployments > klik op eerdere deployment > "Promote to Production"

### Error debuggen
Vercel dashboard > Logs > filter op "Error" of zoek op de route. Elke cron logt zijn output hier.

### Database query uitvoeren
Supabase dashboard > SQL Editor > schrijf je query. Let op: altijd een WHERE-clause bij schrijfoperaties.

### E-mail testen
`/bot/admin/emails` — lijst met alle e-mail templates, elke met testknop.

---

## Bekende beperkingen en openstaande punten

1. **Sonnet 5 hoofdchat:** Teruggedraaid naar Sonnet 4.6 wegens thinking-mode truncatie. Hercheck gepland na 1 augustus 2026.
2. **RLS Supabase:** Nog niet ingeschakeld. Moet vóór livegang gedaan worden.
3. **Share intrekken:** Gebouwd maar bewust uitgesteld. Kleine kans op probleem bij huidige doelgroep.
4. **Pro upgrade triggers:** Vercel Firewall, Supabase PITR, Clerk session limits aanzetten bij 50+ actieve gebruikers.
