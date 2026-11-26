-- Referralautomatisering, fundament voor verrekenen (docs/REFERRAL_BOUWPLAN_R3.md, B0 en E stap 2).
-- Uitvoeren in de Supabase SQL Editor, het hele bestand in een keer.
--
-- Alleen toevoegingen: twee nieuwe tabellen, nieuwe kolommen en databasefuncties. Er wordt geen bestaande rij
-- gewijzigd of verwijderd. De enige vervanging is de controleregel op arnobot_referral_grootboek.soort, die ruimer
-- wordt. Veilig om nog een keer te draaien. Alles staat in een transactie: mislukt er iets, dan verandert er niets.
-- De code werkt ook zolang dit niet is uitgevoerd. Uitvoeren zet niets aan: geld verplaatsen vraagt daarnaast een
-- env-schakelaar die exact op 'true' staat (lib/billing/referralSchakelaars.ts).
--
-- Eerder nodig: 2026-11-25-referral-fundament.sql en 2026-11-25-referral-grootboek.sql.
--
-- De kolomtypes van arnobot_referrals staan niet in de repo. Daarom vergelijkt alles hieronder die kolommen als tekst.
-- De controlequery aan het eind laat zien welk type het werkelijk is.

begin;

do $$
begin
  if to_regclass('public.arnobot_referral_grootboek') is null then
    raise exception 'Voer eerst docs/sql/2026-11-25-referral-grootboek.sql uit';
  end if;
  if not exists (select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'arnobot_payments' and column_name = 'referral_refund_cent') then
    raise exception 'Voer eerst docs/sql/2026-11-25-referral-fundament.sql uit';
  end if;
  if to_regclass('public.arnobot_referrals') is null then
    raise exception 'De tabel arnobot_referrals ontbreekt';
  end if;
end $$;

-- ── Tabellen en kolommen ────────────────────────────────────────────────────────────────────────────────────────────

-- Elke keer dat er een voordeel of tegoed uitgekeerd moet worden is dat een rij (outbox).
create table if not exists public.arnobot_referral_acties (
  id uuid primary key default gen_random_uuid(),
  soort text not null check (soort in ('voordeel_jaar', 'voordeel_maand', 'voordeel_team',
    'tegoed_terugstorten', 'tegoed_overslaan', 'tegoed_teamkorting')),
  user_id text not null,                -- wie het voordeel of tegoed krijgt
  referral_id text,                     -- verplicht bij voordeel_*
  doel_soort text not null check (doel_soort in ('betaling', 'periode', 'teamfactuur')),
  doel_id text not null,
  bruto_cent integer not null check (bruto_cent >= 0),
  netto_cent integer not null check (netto_cent >= 0),
  -- vastgelopen: een mens moet kijken. gegevens->>'boeking_teruggezet' zegt of de reservering is teruggedraaid.
  status text not null default 'gereserveerd' check (status in
    ('gereserveerd', 'bezig', 'verzonden', 'bevestigd', 'vrijgegeven', 'ongedaan', 'vastgelopen')),
  bezig_tot timestamptz,
  pogingen integer not null default 0,
  fout text,
  mollie_refund_id text,
  gegevens jsonb not null default '{}'::jsonb,
  credit_status text not null default 'nvt' check (credit_status in ('nvt', 'nodig', 'bezig', 'klaar')),
  credit_id text,
  mail_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint arnobot_referral_acties_voordeel_referral check (soort not like 'voordeel%' or referral_id is not null)
);

-- Een voordeel per aangebrachte klant: jaarkorting, gratis maand en teammaand sluiten elkaar uit.
create unique index if not exists referral_een_voordeel on public.arnobot_referral_acties (referral_id)
  where soort like 'voordeel%' and status not in ('vrijgegeven', 'ongedaan');
create unique index if not exists referral_een_actie_per_doel on public.arnobot_referral_acties (soort, doel_id, user_id)
  where status not in ('vrijgegeven', 'ongedaan');
create index if not exists referral_acties_open_idx on public.arnobot_referral_acties (status)
  where status in ('gereserveerd', 'bezig', 'verzonden', 'vastgelopen');
create index if not exists referral_acties_doel_idx on public.arnobot_referral_acties (doel_id);
alter table public.arnobot_referral_acties enable row level security;

alter table public.arnobot_referral_grootboek
  add column if not exists bron_ids text[],     -- betaal- of factuurkenmerken onder de toekenning
  add column if not exists actie_id uuid,
  add column if not exists hoort_bij text,      -- referral_id van de aangesproken toekenning
  add column if not exists mail_at timestamptz;

