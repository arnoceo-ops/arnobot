-- Documenten opruimen (2026-11-18), stap 3 van docs/DOCUMENTEN_PLAN.md. Voert uit na docs/sql/2026-11-18-documenten.sql.
--
-- Een tijdelijk document wordt 48 uur na het laatste bericht opgeruimd (cron /api/cron/documenten-opruimen). Het
-- bestand en alle inhoud (tekst, samenvatting) verdwijnen, maar de rij blijft 30 dagen staan met alleen de naam en
-- het moment van verwijderen (verwijderd_op). Zo kan ArnoBot in een gesprek dat later wordt hervat melden dat
-- "dit document is verlopen", in plaats van niets te weten en te gokken. Na 30 dagen gaat ook die rij weg.
--
-- 1. Nieuwe kolom verwijderd_op.
-- 2. De inhoudscontrole laat nu ook een rij toe zonder pad en zonder tekst, mits verwijderd_op gevuld is.
--
-- VOOR de code die erop leest en schrijft live gaat uitvoeren: de chatroute selecteert verwijderd_op, dus zonder
-- deze wijziging kan een gebruiker met de documentenfunctie zijn documenten niet laden. Veilig om opnieuw uit te voeren.
--
-- UITVOEREN in de Supabase SQL-editor:

alter table public.arnobot_documenten add column if not exists verwijderd_op timestamptz;

alter table public.arnobot_documenten drop constraint if exists arnobot_documenten_inhoud_check;
alter table public.arnobot_documenten add constraint arnobot_documenten_inhoud_check
  check (storage_path is not null or tekst_cache is not null or verwijderd_op is not null);

create index if not exists arnobot_documenten_verwijderd_idx
  on public.arnobot_documenten (verwijderd_op) where verwijderd_op is not null;

-- Controle: moet één rij tonen (verwijderd_op, timestamp with time zone)
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'arnobot_documenten' and column_name = 'verwijderd_op';
