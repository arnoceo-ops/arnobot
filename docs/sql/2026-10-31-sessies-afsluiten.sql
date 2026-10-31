-- Sessie-sluiter (cron /api/cron/sessies-afsluiten, 2026-10-31).
--
-- Vindt gesprekken die minstens stil_uur uur stil liggen, waarvan het laatste bericht niet
-- ouder is dan venster_uur uur, en die geen samenvatting hebben of een samenvatting die achterloopt
-- op het aantal vragen (message_count < aantal logrijen). Verwijderde sessies (deleted_at) worden
-- nooit meegenomen. Zo hoeft de cron niet de hele logtabel te lezen: de selectie gebeurt in de
-- database, op schaal.
--
-- Draai dit in de Supabase SQL-editor. Geen nieuwe tabel, dus geen RLS-/grantregels voor een tabel,
-- wel een execute-grant op de functie voor service_role (de app gebruikt uitsluitend de service-role-key).

create index if not exists arnobot_rds_logs_created_at_idx on arnobot_rds_logs (created_at);

create or replace function public.sessies_zonder_actuele_synthese(
  stil_uur integer,
  venster_uur integer,
  max_aantal integer
)
returns table (session_id text, user_id text, vragen bigint, laatste timestamptz)
language sql
stable
set search_path = public
as $$
  with kandidaten as (
    select l.session_id::text as sid
    from arnobot_rds_logs l
    where l.created_at > now() - make_interval(hours => venster_uur)
      and l.session_id is not null
      and l.user_id is not null
    group by l.session_id
    having max(l.created_at) < now() - make_interval(hours => stil_uur)
  )
  select
    l.session_id::text,
    l.user_id::text,
    count(*)::bigint as vragen,
    max(l.created_at) as laatste
  from arnobot_rds_logs l
  join kandidaten k on k.sid = l.session_id::text
  left join arnobot_blog_sessions b on b.session_id::text = l.session_id::text
  where l.user_id is not null
  group by l.session_id, l.user_id, b.session_id, b.message_count, b.deleted_at
  having b.session_id is null
      or (b.deleted_at is null and coalesce(b.message_count, 0) < count(*))
  order by max(l.created_at) asc
  limit max_aantal;
$$;

revoke all on function public.sessies_zonder_actuele_synthese(integer, integer, integer) from public;
grant execute on function public.sessies_zonder_actuele_synthese(integer, integer, integer) to service_role;
