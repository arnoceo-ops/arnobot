-- !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
-- !!  NU NIET UITVOEREN.                                                                                           !!
-- !!                                                                                                               !!
-- !!  Dit is het script voor de livegang van het referralgrootboek (docs/REFERRAL_BOUWPLAN_R3.md, B5). Die komt     !!
-- !!  pas na stap 1 tot en met 11 van de bouwvolgorde. De code kent REFERRAL_GROOTBOEK_ECHT nog niet: voer je dit  !!
-- !!  nu uit, dan verdwijnt de meeloopstand en beoordeelt de dagelijkse controle daarna alles opnieuw.             !!
-- !!  Het blok "SLOT" hieronder laat het script daarom altijd mislukken.                                          !!
-- !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
--
-- Volgorde bij livegang:
--   1. Voor 05:00 UTC (voor de dagelijkse controle van 05:20), met alle geldschakelaars uit.
--   2. Eerst 2026-11-26-referral-verrekening.sql uitgevoerd en gecontroleerd. De droogloop naast de meeloopstand is
--      bekeken en elk verschil verklaard. De code die in de echte stand alle grootboekregels via de databasefunctie
--      referral_boek schrijft is gebouwd en gecontroleerd.
--   3. Het blok "SLOT" weghalen en dit script uitvoeren.
--   4. Pas daarna de deploy en REFERRAL_GROOTBOEK_ECHT=true. Eerst deployen kan niet: de echte controle zou de
--      handmatige gevallen opnieuw beoordelen en stap 3 botst dan op de unieke sleutel.
--   Zet de schakelaar daarna niet terug zonder plan.
--
-- De regel: van elke referral met minstens een handmatig besluit blijven ALLE regels bewaard (ook de automatische
-- toekenning, het verval en de vragen). Alle andere meeloopregels verdwijnen; de echte controle beoordeelt die opnieuw.
-- Er blijft een kopie van alle meeloopregels staan in arnobot_referral_grootboek_meeloop_backup.
--
-- Nog met de hand na dit script: bewaarde handmatige toekenningen hebben mogelijk geen bron_ids. Vul die eenmalig aan.
-- Lukt dat niet, dan is er voor die toekenning geen automatische terugdraaiing en hoort daar een melding bij.
-- De laatste controlequery noemt ze.

begin;

-- ── SLOT: pas bij de livegang dit blok verwijderen ──
do $$
begin
  raise exception 'NIET UITVOEREN: dit is het livegangscript van het referralgrootboek. Lees de kop.';
end $$;
-- ── einde SLOT ──

do $$
begin
  if not exists (select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'arnobot_referral_grootboek' and column_name = 'mail_at') then
    raise exception 'Voer eerst docs/sql/2026-11-26-referral-verrekening.sql uit';
  end if;
  if exists (select 1 from public.arnobot_referral_grootboek where not meeloop) then
    raise exception 'Er staan al echte regels in het grootboek: de livegang is al gebeurd of er is iets mis. Niets gewijzigd.';
  end if;
end $$;

-- Bestaat de kopie al, dan mislukt dit en verandert er niets: dit script draait nooit twee keer.
create table public.arnobot_referral_grootboek_meeloop_backup as
  select * from public.arnobot_referral_grootboek where meeloop;
alter table public.arnobot_referral_grootboek_meeloop_backup enable row level security;

-- Alle regels van elke referral met minstens een handmatig besluit worden echt, inclusief toekenning en vragen.
update public.arnobot_referral_grootboek set meeloop = false
 where meeloop and referral_id in (select referral_id from public.arnobot_referral_grootboek
   where meeloop and reden like 'handmatig besluit: %');
delete from public.arnobot_referral_grootboek where meeloop;

-- Over de bewaarde oude regels gaat geen mail meer uit.
update public.arnobot_referral_grootboek set mail_at = now() where not meeloop and mail_at is null;

commit;

-- Controle: het aantal bewaarde regels, het aantal in de kopie, en de handmatige toekenningen zonder betalingskenmerken.
select 'bewaard als echte regel' as controle, count(*)::text as uitkomst from public.arnobot_referral_grootboek where not meeloop
union all
select 'nog in meeloopstand (moet 0 zijn)', count(*)::text from public.arnobot_referral_grootboek where meeloop
union all
select 'in de kopie', count(*)::text from public.arnobot_referral_grootboek_meeloop_backup
union all
select 'toekenning zonder bron_ids, referral', referral_id from public.arnobot_referral_grootboek
  where not meeloop and soort = 'toekenning' and bron_ids is null;
