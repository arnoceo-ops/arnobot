// Regels voor bewaarde en tijdelijke documenten (docs/DOCUMENTEN_PLAN.md). Bewust zonder
// databasetoegang, zodat alles hier met gewone unit-tests te toetsen is. De databasecode volgt in
// lib/documenten.ts.
import { isInternalTestUser } from '@/lib/internalTestAccounts'

export const DOCUMENTEN_BUCKET = 'arnobot-documenten'

// Een tijdelijke kopie leeft tot laatst gebruikt plus 48 uur. Dat is dezelfde grens waarop de app een
// gesprek als verouderd behandelt (lib/geheugenContext.ts en app/bot/SparClient.tsx): bij een kortere
// levensduur verdwijnt een document midden in een gesprek dat de app nog als lopend ziet.
export const DOCUMENT_LEVENSDUUR_MS = 48 * 60 * 60 * 1000

// Per type een grens. Een afbeelding mag bij Anthropic niet groter zijn dan 10 MB (bron: platform.claude.com/docs/en/build-with-claude/vision,
// gelezen 2026-11-18); PDF, Word en tekst mogen tot 20 MB. De bucket arnobot-documenten heeft dezelfde bovengrens (docs/sql/2026-11-18-documenten-bucket-20mb.sql).
export const MAX_AFBEELDING_BYTES = 10 * 1024 * 1024
export const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024
export function maxBytesVoor(mediaType: string): number {
  return mediaType.startsWith('image/') ? MAX_AFBEELDING_BYTES : MAX_DOCUMENT_BYTES
}
// Totaal aan bestanden per beurt: elk bestand gaat als base64 mee (een derde groter) en een Anthropic-aanvraag mag 128 MB zijn
// (bron: platform.claude.com/docs/en/build-with-claude/pdf-support, gelezen 2026-11-18). 60 MB aan bestanden blijft daar ruim onder.
export const MAX_BYTES_PER_BEURT = 60 * 1024 * 1024
// Een PDF kost ruwweg 1.500 tot 3.000 tokens per pagina (tekst en paginabeeld). Bij elke beurt gaat het hele bestand opnieuw mee, dus een boek zou het
// contextvenster van 1 miljoen tokens vullen en het gesprek vastzetten. Besluit Arno 2026-11-18: 100 pagina's per PDF.
export const MAX_PDF_PAGINAS = 100
// Meer dan 20 afbeeldings- en documentblokken per verzoek valt onder strengere limieten bij Anthropic
// (bron: platform.claude.com/docs/en/build-with-claude/vision, gelezen 2026-11-18).
export const MAX_DOCUMENTEN_PER_BEURT = 20
export const MAX_BESTANDSNAAM_TEKENS = 120

/**
 * Wie de nieuwe documentenfunctie gebruikt: iedereen na DOCUMENTEN_OPEN=true, daarvoor alleen de
 * interne testaccounts en de eigenaar (zelfde patroon als herroepingBeschikbaarVoor). Geldt voor de pagina
 * én voor het gedrag van de chatroute: wie hier false krijgt, houdt het oude gedrag.
 */
