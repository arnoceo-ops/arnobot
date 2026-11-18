-- Het meenemen van historie uit een andere AI (2026-11-18): een profiel per bron in plaats van één per gebruiker.
-- Besluit Arno: profielen vullen elkaar aan en vervangen elkaar niet (docs/HISTORIE_IMPORT_PLAN.md).
--
-- Alleen nodig als docs/sql/2026-11-18-historie-import.sql al is uitgevoerd met de oude sleutel (alleen user_id).
-- Veilig om opnieuw uit te voeren. Bestaande rijen blijven staan.
--
-- UITVOEREN in de Supabase SQL-editor:

alter table public.arnobot_import_profielen drop constraint if exists arnobot_import_profielen_pkey;
alter table public.arnobot_import_profielen add primary key (user_id, bron);

-- Controle: moet één rij tonen met een sleutel op user_id en bron
select a.attname as kolom
from pg_index i
join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any(i.indkey)
where i.indrelid = 'public.arnobot_import_profielen'::regclass and i.indisprimary
order by a.attnum;
