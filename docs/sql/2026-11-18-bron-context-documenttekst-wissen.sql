-- bron_context: de tekst van geüploade bestanden eruit (2026-11-18), docs/DOCUMENTEN_PLAN.md, fase 1, voor livegang.
--
-- bron_context (arnobot_rds_logs) bewaart per antwoord de context die het model kreeg, voor de waarheidscontrole. Bij een
-- geüpload Word-, txt- of csv-bestand (en een audiotranscript) stond daar achter de marker "BIJLAGE:" de volledige tekst bij.
-- Dat hoort er niet in: bestanden worden voortaan als document van het gesprek bewaard, niet in de logtabel. Deze SQL haalt
-- de bijlagetekst uit bestaande rijen. Wat verder in de kolom staat (bibliotheekfragmenten, geheugen, profiel) blijft, en wordt
-- door de cron /api/cron/bron-context-opruimen na 30 dagen leeggemaakt.
--
-- UITVOEREN in de Supabase SQL-editor, ná de deploy van livegang. Veilig om opnieuw uit te voeren.

-- 1. Alles vanaf de bijlage-marker weg (de bijlage is altijd het laatste onderdeel).
update public.arnobot_rds_logs
set bron_context = split_part(bron_context, E'\n\n---\n\nBIJLAGE:\n', 1)
where bron_context like '%BIJLAGE:%';

-- 2. Rijen waar de bijlage het enige onderdeel was.
update public.arnobot_rds_logs
set bron_context = null
where bron_context like 'BIJLAGE:%';

-- Controle: moet 0 tonen
select count(*) as nog_met_bijlagetekst
from public.arnobot_rds_logs
where bron_context like '%BIJLAGE:%';
