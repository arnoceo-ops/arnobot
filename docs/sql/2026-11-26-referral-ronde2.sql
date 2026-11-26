-- Referralautomatisering, ronde 2 (docs/REFERRAL_AUTOMATISERING.md). Uitvoeren in de Supabase SQL Editor.
-- Drie nieuwe kolommen op approved_users. De twee updates vullen alleen die nieuwe, lege kolommen; bestaande gegevens
-- worden niet gewijzigd of verwijderd. Veilig om nog een keer te draaien.
-- De code werkt ook zolang dit niet is uitgevoerd, maar bewaart de eerste proef en het teamlidmaatschap dan niet.

alter table public.approved_users
  -- Besluit Arno 26-11-2026: bij een Lifetime-houder vervalt het referraltegoed niet. Leeg: geen Lifetime. Met de hand
  -- zetten: update public.approved_users set lifetime_sinds = now() where user_id = '...';
  -- Dit regelt alleen het tegoed, niet de toegang tot ArnoBot.
  add column if not exists lifetime_sinds timestamptz,
  -- Start van de eerste echte proef (na de intake). trial_start wordt bij een herstart en bij gratis toegang gewist.
  add column if not exists eerste_proef_start timestamptz,
  -- Ooit gewoon teamlid geweest: de rij in arnobot_team_members verdwijnt bij het verwijderen uit een team.
  add column if not exists ooit_teamlid_at timestamptz;

-- Wie nooit herstart is: de huidige trial_start is de eerste. Alleen zodra de intake af is, want daarvoor verschuift
-- trial_start nog een keer.
update public.approved_users
  set eerste_proef_start = trial_start
  where eerste_proef_start is null and trial_reactivated_at is null and trial_start is not null and onboarding_done is true;

-- Wie nu gewoon teamlid is.
update public.approved_users u
  set ooit_teamlid_at = coalesce((select min(m.joined_at) from public.arnobot_team_members m where m.user_id = u.user_id and m.role = 'member'), now())
  where u.ooit_teamlid_at is null
    and exists (select 1 from public.arnobot_team_members m where m.user_id = u.user_id and m.role = 'member');

-- Controle: dit moet 3 rijen teruggeven.
select column_name, data_type from information_schema.columns
  where table_schema = 'public' and table_name = 'approved_users'
    and column_name in ('lifetime_sinds', 'eerste_proef_start', 'ooit_teamlid_at')
  order by column_name;
