-- Zelf-bediening: particulier -> zakelijk corrigeren met btw-factuur (app/bot/account/zakelijk-corrigeren).
-- Veilig om opnieuw te draaien (IF NOT EXISTS). RLS aan zonder policies, zelfde patroon als de rest.

create table if not exists arnobot_klanttype_correcties (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  subscription_id uuid not null references arnobot_subscriptions (id),
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

create index if not exists arnobot_klanttype_correcties_user_idx on arnobot_klanttype_correcties (user_id);

alter table arnobot_klanttype_correcties enable row level security;
