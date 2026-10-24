-- UITGEVOERD 2026-10-24. De factuurroute (doorgaan met een handmatige factuur, betaalwaarschuwing en blokkade) is op
-- 2026-10-24 uit de app gehaald. De code leest en schrijft deze kolommen niet meer.
alter table approved_users
  drop column if exists renewal_requested_at,
  drop column if exists renewal_warning_sent_at;
