-- Tokenverbruik per chatbeurt (lib/chatVerbruik.ts). Uitvoeren in de Supabase SQL-editor, VÓÓR de deploy van de commit die ernaar schrijft
-- (zonder de kolom valt de chatroute terug op loggen zonder verbruik, dus er gaat geen gespreksregel verloren, maar er wordt dan niets gemeten).
--
-- Inhoud per rij: {"invoer":..,"cache_schrijven":..,"cache_lezen":..,"uitvoer":..,"aanroepen":..,"bijlagen":..}, alleen aantallen.

alter table public.arnobot_rds_logs add column if not exists verbruik jsonb;

-- Controle na het uitvoeren (moet één rij met data_type jsonb geven):
-- select column_name, data_type from information_schema.columns where table_name = 'arnobot_rds_logs' and column_name = 'verbruik';

-- Meting na een paar dagen: aandeel van de invoer dat uit de cache komt, en gemiddeld verbruik per beurt, met en zonder bijlage.
-- select (verbruik->>'bijlagen')::int > 0 as met_bijlage,
--        count(*) as beurten,
--        round(avg((verbruik->>'invoer')::numeric)) as gem_invoer,
--        round(avg((verbruik->>'cache_schrijven')::numeric)) as gem_cache_schrijven,
--        round(avg((verbruik->>'cache_lezen')::numeric)) as gem_cache_lezen,
--        round(avg((verbruik->>'uitvoer')::numeric)) as gem_uitvoer,
--        round(avg((verbruik->>'aanroepen')::numeric), 2) as gem_aanroepen
-- from public.arnobot_rds_logs
-- where verbruik is not null and created_at > now() - interval '7 days'
-- group by 1;
