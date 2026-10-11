-- Verwijdert de ongebruikte kolom topics (abonneren is altijd op alle posts, zie docs/BLOG_PLAN.md).
alter table arnobot_blog_subscribers drop column if exists topics;
