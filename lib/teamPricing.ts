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
/**
 * Minimum om zelf aan te melden of te activeren: de manager plus dit aantal teamleden (besloten 2026-11-26). De manager zit in
 * het basistarief en telt nergens mee als teamlid. De prijsberekening hieronder kent dit minimum bewust niet: Arno kan een
 * kleiner team instellen, en dat krijgt gewoon de formule.
 */
export const TEAM_MIN_TEAMLEDEN = 3
/**
 * Meer teamleden dan dit kunnen niet aansluiten (uitnodiging) en dus ook niet zelf activeren: niemand betaalt voor een
 * teamlid dat er niet bij kan. Een groter team vraagt een aanpassing, zie docs/TEAM_PROCES.md.
 */
export const TEAM_MAX_TEAMLEDEN = 25
export const TEAM_KLEIN_TEKST = `Team is er vanaf een manager en ${TEAM_MIN_TEAMLEDEN} teamleden. Begin je kleiner, bijvoorbeeld als startup met 2 teamleden? Neem dan contact op via team@arno.bot.`

// Elite-surplus binnen een Team-aanvraag (besloten 2026-08-11, zie
// docs/PRICING_DECISIONS.md): Elite is geen publieke keuze meer, maar Arno
// wil het nog wel kunnen aanbieden binnen een Team-offerte, uitgevoerd door
// hemzelf of een door hem aangewezen coach. Surplus = exact het verschil
// tussen solo Elite (€397/maand) en solo Pro (€59/maand) = €338/maand extra
// per Elite-teamlid, bovenop het gewone Team-per-gebruikertarief. Bewust
// geen aparte jaarkorting op dit bedrag (Elite zelf heeft geen jaarprijs):
// hetzelfde surplus geldt ongeacht de gekozen Team-facturatiecyclus.
export const TEAM_ELITE_SURPLUS_PER_MAAND = 338

/** Maandprijs voor de manager plus `teamleden` (zonder de manager). Null alleen bij een onmogelijk aantal. */
export function berekenTeamPrijsPerMaand(teamleden: number, cyclus: Cyclus = 'maandelijks'): number | null {
  if (!Number.isInteger(teamleden) || teamleden < 1) return null
  const basis = cyclus === 'jaarlijks' ? TEAM_BASISTARIEF_JAARLIJKS : TEAM_BASISTARIEF_MAANDELIJKS
  const perGebruiker = cyclus === 'jaarlijks' ? TEAM_PRIJS_PER_GEBRUIKER_JAARLIJKS : TEAM_PRIJS_PER_GEBRUIKER_MAANDELIJKS
  return basis + teamleden * perGebruiker
}

/** Als hierboven, maar voor alles wat met geld rekent: een onmogelijk aantal is een fout, nooit stilletjes 0 euro. */
export function teamPrijsPerMaandStrikt(teamleden: number, cyclus: Cyclus): number {
  const prijs = berekenTeamPrijsPerMaand(teamleden, cyclus)
  if (prijs === null) throw new Error(`geen teamprijs bij ${teamleden} teamleden`)
  return prijs
}

export function teamPrijsWeergave(teamleden: number, cyclus: Cyclus = 'maandelijks'): string {
  const prijs = berekenTeamPrijsPerMaand(teamleden, cyclus)
  if (prijs === null) return `Vanaf ${TEAM_MIN_TEAMLEDEN} teamleden`
  return cyclus === 'jaarlijks'
    ? `€${prijs}/maand-equivalent, €${prijs * 12} per jaar vooruit (excl. BTW)`
    : `€${prijs} per maand (excl. BTW)`
}
