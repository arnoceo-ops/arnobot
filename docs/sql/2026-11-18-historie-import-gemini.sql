-- Het meenemen van historie uit een andere AI (2026-11-18): Gemini als eigen bron, naast chatgpt, claude en anders.
--
-- Alleen nodig als docs/sql/2026-11-18-historie-import.sql al is uitgevoerd met de oude controle (zonder gemini). Zonder dit mislukt het opslaan
-- van een profiel uit Gemini. Veilig om opnieuw uit te voeren; bestaande rijen blijven staan.
--
-- UITVOEREN in de Supabase SQL-editor:

alter table public.arnobot_import_profielen drop constraint if exists arnobot_import_profielen_bron_check;
alter table public.arnobot_import_profielen add constraint arnobot_import_profielen_bron_check
  check (bron in ('chatgpt', 'claude', 'gemini', 'anders'));

-- Controle: moet de controle met vier bronnen tonen
select conname, pg_get_constraintdef(oid) as regel
from pg_constraint
where conrelid = 'public.arnobot_import_profielen'::regclass and contype = 'c';
