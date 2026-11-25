-- Referralautomatisering, stap 1 (docs/REFERRAL_AUTOMATISERING.md). Uitvoeren in de Supabase SQL Editor.
-- Alleen toevoegingen: geen bestaande gegevens worden gewijzigd of verwijderd. Veilig om nog een keer te draaien.
-- De code werkt ook zolang dit nog niet is uitgevoerd.

-- 1. Welk deel van een terugbetaling verrekend referraltegoed is. Dat deel beëindigt nooit een abonnement.
alter table public.arnobot_payments
  add column if not exists referral_refund_cent integer not null default 0;

alter table public.arnobot_payments drop constraint if exists arnobot_payments_referral_refund_check;
alter table public.arnobot_payments
  add constraint arnobot_payments_referral_refund_check
  check (referral_refund_cent >= 0 and referral_refund_cent <= bedrag_cent);

-- 2. Momentopname per betaling: welk abonnement en welke periode zij heeft betaald. Nodig om betaalde maanden te tellen.
alter table public.arnobot_payments
  add column if not exists plan text,
  add column if not exists cyclus text,
  add column if not exists klant_type text,
  add column if not exists periode_start timestamptz,
  add column if not exists periode_einde timestamptz;

-- 3. Eén referral per aangebrachte gebruiker (op 25-11 stond er één rij in de tabel).
create unique index if not exists arnobot_referrals_referred_uniek
  on public.arnobot_referrals (referred_user_id);

-- Controle: dit moet 6 kolommen en 1 index teruggeven.
select 'kolom' as soort, column_name as naam from information_schema.columns
  where table_schema = 'public' and table_name = 'arnobot_payments'
    and column_name in ('referral_refund_cent', 'plan', 'cyclus', 'klant_type', 'periode_start', 'periode_einde')
union all
select 'index', indexname from pg_indexes
  where schemaname = 'public' and indexname = 'arnobot_referrals_referred_uniek';
