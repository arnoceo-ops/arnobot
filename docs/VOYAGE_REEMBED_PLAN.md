# Voyage her-embedding naar de voyage-4-serie

## Statusblok

- **Laatst bijgewerkt:** 2026-09-02
- **Waar we staan:** GEPARKEERD. Onderzoek afgerond, cutover gaat niet door. `voyage-4-large` haalde de "kwaliteit eerst"-lat niet t.o.v. `voyage-3-large` / `voyage-multilingual-2` (wisselresultaat op retrieval, zie "Fase 1 verificatie-uitslag"). Geen productiecode ooit gewijzigd. Plandocument + verificatiescripts staan op master. De Supabase-shadowobjecten worden teruggedraaid (zie "Terugdraai-SQL" onderaan) zodat er geen halve migratie in productie blijft hangen.
- **Om te hervatten:** SQL-migratie 1 opnieuw draaien (bijlage), dan `backfill-chunks-v4.mjs`. Eerst de tuning-opties hieronder afwerken vóór een nieuwe kwaliteitsvergelijking.
- **Trigger om te hervatten:** Voyage kondigt een echte EOL-datum aan voor `voyage-3-large` of `voyage-multilingual-2`.

## Waarom nu

Geen harde blokker meer. Belangrijkste vondst: `voyage-3-large` en de hele `voyage-4`-serie draaien standaard op **1024 dimensies**, dus de `vector(1024)`-kolommen en pgvector-indexen hoeven niet te veranderen. Het deprecation-risico (model zonder harde aankondiging uitgezet, kennisbank + sessie-geheugen vallen dan tegelijk uit) loopt alleen op. Corpus is klein: een paar honderd kennisbank-chunks en ~100 sessies, ruim binnen de gratis tokentoelage.

## Wat je in de praktijk merkt

- Geen stille storing meer bij een deprecation-uitzetting.
- Iets scherpere retrieval bij vragen die anders geformuleerd zijn dan de brontekst en bij Nederlands. Merkbaar in een A/B op dezelfde vragen, niet in de dagelijkse beleving.
- Simpelere code: de twee embedding-paden in `lib/rag.ts` worden er één. De model-mix-bug van juni 2026 wordt structureel onmogelijk.
- Geen snelheids- of kostenverschil van betekenis. Geen downtime als we het als cutover doen.

## Besluiten en verworpen alternatieven

- **Gekozen: shadow-kolom (`embedding_v4`) naast de bestaande kolom, gefaseerde cutover.** Verworpen: het model-ID los verruilen en dan her-embedden. Dat laat de zoekfunctie kapot tijdens de rebuild (minuten tot een uur), niet enterprise-waardig.
- **Gekozen: shadow-kolom in dezelfde tabel.** Verworpen: aparte tabel `blog_chunks_v4`. Meer RPC- en code-duplicatie, geen voordeel nu de dimensies gelijk zijn.
- **Gekozen: op 1024 dimensies blijven.** Verworpen: verlagen naar 512/256 voor opslag/snelheid. Corpus te klein om verschil te maken, onnodig kwaliteitsrisico.
- **Gekozen: `voyage-4-large` voor beide vectorstores** (kwaliteit eerst, kosten verwaarloosbaar bij deze corpusgrootte, consolidatie naar één model). Goedgekeurd door Arno 2026-09-02. Verworpen: `voyage-4` / `voyage-4-lite`, alleen relevant geweest als rate limits of tokentoelage knelden, en dat doen ze niet.

## Betrokken code en data

**Kennisbank-RAG**
- Tabel: `blog_chunks` (`content`, `context`, `source`, `url`, `embedding`)
- RPC's: `match_blog_chunks` (vector), `match_blog_chunks_fulltext` (raakt embeddings niet)
- Schrijvers: `scripts/embed-chunks.mjs` (wist en herbouwt de hele tabel), `app/api/cron/rss-ingest/route.ts` (incrementeel, regel 107), `scripts/embed-single-doc.mjs`
- Lezer: `lib/rag.ts` → `getEmbedding()` → `getVoyageEmbedding()` (model op regel 43)

