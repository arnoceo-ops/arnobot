// De vaste, veilige delen van de import (docs/HISTORIE_IMPORT_PLAN.md): bronnen, kopjes, grenzen, de vraag en de links. Bewust zonder
// enige serverimport: dit bestand wordt ook in de browser gebruikt (app/bot/analyses/HistorieImportBlok.tsx), en lib/historieImportRegels.ts
// haalt de lijst met interne testaccounts binnen, die nooit in een clientbundel mag komen.

export type ImportBron = 'chatgpt' | 'claude' | 'anders'
export const IMPORT_BRONNEN: readonly ImportBron[] = ['chatgpt', 'claude', 'anders']
export function isImportBron(x: unknown): x is ImportBron {
  return typeof x === 'string' && (IMPORT_BRONNEN as readonly string[]).includes(x)
}
export const BRON_NAAM: Record<ImportBron, string> = { chatgpt: 'ChatGPT', claude: 'Claude', anders: 'een andere AI' }

export const KOPJES = [
  { sleutel: 'bedrijf', label: 'MIJN BEDRIJF, PRODUCT EN MARKT' },
  { sleutel: 'klanten', label: 'MIJN KLANTEN EN LOPENDE SITUATIES' },
  { sleutel: 'plannen', label: 'MIJN PLANNEN EN DOELEN' },
  { sleutel: 'uitdagingen', label: 'WAT MIJN GROOTSTE UITDAGINGEN ZIJN' },
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

/** De rol uit het ArnoBot-profiel van de gebruiker, schoongemaakt voor in de vraag. Null als er geen bruikbare rol is. */
export function schoneRol(rol: unknown): string | null {
  if (typeof rol !== 'string') return null
  const s = rol.replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60).trim()
  if (s.length < 2 || /^(onbekend|n\.?v\.?t\.?|geen)$/i.test(s)) return null
  return s
}

/** De vraag die de gebruiker in zijn andere AI stuurt. Eén bron, voor de link én voor KOPIEER DE VRAAG. Met de rol uit het profiel als die bekend is. */
export function bouwHistorieVraag(rol?: unknown): string {
  const r = schoneRol(rol)
  return `Ik neem mijn werk${r ? ` als ${r}` : ''} mee naar een andere assistent. Doorzoek je geheugen en al je eerdere gesprekken met mij en vat samen wat je van me weet. Gebruik alleen wat je echt weet. Heb je niets van me opgeslagen, zeg dat dan in één zin en stop. Verzin niets en schrijf een vermoeden nooit als feit (zet "vermoeden:" ervoor). Laat een kopje leeg als je niets weet.

Schrijf per kopje korte regels, één feit per regel, zonder inleiding of afsluiting. Noteer erbij van wanneer iets is, als je dat weet. Noem bedrijven met naam en personen alleen met hun functie. Geen e-mailadressen of telefoonnummers. Alleen werk: niets privés en niets over gezondheid, geloof of politiek. Geen advies en geen oordeel over mij, alleen feiten.

1. ${KOPJES[0].label} (wat ik verkoop, aan wie, dealgrootte, salescyclus, teamgrootte)
2. ${KOPJES[1].label} (met cijfers waar je die kent)
3. ${KOPJES[2].label} (ook of eerdere plannen zijn gehaald)
4. ${KOPJES[3].label}

Maximaal 800 woorden.`
}

/** De vraag zonder rol, voor tests en als er geen rol bekend is. */
export const HISTORIE_VRAAG = bouwHistorieVraag(null)

/**
 * Een link die de andere AI opent met de vraag al ingevuld. Of de vooraf ingevulde vraag werkt is nog niet in een echte browser
 * gecontroleerd (zie "Nog te testen" in het plan); de pagina kopieert de vraag daarom altijd ook naar het klembord.
 */
export function bouwVraagLink(bron: 'chatgpt' | 'claude', rol?: unknown): string {
  const q = encodeURIComponent(bouwHistorieVraag(rol))
  return bron === 'chatgpt' ? `https://chatgpt.com/?q=${q}` : `https://claude.ai/new?q=${q}`
}
