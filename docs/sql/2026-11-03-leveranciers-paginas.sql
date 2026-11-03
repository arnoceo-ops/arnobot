-- Leveranciersbewaking (2026-11-03): cron/leveranciers-wijzigingen bewaart per pagina (DPA of
-- deprecations van een leverancier) de laatst geziene tekst en meldt via Telegram wat er veranderd is.
-- Aanvulling op VisualPing (gratis tier: 5 pagina's, die 5 DPA's blijven daar staan).
--
-- UITVOEREN in de Supabase SQL-editor:
create table if not exists public.arnobot_leveranciers_paginas (
  url text primary key,
  label text not null,
  categorie text not null,
  tekst text,
  hash text,
  laatst_gecontroleerd timestamptz,
  laatst_gewijzigd timestamptz,
  fouten_op_rij integer not null default 0,
  fout_gemeld boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.arnobot_leveranciers_paginas enable row level security;
grant select, insert, update, delete on public.arnobot_leveranciers_paginas to service_role;