**Sessie-geheugen**
- Tabel: `arnobot_blog_sessions.embedding`
- RPC: `match_sessions(query_embedding, match_user_id, match_count)` → `session_id, similarity`. Filtert **niet** op `deleted_at` (bevestigd 2026-08-12); de `deleted_at`-uitsluiting gebeurt daarna in `app/api/chat/route.ts`. De v4-kloon houdt dit gedrag exact aan.
- Schrijvers: alle via `embedSessionText()` in `lib/rag.ts` → `app/api/bot/session-end/route.ts`, `app/api/bot/sessions/route.ts`, `app/api/bot/backfill-embeddings/route.ts`
- Lezer: `embedSessionQuery()` in `lib/rag.ts` (model op regel 62), aangeroepen vanuit `app/api/chat/route.ts`

**Tests die het model hardcoderen**
- `lib/contract.test.ts` (regel 60), `lib/rag.test.ts` (regels 71, 104-120)

**Docs die de modelnaam noemen**
- `CLAUDE.md` (modelinventaris, 3 rijen + de "Openstaand"-alinea rond regel 124)
- `docs/TECHNICAL_HANDOVER.md` (regels 426, 514, 621-623, 868)
- `docs/OPENSTAANDE_PUNTEN.md` (regel 18)

## Fasering

> **De fasering hieronder is het plan zoals het lag toen we begonnen. Het traject is geparkeerd na de Fase 1 verificatie-uitslag. Bewaard als startpunt voor een eventuele hervatting; de afvinkstatus is bevroren op 2026-09-02.**

### Fase 0 — voorbereiding
- [x] Modelkeuze bevestigd door Arno (`voyage-4-large`, 2026-09-02)
- [x] Prijs/toelage gecheckt: $0,12/M, eerste 200M gratis, corpus < 0,5M tokens
- [x] Voyage-account gecheckt via `scripts/check-voyage-4.mjs`: `voyage-4-large` werkt op de huidige key, geeft **1024 dimensies** terug (bestaande `vector(1024)`-kolommen passen, geen kolomtype-migratie), cosine(v3, v4) op dezelfde zin ≈ 0 (bevestigt: echt andere vectorruimte, volledige her-embedding verplicht)
- [x] **Fase 0-SQL** uitgevoerd (2026-09-02). Bevindingen:
  - Indexen: `blog_chunks_embedding_idx` = ivfflat, `vector_cosine_ops`, `lists=100`. `idx_sessions_embedding` = ivfflat, `vector_cosine_ops`, `lists=50`.
  - `match_blog_chunks(query_embedding vector, match_count int default 30, match_threshold float default 0.3)` → `content, context, source, url, similarity`. Cosine-distance (`<=>`), `similarity = 1 - distance`, filter `similarity > match_threshold`. App roept aan met alleen `query_embedding` + `match_count: 100` (threshold blijft 0.3).
  - `match_blog_chunks_fulltext` raakt embeddings niet, geen v4-versie nodig.
  - `match_sessions(query_embedding vector, match_user_id text, match_count int default 30)` → `session_id, title, summary, message_count, created_at, blog_suggestions, similarity`. Filtert `user_id = match_user_id AND embedding is not null AND deleted_at is null`.
  - **Zijvondst:** `match_sessions` filtert dus wél op `deleted_at`, terwijl de comment in `app/api/chat/route.ts` (rond regel 225) beweert van niet en er daarom nog een keer overheen filtert. De app-filter is nu redundant maar onschadelijk. Buiten scope van deze migratie; los noteren voor Arno.

**Combi-aanpak besluit:** beide vectorstores in één shadow-migratie (`embedding_v4` op beide tabellen, `match_blog_chunks_v4` + `match_sessions_v4` in één keer). De schrijvers en de cutover blijven wél per store gescheiden, zodat elke omschakeling los te verifiëren en terug te draaien is. Reden: de SQL is bijna identiek, dat scheelt Arno twee losse Supabase-sessies.

**ivfflat-detail:** een ivfflat-index clustert op de data die er bij het bouwen is. De `embedding_v4`-index dus pas aanmaken *nadat* de kolom gevuld is, niet in migratie 1.

