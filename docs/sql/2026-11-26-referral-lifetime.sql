-- Referralautomatisering, ronde 2 (docs/REFERRAL_AUTOMATISERING.md). Uitvoeren in de Supabase SQL Editor.
-- Alleen een toevoeging: geen bestaande gegevens worden gewijzigd of verwijderd. Veilig om nog een keer te draaien.
-- De code werkt ook zolang dit niet is uitgevoerd: dan is niemand Lifetime-houder.

-- Besluit Arno 26-11-2026: bij een Lifetime-houder zonder betaald abonnement vervalt het referraltegoed niet.
-- Leeg: geen Lifetime. Zet met de hand de datum waarop iemand Lifetime kreeg, bijvoorbeeld:
--   update public.approved_users set lifetime_sinds = now() where user_id = '...';
-- Dit regelt alleen het tegoed, niet de toegang tot ArnoBot.
alter table public.approved_users
  add column if not exists lifetime_sinds timestamptz;

-- Controle: dit moet 1 rij teruggeven.
select column_name, data_type from information_schema.columns
  where table_schema = 'public' and table_name = 'approved_users' and column_name = 'lifetime_sinds';
