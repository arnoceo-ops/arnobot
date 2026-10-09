-- Mollie-integratie: tabellen voor klanten, abonnementen en betalingen.
-- Uitvoeren in Supabase (SQL Editor). Veilig om opnieuw te draaien (IF NOT EXISTS).
-- RLS staat aan zonder policies: alleen de service-role-key van de app heeft toegang,
-- net als bij de rest van de tabellen.

create table if not exists arnobot_billing_customers (
  user_id text primary key,
  mollie_customer_id text not null unique,
  klant_type text not null check (klant_type in ('particulier', 'zakelijk')),
  bedrijfsnaam text,
  kvk_nummer text,
  btw_nummer text,
  btw_gevalideerd boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists arnobot_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  plan text not null check (plan in ('basis', 'premium')),
  cyclus text not null check (cyclus in ('maandelijks', 'jaarlijks')),
  klant_type text not null check (klant_type in ('particulier', 'zakelijk')),
  status text not null default 'pending'
    check (status in ('pending', 'active', 'cancelled', 'ended', 'refunded', 'abandoned')),
  bedrag_cent integer not null check (bedrag_cent > 0),
  btw_cent integer not null check (btw_cent >= 0),
  mollie_customer_id text not null,
  mollie_subscription_id text,
  mollie_sub_geannuleerd_at timestamptz,
  periode_start timestamptz,
  periode_einde timestamptz,
  contract_einde timestamptz,
  opzegging_aangevraagd_at timestamptz,
  opzegging_ingaat_at timestamptz,
  herinnering_30_at timestamptz,
  herinnering_7_at timestamptz,
  einde_mail_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists arnobot_subscriptions_user_idx on arnobot_subscriptions (user_id);
create index if not exists arnobot_subscriptions_status_idx on arnobot_subscriptions (status);

create table if not exists arnobot_payments (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  subscription_id uuid references arnobot_subscriptions (id),
  mollie_payment_id text not null unique,
  soort text not null check (soort in ('eerste', 'herhaling', 'verlenging')),
  status text not null default 'open',
  bedrag_cent integer not null,
  btw_cent integer not null default 0,
  terugbetaald_cent integer not null default 0,
  teruggeboekt_cent integer not null default 0,
  betaald_at timestamptz,
  verwerkt_at timestamptz,
  terugbetaling_verwerkt_at timestamptz,
  moneybird_factuur_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists arnobot_payments_user_idx on arnobot_payments (user_id);
create index if not exists arnobot_payments_subscription_idx on arnobot_payments (subscription_id);

alter table arnobot_billing_customers enable row level security;
alter table arnobot_subscriptions enable row level security;
alter table arnobot_payments enable row level security;
