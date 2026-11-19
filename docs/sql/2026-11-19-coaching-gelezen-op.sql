-- Leesmoment voor coaching en SPE-analyse, voor de NIEUW-kaart op /bot ("Je nieuwe analyse staat
-- klaar"). Een document is ongelezen als gelezen_op leeg is of ouder dan updated_at. De
-- coachingpagina zet gelezen_op zodra het advies zichtbaar is en er niet meer gegenereerd wordt.
-- Uitvoeren in het Supabase-dashboard, SQL Editor. Veilig om twee keer te draaien.

alter table arnobot_coaching add column if not exists gelezen_op timestamptz;
alter table arnobot_salesbaas_coaching add column if not exists gelezen_op timestamptz;

-- Bestaande documenten gelden als gelezen, anders krijgt iedereen met een oud advies bij de
-- volgende login ten onrechte een NIEUW-kaart.
update arnobot_coaching set gelezen_op = updated_at where gelezen_op is null;
update arnobot_salesbaas_coaching set gelezen_op = updated_at where gelezen_op is null;

-- Controle: beide tellingen horen 0 te zijn.
select
  (select count(*) from arnobot_coaching where gelezen_op is null) as coaching_zonder_leesmoment,
  (select count(*) from arnobot_salesbaas_coaching where gelezen_op is null) as spe_zonder_leesmoment;

-- Voor de test na het bouwen (zet jouw SPE-analyse terug naar ongelezen, dan verschijnt de kaart
-- bij de volgende login op /bot):
-- update arnobot_salesbaas_coaching set gelezen_op = null where user_id = 'user_3HFvMfJ8ztQxatkJg3SWdSJPz4D';
