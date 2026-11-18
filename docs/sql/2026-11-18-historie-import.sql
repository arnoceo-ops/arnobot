-- Het meenemen van historie uit een andere AI (2026-11-18), stap 1 van docs/HISTORIE_IMPORT_PLAN.md.
--
-- Eén profiel per gebruiker en per bron (chatgpt, claude, anders): wat de gebruiker zelf uit zijn andere AI heeft overgenomen en gecontroleerd,
-- in vier vaste kopjes (bedrijf, klanten, plannen, uitdagingen). Een nieuwe import van dezelfde bron vervangt het oude profiel van die bron;
-- profielen van andere bronnen blijven staan. (Aangepast op 2026-11-18, zie docs/sql/2026-11-18-historie-import-per-bron.sql voor wie de tabel al had.) De geplakte ruwe tekst wordt nooit bewaard.
-- Alleen lib/historieImport.ts leest en schrijft deze tabel; niet in analyses, managerroutes, blijvende feiten of arnobot_memory_entities.
--
-- Veilig om opnieuw uit te voeren. Mag VOOR de code die erop leest: de code staat achter HISTORIE_IMPORT_OPEN.
--
-- UITVOEREN in de Supabase SQL-editor:

create table if not exists public.arnobot_import_profielen (
  user_id text not null,
  bron text not null check (bron in ('chatgpt', 'claude', 'gemini', 'anders')),
  kopjes jsonb not null,
  tekens integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (user_id, bron)
);

-- RLS aan zonder policies, zoals alle andere tabellen (de app gebruikt alleen de service-role-key).
alter table public.arnobot_import_profielen enable row level security;

-- Controle: moet één rij tonen met rowsecurity = true
select tablename, rowsecurity
from pg_tables
where schemaname = 'public' and tablename = 'arnobot_import_profielen';
