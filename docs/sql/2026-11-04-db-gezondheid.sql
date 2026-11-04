-- Databaseverbindingen voor cron/capaciteitswacht. Alleen service_role mag hem aanroepen.
-- Geeft het aantal verbindingen met deze database en het maximum van de server.
create or replace function public.arnobot_db_gezondheid()
returns json
language sql
security definer
set search_path = public
as $$
  select json_build_object(
    'verbindingen', (select count(*) from pg_stat_activity where datname = current_database()),
    'max_verbindingen', current_setting('max_connections')::int
  );
$$;

revoke all on function public.arnobot_db_gezondheid() from public, anon, authenticated;
grant execute on function public.arnobot_db_gezondheid() to service_role;
