-- Geheugenlabels per sessie (2026-10-31).
--
-- Twee nieuwe kolommen op de bestaande tabel arnobot_blog_sessions (geen nieuwe tabel, dus geen
-- RLS- of grantregels nodig):
--   onderwerp       korte, neutrale titel van waar het gesprek over ging (zonder uitkomst of status)
--   feiten_blijvend de feiten die alleen over de gebruiker zelf of zijn eigen bedrijf gaan en jaren
--                   geldig blijven (functie, werkgever, eigen product, markt, werkwijze). Leeg betekent
--                   dat er geen blijvende feiten waren, of dat het gesprek nog niet is gelabeld.
--
-- Gebruik: herinneringen ouder dan 6 weken komen in de chat alleen nog als onderwerp en blijvende
-- feiten in de prompt, niet meer als situatiefeiten (stand van een deal, traject, klant). Zo kan
-- ArnoBot er een vraag over stellen maar er geen bewering over doen.
--
-- Draai dit in de Supabase SQL-editor VOORDAT de bijbehorende code wordt gepusht: de session-end
-- route schrijft deze kolommen en faalt zonder.

alter table public.arnobot_blog_sessions
  add column if not exists onderwerp text,
  add column if not exists feiten_blijvend text;
