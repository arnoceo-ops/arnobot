// Regels voor bewaarde en tijdelijke documenten (docs/DOCUMENTEN_PLAN.md). Bewust zonder
// databasetoegang, zodat alles hier met gewone unit-tests te toetsen is. De databasecode volgt in
// lib/documenten.ts.
import { isInternalTestUser } from '@/lib/internalTestAccounts'

export const DOCUMENTEN_BUCKET = 'arnobot-documenten'

// Een tijdelijke kopie leeft tot laatst gebruikt plus 48 uur. Dat is dezelfde grens waarop de app een
// gesprek als verouderd behandelt (lib/geheugenContext.ts en app/bot/SparClient.tsx): bij een kortere
// levensduur verdwijnt een document midden in een gesprek dat de app nog als lopend ziet.
export const DOCUMENT_LEVENSDUUR_MS = 48 * 60 * 60 * 1000

export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024
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
): { gekozen: T[]; afgevallen: T[] } {
  const opVolgorde = [...documenten].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at))
  if (opVolgorde.length <= max) return { gekozen: opVolgorde, afgevallen: [] }
  const grens = opVolgorde.length - max
  return { gekozen: opVolgorde.slice(grens), afgevallen: opVolgorde.slice(0, grens) }
}
