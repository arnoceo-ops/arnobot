-- Upgrade van Basic naar Pro (docs/OVERSTAP_PLAN.md): de bijbetaling is een eigen betaalsoort.
-- Uitvoeren in Supabase (SQL Editor). Veilig om opnieuw te draaien.
--
-- arnobot_payments.soort heeft een CHECK-constraint met alleen 'eerste', 'herhaling' en 'verlenging'
-- (docs/sql/2026-10-10-mollie-billing.sql). Deze migratie vervangt hem door een verruimde versie met
-- 'upgrade'. Tot dit is uitgevoerd weigert de upgrade-route (die controleert het met een probe-rij die
-- meteen weer verwijderd wordt) en maakt hij dus geen betaling bij Mollie aan. Bestaande rijen blijven geldig.

do $$
declare
  c record;
begin
  -- De constraint-naam is niet vastgelegd (automatisch gegenereerd): zoek elke CHECK die op soort slaat.
  for c in
    select conname from pg_constraint
    where conrelid = 'arnobot_payments'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%soort%'
  loop
    execute format('alter table arnobot_payments drop constraint %I', c.conname);
  end loop;

  alter table arnobot_payments
    add constraint arnobot_payments_soort_check
    check (soort in ('eerste', 'herhaling', 'verlenging', 'upgrade'));
end $$;

-- Controle na afloop (moet precies 1 rij geven met 'upgrade' erin):
--   select conname, pg_get_constraintdef(oid) from pg_constraint
--   where conrelid = 'arnobot_payments'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%soort%';
--
-- Terugdraaien (alleen als er nog geen rij met soort 'upgrade' bestaat):
--   alter table arnobot_payments drop constraint arnobot_payments_soort_check;
--   alter table arnobot_payments add constraint arnobot_payments_soort_check
--     check (soort in ('eerste', 'herhaling', 'verlenging'));
