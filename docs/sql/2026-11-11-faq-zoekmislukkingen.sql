-- FAQ-zoekveld (2026-11-11): zoektermen die op /bot/qa geen enkel antwoord opleverden.
-- Doel: zien welke antwoorden in de FAQ ontbreken. Bewust zonder user_id of enige andere
-- herleidbare kolom: alleen de (genormaliseerde) zoekterm en het tijdstip.
-- De dagelijkse cron /api/cron/productvragen meldt de termen van de afgelopen 24 uur via Telegram
-- en ruimt rijen ouder dan 30 dagen op.
--
-- UITVOEREN in de Supabase SQL-editor:
create table if not exists public.faq_zoekmislukkingen (
  id uuid primary key default gen_random_uuid(),
  term text not null,
  created_at timestamptz not null default now()
);

create index if not exists faq_zoekmislukkingen_created_at_idx
  on public.faq_zoekmislukkingen (created_at);

-- RLS aan zonder policies, zoals alle andere tabellen (de app gebruikt alleen de service-role-key).
alter table public.faq_zoekmislukkingen enable row level security;
