-- Referralautomatisering, herstel H3 (docs/REFERRAL_CONTROLE_2026-11-26.md). Uitvoeren in de Supabase SQL Editor.
-- Alleen een nieuwe kolom: geen bestaande gegevens worden gewijzigd. Veilig om nog een keer te draaien.
-- Een teamfactuur krijgt pas een herinnering of blokkade als hier staat dat de klant hem heeft gekregen.
-- Tot dit script is uitgevoerd volgen er geen herinneringen en geen blokkades wegens niet betalen.

alter table public.arnobot_team_facturen
  add column if not exists bezorgd_at timestamptz;

-- Controle 1: dit moet 1 rij teruggeven.
select column_name from information_schema.columns
  where table_schema = 'public' and table_name = 'arnobot_team_facturen' and column_name = 'bezorgd_at';

-- Controle 2: openstaande facturen van voor dit script. Verwacht: geen rijen (er stond op 26-11 niets open).
-- Staat er toch een factuur die de klant wel heeft, meld die dan.
select id, team_id, created_at from public.arnobot_team_facturen where status = 'open' and bezorgd_at is null;
