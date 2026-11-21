// Telt de pagina's van een PDF, voor de paginagrens (MAX_PDF_PAGINAS in lib/documentenRegels.ts).
// Geeft null als het tellen mislukt: de aanroeper laat het bestand dan door (een kapotte teller mag geen upload blokkeren) en de fout gaat naar Sentry.
import * as Sentry from '@sentry/nextjs'

// pdf-parse draait op pdfjs, en die zoekt bij het laden DOMMatrix. Lokaal komt die uit @napi-rs/canvas, maar die ontbreekt op Vercel
// ("DOMMatrix is not defined", Sentry ARNO-BOT-1T, 18 en 19 november): het tellen faalde daar altijd en de paginagrens werkte dus niet.
// Tellen heeft geen DOMMatrix nodig, een lege klasse is genoeg om de module te laten laden (getest zonder canvas-module: 3 van 3 pagina's).
function zorgVoorDomMatrix(): void {
  const g = globalThis as { DOMMatrix?: unknown }
  if (typeof g.DOMMatrix === 'undefined') g.DOMMatrix = class DOMMatrix {}
}

export async function telPdfPaginas(buffer: Buffer): Promise<number | null> {
  try {
    zorgVoorDomMatrix()
    const { PDFParse } = await import('pdf-parse')
    const parser = new PDFParse({ data: new Uint8Array(buffer) })
    try {
      const info = await parser.getInfo()
      return typeof info.total === 'number' && info.total > 0 ? info.total : null
    } finally {
      await parser.destroy().catch(() => {})
    }
  } catch (e) {
    Sentry.captureException(e, { tags: { onderdeel: 'pdf-paginas-tellen' }, level: 'error' })
    return null
  }
}
