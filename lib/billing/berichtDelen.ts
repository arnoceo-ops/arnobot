/** Telegram weigert berichten boven 4096 tekens. */
export const MAX_TELEGRAM_TEKENS = 3900

/**
 * Verdeelt losse alinea's over zo weinig mogelijk berichten onder de grens. Elk bericht krijgt de kop, het laatste de
 * voet. Er valt niets weg, alleen een alinea die zelf te lang is wordt ingekort.
 */
export function splitsBericht(kop: string, alineas: string[], voet: string, max: number = MAX_TELEGRAM_TEKENS): string[] {
  const ruimte = max - kop.length - voet.length - 4
  const delen: string[] = []
  let huidig = ''
  for (const ruw of alineas) {
    const alinea = ruw.length > ruimte ? `${ruw.slice(0, ruimte - 3)}...` : ruw
    if (huidig && huidig.length + 2 + alinea.length > ruimte) {
      delen.push(huidig)
      huidig = alinea
    } else {
      huidig = huidig ? `${huidig}\n\n${alinea}` : alinea
    }
  }
  if (huidig) delen.push(huidig)
  return delen.map((d, i) => `${kop}\n\n${d}${i === delen.length - 1 ? `\n\n${voet}` : ''}`)
}
