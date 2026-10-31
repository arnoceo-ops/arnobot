-- Mailpatroon per sessie (2026-10-31).
--
-- Eén nieuwe kolom op de bestaande tabel arnobot_blog_sessions (geen nieuwe tabel, dus geen
-- RLS- of grantregels nodig):
--   mail_verzoek  true als het gesprek vooral ging om ArnoBot een mail of bericht aan een klant of
--                 prospect te laten schrijven. null = nog niet bepaald, false = niet het geval.
--
-- Gebruik: vanaf 3 gesprekken met een mailverzoek zegt ArnoBot in het gesprek zelf dat de gebruiker
-- hem vooral als tekstschrijver gebruikt, vanaf 5 nemen de patroonanalyse en de coaching het mee
-- (lib/mailPatroon.ts).
--
-- Draai dit in de Supabase SQL-editor VOORDAT de bijbehorende code wordt gepusht: de chatroute en
-- de analyse- en coachingroutes lezen deze kolom en falen zonder.

alter table public.arnobot_blog_sessions
  add column if not exists mail_verzoek boolean;
