export type Cyclus = 'maandelijks' | 'jaarlijks'

const SCHIJVEN = [
  { tot: 5, prijs: 97 },
  { tot: 10, prijs: 87 },
  { tot: 20, prijs: 77 },
]

// Gestaffeld/marginaal, zoals belastingschijven: alleen de seats bínnen een
// bandbreedte krijgen dat tarief, niet alle seats zodra een drempel wordt
// overschreden. Voorkomt dat een seat erbij het totaal juist verlaagt.
export function berekenCommandPrijsPerMaand(seats: number): number | null {
  if (!Number.isFinite(seats) || seats < 2) return null
  if (seats > 20) return null

  let totaal = 0
  let resterend = seats
  let vorige = 0
  for (const schijf of SCHIJVEN) {
    const inDezeSchijf = Math.min(resterend, schijf.tot - vorige)
    if (inDezeSchijf > 0) totaal += inDezeSchijf * schijf.prijs
    resterend -= inDezeSchijf
    vorige = schijf.tot
    if (resterend <= 0) break
  }
  return totaal
}

export function berekenCommandPrijs(seats: number, cyclus: Cyclus): number | null {
  const perMaand = berekenCommandPrijsPerMaand(seats)
  if (perMaand === null) return null
  return cyclus === 'jaarlijks' ? perMaand * 8 : perMaand
}
