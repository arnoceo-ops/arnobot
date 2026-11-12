-- Overstappen (maand naar jaar, Basic naar Pro, Pro naar Basic, opzegging intrekken):
-- kolommen voor een GEPLANDE wijziging op arnobot_subscriptions. Zie docs/OVERSTAP_PLAN.md.
-- Uitvoeren in Supabase (SQL Editor). Veilig om opnieuw te draaien (IF NOT EXISTS).
--
-- Alleen toevoegingen: nullable kolommen zonder standaardwaarde. Bestaande rijen en bestaand
-- gedrag veranderen niet; niets in de app leest deze kolommen tot de overstap-code er is.
-- RLS blijft zoals het was (aan, zonder policies, alleen de service-role-key van de app).
--
-- De rij-kolommen cyclus, plan, bedrag_cent en btw_cent blijven de HUIDIGE waarden. Pas als de
-- eerste betaling van het geplande abonnement binnenkomt, worden ze vervangen door de
-- gepland_*-waarden (anders telt een late oude betaling de verkeerde periode bij).

alter table arnobot_subscriptions
  add column if not exists gepland_plan text
    check (gepland_plan in ('basis', 'premium')),
  add column if not exists gepland_cyclus text
    check (gepland_cyclus in ('maandelijks', 'jaarlijks')),
  add column if not exists gepland_bedrag_cent integer
    check (gepland_bedrag_cent > 0),
  add column if not exists gepland_btw_cent integer
    check (gepland_btw_cent >= 0),
  -- Het nieuwe Mollie-abonnement dat na de overstap gaat incasseren.
  add column if not exists gepland_mollie_subscription_id text,
  -- Eigen guardkolom: het geplande abonnement moet los van het huidige te stoppen zijn.
  add column if not exists gepland_mollie_sub_geannuleerd_at timestamptz,
  -- Wanneer de wijziging ingaat (startdatum van het geplande Mollie-abonnement).
  add column if not exists gepland_ingangs_at timestamptz,
  -- Moment van de claim (voorkomt dubbele overstappen; leeg = geen wijziging gepland).
  add column if not exists gepland_at timestamptz;

-- Controle na afloop (moet 8 rijen geven, en alle bestaande rijen moeten overal null hebben):
--   select column_name from information_schema.columns
--   where table_name = 'arnobot_subscriptions' and column_name like 'gepland_%' order by 1;
--   select count(*) from arnobot_subscriptions where gepland_at is not null;  -- verwacht 0
--
-- Terugdraaien (alleen als er nog niets is gebouwd dat de kolommen gebruikt):
--   alter table arnobot_subscriptions
--     drop column if exists gepland_plan, drop column if exists gepland_cyclus,
--     drop column if exists gepland_bedrag_cent, drop column if exists gepland_btw_cent,
--     drop column if exists gepland_mollie_subscription_id,
--     drop column if exists gepland_mollie_sub_geannuleerd_at,
--     drop column if exists gepland_ingangs_at, drop column if exists gepland_at;
