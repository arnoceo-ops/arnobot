-- !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
-- !!  NU NIET UITVOEREN.                                                                                           !!
-- !!                                                                                                               !!
-- !!  Dit is het script voor de livegang van het referralgrootboek (docs/REFERRAL_BOUWPLAN_R3.md, B5). Die komt     !!
-- !!  pas na stap 1 tot en met 11 van de bouwvolgorde. De echte stand is gebouwd; voer je dit      !!
-- !!  nu uit, dan verdwijnt de meeloopstand en beoordeelt de dagelijkse controle daarna alles opnieuw.             !!
-- !!  Zolang v_mag hieronder op false staat, mislukt het script.                                                   !!
-- !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
--
-- Volgorde bij livegang:
--   0. Kijk of er in approved_users een referral_credit boven 0 staat (oud, met de hand gegeven tegoed).
--   1. Met alle geldschakelaars en REFERRAL_MAILS uit (REFERRAL_TERUGSTORTEN, REFERRAL_TEGOED_VERREKENEN, REFERRAL_CREDITNOTA), en zo
--      gepland dat stap 4 KLAAR EN ACTIEF is voor de eerstvolgende controle van 05:20 UTC. Doe SQL en deploy dus direct
--      na elkaar, niet de dag ervoor.
--   2. Eerst 2026-11-26-referral-verrekening.sql uitgevoerd en gecontroleerd. De droogloop naast de meeloopstand is
--      bekeken en elk verschil verklaard. De code die in de echte stand alle grootboekregels via de databasefunctie
--      referral_boek schrijft is gebouwd en gecontroleerd.
--   3. v_mag op true zetten en het hele bestand uitvoeren.
--   4. Pas daarna de deploy met REFERRAL_GROOTBOEK_ECHT=true. Eerst deployen kan niet: de code schrijft niets zolang
--      er meeloopregels zijn. Draaide de OUDE code toch nog een keer na stap 3, dan staan er weer meeloopregels en
--      weigert de nieuwe code. Herstel: controleer dat geen daarvan met de hand besloten is
--      (select * from arnobot_referral_grootboek where meeloop and reden like 'handmatig besluit: %';) en verwijder
--      daarna de meeloopregels. Dit script nog eens draaien kan niet.
--   5. Wacht op de eerste echte controle (05:20 UTC): daarna bestaan de toekenningen weer, nu echt.
--   6. Boek DAARNA alles in wat al met de hand is gegeven: referral_handmatig_tegoed (verlaagt het saldo; dat kan pas
--      als de toekenning bestaat), referral_handmatig_voordeel en referral_handmatig_betaling (die laatste verlaagt
--      het saldo NIET).
--   7. PAS DAARNA REFERRAL_TERUGSTORTEN en eventueel REFERRAL_TEGOED_VERREKENEN aanzetten. De uitvoerronde van 05:40
--      verrekent met terugwerkende kracht over alle verlengingen na het verdienmoment: wat niet is ingeboekt wordt
--      dan nog een keer uitbetaald.
--   8. Wil je klantmails: REFERRAL_MAILS=true en REFERRAL_MAILS_VANAF op een tijdstip NA de eerste echte controle EN
--      na stap 6, als JJJJ-MM-DD of met tijd (2027-01-10T12:00:00Z). Een kale datum telt vanaf middernacht UTC: kies dan
--      de dag van MORGEN, anders krijgt iedereen mail over de net opnieuw aangemaakte regels. Zonder datum niets.
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
-- Nog met de hand na dit script: bewaarde handmatige toekenningen hebben mogelijk geen bron_ids en geen verdiend_at.
-- Vul BEIDE eenmalig aan (alleen bron_ids aanvullen laat verlengingen tussen verdienen en besluit wegvallen).
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
  where not meeloop and soort = 'toekenning' and bron_ids is null
union all
select 'toekenning zonder verdiend_at (telt vanaf de dag van vastleggen), referral', referral_id from public.arnobot_referral_grootboek
  where not meeloop and soort = 'toekenning' and verdiend_at is null;