-- De naam van de oude controleregel is automatisch gekozen: elke controle op soort vervangen door de ruimere.
do $$
declare
  c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.arnobot_referral_grootboek'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) like '%soort%'
  loop
    execute format('alter table public.arnobot_referral_grootboek drop constraint %I', c.conname);
  end loop;
  alter table public.arnobot_referral_grootboek
    add constraint arnobot_referral_grootboek_soort_check check (soort in
      ('toekenning', 'afwijzing', 'vaststelling', 'verval', 'handwerk', 'verrekening', 'vrijgave', 'terugdraaiing', 'herstel'));
end $$;

create table if not exists public.arnobot_referral_gratis_periodes (
  actie_id uuid primary key references public.arnobot_referral_acties (id),
  user_id text not null,
  subscription_id uuid,
  team_id uuid,
  periode_start timestamptz not null,
  periode_einde timestamptz not null
);
create index if not exists referral_gratis_periodes_user_idx on public.arnobot_referral_gratis_periodes (user_id);
alter table public.arnobot_referral_gratis_periodes enable row level security;

-- Zolang dit in de toekomst ligt komt er geen nieuwe reservering op deze betaling: de beheerder of de klant zelf is
-- hem aan het terugbetalen.
alter table public.arnobot_payments
  add column if not exists referral_geblokkeerd_tot timestamptz;

-- ── Rekenhulpen ─────────────────────────────────────────────────────────────────────────────────────────────────────

-- Gelijk aan Math.round in TypeScript, op hetzelfde kommagetal (float8).
create or replace function public.referral_rond(p float8) returns integer
language sql immutable security invoker set search_path = public as $$
  select (case when p - floor(p) >= 0.5 then floor(p) + 1 else floor(p) end)::integer
$$;

-- Gelijk aan verrekening() in lib/billing/referralRegels.ts: wijzig ze altijd samen.
create or replace function public.referral_verrekening(p_saldo integer, p_bruto integer, out bruto_cent integer, out verbruikt_netto_cent integer)
language plpgsql immutable security invoker set search_path = public as $$
declare
  f float8 := 1::float8 + 21::float8 / 100::float8;
  vol integer;
  v integer;
begin
  if p_saldo is null or p_bruto is null or p_saldo <= 0 or p_bruto <= 0 then
    bruto_cent := 0; verbruikt_netto_cent := 0; return;
  end if;
  vol := public.referral_rond(p_saldo * f);
  if vol <= p_bruto then
    bruto_cent := vol; verbruikt_netto_cent := p_saldo; return;
  end if;
  v := least(p_saldo, public.referral_rond(p_bruto / f));
  -- Een rest van 1 cent telt als verbruikt.
  if p_saldo - v = 1 then v := p_saldo; end if;
  bruto_cent := p_bruto; verbruikt_netto_cent := v;
end $$;

-- Wat er van een toekenning over is: alle echte regels die erop slaan.
create or replace function public.referral_rest(p_referral text) returns integer
language sql stable security invoker set search_path = public as $$
  select coalesce(sum(netto_cent), 0)::integer from arnobot_referral_grootboek
  where not meeloop and coalesce(hoort_bij, referral_id) = p_referral
$$;

-- Mag er op deze betaling gereserveerd worden? Vergrendelt de betaalrij tot het einde van de transactie. Het id wordt als
-- tekst vergeleken, zodat het type van de kolom niet uitmaakt.
create or replace function public.referral_betaling_ruimte(p_user text, p_doel text, out reden text, out ruimte_cent integer,
  out betaald_at timestamptz, out soort text)
language plpgsql security invoker set search_path = public as $$
declare
  b record;
begin
  select * into b from arnobot_payments p where p.id::text = p_doel and p.user_id::text = p_user for update;
  if not found then reden := 'betaling_onbekend'; return; end if;
  betaald_at := b.betaald_at;
  soort := b.soort;
  if b.status is distinct from 'paid' or b.betaald_at is null then reden := 'niet_betaald';
  elsif b.terugbetaling_verwerkt_at is not null then reden := 'terugbetaald';
  elsif coalesce(b.teruggeboekt_cent, 0) <> 0 then reden := 'teruggeboekt';
  elsif b.referral_geblokkeerd_tot is not null and b.referral_geblokkeerd_tot > now() then reden := 'geblokkeerd';
  -- Er is meer terug dan wij zelf als referral boekten.
  elsif coalesce(b.terugbetaald_cent, 0) > coalesce(b.referral_refund_cent, 0) then reden := 'andere_terugbetaling';
  else
    ruimte_cent := b.bedrag_cent - greatest(coalesce(b.terugbetaald_cent, 0), coalesce(b.referral_refund_cent, 0));
    if ruimte_cent <= 0 then reden := 'geen_ruimte'; end if;
  end if;
