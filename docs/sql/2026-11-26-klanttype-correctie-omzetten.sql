-- Zelf omzetten van particulier naar zakelijk (docs/REFERRAL_CONTROLE_2026-11-26.md, N5). Uitvoeren in de Supabase SQL Editor.
-- Zelf omzetten werkt daarna alleen voor de eigenaar en de testaccounts, tot in Vercel KLANTTYPE_OPEN=true staat.
-- Vervangt docs/sql/2026-10-13-klanttype-correctie.sql (dat niet los draaien). Geen bestaande gegevens worden
-- gewijzigd of verwijderd. Veilig om nog een keer te draaien.

create table if not exists public.arnobot_klanttype_correcties (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  subscription_id uuid not null references public.arnobot_subscriptions (id),
  verschil_cent integer not null check (verschil_cent > 0),
  btw_cent integer not null check (btw_cent >= 0),
  mollie_payment_id text unique,
  status text not null default 'open' check (status in ('open', 'paid')),
  bedrijfsnaam text not null,
  kvk_nummer text not null,
  btw_nummer text not null,
  straat text not null,
  postcode text not null,
  plaats text not null,
  moneybird_factuur_id text,
  betaald_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.arnobot_klanttype_correcties
  add column if not exists plan text not null,
  add column if not exists cyclus text not null,
  add column if not exists nieuw_bedrag_cent integer not null,
  add column if not exists nieuw_btw_cent integer not null,
  add column if not exists omzetting_gestart_at timestamptz,
  add column if not exists nieuw_mollie_subscription_id text,
  add column if not exists afgehandeld_at timestamptz,
  add column if not exists handwerk_reden text,
  add column if not exists gecrediteerde_betaling_id uuid,
  add column if not exists gefactureerd_at timestamptz;

-- Slot zodat een abonnement nooit door twee aanroepen tegelijk wordt omgezet.
alter table public.arnobot_subscriptions
  add column if not exists klanttype_bezig_tot timestamptz;

create index if not exists arnobot_klanttype_correcties_user_idx on public.arnobot_klanttype_correcties (user_id);

alter table public.arnobot_klanttype_correcties enable row level security;

-- Controle (een resultaat, want de SQL Editor toont alleen het laatste): kolommen moet 11 zijn en rowsecurity true.
select
  (select count(*) from information_schema.columns
     where table_schema = 'public' and (
       (table_name = 'arnobot_klanttype_correcties' and column_name in ('plan', 'cyclus', 'nieuw_bedrag_cent', 'nieuw_btw_cent',
         'omzetting_gestart_at', 'nieuw_mollie_subscription_id', 'afgehandeld_at', 'handwerk_reden', 'gecrediteerde_betaling_id', 'gefactureerd_at'))
       or (table_name = 'arnobot_subscriptions' and column_name = 'klanttype_bezig_tot'))) as kolommen,
  (select rowsecurity from pg_tables where schemaname = 'public' and tablename = 'arnobot_klanttype_correcties') as rowsecurity;
