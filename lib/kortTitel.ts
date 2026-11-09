// Gesprekstitels worden bij het opslaan hard op 100 tekens afgekapt (session-end en sessions
// route). Bij weergave knippen we daarom bij het laatste hele woord en zetten we "…" erachter.
// Titels korter dan de opslaglimiet zijn compleet en blijven ongewijzigd.
export const TITEL_OPSLAGLIMIET = 100

export function kortTitel(titel: string | null | undefined): string {
  const t = (titel ?? '').trim()
  if (t.length < TITEL_OPSLAGLIMIET) return t
  const laatsteSpatie = t.search(/\s\S*$/)
  const knip = laatsteSpatie > 0 ? t.slice(0, laatsteSpatie) : t
  return knip.replace(/[\s,;:.\-]+$/, '') + '…'
}
