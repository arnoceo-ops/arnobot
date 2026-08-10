// Vlak Team-tarief (besloten 2026-08-02, zie docs/PRICING_DECISIONS.md): €97/maand
// platformtarief (manager) + €49 per gebruiker/maand, geen staffelkorting, geen niveau-
// keuze (elk teamlid krijgt volledige Pro-functionaliteit), vanaf 3 gebruikers, uitsluitend
// maandelijks (teamgrootte fluctueert, jaarcontract past daar niet bij zonder betaalprovider).
export const TEAM_BASISTARIEF = 97
export const TEAM_PRIJS_PER_GEBRUIKER = 49
export const TEAM_MIN_GEBRUIKERS = 3

export function berekenTeamPrijsPerMaand(gebruikers: number): number | null {
  if (!Number.isFinite(gebruikers) || gebruikers < TEAM_MIN_GEBRUIKERS) return null
  return TEAM_BASISTARIEF + gebruikers * TEAM_PRIJS_PER_GEBRUIKER
}

export function teamPrijsWeergave(gebruikers: number): string {
  const prijs = berekenTeamPrijsPerMaand(gebruikers)
  if (prijs === null) return `Vanaf ${TEAM_MIN_GEBRUIKERS} gebruikers`
  return `€${prijs} per maand (excl. btw)`
}