end $$;

-- ── 1. Tegoed reserveren ────────────────────────────────────────────────────────────────────────────────────────────
-- Alleen echte regels (meeloop = false). Kan het niet, dan verandert er niets en zegt 'reden' waarom.
-- p_terugwerkend: alleen voor de aanbrenger die gewoon teamlid is geworden; anders telt alleen tegoed dat er al was
-- toen de betaling werd gedaan.
create or replace function public.referral_reserveer(p_actie uuid, p_user text, p_doel text, p_max_netto integer default null,
  p_gegevens jsonb default '{}'::jsonb, p_terugwerkend boolean default false)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  a arnobot_referral_acties%rowtype;
  b record;
  t record;
  v record;
  schuld integer;
  open_schuld integer;
  eraf integer;
  vrij integer;
  beschikbaar integer := 0;
  nog integer;
  deel integer;
  kandidaten jsonb := '[]'::jsonb;
  k jsonb;
begin
  if p_actie is null or p_user is null or p_doel is null then
    return jsonb_build_object('ok', false, 'reden', 'ongeldig');
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user, 0));

  select * into a from arnobot_referral_acties where id = p_actie;
  if found then
    if a.user_id = p_user and a.doel_id = p_doel and a.soort = 'tegoed_terugstorten' then
      return jsonb_build_object('ok', true, 'bestaand', true, 'status', a.status, 'bruto_cent', a.bruto_cent, 'netto_cent', a.netto_cent);
    end if;
    return jsonb_build_object('ok', false, 'reden', 'actie_id_in_gebruik');
  end if;
  if exists (select 1 from arnobot_referral_acties x where x.soort = 'tegoed_terugstorten' and x.doel_id = p_doel
      and x.user_id = p_user and x.status not in ('vrijgegeven', 'ongedaan')) then
    return jsonb_build_object('ok', false, 'reden', 'al_actie');
  end if;
  if p_max_netto is not null and p_max_netto <= 0 then
    return jsonb_build_object('ok', false, 'reden', 'geen_saldo');
  end if;

  select * into b from public.referral_betaling_ruimte(p_user, p_doel);
  if b.reden is not null then return jsonb_build_object('ok', false, 'reden', b.reden); end if;
  if b.soort = 'upgrade' and not p_terugwerkend then return jsonb_build_object('ok', false, 'reden', 'upgrade'); end if;

  -- Schulden (teruggedraaid na gebruik) gaan er eerst af, van het oudste tegoed.
  select coalesce(sum(greatest(0, -public.referral_rest(g.referral_id))), 0)::integer into schuld
    from arnobot_referral_grootboek g where not g.meeloop and g.soort = 'toekenning' and g.aanbrenger_user_id = p_user;
  open_schuld := schuld;
  for t in
    select g.referral_id, g.klant_user_id, g.created_at from arnobot_referral_grootboek g
    where not g.meeloop and g.soort = 'toekenning' and g.aanbrenger_user_id = p_user
    order by g.created_at, g.referral_id collate "C"
  loop
    vrij := greatest(0, public.referral_rest(t.referral_id));
    eraf := least(open_schuld, vrij);
    open_schuld := open_schuld - eraf;
    vrij := vrij - eraf;
    if vrij > 0 and (p_terugwerkend or t.created_at < b.betaald_at) then
      beschikbaar := beschikbaar + vrij;
      kandidaten := kandidaten || jsonb_build_object('referral_id', t.referral_id, 'klant', t.klant_user_id, 'vrij', vrij);
    end if;
  end loop;
  if beschikbaar <= 0 then return jsonb_build_object('ok', false, 'reden', 'geen_saldo'); end if;

  select * into v from public.referral_verrekening(least(beschikbaar, coalesce(p_max_netto, beschikbaar)), b.ruimte_cent);
  if v.bruto_cent <= 0 or v.verbruikt_netto_cent <= 0 then return jsonb_build_object('ok', false, 'reden', 'geen_saldo'); end if;

  insert into arnobot_referral_acties (id, soort, user_id, doel_soort, doel_id, bruto_cent, netto_cent, gegevens)
  values (p_actie, 'tegoed_terugstorten', p_user, 'betaling', p_doel, v.bruto_cent, v.verbruikt_netto_cent,
    coalesce(p_gegevens, '{}'::jsonb));

  nog := v.verbruikt_netto_cent;
  for k in select value from jsonb_array_elements(kandidaten) with ordinality order by ordinality
  loop
    exit when nog <= 0;
    deel := least(nog, (k->>'vrij')::integer);
    insert into arnobot_referral_grootboek (event_key, meeloop, soort, referral_id, aanbrenger_user_id, klant_user_id,
      netto_cent, reden, klant_maand_netto_cent, actie_id, hoort_bij)
    values ('verrekening:' || p_actie || ':' || (k->>'referral_id'), false, 'verrekening', k->>'referral_id', p_user, k->>'klant',
      -deel, 'gereserveerd voor terugstorten', null, p_actie, k->>'referral_id');
    nog := nog - deel;
  end loop;
  if nog <> 0 then raise exception 'referral_reserveer: verdeling klopt niet (% over)', nog; end if;

  -- In dezelfde transactie: zo ziet de betaalverwerking de terugstorting nooit als volledige terugbetaling.
  update arnobot_payments set referral_refund_cent = coalesce(referral_refund_cent, 0) + v.bruto_cent where id::text = p_doel;

  return jsonb_build_object('ok', true, 'bestaand', false, 'status', 'gereserveerd', 'bruto_cent', v.bruto_cent,
    'netto_cent', v.verbruikt_netto_cent);
