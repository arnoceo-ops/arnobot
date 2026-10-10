-- Publieke blog op arno.bot/blog: posts, abonnees en bezorgwachtrij.
-- Uitvoeren in Supabase (SQL Editor). Veilig om opnieuw te draaien (IF NOT EXISTS).
-- RLS staat aan zonder policies: alleen de service-role-key van de app komt erbij,
-- net als bij de andere tabellen.

-- 1. Posts. Tags staan als array op de post (kleine letters, geen spaties, genormaliseerd
--    door de app). GIN-index voor het filteren op tag.
create table if not exists arnobot_blog_posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  summary text not null default '',
  body_md text not null default '',
  cover_image_url text,
  tags text[] not null default '{}',
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'published')),
  publish_at timestamptz,
  published_at timestamptz,
  notify_subscribers boolean not null default false,
  notified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists arnobot_blog_posts_status_published_idx
  on arnobot_blog_posts (status, published_at desc);
create index if not exists arnobot_blog_posts_tags_idx
  on arnobot_blog_posts using gin (tags);
create index if not exists arnobot_blog_posts_scheduled_idx
  on arnobot_blog_posts (publish_at) where status = 'scheduled';

alter table arnobot_blog_posts enable row level security;

-- 2. Abonnees. Double opt-in: pas status 'confirmed' ontvangt mail. topics leeg = alle posts.
--    Geen IP-opslag; de bevestigingsklik (confirmed_at) is het toestemmingsbewijs.
create table if not exists arnobot_blog_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'unsubscribed')),
  topics text[] not null default '{}',
  confirm_token text not null unique,
  unsubscribe_token text not null unique,
  created_at timestamptz not null default now(),
  confirm_sent_at timestamptz,
  confirmed_at timestamptz,
  unsubscribed_at timestamptz
);

create unique index if not exists arnobot_blog_subscribers_email_idx
  on arnobot_blog_subscribers (lower(email));
create index if not exists arnobot_blog_subscribers_status_idx
  on arnobot_blog_subscribers (status);

alter table arnobot_blog_subscribers enable row level security;

-- 3. Bezorgwachtrij: een rij per post per abonnee. De unieke combinatie maakt het versturen
--    idempotent (nooit dubbel mailen), en het dagbudget kan de wachtrij over dagen verdelen.
create table if not exists arnobot_blog_deliveries (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references arnobot_blog_posts (id) on delete cascade,
  subscriber_id uuid not null references arnobot_blog_subscribers (id) on delete cascade,
  status text not null default 'queued' check (status in ('queued', 'sent', 'failed')),
  attempts int not null default 0,
  resend_id text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (post_id, subscriber_id)
);

create index if not exists arnobot_blog_deliveries_queue_idx
  on arnobot_blog_deliveries (status, created_at);

alter table arnobot_blog_deliveries enable row level security;

-- 4. Publieke bucket voor afbeeldingen in posts. Lezen via de publieke URL, schrijven alleen
--    via de service-role-key (geen schrijf-policies).
insert into storage.buckets (id, name, public)
values ('blog-images', 'blog-images', true)
on conflict (id) do nothing;
