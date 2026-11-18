-- Documenten kiezen uit Docs (2026-11-18), stap 4 van docs/DOCUMENTEN_PLAN.md. Voert uit na
-- docs/sql/2026-11-18-documenten.sql en docs/sql/2026-11-18-documenten-opruiming.sql.
--
-- Een document hoort bij het gesprek waarin het is toegevoegd (arnobot_documenten.session_id). Kiest een gebruiker een
-- bewaard document uit Docs in een ander gesprek (of start hij een gesprek via BESPREEK), dan wordt dat document
-- aan dat gesprek gekoppeld: één rij hier. De server laadt per beurt de documenten van het gesprek zelf plus de
-- gekoppelde documenten. Verwijdert de gebruiker het document, dan verdwijnen de koppelingen vanzelf (on delete cascade).
--
-- Bevat geen gebruikersinhoud: alleen ID's en een tijdstip.
-- VOOR de code die erop leest live gaat uitvoeren: de chatroute vraagt deze tabel bij elke beurt op voor wie de
-- documentenfunctie heeft. Veilig om opnieuw uit te voeren.
--
-- UITVOEREN in de Supabase SQL-editor:

create table if not exists public.arnobot_document_koppelingen (
  document_id uuid not null references public.arnobot_documenten(id) on delete cascade,
  user_id text not null,
  session_id text not null,
  created_at timestamptz not null default now(),
  primary key (document_id, session_id)
);

create index if not exists arnobot_document_koppelingen_sessie_idx
  on public.arnobot_document_koppelingen (user_id, session_id);

-- RLS aan zonder policies, zoals alle andere tabellen (de app gebruikt alleen de service-role-key).
alter table public.arnobot_document_koppelingen enable row level security;

-- Controle: moet één rij tonen met rowsecurity = true
select tablename, rowsecurity
from pg_tables
where schemaname = 'public' and tablename = 'arnobot_document_koppelingen';