**Aanpak-besluit kennisbank vullen:** géén volledige rebuild via `embed-chunks.mjs` tijdens het venster. In plaats daarvan een niet-destructief `scripts/backfill-chunks-v4.mjs` dat per bestaande rij `context + content` opnieuw embedt met `voyage-4-large` en alleen `embedding_v4` bijwerkt (`where embedding_v4 is null`, hervatbaar). Verworpen: `embed-chunks.mjs` dual-write laten draaien (wist en herbouwt de hele live tabel, te grof risico).

**Besluit incrementele schrijvers (herzien):** géén dual-write in `rss-ingest` en `embed-single-doc` tijdens het venster. Verworpen omdat het transitionele code + een tweede Voyage-call per batch is met rate-limit- en timeout-risico op de cron. In plaats daarvan: `backfill-chunks-v4.mjs` is hervatbaar (`where embedding_v4 is null`) en wordt **vlak vóór de cutover nog een keer gedraaid** om alles op te pikken wat de RSS-cron in het venster heeft toegevoegd. Restrace (cron vuurt tussen laatste backfill en deploy): één artikel maximaal een dag onvindbaar, opgelost door een backfill-run ná de cutover. Acceptabel voor een vaste kennisbank. `rss-ingest` + `embed-single-doc` gaan pas bij de cutover om naar `voyage-4-large` (dan één model).

- [x] **SQL-migratie 1** uitgevoerd + bevestigd door Arno (2026-09-02): `match_blog_chunks_v4` en `match_sessions_v4` bestaan, shadow-kolommen aangemaakt (function-body-validatie bevestigt dat `embedding_v4` bestaat).
- [ ] `scripts/backfill-chunks-v4.mjs` draaien → elke bestaande rij krijgt `embedding_v4`
- [ ] **SQL-migratie 1b** (Arno): `create index blog_chunks_embedding_v4_idx ... ivfflat (embedding_v4 vector_cosine_ops) with (lists = 100)`
- [ ] Verifiëren: 10 echte vragen door beide RPC's, resultaten vergelijken; cosine-similarity-steekproef op identieke brontekst (nieuw geëmbede query vs opgeslagen `embedding_v4` ≈ 1,0)
- [ ] `backfill-chunks-v4.mjs` nog één keer draaien (venster-restjes van de RSS-cron)
- [ ] **Cutover-deploy:** `getVoyageEmbedding()` → `voyage-4-large` + `searchCandidates()` → `match_blog_chunks_v4`; in dezelfde deploy `rss-ingest` + `embed-single-doc` + `embed-chunks.mjs` → `voyage-4-large`
- [ ] `backfill-chunks-v4.mjs` nog één keer ná de cutover (laatste restrace)
- [ ] 48 uur meekijken op Sentry en op de retrieval-kwaliteit
- [ ] **SQL-migratie 2** (Arno): oude `embedding` + index droppen, `embedding_v4` → `embedding` hernoemen, index hernoemen, `match_blog_chunks` vervangen door de v4-body, `match_blog_chunks_v4` droppen. Code terug naar de kale RPC-naam.

### Fase 2 — sessie-geheugen (groeiende corpus)
- [ ] `embedSessionText()` schrijft beide kolommen (oud model + `voyage-4-large`); deploy dual-write
- [ ] Backfill-script: `embedding_v4` vullen voor alle niet-verwijderde sessies (patroon van `scripts/reembed-sessions.mjs`)
- [ ] **SQL-migratie 3b** (Arno): `create index idx_sessions_embedding_v4 ... ivfflat (embedding_v4 vector_cosine_ops) with (lists = 50)`
- [ ] Verifiëren: cosine-similarity-steekproef + `match_sessions_v4` handmatig testen op een paar bekende sessies
- [ ] **Cutover-deploy:** `embedSessionQuery()` → `voyage-4-large`, lezer → `match_sessions_v4`
- [ ] 48 uur meekijken
- [ ] **SQL-migratie 4** (Arno): oude kolom + index droppen, hernoemen, `match_sessions` vervangen, `match_sessions_v4` droppen

