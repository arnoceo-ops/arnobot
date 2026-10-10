-- Optionele voornaam van blogabonnees, voor de aanhef "Hey, {voornaam}." in de blogmails.
-- Uitvoeren in Supabase (SQL Editor). Veilig om opnieuw te draaien (IF NOT EXISTS).
-- Tot dit is uitgevoerd werkt de blog gewoon door, alleen zonder voornaam.

alter table arnobot_blog_subscribers
  add column if not exists voornaam text;
