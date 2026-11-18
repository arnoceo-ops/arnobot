-- Uploads tot 20 MB (2026-11-18), docs/DOCUMENTEN_PLAN.md.
--
-- De bucket arnobot-documenten stond op 10 MB per bestand (docs/sql/2026-11-18-documenten.sql). PDF, Word en tekst mogen nu tot 20 MB;
-- een afbeelding blijft in de app op 10 MB, want Anthropic accepteert geen grotere afbeeldingen. De app dwingt de grens per type zelf af,
-- de bucket vormt de bovengrens.
--
-- UITVOEREN in de Supabase SQL-editor, VOOR de deploy van de aanpassing in de app (anders wijst de opslag een bestand tussen 10 en 20 MB af
-- terwijl de app het toestaat). Veilig om opnieuw uit te voeren.

update storage.buckets
set file_size_limit = 20971520
where id = 'arnobot-documenten';

-- Controle: moet één rij tonen met public = false en file_size_limit = 20971520
select id, public, file_size_limit
from storage.buckets
where id = 'arnobot-documenten';
