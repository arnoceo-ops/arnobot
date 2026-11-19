-- Samenvatting per bewaard document (2026-11-19), zie docs/DOCUMENTEN_PLAN.md, "Bouwplan stap 5".
--
-- Voegt toe aan arnobot_documenten: een status voor het samenvatten (zodat een falend document niet bij elke
-- run opnieuw geld kost), een tellertje voor pogingen, en de embedding van de samenvatting
-- (voyage-multilingual-2, 1024 dimensies, dezelfde ruimte als arnobot_blog_sessions.embedding).
-- Plus match_documenten: zoekt in de samenvattingen van één gebruiker, met het eigenaarsfilter in de functie zelf.
--
-- Geen ivfflat-index (zie CLAUDE.md, recall-check): per gebruiker staan er hooguit 50 documenten (QUOTA_MAX_DOCUMENTEN),
-- een gewone scan met het user_id-filter is exact en snel genoeg.
--
-- Veilig om nu uit te voeren: de bestaande code kent de nieuwe kolommen niet en verandert niet.
--
-- UITVOEREN in de Supabase SQL-editor:

alter table public.arnobot_documenten
  add column if not exists samenvatting_status text not null default 'leeg'
    check (samenvatting_status in ('leeg', 'bezig', 'klaar', 'mislukt', 'overgeslagen')),
  add column if not exists samenvatting_pogingen integer not null default 0,
  add column if not exists samenvatting_bijgewerkt_op timestamptz,
  add column if not exists embedding vector(1024);

create index if not exists arnobot_documenten_samenvatting_idx
  on public.arnobot_documenten (samenvatting_status, created_at)
  where bewaard = true and verwijderd_op is null;

create or replace function public.match_documenten(
  match_user_id text,
  query_embedding vector(1024),
  match_count integer default 10
)
returns table (id uuid, naam text, samenvatting text, created_at timestamptz, similarity double precision)
language sql
stable
as $$
  select d.id, d.naam, d.samenvatting, d.created_at,
         1 - (d.embedding <=> query_embedding) as similarity
  from public.arnobot_documenten d
  where d.user_id = match_user_id
    and d.bewaard = true
    and d.verwijderd_op is null
    and d.samenvatting_status = 'klaar'
    and d.embedding is not null
  order by d.embedding <=> query_embedding
  limit match_count;
$$;

-- Controle: de vier kolommen en de functie moeten er staan.
select column_name from information_schema.columns
where table_schema = 'public' and table_name = 'arnobot_documenten'
  and column_name in ('samenvatting_status', 'samenvatting_pogingen', 'samenvatting_bijgewerkt_op', 'embedding');
select proname from pg_proc where proname = 'match_documenten';