export function documentenBeschikbaarVoor(userId: string | null | undefined): boolean {
  if (!userId) return false
  if (process.env.DOCUMENTEN_OPEN === 'true') return true
  if (isInternalTestUser(userId)) return true
  const eigenaar = process.env.ARNOBOT_OWNER_USER_ID
  return !!eigenaar && eigenaar === userId
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** Een document-ID komt uit de client en is dus nooit te vertrouwen: alleen een echte UUID, nooit een pad. */
export function isGeldigDocumentId(id: unknown): id is string {
  return typeof id === 'string' && UUID_RE.test(id)
}

const PAD_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(pdf|png|jpg|webp|gif|docx|txt|csv)$/i

/**
 * Een opslagpad moet precies de vorm `<userId>/<uuid>.<extensie>` hebben, met het eigen userId. Een pad uit
 * een request is nooit te vertrouwen: dit weigert ook `../`, extra mappen en andermans prefix.
 */
export function isGeldigDocumentPad(userId: string, pad: unknown): pad is string {
  if (typeof pad !== 'string' || !userId) return false
  if (!pad.startsWith(`${userId}/`)) return false
  return PAD_RE.test(pad.slice(userId.length + 1))
}

/**
 * De bestandsnaam komt in de prompt en in de lijst met documenten. Stuurtekens en regeleinden weg
 * (anders kan een naam een nep-kop in de prompt zetten), haakjes die als markering kunnen dienen weg,
 * kappen op MAX_BESTANDSNAAM_TEKENS met behoud van de extensie.
 */
export function schoneBestandsnaam(naam: unknown): string {
  let s = typeof naam === 'string' ? naam : ''
  // Geen regex met stuurtekens: de tekens zelf (ook U+2028 en U+2029) horen niet letterlijk in de broncode.
  s = Array.from(s)
    .map(ch => {
      const c = ch.charCodeAt(0)
      return c < 32 || c === 127 || c === 0x2028 || c === 0x2029 ? ' ' : ch
    })
    .join('')
  s = s.replace(/[[\]{}<>]/g, '')
  s = s.replace(/\s+/g, ' ').trim()
  if (s.length > MAX_BESTANDSNAAM_TEKENS) {
    const punt = s.lastIndexOf('.')
    const ext = punt > 0 && s.length - punt <= 8 ? s.slice(punt) : ''
    s = s.slice(0, MAX_BESTANDSNAAM_TEKENS - ext.length).trimEnd() + ext
  }
  return s || 'document'
}

export function verloopOp(laatstGebruikt: Date): Date {
  return new Date(laatstGebruikt.getTime() + DOCUMENT_LEVENSDUUR_MS)
}

/** Een bewaard document (geen verloopmoment) verloopt nooit. */
export function isVerlopen(verlooptOp: string | Date | null | undefined, nu: Date = new Date()): boolean {
  if (!verlooptOp) return false
  return new Date(verlooptOp).getTime() <= nu.getTime()
}

/**
 * Kiest welke documenten in één beurt meegaan: maximaal `max`, het oudste valt af. De gekozen lijst blijft
 * in uploadvolgorde staan, zodat het begin van het bericht van beurt tot beurt hetzelfde is (nodig voor
 * prompt caching). De namen van wat afvalt gaan als melding naar het model.
 */
export function kiesDocumentenVoorBeurt<T extends { naam: string; created_at: string }>(
  documenten: T[],
  max: number = MAX_DOCUMENTEN_PER_BEURT,
  opties?: { gewicht: (d: T) => number; maxGewicht: number },
): { gekozen: T[]; afgevallen: T[] } {
  const gekozen = [...documenten].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at))
  const afgevallen: T[] = []
  const som = () => (opties ? gekozen.reduce((t, d) => t + opties.gewicht(d), 0) : 0)
  // Het oudste valt eerst af; het nieuwste document blijft altijd staan (elk afzonderlijk bestand blijft binnen zijn eigen grens).
  while (gekozen.length > 1 && (gekozen.length > max || (opties !== undefined && som() > opties.maxGewicht))) {
    afgevallen.push(gekozen.shift() as T)
  }
  return { gekozen, afgevallen }
}

// Voorlopige grenzen voor bewaarde documenten per gebruiker (alleen wat in Docs staat; tijdelijke kopieën verlopen vanzelf).
// De cijfers zijn plaatshouders uit de mockup: het besluit over de echte grenzen per plan ligt bij Arno
// (docs/DOCUMENTEN_PLAN.md, open besluit 3).
export const QUOTA_MAX_DOCUMENTEN = 50
export const QUOTA_MAX_BYTES = 500 * 1024 * 1024

/** Een sessie-ID komt uit de client; alleen tekens die in een echt ID voorkomen, nooit iets dat een query kan beïnvloeden. */
export function isGeldigSessieId(id: unknown): id is string {
  return typeof id === 'string' && /^[A-Za-z0-9_.:-]{1,100}$/.test(id)
}

/**
 * De nieuwe naam van een document: dezelfde opschoning als bij de upload, met behoud van de oorspronkelijke extensie
 * (zodat naam en bestandstype niet uit elkaar lopen). Typt de gebruiker de extensie zelf mee, dan komt die niet dubbel.
 * Geeft null bij een lege invoer.
 */
export function hernoemMetBehoudExtensie(oudeNaam: string, invoer: unknown): string | null {
  if (typeof invoer !== 'string' || invoer.trim() === '') return null
  const punt = oudeNaam.lastIndexOf('.')
  const ext = punt > 0 && oudeNaam.length - punt <= 8 ? oudeNaam.slice(punt) : ''
  let basis = invoer.trim()
  if (ext && basis.toLowerCase().endsWith(ext.toLowerCase())) basis = basis.slice(0, basis.length - ext.length).trimEnd()
  if (basis === '') return null
  return schoneBestandsnaam(basis + ext)
}
