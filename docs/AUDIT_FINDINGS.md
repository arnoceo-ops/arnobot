# Architectuur-audit bevindingen

Dit bestand bevat automatisch gegenereerde bevindingen van een periodieke architectuur-consistentie-audit (statische codeanalyse, geen live productietoegang). Elke bevinding hieronder moet door een mens beoordeeld worden, dit zijn geen bevestigde bugs.

## 2026-09-01

Uitgevoerd: wees-routes-check, gedeelde-databron-risico, modelinventaris-drift, RPC-aannames. Aanleiding: het embedding-model-mix-incident van 2026-08-12 en de ongebruikte debug-route die sinds juni 2026 onopgemerkt bleef, beide toevallig gevonden tijdens ander werk.

### 1. Wees-routes

`scripts/check-orphan-routes.mjs` gedraaid: geen nieuwe kandidaten gevonden buiten wat al in `KNOWN_MANUAL_ROUTES`/`KNOWN_EXTERNAL_PREFIXES` staat.

### 2. Gedeelde-databron-risico

Alle Supabase-tabellen met 2+ schrijvers doorlopen (18 tabellen, o.a. `approved_users` met 20 schrijvers). De meeste zijn onafhankelijke updates van verschillende velden op dezelfde rij (normaal patroon, geen risico). De volgende gevallen springen eruit:

- **`blog_chunks.embedding`**: twee volledig onafhankelijke implementaties van `embedBatch()`, elk met `model: 'voyage-3-large'` als losse string-literal, geen gedeelde helper of onderlinge import:
  - `scripts/embed-chunks.mjs` (rond regel 199, handmatig volledig her-embed-script)
  - `app/api/cron/rss-ingest/route.ts` (rond regel 103, wekelijkse incrementele cron)
  Vandaag zijn ze gelijk, maar niets dwingt dat af. Dit is qua vorm identiek aan het incident van 2026-08-12: twee schrijvers naar dezelfde embedding-kolom die het model onafhankelijk kiezen in plaats van via één gedeelde functie zoals `embedSessionText()` dat al wel doet voor sessie-geheugen.

- **`arnobot_analyses.analyse_text`**: twee onafhankelijke implementaties van de "Arno patroonanalyse"-aanroep, geen gedeelde prompt-opbouwfunctie:
  - `app/api/cron/auto-analyse/route.ts` (rond regel 68-73)
  - `app/api/bot/coaching-analyse/route.ts` (rond regel 139-146)
  Beide gebruiken consistent `claude-sonnet-4-6`, maar de systeemprompts zijn al uit elkaar gegroeid: `coaching-analyse/route.ts` importeert `RULE_ENGLISH_TERMS`/`RULE_NO_CRUDE_LANGUAGE`/`RULE_NEVER_BREAK_CHARACTER`/`RULE_NO_INVENTED_DETAILS` uit `lib/systemPrompt.ts` en bevat de door CLAUDE.md verplichte zinnen tegen markdown-opmaak en streepjes-als-leesteken. `cron/auto-analyse/route.ts` bevat géén van beide (geen referentie naar deze regels of naar `lib/systemPrompt`). Beide schrijven naar dezelfde `analyse_text`-kolom die identiek aan de gebruiker getoond wordt. Dit lijkt een al bestaande afwijking van de streepjes/markdown-regel in CLAUDE.md, niet alleen een hypothetisch risico.

- **`arnobot_referrals`**: twee onafhankelijke insert-paden zonder gedeelde helper:
  - `proxy.ts` (rond regel 239) vult `referred_naam` bij de insert
  - `app/api/bot/referral/route.ts` (rond regel 114) berekent een vergelijkbare naam via de Clerk API, maar neemt die niet op in de insert (alleen gebruikt voor een Telegram-bericht)
  Een referral via de URL-cookie-flow krijgt dus wel `referred_naam`, een referral via het in-app code-invoerpad niet. Zichtbaar in de huidige code, geen aanname.

- **`arnobot_meta_analyses`** (te beoordelen, geen bevestigd defect): `app/api/admin/meta-analyse/route.ts` en `app/api/cron/meta-analyse/route.ts` zijn twee grotendeels losse implementaties (250-300 regels elk) van dezelfde zelfbeoordeling/expertpanel/jouw-analyse-logica, met alleen gedeelde imports, geen gedeelde businesslogica-helper. De admin-route filtert de sessiepool expliciet tot `approved_users` (widget- en Sales Canvas-gebruikers uitgesloten per eigen commentaar); de cron-route lijkt dat filter niet toe te passen. Mogelijk bewust (cron breder bemonsteren), mogelijk niet: als onbedoeld, analyseert de maandelijkse automatische mail een andere, minder gecureerde populatie dan een handmatige admin-run van "dezelfde" rapportage.

