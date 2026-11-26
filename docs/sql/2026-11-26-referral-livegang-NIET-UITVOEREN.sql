-- !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
-- !!  NU NIET UITVOEREN.                                                                                           !!
-- !!                                                                                                               !!
-- !!  Dit is het script voor de livegang van het referralgrootboek (docs/REFERRAL_BOUWPLAN_R3.md, B5). Die komt     !!
-- !!  pas na stap 1 tot en met 11 van de bouwvolgorde. De code kent REFERRAL_GROOTBOEK_ECHT nog niet: voer je dit  !!
-- !!  nu uit, dan verdwijnt de meeloopstand en beoordeelt de dagelijkse controle daarna alles opnieuw.             !!
-- !!  Zolang v_mag hieronder op false staat, mislukt het script.                                                   !!
-- !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
--
-- Volgorde bij livegang:
--   1. Voor 05:00 UTC (voor de dagelijkse controle van 05:20), met alle geldschakelaars uit.
--   2. Eerst 2026-11-26-referral-verrekening.sql uitgevoerd en gecontroleerd. De droogloop naast de meeloopstand is
--      bekeken en elk verschil verklaard. De code die in de echte stand alle grootboekregels via de databasefunctie
--      referral_boek schrijft is gebouwd en gecontroleerd.
--   3. v_mag op true zetten en het hele bestand uitvoeren.
--   4. Pas daarna de deploy en REFERRAL_GROOTBOEK_ECHT=true. Eerst deployen kan niet: de echte controle zou de
--      handmatige gevallen opnieuw beoordelen en stap 3 botst dan op de unieke sleutel.
--   Zet de schakelaar daarna niet terug zonder plan.
--
-- De regel: van elke referral met minstens een handmatig besluit blijven ALLE regels bewaard (ook de automatische
-- toekenning, het verval en de vragen). Alle andere meeloopregels verdwijnen; de echte controle beoordeelt die opnieuw.
-- Er blijft een kopie van alle meeloopregels staan in arnobot_referral_grootboek_meeloop_backup.
--
-- Alles wat iets wijzigt staat in een blok. De Supabase SQL Editor voert ook alleen geselecteerde tekst uit: daarom
-- staat elke wijziging in een opdrachttekst die los niet uit te voeren is (de tabelnaam komt uit een variabele). Zet
-- die opdrachten nooit als gewone SQL in dit bestand.
--
-- Nog met de hand na dit script: bewaarde handmatige toekenningen hebben mogelijk geen bron_ids. Vul die eenmalig aan.
-- Lukt dat niet, dan is er voor die toekenning geen automatische terugdraaiing en hoort daar een melding bij.
-- De laatste controlevraag noemt ze.

do $livegang$
declare
  -- SLOT: pas bij de livegang op true zetten.
  v_mag constant boolean := false;
  v_boek constant text := 'arnobot_referral_grootboek';
  v_kopie constant text := 'arnobot_referral_grootboek_meeloop_backup';
  v_echt boolean;
begin
  if not v_mag then
    raise exception 'NIET UITVOEREN: dit is het livegangscript van het referralgrootboek. Lees de kop.';
  end if;
  if not exists (select 1 from information_schema.columns
      where table_schema = 'public' and table_name = v_boek and column_name = 'mail_at') then
    raise exception 'Voer eerst docs/sql/2026-11-26-referral-verrekening.sql uit';
  end if;
  execute format('select exists (select 1 from public.%I where not meeloop)', v_boek) into v_echt;
  if v_echt then
    raise exception 'Er staan al echte regels in het grootboek: de livegang is al gebeurd of er is iets mis. Niets gewijzigd.';
  end if;

  -- Bestaat de kopie al, dan mislukt dit en verandert er niets: dit script draait nooit twee keer.
  execute format('create table public.%I as select * from public.%I where meeloop', v_kopie, v_boek);
  execute format('alter table public.%I enable row level security', v_kopie);

  -- Alle regels van elke referral met minstens een handmatig besluit worden echt, inclusief toekenning en vragen.
  execute format('update public.%I set meeloop = false where meeloop and referral_id in
      (select referral_id from public.%I where meeloop and reden like %L)', v_boek, v_boek, 'handmatig besluit: %');
  execute format('delete from public.%I where meeloop', v_boek);

  -- Over de bewaarde oude regels gaat geen mail meer uit.
  execute format('update public.%I set mail_at = now() where not meeloop and mail_at is null', v_boek);
end $livegang$;

-- Controle (alleen lezen): het aantal bewaarde regels, het aantal in de kopie, en de handmatige toekenningen zonder
-- betalingskenmerken.
select 'bewaard als echte regel' as controle, count(*)::text as uitkomst from public.arnobot_referral_grootboek where not meeloop
union all
select 'nog in meeloopstand (moet 0 zijn)', count(*)::text from public.arnobot_referral_grootboek where meeloop
union all
select 'in de kopie', count(*)::text from public.arnobot_referral_grootboek_meeloop_backup
union all
select 'toekenning zonder bron_ids, referral', referral_id from public.arnobot_referral_grootboek
  where not meeloop and soort = 'toekenning' and bron_ids is null;
