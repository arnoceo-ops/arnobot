-- Openen en doorklikken van blogmails per bezorging (en dus per abonnee), gevuld door de
-- Resend-webhook (/api/webhooks/resend, events email.opened en email.clicked).
-- Uitvoeren in Supabase (SQL Editor). Veilig om opnieuw te draaien (IF NOT EXISTS).
-- Tot de tracking in Resend aanstaat en de webhook de events krijgt, blijven deze kolommen leeg.

alter table arnobot_blog_deliveries
  add column if not exists opened_count int not null default 0,
  add column if not exists first_opened_at timestamptz,
  add column if not exists last_opened_at timestamptz,
  add column if not exists clicked_count int not null default 0,
  add column if not exists first_clicked_at timestamptz,
  add column if not exists last_clicked_at timestamptz,
  add column if not exists last_clicked_link text;

-- De webhook zoekt een bezorging op via het Resend-id van de mail.
create index if not exists arnobot_blog_deliveries_resend_idx
  on arnobot_blog_deliveries (resend_id);

-- Voor de lijst "wie doet wat" in de admin: recente activiteit snel vinden.
create index if not exists arnobot_blog_deliveries_activity_idx
  on arnobot_blog_deliveries (last_clicked_at desc)
  where clicked_count > 0;
