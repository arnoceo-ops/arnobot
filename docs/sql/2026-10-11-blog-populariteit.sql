-- Populariteit per blog voor de statistieken (tab BLOG in /bot/admin/stats): per gepubliceerd blog
-- hoe vaak het is geopend en hoe vaak er op "Start gratis" is geklikt, over een periode en in totaal.
-- Eén aanroep telt alle blogs in de database (groeperen), i.p.v. per blog apart tellen.
-- Uitvoeren in Supabase (SQL Editor). Veilig om opnieuw te draaien (create or replace, IF NOT EXISTS).

-- Snelle prefix-zoekopdracht op pad (like '/blog/%') voor de tellers.
create index if not exists arnobot_pageviews_path_idx on arnobot_pageviews (path text_pattern_ops);
create index if not exists arnobot_cta_clicks_path_idx on arnobot_cta_clicks (path text_pattern_ops);

create or replace function arnobot_blog_post_stats(p_since timestamptz)
returns table (
  post_id uuid,
  slug text,
  title text,
  published_at timestamptz,
  opens_period bigint,
  opens_total bigint,
  cta_period bigint,
  cta_total bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with v as (
    select regexp_replace(pv.path, '/+$', '') as pad,
           count(*) filter (where pv.created_at >= p_since) as per,
           count(*) as tot
    from arnobot_pageviews pv
    where pv.path like '/blog/%' and pv.path not like '/blog/tag/%'
    group by 1
  ),
  c as (
    select regexp_replace(cc.path, '/+$', '') as pad,
           count(*) filter (where cc.created_at >= p_since) as per,
           count(*) as tot
    from arnobot_cta_clicks cc
    where cc.path like '/blog/%' and cc.path not like '/blog/tag/%'
    group by 1
  )
  select p.id, p.slug, p.title, p.published_at,
         coalesce(v.per, 0), coalesce(v.tot, 0),
         coalesce(c.per, 0), coalesce(c.tot, 0)
  from arnobot_blog_posts p
  left join v on v.pad = '/blog/' || p.slug
  left join c on c.pad = '/blog/' || p.slug
  where p.status = 'published'
  order by coalesce(v.per, 0) desc, coalesce(v.tot, 0) desc, p.published_at desc;
$$;

-- Alleen de service-role-key van de app mag dit aanroepen, niet anon of ingelogde gebruikers.
revoke all on function arnobot_blog_post_stats(timestamptz) from public, anon, authenticated;
grant execute on function arnobot_blog_post_stats(timestamptz) to service_role;
