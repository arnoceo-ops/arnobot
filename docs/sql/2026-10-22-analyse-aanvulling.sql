-- Aanvulling op een analyse: wat de gebruiker zelf vertelt over wat er buiten ArnoBot is gedaan,
-- en de bijgewerkte analysetekst die daaruit volgt. Privé: niet meegenomen bij DEEL MET MANAGER.
-- Bestaande tabel, dus RLS en grants blijven zoals ze zijn. Veilig om opnieuw te draaien.
-- Tot dit is uitgevoerd werkt de rest van de analyse gewoon door, alleen zonder aanvulling.

alter table public.arnobot_analyses
  add column if not exists aanvulling_context text,
  add column if not exists aanvulling_tekst text,
  add column if not exists aanvulling_at timestamptz;
