-- UITGEVOERD 2026-10-24. De analyse-aanvulling ("Mist er iets?") is op 2026-10-24 uit de app gehaald. De code leest en
-- schrijft deze kolommen niet meer. Dit verwijdert ze ook uit de database.
alter table arnobot_analyses
  drop column if exists aanvulling_context,
  drop column if exists aanvulling_tekst,
  drop column if exists aanvulling_at;
