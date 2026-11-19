-- Eén rij per Anthropic-aanroep: wie (user_id, leeg bij systeemwerk), waarvoor (bron), welk model en hoeveel tokens.
-- Gevuld door de middleware in lib/aiGebruik.ts via lib/anthropicClient.ts. Alleen aantallen, nooit inhoud.
-- Uitvoeren in de Supabase SQL-editor. De code werkt ook zonder deze tabel (de insert faalt dan stil met een logregel).

create table if not exists arnobot_ai_gebruik (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  user_id text,
  bron text not null,
  model text,
  invoer integer not null default 0,
  cache_schrijven integer not null default 0,
  cache_lezen integer not null default 0,
  uitvoer integer not null default 0,
  kosten_usd numeric(12, 6),
  afgebroken boolean not null default false
);

create index if not exists arnobot_ai_gebruik_user_tijd on arnobot_ai_gebruik (user_id, created_at);
create index if not exists arnobot_ai_gebruik_tijd on arnobot_ai_gebruik (created_at);

-- RLS aan zonder policies: veilig zolang de app uitsluitend de service-role-key gebruikt (zie CLAUDE.md, maandcheck 1).
alter table arnobot_ai_gebruik enable row level security;
