-- Referralautomatisering, B3 (docs/REFERRAL_AUTOMATISERING.md). Uitvoeren in de Supabase SQL Editor.
-- Alleen toevoegingen: geen bestaande gegevens worden gewijzigd of verwijderd. Veilig om nog een keer te draaien.
-- Zolang dit niet is uitgevoerd blijft de gewone betaalverwerking van teamfacturen werken; alleen het vastleggen van
-- terugbetalingen en de admin-acties "betaald per bank" en "teruggedraaid" werken dan nog niet.

alter table public.arnobot_team_facturen
  add column if not exists paid_via text,
  add column if not exists mollie_payment_id text,
  add column if not exists terugbetaald_cent integer not null default 0,
  add column if not exists teruggeboekt_cent integer not null default 0,
  add column if not exists reversed_at timestamptz;

alter table public.arnobot_team_facturen drop constraint if exists arnobot_team_facturen_paid_via_check;
alter table public.arnobot_team_facturen
  add constraint arnobot_team_facturen_paid_via_check
  check (paid_via is null or paid_via in ('mollie', 'bank'));

-- Eén lopende reguliere factuur per team per periode. Mislukt deze regel, dan staan er al dubbele facturen:
-- niets verwijderen, maar de foutmelding aan Claude geven.
create unique index if not exists arnobot_team_facturen_periode_uniek
  on public.arnobot_team_facturen (team_id, periode_start)
  where soort = 'regulier' and status in ('open', 'paid', 'overdue');

-- Controle: dit moet 5 kolommen en 1 index teruggeven.
select 'kolom' as soort, column_name as naam from information_schema.columns
  where table_schema = 'public' and table_name = 'arnobot_team_facturen'
    and column_name in ('paid_via', 'mollie_payment_id', 'terugbetaald_cent', 'teruggeboekt_cent', 'reversed_at')
union all
select 'index', indexname from pg_indexes
  where schemaname = 'public' and indexname = 'arnobot_team_facturen_periode_uniek';
