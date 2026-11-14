-- Admin-logboek en cron-gezondheid (2026-11-14), voor ronde 2 van docs/ADMIN_PLAN.md.
--
-- 1. arnobot_admin_log: elke adminknop die geld of toegang wijzigt (BETAALD, terugbetalen,
--    plan, teamrol, SD-agent, gratis toegang, aan/uit, Teams-instellingen) schrijft hier een
--    regel: wat er gebeurde, voor wie, en de oude en nieuwe waarde. Alleen toevoegen, nooit
--    wijzigen of verwijderen, zodat het een betrouwbaar spoor blijft.
-- 2. cron_runs: per cron de laatste start, het laatste succes en de laatste fout, zodat de
--    admin kan tonen "laatst gelukt op ..." en een cron markeert die te laat is. Eén rij per
--    cron (primaire sleutel is de naam), elke run werkt die rij bij.
--
-- Bevat geen gebruikersinhoud: alleen gebruiker-ID's, bedragen, planwaarden en tijdstippen.
-- Nu uitvoeren kan geen kwaad: tot de code in ronde 2 erop schrijft blijven de tabellen leeg.
--
-- UITVOEREN in de Supabase SQL-editor:

create table if not exists public.arnobot_admin_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  actie text not null,          -- bijvoorbeeld 'betaald_gezet', 'terugbetaling', 'plan_gewijzigd'
  doel_user_id text,            -- de gebruiker waar de actie over ging
  doel_team_id text,            -- het team, bij Teams-instellingen
  details jsonb not null default '{}'::jsonb  -- oude en nieuwe waarde, bedrag, enzovoort
);

create index if not exists arnobot_admin_log_created_at_idx
  on public.arnobot_admin_log (created_at desc);
create index if not exists arnobot_admin_log_doel_user_idx
  on public.arnobot_admin_log (doel_user_id, created_at desc);

create table if not exists public.cron_runs (
  naam text primary key,        -- het pad van de cron, bijvoorbeeld '/api/cron/billing'
  laatste_start timestamptz,
  laatste_ok timestamptz,
  laatste_fout timestamptz,
  laatste_fout_tekst text,
  laatste_duur_ms integer,
  updated_at timestamptz not null default now()
);

-- RLS aan zonder policies, zoals alle andere tabellen (de app gebruikt alleen de service-role-key).
alter table public.arnobot_admin_log enable row level security;
alter table public.cron_runs enable row level security;

-- Controle: moet twee rijen tonen, beide met rowsecurity = true
select tablename, rowsecurity
from pg_tables
where schemaname = 'public' and tablename in ('arnobot_admin_log', 'cron_runs');
