-- Databasegrootte voor cron/capaciteitswacht. Alleen service_role mag hem aanroepen.
create or replace function public.arnobot_db_grootte()
returns bigint
language sql
security definer
set search_path = public
as $$
  select pg_database_size(current_database());
$$;

revoke all on function public.arnobot_db_grootte() from public, anon, authenticated;
grant execute on function public.arnobot_db_grootte() to service_role;
