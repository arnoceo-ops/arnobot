-- Documenten bewaren (2026-11-18), zie docs/DOCUMENTEN_PLAN.md.
--
-- 1. arnobot_documenten: één rij per bijlage van een gebruiker. Tijdelijk (bewaard = false, met een
--    verloopmoment van laatst gebruikt plus 48 uur) of bewaard in Docs (bewaard = true, geen verloop).
--    De server laadt per beurt alle documenten van (user_id, session_id). Een transcript van een
--    audio-opname is een rij met soort = 'transcript' en alleen tekst, zonder bestand (het audiobestand
--    wordt nooit bewaard).
-- 2. Bucket arnobot-documenten: privé, geen policies (alleen de service-role-key komt erbij), maximaal
--    10 MB per bestand, alleen de bestandstypen die de chat accepteert. De type-lijst bevat ook Excel en
--    PowerPoint voor later, dat hoeft dan geen tweede wijziging.
--
-- De embedding-kolom volgt in een eigen wijziging bij de stap die documenten aan het geheugen koppelt
-- (dezelfde vectorgrootte en hetzelfde model als de bestaande geheugen-embeddings, zie de
-- embedding-consistentiecheck in CLAUDE.md).
--
-- Bevat gebruikersinhoud (namen, tekst, samenvattingen). Nu uitvoeren kan geen kwaad: tot de code erop
-- schrijft blijven tabel en bucket leeg, en voor niemand verandert iets.
--
-- UITVOEREN in de Supabase SQL-editor:

create table if not exists public.arnobot_documenten (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  session_id text,                         -- leeg bij een document dat direct in Docs is toegevoegd
  naam text not null,                      -- schoongemaakte bestandsnaam, maximaal 120 tekens
  soort text not null default 'document' check (soort in ('document', 'transcript')),
  media_type text not null,
  bytes integer not null default 0,
  storage_path text,                       -- leeg bij een transcript
  tekst_cache text,                        -- uitgepakte tekst (docx/txt/csv/transcript), zodat niet elke beurt opnieuw wordt uitgepakt
  samenvatting text,
  bewaard boolean not null default false,
  created_at timestamptz not null default now(),
  laatst_gebruikt timestamptz not null default now(),
  verloopt_op timestamptz,                 -- alleen bij een tijdelijke kopie
  constraint arnobot_documenten_verloop_check check (bewaard = true or verloopt_op is not null),
  constraint arnobot_documenten_inhoud_check check (storage_path is not null or tekst_cache is not null)
);

create unique index if not exists arnobot_documenten_pad_idx
  on public.arnobot_documenten (storage_path) where storage_path is not null;
create index if not exists arnobot_documenten_sessie_idx
  on public.arnobot_documenten (user_id, session_id);
create index if not exists arnobot_documenten_docs_idx
  on public.arnobot_documenten (user_id, bewaard, created_at desc);
create index if not exists arnobot_documenten_verloop_idx
  on public.arnobot_documenten (verloopt_op) where verloopt_op is not null;

-- RLS aan zonder policies, zoals alle andere tabellen (de app gebruikt alleen de service-role-key).
alter table public.arnobot_documenten enable row level security;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'arnobot-documenten', 'arnobot-documenten', false, 10485760,
  array[
    'application/pdf',
    'image/png', 'image/jpeg', 'image/webp', 'image/gif',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain', 'text/csv'
  ]
)
on conflict (id) do nothing;

-- Controle 1: moet één rij tonen met rowsecurity = true
select tablename, rowsecurity
from pg_tables
where schemaname = 'public' and tablename = 'arnobot_documenten';

-- Controle 2: moet één rij tonen met public = false en file_size_limit = 10485760
select id, public, file_size_limit
from storage.buckets
where id = 'arnobot-documenten';

-- Controle 3: moet 0 rijen tonen (geen policies op deze bucket)
select policyname
from pg_policies
where schemaname = 'storage' and tablename = 'objects' and policyname ilike '%documenten%';