end $$;

-- ── 2. Voordeel van de nieuwe klant reserveren (geen saldo) ─────────────────────────────────────────────────────────
-- Nu alleen jaarkorting en gratis maand, terug te storten op een betaling. De teammaand hoort bij de teamfacturatie
-- (nog niet gebouwd) en wordt hier geweigerd.
create or replace function public.referral_reserveer_voordeel(p_actie uuid, p_user text, p_soort text, p_referral text,
  p_doel text, p_bruto integer, p_gegevens jsonb default '{}'::jsonb)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  a arnobot_referral_acties%rowtype;
  b record;
  r record;
  netto integer;
begin
  if p_actie is null or p_user is null or p_referral is null or p_doel is null then
    return jsonb_build_object('ok', false, 'reden', 'ongeldig');
  end if;
  if p_soort is null or p_soort not in ('voordeel_jaar', 'voordeel_maand') then
    return jsonb_build_object('ok', false, 'reden', 'niet_ondersteund');
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user, 0));

  select * into a from arnobot_referral_acties where id = p_actie;
  if found then
    if a.user_id = p_user and a.doel_id = p_doel and a.soort = p_soort then
      return jsonb_build_object('ok', true, 'bestaand', true, 'status', a.status, 'bruto_cent', a.bruto_cent, 'netto_cent', a.netto_cent);
    end if;
    return jsonb_build_object('ok', false, 'reden', 'actie_id_in_gebruik');
  end if;

  -- Het voordeel is van de aangebrachte klant zelf. to_jsonb: referred_discount kan van elk getaltype zijn of ontbreken.
  select x.referrer_user_id::text as aanbrenger, to_jsonb(x)->>'referred_discount' as korting into r
    from arnobot_referrals x where x.id::text = p_referral and x.referred_user_id::text = p_user;
  if not found then return jsonb_build_object('ok', false, 'reden', 'referral_onbekend'); end if;
  if r.aanbrenger = p_user or exists (select 1 from arnobot_referrals y
      where y.referrer_user_id::text = p_user and y.referred_user_id::text = r.aanbrenger) then
    return jsonb_build_object('ok', false, 'reden', 'wederzijds');
  end if;
  if coalesce(nullif(btrim(r.korting), '')::numeric, 0) > 0
    or exists (select 1 from arnobot_referral_acties x where x.referral_id = p_referral and x.soort like 'voordeel%'
      and x.status not in ('vrijgegeven', 'ongedaan')) then
    return jsonb_build_object('ok', false, 'reden', 'voordeel_al_gebruikt');
  end if;

  select * into b from public.referral_betaling_ruimte(p_user, p_doel);
  if b.reden is not null then return jsonb_build_object('ok', false, 'reden', b.reden); end if;
  if b.soort = 'upgrade' then return jsonb_build_object('ok', false, 'reden', 'upgrade'); end if;
  -- Niet gedeeltelijk: past het hele voordeel niet, dan beslist een mens.
  if p_bruto is null or p_bruto <= 0 or p_bruto > b.ruimte_cent then
    return jsonb_build_object('ok', false, 'reden', 'bedrag_past_niet');
  end if;
  netto := public.referral_rond(p_bruto / (1::float8 + 21::float8 / 100::float8));

  insert into arnobot_referral_acties (id, soort, user_id, referral_id, doel_soort, doel_id, bruto_cent, netto_cent, gegevens)
  values (p_actie, p_soort, p_user, p_referral, 'betaling', p_doel, p_bruto, netto, coalesce(p_gegevens, '{}'::jsonb));
  update arnobot_payments set referral_refund_cent = coalesce(referral_refund_cent, 0) + p_bruto where id::text = p_doel;

  return jsonb_build_object('ok', true, 'bestaand', false, 'status', 'gereserveerd', 'bruto_cent', p_bruto, 'netto_cent', netto);
