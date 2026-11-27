// Team-tarief (herzien 2026-11-26, zie docs/PRICING_DECISIONS.md): €97/maand
// voor de manager, inclusief eigen Pro, + €49 per teamlid per maand. Geen
// staffelkorting, geen niveau-keuze (elk teamlid krijgt volledige Pro).
// Jaarlijks vooruit: €77 + €33 per teamlid als maand-equivalent (dus €924 +
// €396 per teamlid per jaar). Een teamlid betaalt precies de solo Pro-prijs,
// per maand en per jaar; het managerbedrag is de prijs van de managerlaag.
// Zelf aanmelden vanaf een manager plus 3 teamleden.
//
// Extra teamleden tijdens een lopend jaarcontract: de cron maakt eenmalig een
// tussenfactuur naar rato (lib/billing/teamFacturatie.ts). Bij een maandteam
// tellen ze mee op de volgende factuur. Minder teamleden gaat pas in bij de
// verlenging, zonder terugbetaling. Facturen rekenen altijd met de bedragen
// hieronder, dus met de huidige prijslijst.
export type Cyclus = 'maandelijks' | 'jaarlijks'

export const TEAM_BASISTARIEF_MAANDELIJKS = 97
export const TEAM_BASISTARIEF_JAARLIJKS = 77
export const TEAM_PRIJS_PER_GEBRUIKER_MAANDELIJKS = 49
export const TEAM_PRIJS_PER_GEBRUIKER_JAARLIJKS = 33
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
export const TEAM_GROOT_TEKST = `Voor meer dan ${TEAM_MAX_TEAMLEDEN} teamleden: neem contact op via team@arno.bot.`
export const TEAM_KLEIN_TEKST = `Team is er vanaf een manager en ${TEAM_MIN_TEAMLEDEN} teamleden. Begin je kleiner, bijvoorbeeld als startup met 2 teamleden? Neem dan contact op via team@arno.bot.`

// Elite-surplus binnen een Team-aanvraag (besloten 2026-08-11, zie
// docs/PRICING_DECISIONS.md): Elite is geen publieke keuze meer, maar Arno
// wil het nog wel kunnen aanbieden binnen een Team-offerte, uitgevoerd door
// hemzelf of een door hem aangewezen coach. Surplus = exact het verschil
// tussen solo Elite (€397/maand) en de toenmalige solo Pro (€59/maand) = €338.
// Sinds 2026-11-26 een los vast bedrag (besluit: niet meebewegen met Pro), per
// maand extra per Elite-teamlid, bovenop het gewone Team-per-gebruikertarief. Bewust
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
