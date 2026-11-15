-- Opzegregel voor Team (2026-11-15), zie docs/TEAM_PROCES.md, fase 6 "Einde".
--
-- arnobot_teams.stopt_op: de dag waarop een opgezegd team stopt (JJJJ-MM-DD). De manager zegt het teamabonnement op,
-- de server berekent met de regels van artikel 7 van de voorwaarden (zakelijk: opzegtermijn één maand vóór het einde van
-- de lopende betaalperiode, anders een periode erbij) wanneer het team stopt en zet die datum hier. Tot die dag houden
-- manager en leden toegang. Op die dag blokkeert het team en stopt de facturatie. Leeg betekent: niet opgezegd.
--
-- Bevat geen gebruikersinhoud, alleen een datum. Nu uitvoeren kan geen kwaad: zolang de code er niet op schrijft
-- blijft de kolom leeg en verandert er niets aan het gedrag.

alter table arnobot_teams
  add column if not exists stopt_op date;

comment on column arnobot_teams.stopt_op is 'Dag waarop het opgezegde team stopt (blokkade en einde facturatie). Leeg = niet opgezegd.';
