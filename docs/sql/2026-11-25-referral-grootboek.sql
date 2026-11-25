-- Referralautomatisering, grootboek (docs/REFERRAL_AUTOMATISERING.md). Uitvoeren in de Supabase SQL Editor.
-- Alleen een nieuwe tabel: geen bestaande gegevens worden gewijzigd of verwijderd. Veilig om nog een keer te draaien.
-- Zolang dit niet is uitgevoerd doet de dagelijkse grootboekcontrole niets; het overzicht rekent dan wel mee.

create table if not exists public.arnobot_referral_grootboek (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  -- Unieke gebeurtenis, bijvoorbeeld 'uitkomst:<referral>' (toegekend of afgewezen) of 'verval:<referral>'.
  event_key text not null,
  -- true: meeloopstand, deze regel heeft geen gevolgen en telt bij livegang niet mee.
  meeloop boolean not null default true,
  soort text not null check (soort in ('toekenning', 'afwijzing', 'vaststelling', 'verval', 'handwerk')),
  referral_id text not null,
  aanbrenger_user_id text not null,
  klant_user_id text not null,
  -- Mutatie van het saldo in centen exclusief btw. Leeg: toegekend, bedrag nog niet vast te stellen.
  netto_cent integer,
  reden text not null,
  klant_maand_netto_cent integer
);

create unique index if not exists arnobot_referral_grootboek_event_uniek
  on public.arnobot_referral_grootboek (meeloop, event_key);
create index if not exists arnobot_referral_grootboek_aanbrenger_idx
  on public.arnobot_referral_grootboek (aanbrenger_user_id);

-- Alleen de server (service-role) komt erbij, net als bij de andere tabellen.
alter table public.arnobot_referral_grootboek enable row level security;

-- Controle: dit moet 1 rij teruggeven met rowsecurity = true en indexen = 3.
select t.tablename, t.rowsecurity,
  (select count(*) from pg_indexes i where i.schemaname = 'public' and i.tablename = t.tablename) as indexen
from pg_tables t
where t.schemaname = 'public' and t.tablename = 'arnobot_referral_grootboek';