### Fase 3 — consolidatie en opruimen
- [ ] `getVoyageEmbedding()` en `getMultilingualEmbedding()` samenvoegen tot één functie; het dual-model-commentaar in `lib/rag.ts` verwijderen
- [ ] `lib/contract.test.ts` en `lib/rag.test.ts` bijwerken naar `voyage-4-large`
- [ ] `CLAUDE.md` modelinventaris: 3 rijen bijwerken, de "Openstaand"-alinea bij Voyage weghalen, de embedding-consistentiecheck in de maandcheck versimpelen naar één model
- [ ] `docs/TECHNICAL_HANDOVER.md` en `docs/OPENSTAANDE_PUNTEN.md` bijwerken
- [ ] `npm audit`, `tsc`, `vitest`, `eslint` groen
- [ ] `npm run docs:pdf` en meecommitten

## Checkpoints waar Arno in de lus zit

1. Modelkeuze-akkoord (Fase 0)
2. SQL-migratie 1 uitvoeren + bevestigen (Fase 1)
3. Beslissen wie `embed-chunks.mjs` tegen productie draait en meekijkt (rate-limited, lange looptijd)
4. Retrieval-kwaliteit beoordelen op echte vragen vóór de cutover (Fase 1 en Fase 2)
5. Timing van elke cutover-deploy
6. SQL-migraties 2, 3 en 4 uitvoeren + bevestigen

Tussen de checkpoints door kan de bouw autonoom.

## Fase 1 verificatie-uitslag (2026-09-02)

Scripts: `scripts/verify-chunks-v4.mjs` (consistentie + pijplijn-vergelijking), `scripts/dump-v4-content.mjs` (inhoud van de top-5 naast elkaar, output `scripts/v4-content-vergelijking.md`), `scripts/verify-v4-inputtype.mjs` (input_type-test).

- **Consistentie: OK.** Verse `voyage-4-large`-embeddings van bestaande chunk-tekst matchen de opgeslagen `embedding_v4` op cosine 1,00000. De backfill klopt.
- **`input_type` (query/document): geen effect.** Voyage raadt het aan, maar met en zonder gaf identieke rerank-top. Niet de knop.
- **Retrieval na rerank: gemiddeld 28% bron-overlap oud vs nieuw.** Op inhoud beoordeeld (niet op titel):
  - "prijs te hoog": oud beter (VALUE BASED SELLING, HOE HOU JE DE PRIJZEN HOOG direct; nieuw dwaalt naar RETENTION / EOY STRATEGIES).
  - "vragen in een discovery call": nieuw beter (SHOOT FOR THE STARS = letterlijke vragenlijst; oud herhaalt 3x hetzelfde artikel + een dating-anekdote).
  - "vervolgafspraak zonder pusherig": oud duidelijk beter (AANBEVELENSWAARDIG J/N, KOUWE KERMIS; nieuw pakt HIRE FIRE en een zomerblog).
  - "erover nadenken": licht in het voordeel van nieuw op inhoud, maar met de meta-doc als ruis.
- **`voyage-4-large` haalt de kennisbankdoc "Kennisbank: Verifieer eerst, dan pas adviseer" hoog naar boven voor 3 van de 4 vragen.** Correctie op een eerdere aanname: dit is **geen stray meta-doc**, Arno heeft 'm bewust toegevoegd (`docs/kennisbank/verifieer-eerst-ruimte-niet-obstakel.md`, commit 9ce0b7b6, 19-8, opnieuw ge-embed 25-8) om het coachgedrag te sturen. Bij het huidige `voyage-3-large` rankt hij niet storend hoog; `voyage-4-large` trekt hem agressiever naar voren bij tactische vragen waar je liever tactische content ziet. Geen bug, wel een gedragsverschil dat meeweegt in het oordeel.

**Conclusie:** `voyage-4-large` haalt de "kwaliteit eerst"-lat niet. Niet slechter over de hele linie, maar ook niet aantoonbaar gelijkwaardig. Kosten zijn voor beide modellen effectief nul, dus er is geen kostenargument dat een gelijkspel-op-kwaliteit zou rechtvaardigen.

