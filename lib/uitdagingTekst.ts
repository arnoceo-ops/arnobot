// Hulpfuncties voor de "thought of the day" (app/api/bot/uitdaging/route.ts): de beperking zit
// in het aantal woorden (maximaal 50, ongeveer vier regels), niet in het aantal tokens. Een
// tokengrens kapte de gedachte midden in een zin af.

export const MAX_WOORDEN = 50
/** Kleine marge boven het maximum voordat het antwoord als te lang telt. */
export const WOORDEN_MARGE = 5

export function aantalWoorden(tekst: string): number {
  return tekst.split(/\s+/).filter(Boolean).length
}

export function isTeLang(tekst: string): boolean {
  return aantalWoorden(tekst) > MAX_WOORDEN + WOORDEN_MARGE
}

/**
 * Knipt een te lange tekst terug tot hele zinnen die samen binnen het maximum passen. Past zelfs
 * de eerste zin niet, dan blijft die staan: liever één lange zin dan een halve.
 */
export function knipOpZin(tekst: string, max: number = MAX_WOORDEN): string {
  const zinnen = tekst.match(/[^.!?]+[.!?]+(\s+|$)|[^.!?]+$/g)?.map(z => z.trim()).filter(Boolean) ?? [tekst]
  let resultaat = ''
  for (const zin of zinnen) {
    const kandidaat = resultaat ? `${resultaat} ${zin}` : zin
    if (resultaat && aantalWoorden(kandidaat) > max) break
    resultaat = kandidaat
  }
  return resultaat
}