end $$;

-- ── 3. Vrijgeven ────────────────────────────────────────────────────────────────────────────────────────────────────
-- ALLEEN aanroepen als zeker is dat er geen geld is verplaatst. p_van: alleen als de actie nog die status heeft.
-- p_eind 'vastgelopen': de reservering wordt teruggezet en de actie blijft het doel bezet houden, zodat niets het
-- vanzelf opnieuw probeert.
create or replace function public.referral_vrijgeven(p_actie uuid, p_van text default null, p_eind text default 'vrijgegeven',
  p_reden text default null)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  eigenaar text;
  a arnobot_referral_acties%rowtype;
  v record;
  rest integer;
begin
  if p_eind is null or p_eind not in ('vrijgegeven', 'vastgelopen') then
    raise exception 'referral_vrijgeven: onbekende eindstatus %', p_eind;
  end if;
  select user_id into eigenaar from arnobot_referral_acties where id = p_actie;
  if not found then return jsonb_build_object('ok', false, 'reden', 'actie_onbekend'); end if;
  perform pg_advisory_xact_lock(hashtextextended(eigenaar, 0));
  select * into a from arnobot_referral_acties where id = p_actie for update;

  if p_van is not null and a.status <> p_van then
    return jsonb_build_object('ok', false, 'reden', 'status_gewijzigd', 'status', a.status);
  end if;
  if a.status in ('bevestigd', 'ongedaan') then
    return jsonb_build_object('ok', false, 'reden', 'niet_vrij_te_geven', 'status', a.status);
  end if;
  if a.status = 'vrijgegeven' then
    return jsonb_build_object('ok', true, 'bestaand', true, 'status', a.status);
  end if;

  if coalesce((a.gegevens->>'boeking_teruggezet')::boolean, false) = false then
    for v in
      select * from arnobot_referral_grootboek g where not g.meeloop and g.actie_id = p_actie and g.soort = 'verrekening'
    loop
      insert into arnobot_referral_grootboek (event_key, meeloop, soort, referral_id, aanbrenger_user_id, klant_user_id,
        netto_cent, reden, klant_maand_netto_cent, actie_id, hoort_bij)
      values ('vrijgave:' || p_actie || ':' || v.hoort_bij, false, 'vrijgave', v.referral_id, v.aanbrenger_user_id,
        v.klant_user_id, -v.netto_cent, coalesce(p_reden, 'niet teruggestort'), null, p_actie, v.hoort_bij);
      -- Is dit tegoed intussen vervallen, dan komt het niet terug: vervallen is definitief.
      if exists (select 1 from arnobot_referral_grootboek g where not g.meeloop and g.event_key = 'verval:' || v.hoort_bij) then
        rest := public.referral_rest(v.hoort_bij);
        if rest > 0 then
          insert into arnobot_referral_grootboek (event_key, meeloop, soort, referral_id, aanbrenger_user_id, klant_user_id,
            netto_cent, reden, klant_maand_netto_cent, actie_id, hoort_bij)
          values ('verval:' || v.hoort_bij || ':vrijgave:' || p_actie, false, 'verval', v.referral_id, v.aanbrenger_user_id,
            v.klant_user_id, -least(rest, -v.netto_cent), 'dit tegoed was al vervallen', null, p_actie, v.hoort_bij);
        end if;
      end if;
    end loop;
    if a.doel_soort = 'betaling' and a.bruto_cent > 0 then
      update arnobot_payments set referral_refund_cent = greatest(0, coalesce(referral_refund_cent, 0) - a.bruto_cent)
        where id::text = a.doel_id and user_id::text = a.user_id;
    end if;
  end if;

  update arnobot_referral_acties set status = p_eind, bezig_tot = null, fout = coalesce(p_reden, fout),
    gegevens = gegevens || jsonb_build_object('boeking_teruggezet', true), updated_at = now()
    where id = p_actie;
  return jsonb_build_object('ok', true, 'bestaand', false, 'status', p_eind);
end $$;