**Tuning-opties vóór een nieuwe poging:**
1. De verificatie herhalen met de vólledige hybride pijplijn: de test miste de 30 fulltext-kandidaten die `searchCandidates()` normaal meeneemt. Die vangen juist de idioom-titels (KOUWE KERMIS) die `voyage-4-large` laat vallen. Dit is de belangrijkste, de test was oneerlijk streng.
2. `voyage-4` (niet -large) en een hogere/lagere `match_threshold` testen.
3. `rerank-2.5` topN en `diversifyChunks` opnieuw ijken op de bredere bronspreiding die `voyage-4-large` geeft.

**Wat teruggedraaid wordt:** de `embedding_v4`-kolommen en `match_blog_chunks_v4` / `match_sessions_v4`. Reden: een halve migratie in productie laten staan is precies wat de professionaliteitscheck als anti-patroon noemt, en opnieuw opzetten is 30 seconden. De scripts en dit document blijven op master als startpunt.

## Bijlage: SQL

### SQL-migratie 1 (alleen-toevoegend, geen indexen)

```sql
-- Shadow-kolommen op beide vectorstores. Zelfde type als bestaand: vector(1024).
alter table blog_chunks           add column if not exists embedding_v4 vector(1024);
alter table arnobot_blog_sessions add column if not exists embedding_v4 vector(1024);

-- v4-variant van match_blog_chunks: identiek aan het origineel, leest embedding_v4.
create or replace function public.match_blog_chunks_v4(
  query_embedding vector,
  match_count integer default 30,
  match_threshold double precision default 0.3
)
returns table(content text, context text, source text, url text, similarity double precision)
language sql stable as $$
  select
    content, context, source, url,
    1 - (embedding_v4 <=> query_embedding) as similarity
  from blog_chunks
  where embedding_v4 is not null
    and 1 - (embedding_v4 <=> query_embedding) > match_threshold
  order by embedding_v4 <=> query_embedding
  limit match_count;
$$;

-- v4-variant van match_sessions: identiek aan het origineel, leest embedding_v4.
create or replace function public.match_sessions_v4(
  query_embedding vector,
  match_user_id text,
  match_count integer default 30
)
returns table(session_id text, title text, summary text, message_count integer,
              created_at timestamptz, blog_suggestions jsonb, similarity double precision)
language sql stable as $$
  select
    session_id, title, summary, message_count, created_at, blog_suggestions,
    1 - (embedding_v4 <=> query_embedding) as similarity
  from arnobot_blog_sessions
  where user_id = match_user_id
    and embedding_v4 is not null
    and deleted_at is null
  order by embedding_v4 <=> query_embedding
  limit match_count;
$$;
```

Verschil met de originelen: alleen de kolomnaam (`embedding_v4`) en een expliciete `embedding_v4 is not null` in `match_blog_chunks_v4` (het origineel mist die; tijdens de shadow-fase staat een groot deel van de kolom op null, de check maakt dat goedkoop expliciet). Verder byte-voor-byte gelijk gedrag.

Verificatie na uitvoeren:

```sql
select column_name, data_type from information_schema.columns
where table_name in ('blog_chunks','arnobot_blog_sessions') and column_name = 'embedding_v4';
-- verwacht: 2 rijen, USER-DEFINED (vector)

select proname from pg_proc where proname in ('match_blog_chunks_v4','match_sessions_v4');
-- verwacht: 2 rijen
```

### Terugdraai-SQL (uitgevoerd bij het parkeren, 2026-09-02)

Draait de shadowobjecten terug zodat er geen halve migratie in productie blijft. Raakt niets wat de app gebruikt.

```sql
drop function if exists public.match_blog_chunks_v4(vector, integer, double precision);
drop function if exists public.match_sessions_v4(vector, text, integer);
alter table blog_chunks           drop column if exists embedding_v4;
alter table arnobot_blog_sessions drop column if exists embedding_v4;
```

Verificatie:

```sql
select proname from pg_proc where proname in ('match_blog_chunks_v4','match_sessions_v4');
-- verwacht: 0 rijen
select column_name from information_schema.columns
where table_name in ('blog_chunks','arnobot_blog_sessions') and column_name = 'embedding_v4';
-- verwacht: 0 rijen
```

