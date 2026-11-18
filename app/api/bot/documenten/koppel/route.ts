import { NextRequest, NextResponse } from 'next/server'
import { documentenDb, documentenGebruiker, statusVoorFout } from '@/lib/documentenApi'
import { koppelDocument, ontkoppelDocument } from '@/lib/documenten'

// Koppelt een bewaard document uit Docs aan het gesprek waarin de gebruiker bezig is ("kies uit Docs" en BESPREEK),
// zodat ArnoBot het vanaf het volgende bericht leest. Alleen eigen, bewaarde documenten.
export async function POST(req: NextRequest) {
  const g = await documentenGebruiker()
  if ('fout' in g) return g.fout
  const body = await req.json().catch(() => null)
  const r = await koppelDocument(documentenDb, g.userId, body?.documentId, body?.sessionId)
  if (r.error) return NextResponse.json({ error: r.error }, { status: statusVoorFout(r.error) })
  return NextResponse.json({ ok: true, document: r.document })
}

// Haalt de koppeling weg (het kruisje bij het document boven het invoerveld). Het document zelf blijft in Docs staan.
export async function DELETE(req: NextRequest) {
  const g = await documentenGebruiker()
  if ('fout' in g) return g.fout
  const p = req.nextUrl.searchParams
  const r = await ontkoppelDocument(documentenDb, g.userId, p.get('documentId'), p.get('sessionId'))
  if (r.error) return NextResponse.json({ error: r.error }, { status: statusVoorFout(r.error) })
  return NextResponse.json({ ok: true })
}
