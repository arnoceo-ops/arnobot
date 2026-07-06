# ArnoBot — Technische overdracht

Dit document beschrijft de volledige technische structuur van ArnoBot. Het is bedoeld voor een developer die het project overneemt zonder voorkennis. Bewaar dit document in de GitHub-repo (`docs/TECHNICAL_HANDOVER.md`) zodat het altijd naast de code staat.

Sectie **AI-modellen** en **Package-versies** worden automatisch bijgewerkt op de 1e van elke maand door de `update-handover` cron.

<!-- AUTO:UPDATED -->
Laatste automatische update: 2026-07-06
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
| `/api/bot/sessions/embed` | Embeddings opslaan |
| `/api/bot/backfill-embeddings` | Embeddings backfill |
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
| `deleted_at` | Soft delete timestamp |

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

**Toegangslogica (middleware.ts):**
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

- **CSP (Content Security Policy):** Gegenereerd per request met nonce in `middleware.ts`. Blokkeert inline scripts zonder nonce.
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
| `app/api/chat/route.ts` (hoofdchat) | `claude-sonnet-4-6` | Sonnet 5 teruggedraaid: bij lange/complexe vragen geen text block in response (thinking mode zonder output). Hercheck zodra stabiel gedrag bevestigd. | 2026-07 |
| `app/api/bot/uitdaging/route.ts` | `claude-sonnet-5` | Één korte vraag genereren, Sonnet volstaat | 2026-07 |
| `app/api/bot/session-end/route.ts` (synthese) | `claude-haiku-4-5-20251001` | Drie snelle batch-calls per sessie, kwaliteit voldoende | 2026-07 |
| `app/api/bot/coaching/route.ts` (precheck) | `claude-sonnet-5` | Alleen ja/nee-vraag, Fable 5 overkill | 2026-07 |
| `app/api/bot/coaching/route.ts` (hoofdsynthese) | `claude-fable-5` | Hoogste kwaliteit voor de belangrijkste synthese | 2026-07 |
| `app/api/bot/coaching/route.ts` (blog-synthese) | `claude-haiku-4-5-20251001` | Korte label per blog, Haiku volstaat | 2026-07 |
| `app/api/bot/coaching-analyse/route.ts` | `claude-sonnet-5` | Patroonanalyse van max 20 gesprekken | 2026-07 |
| `app/api/bot/team/spotlight/route.ts` | `claude-sonnet-5` | Trend-bewuste teamanalyse | 2026-07 |
| `app/api/bot/team/1on1/route.ts` | `claude-haiku-4-5-20251001` | Sonnet 5 teruggedraaid wegens thinking-mode truncatie. Haiku: geen thinking, 5-10x sneller. | 2026-07 |
<!-- /AUTO:MODELS -->

**Beslissingsvolgorde:** kwaliteit eerst, kosten tweed. Een goedkoper model wordt alleen gekozen als de kwaliteit aantoonbaar gelijkwaardig is voor die specifieke taak.

**Openstaand actiepunt:** Hercheck of Sonnet 5 de thinking-mode truncatie heeft opgelost. Test op staging. Niet uitvoeren rond 1 augustus (livegang). Zie CLAUDE.md voor details.

---

## Package-versies

<!-- AUTO:VERSIONS -->
| Package | Versie |
|---|---|
| next | ^16.2.9 |
| react | ^19.2.7 |
| @anthropic-ai/sdk | ^0.109.0 |
| @clerk/nextjs | ^7.0.4 |
| @supabase/supabase-js | ^2.108.2 |
| resend | ^6.16.0 |
| @upstash/ratelimit | ^2.0.8 |
| @upstash/redis | ^1.38.0 |
| sanity | ^6.2.0 |
| voyageai | ^0.4.0 |
| @react-pdf/renderer | ^4.3.3 |
| jspdf | ^4.2.0 |
| typescript | ^5 |
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
