# Voyage her-embedding naar de voyage-4-serie

## Statusblok

- **Laatst bijgewerkt:** 2026-09-02
- **Waar we staan:** Fase 0 loopt. Branch `voyage-4-reembed` aangemaakt. Modelkeuze `voyage-4-large` goedgekeurd door Arno (2026-09-02). Geverifieerd tegen de actuele Voyage-docs: `voyage-3-large` is "previous generation", `voyage-3.5` is "legacy", `voyage-multilingual-2` is deprecated. De `voyage-4`-serie is de huidige generatie en dekt ook multilingual. Prijs `voyage-4-large` $0,12/M tokens, eerste 200M gratis; corpus is < 0,5M tokens totaal, dus effectief gratis.
- **Eerstvolgende stap:** Arno voert de Fase 0-SQL uit in Supabase (kolomtype-check + huidige definities van `match_blog_chunks` en `match_sessions` dumpen) en plakt de output terug, zodat de v4-RPC's exact gekloond kunnen worden.

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

- [x] **SQL-migratie 1** aangeleverd (shadow-kolommen op beide tabellen + `match_blog_chunks_v4` + `match_sessions_v4`, geen indexen). Wacht op uitvoering + bevestiging door Arno.
- [ ] `embed-chunks.mjs`, `rss-ingest/route.ts`, `embed-single-doc.mjs` schrijven **beide** kolommen (oud model + `voyage-4-large`)
- [ ] Deploy van de dual-write (leest nog oud)
- [ ] `node scripts/embed-chunks.mjs` draaien → volledige rebuild, elke rij krijgt beide vectoren
- [ ] **SQL-migratie 1b** (Arno): `create index blog_chunks_embedding_v4_idx ... ivfflat (embedding_v4 vector_cosine_ops) with (lists = 100)`
- [ ] Verifiëren: 10 echte vragen door beide RPC's, resultaten vergelijken; cosine-similarity-steekproef op identieke brontekst (nieuw geëmbede query vs opgeslagen `embedding_v4` ≈ 1,0)
- [ ] **Cutover-deploy:** `getVoyageEmbedding()` → `voyage-4-large`, `searchCandidates()` → `match_blog_chunks_v4`
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