- **`arnobot_blog_profiles`** (lage zekerheid, niet volledig getraceerd): `app/api/bot/profiel/route.ts` upsert het door de client gestuurde `profiel`-object zonder te mergen met de bestaande rij, terwijl `app/api/admin/test-persona/route.ts` en `lib/teamAccess.ts` (`clearIndividueelGebruik()`) wel eerst het bestaande profiel spreaden. `teamAccess.ts` heeft al een commentaar dat deze kwetsbaarheid rond het `gebruik`-veld erkent. Niet geverifieerd of de frontend in de praktijk altijd alle velden meestuurt.

### 3. Modelinventaris-drift

CLAUDE.md's Model-inventaris-tabel vergeleken met alle bestanden die `@anthropic-ai/sdk`, `getVoyageEmbedding`, `getMultilingualEmbedding`, `embedSessionText` of `embedSessionQuery` gebruiken (zowel `.messages.create(` als `.messages.stream(`).

- **`lib/groeibalansServer.ts`** (`recomputeGroeibalans`, rond regel 65-66): roept `claude-haiku-4-5-20251001` aan voor de "Gebruiksbalans"-widget, aangeroepen vanuit `app/api/bot/session-end/route.ts:190` en `app/api/sparring/debrief/route.ts:113`. Heeft geen eigen rij in de tabel en wordt niet gedekt door de bestaande session-end-rij (die verwijst naar de aparte thema-classificatie in `callThemasModel`, niet naar deze aanroep).

- **`app/api/cron/rss-ingest/route.ts`**: heeft een eigen inline `embedBatch()` die rechtstreeks Voyage aanroept met `voyage-3-large` (regel 107), los van `lib/rag.ts`'s `getVoyageEmbedding()`. Het modelgetal zelf klopt (consistent met tabelrij 18), maar de tabelrij voor deze route noemt alleen de Haiku-aanroep, niet deze embedding-aanroep. `lib/rag.ts` bevat expliciet commentaar (regel 30-33) dat `getVoyageEmbedding` niet los aangeroepen mag worden om precies dit soort model-mix te voorkomen. Zie ook bevinding onder sectie 2 hierboven, dit is dezelfde onderliggende situatie, twee keer onafhankelijk gevonden.

- **`scripts/embed-single-doc.mjs`** (laagste zekerheid): dezelfde Haiku 4.5 + `voyage-3-large`-pijplijn als `embed-chunks.mjs`, maar heeft geen eigen tabelrij. Eenmalig handmatig script, geen actieve productieroute.

Alle overige gecontroleerde routes (hoofdchat inclusief de `.stream()`-aanroep, coaching, RAG-herschrijving, rerank, sparring, admin- en cron-routes, transcriptie, ElevenLabs) kwamen overeen met de tabel.

### 4. RPC-aannames

`supabase.rpc(...)`-aanroepen gevonden op 3 plekken, 3 verschillende functienamen. Er is geen enkel SQL-migratiebestand in de repo (geen `*.sql`, geen `supabase/migrations`-map), dus geen van de drie is te verifiëren tegen de daadwerkelijke functie-definitie:

- **`match_sessions`** (`app/api/chat/route.ts:211-215`): code-commentaar (regel 225-227) stelt expliciet dat deze RPC NIET op `deleted_at` filtert ("bevestigd 2026-08-12, zie geheugen") en de aanroepende code compenseert daarvoor met een aparte `.is('deleted_at', null)`-query. **Tegenstrijdigheid gevonden:** `docs/TECHNICAL_HANDOVER.md:426` stelt het tegenovergestelde, dat `match_sessions` "user-gescoped, filtert deleted_at". Dit is een directe inconsistentie tussen code-commentaar en documentatie die apart bevestigd moet worden met live Supabase-data.
- **`match_blog_chunks`** (`lib/rag.ts:157-160`): aanname dat dit een vector-similarity-zoekopdracht over de kennisbank is zonder filtering op publicatiestatus. Niet expliciet gedocumenteerd, niet verifieerbaar.
- **`match_blog_chunks_fulltext`** (`lib/rag.ts:161-164`): fulltext-tegenhanger van bovenstaande, zelfde gebrek aan gedocumenteerde filtering-aannames.

Alle drie: te verifiëren met live data, niet automatisch gecontroleerd.
