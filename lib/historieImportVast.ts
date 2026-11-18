// De vaste, veilige delen van de import (docs/HISTORIE_IMPORT_PLAN.md): bronnen, kopjes, grenzen, de vraag en de links. Bewust zonder
// enige serverimport: dit bestand wordt ook in de browser gebruikt (app/bot/analyses/HistorieImportBlok.tsx), en lib/historieImportRegels.ts
// haalt de lijst met interne testaccounts binnen, die nooit in een clientbundel mag komen.

export type ImportBron = 'chatgpt' | 'claude' | 'gemini' | 'anders'
export const IMPORT_BRONNEN: readonly ImportBron[] = ['chatgpt', 'claude', 'gemini', 'anders']
export function isImportBron(x: unknown): x is ImportBron {
  return typeof x === 'string' && (IMPORT_BRONNEN as readonly string[]).includes(x)
}
export const BRON_NAAM: Record<ImportBron, string> = { chatgpt: 'ChatGPT', claude: 'Claude', gemini: 'Gemini', anders: 'een andere AI' }

export const KOPJES = [
  { sleutel: 'bedrijf', label: 'MIJN BEDRIJF, PRODUCT EN MARKT' },
  { sleutel: 'klanten', label: 'MIJN KLANTEN EN LOPENDE SITUATIES' },
  { sleutel: 'plannen', label: 'MIJN PLANNEN EN DOELEN' },
  { sleutel: 'uitdagingen', label: 'WAAR IK MEE WORSTEL' },
] as const
export type KopjeSleutel = typeof KOPJES[number]['sleutel']
export type ImportProfiel = Record<KopjeSleutel, string[]>

// Grenzen. De invoergrens wordt gecontroleerd vóór de limiter en vóór het model (de limiter is fail-open bij een Upstash-storing).
export const MAX_INVOER_TEKENS = 20000
export const MAX_REGELS_PER_KOPJE = 10
export const MAX_TEKENS_REGEL = 240
// Per profiel (een bron) en in totaal in de chat. Een rijk antwoord van een andere AI is ongeveer 6.000 tekens (Arno, 2026-11-18: niet
// terugbrengen tot een willekeurige grens). Het blok gaat bij elk bericht mee en mag het gesprek zelf niet overstemmen.
export const MAX_BLOK_TEKENS = 6800
export const MAX_BLOK_TOTAAL = 12000
// Per kopje een eigen tekenbudget, zodat elk kopje in het blok past en de gebruiker bij het controleren precies ziet wat ArnoBot krijgt.
// Vier kopjes van 1.500 tekens plus kop, labels en einde blijven onder MAX_BLOK_TEKENS.
export const MAX_TEKENS_PER_KOPJE = 1500

/** De vraag die de gebruiker in zijn andere AI stuurt. Eén bron, voor de link én voor KOPIEER VRAAG. */
export const HISTORIE_VRAAG = `Ik neem mijn werk als verkoper mee naar een andere assistent. Gebruik alleen wat je echt van me weet uit je geheugen of eerdere gesprekken. Heb je niets van me opgeslagen, zeg dat dan in één zin en stop. Verzin niets, schrijf geen vermoedens als feiten (zet "vermoeden:" ervoor) en laat een kopje leeg als je niets weet. Alleen werk, niets privés. Geen advies. Geen e-mailadressen of telefoonnummers van klanten.

1. ${KOPJES[0].label}
2. ${KOPJES[1].label} (met namen van bedrijven en cijfers waar je die kent)
3. ${KOPJES[2].label} (ook of eerdere plannen zijn gehaald)
4. ${KOPJES[3].label}

Maximaal 600 woorden.`

/**
 * Een link die de andere AI opent met de vraag al ingevuld. Of de vooraf ingevulde vraag werkt is nog niet in een echte browser
 * gecontroleerd (zie "Nog te testen" in het plan); de pagina kopieert de vraag daarom altijd ook naar het klembord.
 */
export function bouwVraagLink(bron: 'chatgpt' | 'claude' | 'gemini'): string {
  // Gemini kent geen vooraf ingevulde vraag via een link (geen officiële bron gevonden): de knop opent alleen Gemini en de vraag staat op het klembord.
  if (bron === 'gemini') return 'https://gemini.google.com/app'
  const q = encodeURIComponent(HISTORIE_VRAAG)
  return bron === 'chatgpt' ? `https://chatgpt.com/?q=${q}` : `https://claude.ai/new?q=${q}`
}
