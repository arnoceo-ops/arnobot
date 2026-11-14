// Ontwikkelpunten in arnobot_coaching(_history) komen in twee vormen voor: oude rapportages
// hebben een lijst losse strings, nieuwe een lijst objecten { tekst, pijlar }. Wie ze rechtstreeks
// in een template of prompt zet, krijgt "[object Object]" (objecten) of "[undefined] undefined"
// (strings door een `p.tekst`-lezing). Alle weergave en promptopbouw loopt daarom hierlangs.

export type Ontwikkelpunt = string | { tekst?: string; pijlar?: string }

export function ontwikkelpuntTekst(p: Ontwikkelpunt | null | undefined): { tekst: string; pijlar: string } {
  if (p == null) return { tekst: '', pijlar: '' }
  if (typeof p === 'string') return { tekst: p, pijlar: '' }
  return { tekst: p.tekst ?? '', pijlar: p.pijlar ?? '' }
}

/** "[pijlar] tekst" per punt (zonder haakjes als de pijlar ontbreekt), aan elkaar met `scheiding`. */
export function ontwikkelpuntenAlsTekst(
  punten: Ontwikkelpunt[] | null | undefined,
  scheiding = ' | ',
): string {
  return (punten ?? [])
    .map(ontwikkelpuntTekst)
    .filter(p => p.tekst)
    .map(p => (p.pijlar ? `[${p.pijlar}] ${p.tekst}` : p.tekst))
    .join(scheiding)
}
