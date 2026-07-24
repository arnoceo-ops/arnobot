export type Cyclus = 'maandelijks' | 'jaarlijks'
export type CommandNiveau = 'premium' | 'elite'

// Premium-niveau: geanchored op de individuele Premium-prijs (€97), gestaffeld.
// Elite-niveau: vlak €397/seat, geen staffelkorting (besloten door Arno), en
// alleen maandelijks (zie de cyclus-check in app/api/command-aanvraag/route.ts).
const SCHIJVEN: Record<CommandNiveau, { tot: number; prijs: number }[]> = {
  premium: [
    { tot: 5, prijs: 97 },
    { tot: 10, prijs: 87 },
    { tot: 20, prijs: 77 },
  ],
  elite: [
    { tot: 20, prijs: 397 },
  ],
}

// Gestaffeld/marginaal, zoals belastingschijven: alleen de seats bínnen een
// bandbreedte krijgen dat tarief, niet alle seats zodra een drempel wordt
// overschreden. Voorkomt dat een seat erbij het totaal juist verlaagt.
export function berekenCommandPrijsPerMaand(seats: number, niveau: CommandNiveau = 'premium'): number | null {
  if (!Number.isFinite(seats) || seats < 2) return null
  if (seats > 20) return null

  let totaal = 0
  let resterend = seats
  let vorige = 0
  for (const schijf of SCHIJVEN[niveau]) {
    const inDezeSchijf = Math.min(resterend, schijf.tot - vorige)
    if (inDezeSchijf > 0) totaal += inDezeSchijf * schijf.prijs
    resterend -= inDezeSchijf
    vorige = schijf.tot
    if (resterend <= 0) break
  }
  return totaal
}

export function berekenCommandPrijs(seats: number, cyclus: Cyclus, niveau: CommandNiveau = 'premium'): number | null {
  const perMaand = berekenCommandPrijsPerMaand(seats, niveau)
  if (perMaand === null) return null
  return cyclus === 'jaarlijks' ? perMaand * 8 : perMaand
}
