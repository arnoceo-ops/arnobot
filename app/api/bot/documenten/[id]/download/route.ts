import { NextRequest, NextResponse } from 'next/server'
import { documentenDb, documentenGebruiker } from '@/lib/documentenApi'
import { downloadBewaardDocument } from '@/lib/documenten'

type Ctx = { params: Promise<{ id: string }> }

// Alleen bestandstypen die de chat zelf accepteert; al het andere wordt als onbekend binair bestand uitgeleverd.
const TOEGESTANE_TYPES = new Set([
  'application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/gif',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'text/csv',
])

// Levert een bewaard document aan de eigenaar, altijd als download en nooit inline: een document van een gebruiker
// mag onder ons eigen domein niet als pagina worden uitgevoerd. Geen lange signed URL: de eigenaarscheck gebeurt hier.
export async function GET(_req: NextRequest, { params }: Ctx) {
  const g = await documentenGebruiker()
  if ('fout' in g) return g.fout
  const { id } = await params
  const doc = await downloadBewaardDocument(documentenDb, g.userId, id)
  if (!doc) return NextResponse.json({ error: 'niet_gevonden' }, { status: 404 })

  const ascii = doc.naam.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_')
  return new NextResponse(new Uint8Array(doc.buffer), {
    status: 200,
    headers: {
      'Content-Type': TOEGESTANE_TYPES.has(doc.mediaType) ? doc.mediaType : 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(doc.naam)}`,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-store',
    },
  })
}