-- ── 4. Grootboekregels boeken ───────────────────────────────────────────────────────────────────────────────────────
-- Toekenning, afwijzing, handwerk, vaststelling, verval, terugdraaiing en herstel, allemaal achter hetzelfde slot per
-- aanbrenger en altijd als echte regel (meeloop = false). Bij verval, terugdraaiing en herstel rekent de database het
-- bedrag zelf uit; een meegegeven bedrag wordt genegeerd. p_regel gebruikt de kolomnamen van het grootboek.
create or replace function public.referral_boek(p_regel jsonb)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  s text := p_regel->>'soort';
  ref text := p_regel->>'referral_id';
  aanbrenger text := p_regel->>'aanbrenger_user_id';
  klant text := p_regel->>'klant_user_id';
  invoer integer := (p_regel->>'netto_cent')::integer;
  maandprijs integer := (p_regel->>'klant_maand_netto_cent')::integer;
  bronnen text[];
  sleutel text;
  mutatie boolean;
  t arnobot_referral_grootboek%rowtype;
  bestaand arnobot_referral_grootboek%rowtype;
  netto integer;
  gedraaid integer;
  hersteld integer;
  volle integer;
  vervallen integer;
  rest integer;
begin
  if s is null or s not in ('toekenning', 'afwijzing', 'handwerk', 'vaststelling', 'verval', 'terugdraaiing', 'herstel') then
    return jsonb_build_object('ok', false, 'reden', 'soort_niet_toegestaan');
  end if;
  mutatie := s in ('vaststelling', 'verval', 'terugdraaiing', 'herstel');
  if ref is null or ref = '' then return jsonb_build_object('ok', false, 'reden', 'ongeldig'); end if;

  if mutatie then
    -- De aanbrenger komt uit de toekenning: zo staat het slot nooit op de verkeerde.
    select * into t from arnobot_referral_grootboek g where not g.meeloop and g.soort = 'toekenning' and g.referral_id = ref;
    if not found then return jsonb_build_object('ok', false, 'reden', 'geen_toekenning'); end if;
    if aanbrenger is not null and aanbrenger <> t.aanbrenger_user_id then
      return jsonb_build_object('ok', false, 'reden', 'aanbrenger_klopt_niet');
    end if;
    aanbrenger := t.aanbrenger_user_id;
    klant := t.klant_user_id;
    maandprijs := t.klant_maand_netto_cent;
  elsif aanbrenger is null or klant is null then
    return jsonb_build_object('ok', false, 'reden', 'ongeldig');
  end if;

  perform pg_advisory_xact_lock(hashtextextended(aanbrenger, 0));

  select count(*) filter (where g.soort = 'terugdraaiing'), count(*) filter (where g.soort = 'herstel') into gedraaid, hersteld
    from arnobot_referral_grootboek g where not g.meeloop and coalesce(g.hoort_bij, g.referral_id) = ref;

  sleutel := case
    when s in ('toekenning', 'afwijzing') then 'uitkomst:' || ref
    when s = 'vaststelling' then 'vaststelling:' || ref
    when s = 'verval' then 'verval:' || ref
    when s = 'terugdraaiing' then 'terugdraaiing:' || ref || ':' || (gedraaid + 1)
    when s = 'herstel' then 'herstel:' || ref || ':' || (hersteld + 1)
    else p_regel->>'event_key'
  end;
  if s = 'handwerk' and (sleutel is null or sleutel !~ '^(handwerk|verval-handwerk|verval-behoud):') then
    return jsonb_build_object('ok', false, 'reden', 'sleutel_ongeldig');
  end if;

  select * into bestaand from arnobot_referral_grootboek g where not g.meeloop and g.event_key = sleutel;
  if found then
    return jsonb_build_object('ok', true, 'bestaand', true, 'soort', bestaand.soort, 'netto_cent', bestaand.netto_cent, 'event_key', sleutel);
  end if;

  if s = 'toekenning' then
    if invoer is not null and (invoer <= 0 or invoer > 1000000) then return jsonb_build_object('ok', false, 'reden', 'bedrag_ongeldig'); end if;
    netto := invoer;
  elsif s in ('afwijzing', 'handwerk') then
    netto := 0;
  elsif s = 'vaststelling' then
    if t.netto_cent is not null then return jsonb_build_object('ok', false, 'reden', 'bedrag_staat_al_vast'); end if;
    if gedraaid > hersteld then return jsonb_build_object('ok', false, 'reden', 'teruggedraaid'); end if;
    if exists (select 1 from arnobot_referral_grootboek g where not g.meeloop and g.event_key = 'verval:' || ref) then
      return jsonb_build_object('ok', false, 'reden', 'vervallen');
    end if;
    if invoer is null or invoer <= 0 or invoer > 1000000 then return jsonb_build_object('ok', false, 'reden', 'bedrag_ongeldig'); end if;
    netto := invoer;
  elsif s = 'verval' then
    -- Alleen wat er van deze toekenning nog is, nooit onder 0.
    netto := -greatest(0, public.referral_rest(ref));
  elsif s = 'terugdraaiing' then
    if gedraaid > hersteld then return jsonb_build_object('ok', false, 'reden', 'al_teruggedraaid'); end if;
    select coalesce(sum(g.netto_cent) filter (where g.soort in ('toekenning', 'vaststelling')), 0),
           coalesce(-sum(g.netto_cent) filter (where g.soort = 'verval'), 0)
      into volle, vervallen
      from arnobot_referral_grootboek g where not g.meeloop and coalesce(g.hoort_bij, g.referral_id) = ref;
    -- De hele toekenning min wat al vervallen is. Was het al gebruikt, dan wordt de rest negatief: een schuld.
    netto := -greatest(0, volle - vervallen);
  else
    if gedraaid <= hersteld then return jsonb_build_object('ok', false, 'reden', 'niet_teruggedraaid'); end if;
    select -g.netto_cent into netto from arnobot_referral_grootboek g
      where not g.meeloop and g.event_key = 'terugdraaiing:' || ref || ':' || gedraaid;
    if netto is null then return jsonb_build_object('ok', false, 'reden', 'terugdraaiing_onbekend'); end if;
  end if;

  if jsonb_typeof(p_regel->'bron_ids') = 'array' then
    bronnen := array(select jsonb_array_elements_text(p_regel->'bron_ids'));
  end if;

  insert into arnobot_referral_grootboek (event_key, meeloop, soort, referral_id, aanbrenger_user_id, klant_user_id,
    netto_cent, reden, klant_maand_netto_cent, bron_ids, hoort_bij)
  values (sleutel, false, s, ref, aanbrenger, klant, netto, coalesce(p_regel->>'reden', s), maandprijs, bronnen,
    case when mutatie then ref end);

  -- Was dit tegoed vervallen terwijl het teruggedraaid was, dan brengt een herstel het niet terug.
  if s = 'herstel' and exists (select 1 from arnobot_referral_grootboek g where not g.meeloop and g.event_key = 'verval:' || ref) then
    rest := public.referral_rest(ref);
    if rest > 0 then
      insert into arnobot_referral_grootboek (event_key, meeloop, soort, referral_id, aanbrenger_user_id, klant_user_id,
        netto_cent, reden, klant_maand_netto_cent, hoort_bij)
      values ('verval:' || ref || ':herstel:' || (hersteld + 1), false, 'verval', ref, aanbrenger, klant,
        -least(rest, netto), 'dit tegoed was al vervallen', maandprijs, ref);
    end if;
  end if;

  return jsonb_build_object('ok', true, 'bestaand', false, 'soort', s, 'netto_cent', netto, 'event_key', sleutel);
