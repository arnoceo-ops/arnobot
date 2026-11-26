-- Referralautomatisering, herstel ronde 1 (docs/REFERRAL_CONTROLE_2026-11-26.md). Uitvoeren in de Supabase SQL Editor.
-- Alleen een nieuwe kolom: geen bestaande gegevens worden gewijzigd. Veilig om nog een keer te draaien.
-- Een blokkade die je zelf met BLOKKEER zet, wordt daarna niet meer door een betaling opgeheven.

alter table public.arnobot_teams
  add column if not exists geblokkeerd_handmatig boolean not null default false;

-- Controle: dit moet 1 rij teruggeven.
select column_name from information_schema.columns
  where table_schema = 'public' and table_name = 'arnobot_teams' and column_name = 'geblokkeerd_handmatig';
