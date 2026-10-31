// Feitencontrole (2026-10-31): ArnoBot speelde een gebruiker "vier inkomstenbronnen" terug terwijl die er
// twee noemde. Een coach die feiten verkeerd terugspeelt verliest zijn gezag, en gebruikers haken af.
//
// Drie lagen, zonder vertraging in de chat (de chat streamt, een antwoord is al zichtbaar voor je het kunt
// controleren):
//   1. feitenRegel: voorwaardelijke promptregel bij berichten waarin de gebruiker veel feiten geeft
//   2. verdachteTellingen: deterministische controle op telwoorden die niet in het gesprek staan
//   3. cron/feitencontrole: dagelijks over de echte antwoorden, met een oordeel van Sonnet, melding via Telegram

const TELWOORDEN: Record<string, number> = {
  twee: 2, drie: 3, vier: 4, vijf: 5, zes: 6, zeven: 7, acht: 8, negen: 9, tien: 10, elf: 11, twaalf: 12,
}
const EENHEDEN = /^(%|procent|euro|uur|minuten|minuut|dagen|dag|weken|week|maanden|maand|jaar|jaren|keer|x)$/i

function waarden(tekst: string): Set<number> {
  const set = new Set<number>()
  for (const m of tekst.toLowerCase().matchAll(/\b[a-zà-ÿ]+\b/g)) {
    const n = TELWOORDEN[m[0]]
    if (n !== undefined) set.add(n)
  }
  for (const m of tekst.matchAll(/\b(\d{1,2})\b/g)) set.add(Number(m[1]))
  return set
}

// Aantallen (telwoorden en losse cijfers van 2 tot 12) in het antwoord die niet in de bronnen voorkomen.
// Een berekening of telling uit eigen woorden van de gebruiker kan hier ook in vallen: het is een
// voorselectie voor het oordeel van de cron, geen vonnis.
export function verdachteTellingen(antwoord: string, bronnen: string[]): string[] {
  const bekend = waarden(bronnen.join('\n'))
  const gevonden: string[] = []
  const woorden = antwoord.match(/[%\wà-ÿ]+/gi) ?? []
  for (let i = 0; i < woorden.length; i++) {
    const w = woorden[i].toLowerCase()
    let n: number | undefined = TELWOORDEN[w]
    if (n === undefined && /^\d{1,2}$/.test(w)) {
      n = Number(w)
      if (n < 2 || n > 12 || EENHEDEN.test(woorden[i + 1] ?? '')) continue
    }
    if (n === undefined || n > 12) continue
    if (!bekend.has(n)) gevonden.push(woorden[i])
  }
  return [...new Set(gevonden)]
}

// Alleen bij berichten met veel feiten (een briefing, cijfers): daar speelt ArnoBot terug en telt hij.
// Niet in de vaste persona, zodat gewone vragen niet verwateren (zie lib/mailPatroon.ts).
export function feitenRegel(vraag: string): string {
  const aantalGetallen = (vraag.match(/\d[\d.,]*/g) ?? []).length
  if (vraag.length < 350 && aantalGetallen < 2) return ''
  return '\n\nFEITEN TERUGGEVEN: geef wat de gebruiker vertelde alleen terug in zijn eigen woorden en zijn eigen getallen. Noem nooit een aantal (aantal bronnen, personen, doelen, stappen) dat hij niet zelf noemde, en tel niets zelf op. Een berekening met zijn eigen getallen mag, zeg er dan bij hoe je erbij komt. Twijfel je over een feit, vraag het.'
}