end $$;

-- ── Voor de terugstortmachine ───────────────────────────────────────────────────────────────────────────────────────
-- Een actie claimen: alleen als zij nog de verwachte status heeft en niemand er nu mee bezig is. Geeft de rij of null.
create or replace function public.referral_claim(p_actie uuid, p_van text, p_minuten integer default 10)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  eigenaar text;
  a arnobot_referral_acties%rowtype;
begin
  if p_van is null or p_van not in ('gereserveerd', 'bezig', 'verzonden') then return null; end if;
  select user_id into eigenaar from arnobot_referral_acties where id = p_actie;
  if not found then return null; end if;
  perform pg_advisory_xact_lock(hashtextextended(eigenaar, 0));
  update arnobot_referral_acties set
      status = case when status = 'gereserveerd' then 'bezig' else status end,
      bezig_tot = now() + make_interval(mins => p_minuten),
      updated_at = now()
    where id = p_actie and status = p_van and (bezig_tot is null or bezig_tot < now())
    returning * into a;
  if not found then return null; end if;
  return to_jsonb(a);
end $$;

-- Vlak voor een terugbetaling door de beheerder of een herroeping, achter hetzelfde slot als het reserveren: blokkeert
-- nieuwe reserveringen op deze betaling, geeft wat nog niet verstuurd is vrij en zegt wat er al onderweg is.
create or replace function public.referral_voor_terugbetaling(p_user text, p_betaling text, p_minuten integer default 10)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  x record;
  vrijgegeven integer := 0;
  onderweg integer;
  vast integer;
  tegoed integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user, 0));
  update arnobot_payments set referral_geblokkeerd_tot = now() + make_interval(mins => p_minuten)
    where id::text = p_betaling and user_id::text = p_user;
  if not found then return jsonb_build_object('ok', false, 'reden', 'betaling_onbekend'); end if;

  for x in
    select id, bruto_cent from arnobot_referral_acties
    where user_id = p_user and doel_soort = 'betaling' and doel_id = p_betaling and status = 'gereserveerd'
  loop
    perform public.referral_vrijgeven(x.id, 'gereserveerd', 'vrijgegeven', 'de betaling wordt terugbetaald');
    vrijgegeven := vrijgegeven + x.bruto_cent;
  end loop;

  select coalesce(sum(bruto_cent) filter (where status in ('bezig', 'verzonden')), 0),
         coalesce(sum(bruto_cent) filter (where status = 'vastgelopen'
           and coalesce((gegevens->>'boeking_teruggezet')::boolean, false) = false), 0)
    into onderweg, vast
    from arnobot_referral_acties where user_id = p_user and doel_soort = 'betaling' and doel_id = p_betaling;
  select coalesce(referral_refund_cent, 0) into tegoed from arnobot_payments where id::text = p_betaling and user_id::text = p_user;

  return jsonb_build_object('ok', true, 'referral_refund_cent', tegoed, 'vrijgegeven_cent', vrijgegeven,
    'onderweg_cent', onderweg, 'vast_cent', vast);
