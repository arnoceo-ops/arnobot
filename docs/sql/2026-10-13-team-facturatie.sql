-- Team-betaalprotocol (fase 2b, zie docs/MOLLIE_PLAN.md): automatische Moneybird-factuur
-- + Mollie-betaallink per Team-cyclus. Uitvoeren in Supabase (SQL Editor). Veilig om
-- opnieuw te draaien (IF NOT EXISTS). Bestaande teams (incl. Team Hippios) krijgen de
-- nieuwe kolommen leeg; de cron slaat een team over zolang volgende_factuurdatum leeg is,
-- dus niemand wordt per ongeluk meegenomen in de automatische facturatie.

-- mollie_customer_id staat bewust niet op dit team: de facturatie hergebruikt de bestaande
-- arnobot_billing_customers-tabel, keyed op de command_manager's user_id (manager_id hieronder),
-- zelfde Moneybird/Mollie-klantmachinerie als bij solo-abonnementen.
alter table arnobot_teams
  add column if not exists min_seats integer,
  add column if not exists cyclus text check (cyclus in ('maandelijks', 'jaarlijks')),
  add column if not exists volgende_factuurdatum date,
  add column if not exists geblokkeerd_at timestamptz;

create table if not exists arnobot_team_facturen (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references arnobot_teams (id),
  periode_start date not null,
  periode_einde date not null,
  cyclus text not null check (cyclus in ('maandelijks', 'jaarlijks')),
  soort text not null default 'regulier' check (soort in ('regulier', 'tussentijds')),
  seats_aantal integer not null check (seats_aantal > 0),
  bedrag_cent integer not null check (bedrag_cent > 0),
  btw_cent integer not null check (btw_cent >= 0),
  mollie_payment_link_id text,
  mollie_payment_link_url text,
  status text not null default 'open'
    check (status in ('open', 'paid', 'overdue', 'expired', 'refunded')),
  moneybird_factuur_id text,
  betaald_at timestamptz,
  herinnering_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists arnobot_team_facturen_team_idx on arnobot_team_facturen (team_id);
create index if not exists arnobot_team_facturen_status_idx on arnobot_team_facturen (status);

alter table arnobot_team_facturen enable row level security;
