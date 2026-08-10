// Team-tarief (besloten 2026-08-02, herzien 2026-08-10 met een jaaroptie, zie
// docs/PRICING_DECISIONS.md): €97/maand platformtarief + €49/gebruiker/maand
// bij maandelijkse betaling, geen staffelkorting, geen niveau-keuze (elk
// teamlid krijgt volledige Pro-functionaliteit), vanaf 3 gebruikers.
//
// Jaaroptie (besloten 2026-08-10): ~20% korting bij vooruitbetalen, €77 +
// €39/gebruiker als maand-equivalent (dus €924 + €468/gebruiker per jaar
// vooruit). Bewust een kleinere korting dan Basic/Pro (~34%): Team is een
// volledig platform hoger (managerlaag, teamoverzicht, coaching inbegrepen
// voor elk lid), geen reden om daar dezelfde korting op te geven als op de
// individuele tiers. €39/gebruiker/maand is bovendien exact de jaarlijkse
// Pro-prijs, dus een teamlid betaalt nooit minder dan een solo Pro-jaarabonnee
// zou betalen (zelfde principe als bij de €49-maandprijs t.o.v. Pro €59/maand).
//
// Seat-wijzigingen tijdens een lopend jaarcontract: true-up, volledig
// handmatig (net als de rest van de facturatie, geen payment provider).
// Jaarprijs staat vast op het aantal gebruikers bij tekenen, nieuwe
// gebruikers worden apart maandelijks bijgefactureerd tot de volgende
// jaarvernieuwing, weggevallen gebruikers worden niet terugbetaald.
export type Cyclus = 'maandelijks' | 'jaarlijks'

export const TEAM_BASISTARIEF_MAANDELIJKS = 97
export const TEAM_BASISTARIEF_JAARLIJKS = 77
export const TEAM_PRIJS_PER_GEBRUIKER_MAANDELIJKS = 49
export const TEAM_PRIJS_PER_GEBRUIKER_JAARLIJKS = 39
export const TEAM_MIN_GEBRUIKERS = 3

export function berekenTeamPrijsPerMaand(gebruikers: number, cyclus: Cyclus = 'maandelijks'): number | null {
  if (!Number.isFinite(gebruikers) || gebruikers < TEAM_MIN_GEBRUIKERS) return null
  const basis = cyclus === 'jaarlijks' ? TEAM_BASISTARIEF_JAARLIJKS : TEAM_BASISTARIEF_MAANDELIJKS
  const perGebruiker = cyclus === 'jaarlijks' ? TEAM_PRIJS_PER_GEBRUIKER_JAARLIJKS : TEAM_PRIJS_PER_GEBRUIKER_MAANDELIJKS
  return basis + gebruikers * perGebruiker
}

export function teamPrijsWeergave(gebruikers: number, cyclus: Cyclus = 'maandelijks'): string {
  const prijs = berekenTeamPrijsPerMaand(gebruikers, cyclus)
  if (prijs === null) return `Vanaf ${TEAM_MIN_GEBRUIKERS} gebruikers`
  return cyclus === 'jaarlijks'
    ? `€${prijs}/maand-equivalent, €${prijs * 12} per jaar vooruit (excl. btw)`
    : `€${prijs} per maand (excl. btw)`
}
