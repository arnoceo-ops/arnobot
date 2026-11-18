// Telt de pagina's van een PDF, voor de paginagrens (MAX_PDF_PAGINAS in lib/documentenRegels.ts).
// Geeft null als het tellen mislukt: de aanroeper laat het bestand dan door (een kapotte teller mag geen upload blokkeren) en de fout gaat naar Sentry.
import * as Sentry from '@sentry/nextjs'

export async function telPdfPaginas(buffer: Buffer): Promise<number | null> {
  try {
    const { PDFParse } = await import('pdf-parse')
    const parser = new PDFParse({ data: new Uint8Array(buffer) })
    try {
      const info = await parser.getInfo()
      return typeof info.total === 'number' && info.total > 0 ? info.total : null
    } finally {
      await parser.destroy().catch(() => {})
    }
  } catch (e) {
    Sentry.captureException(e, { tags: { onderdeel: 'pdf-paginas-tellen' }, level: 'warning' })
    return null
  }
}
