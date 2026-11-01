// Deterministisch vangnet op opgeslagen antwoorden (cron/feitencontrole): klopt elke som die het antwoord
// zelf opschrijft, en spreekt het antwoord de gebruiker aan met "u"? De rekentool (lib/rekenTool.ts) moet
// rekenfouten voorkomen, dit vangt wat toch door komt, zonder modelkosten.

export type FouteSom = { tekst: string; juist: number }

function parseGetal(s: string): number {
  // Nederlandse notatie: 10.350 of 10.350,50. Een enkele punt met niet precies 3 cijfers erna is een decimaal.
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) return Number(s.replace(/\./g, '').replace(',', '.'))
  return Number(s.replace(',', '.'))
}

const GETAL = '(\\d[\\d.,]*\\d|\\d)'
const OP = '(?:×|x|\\*|maal|keer|tegen|\\+|plus|/|gedeeld door)'
// "a [m2] OP [euro] b [euro] [(toelichting)] = c"
// De lookbehind slaat een som over die midden in een langere keten staat ("a + b + c = d" is geen "b + c = d").
const SOM = new RegExp(`(?<![\\d.,])(?<![\\d)]\\s*${OP}\\s*(?:€\\s*)?)${GETAL}\\s*(?:m2|m²|euro|€)?\\s*(${OP})\\s*(?:€\\s*)?${GETAL}\\s*(?:euro|m2|m²)?\\s*(?:\\([^)]*\\)\\s*)?=\\s*(?:€\\s*)?${GETAL}`, 'gi')

export function vindFouteSommen(antwoord: string): FouteSom[] {
  const fouten: FouteSom[] = []
  for (const m of antwoord.matchAll(SOM)) {
    const a = parseGetal(m[1])
    const b = parseGetal(m[3])
    const c = parseGetal(m[4])
    if (![a, b, c].every(Number.isFinite)) continue
    const op = m[2].toLowerCase()
    const juist = op === '+' || op === 'plus' ? a + b : op === '/' || op === 'gedeeld door' ? (b === 0 ? NaN : a / b) : a * b
    if (!Number.isFinite(juist)) continue
    if (Math.abs(juist - c) > Math.max(1, Math.abs(c) * 0.005)) fouten.push({ tekst: m[0].replace(/\s+/g, ' ').slice(0, 120), juist: Number(juist.toPrecision(12)) })
  }
  return fouten
}

// "u" als aanspreekvorm. Alleen eenduidige combinaties, geen losse "u" (komt ook voor in citaten of namen).
const U_VORM = /\b(bent u|heeft u|kunt u|wilt u|zou u|mag u|moet u|weet u|ziet u|hebt u|uw|u bent|u heeft|u kunt|u wilt|u hebt|u moet|u zou)\b/i

export function vindUVorm(antwoord: string): string | null {
  const m = antwoord.match(new RegExp(`.{0,40}${U_VORM.source}.{0,30}`, 'i'))
  return m ? m[0].replace(/\s+/g, ' ') : null
}
