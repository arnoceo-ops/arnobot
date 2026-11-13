-- Waarheidscontrole (steekproef voor Arno): bewaar per antwoord de volledige context die het model
-- kreeg (blogfragmenten, geheugen, profiel, bijlagetekst), zodat achteraf te zien is wat "uit de
-- bibliotheek" kwam en wat niet. Uitvoeren in de Supabase SQL-editor, VOOR de chat-route die erin
-- schrijft live gaat. Veilig om opnieuw uit te voeren.
alter table public.arnobot_rds_logs add column if not exists bron_context text;