end $$;

-- ── Rechten: alleen de server (service-role) ────────────────────────────────────────────────────────────────────────
do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as naam from pg_proc p
    where p.pronamespace = 'public'::regnamespace and p.proname in ('referral_rond', 'referral_verrekening', 'referral_rest',
      'referral_betaling_ruimte', 'referral_reserveer', 'referral_reserveer_voordeel', 'referral_vrijgeven', 'referral_boek',
      'referral_claim', 'referral_voor_terugbetaling')
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.naam);
    execute format('grant execute on function %s to service_role', f.naam);
  end loop;
end $$;

commit;

-- Zodat de API de nieuwe tabellen en functies meteen kent.
notify pgrst, 'reload schema';

-- Controle: de eerste 6 regels moeten goed = true zijn. De laatste regels zijn ter informatie: het type van
-- arnobot_referrals.id en referred_discount (is referred_discount een geheel getal, dan past een korting van 4,92 er
-- niet in en moet dat apart worden aangepast).
with functies as (
  select p.oid, p.prosecdef from pg_proc p
  where p.pronamespace = 'public'::regnamespace and p.proname in ('referral_rond', 'referral_verrekening', 'referral_rest',
    'referral_betaling_ruimte', 'referral_reserveer', 'referral_reserveer_voordeel', 'referral_vrijgeven', 'referral_boek',
    'referral_claim', 'referral_voor_terugbetaling')
)
select 1 as nr, 'twee nieuwe tabellen met RLS aan' as controle, count(*)::text as uitkomst, count(*) = 2 as goed
  from pg_tables where schemaname = 'public' and rowsecurity
    and tablename in ('arnobot_referral_acties', 'arnobot_referral_gratis_periodes')
union all
select 2, 'vijf nieuwe kolommen op grootboek en betalingen', count(*)::text, count(*) = 5
  from information_schema.columns where table_schema = 'public'
    and ((table_name = 'arnobot_referral_grootboek' and column_name in ('bron_ids', 'actie_id', 'hoort_bij', 'mail_at'))
      or (table_name = 'arnobot_payments' and column_name = 'referral_geblokkeerd_tot'))
union all
select 3, 'unieke indexen op de acties', count(*)::text, count(*) = 2
  from pg_indexes where schemaname = 'public' and indexname in ('referral_een_voordeel', 'referral_een_actie_per_doel')
union all
select 4, 'soortcontrole kent verrekening en herstel', count(*)::text, count(*) = 1
  from pg_constraint where conrelid = 'public.arnobot_referral_grootboek'::regclass and contype = 'c'
    and pg_get_constraintdef(oid) like '%verrekening%' and pg_get_constraintdef(oid) like '%herstel%'
union all
select 5, 'tien functies, geen enkele security definer', count(*)::text, count(*) = 10 and not bool_or(prosecdef) from functies
union all
select 6, 'anon en authenticated mogen geen functie uitvoeren, service_role alle', count(*)::text, count(*) = 10
  from functies where not has_function_privilege('anon', oid, 'execute') and not has_function_privilege('authenticated', oid, 'execute')
    and has_function_privilege('service_role', oid, 'execute')
union all
select 7, 'ter informatie: type van arnobot_referrals.' || column_name, data_type, null
  from information_schema.columns where table_schema = 'public' and table_name = 'arnobot_referrals'
    and column_name in ('id', 'referred_user_id', 'referred_discount')
order by 1, 2;
