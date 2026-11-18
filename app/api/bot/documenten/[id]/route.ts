import { NextRequest, NextResponse } from 'next/server'
import { documentenDb, documentenGebruiker, statusVoorFout } from '@/lib/documentenApi'
import { hernoemDocument, verwijderDocument } from '@/lib/documenten'

type Ctx = { params: Promise<{ id: string }> }

// Hernoemt een bewaard document. De extensie blijft staan, de naam gaat door dezelfde opschoning als bij de upload.
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const g = await documentenGebruiker()
  if ('fout' in g) return g.fout
  const { id } = await params
  const body = await req.json().catch(() => null)
  const r = await hernoemDocument(documentenDb, g.userId, id, body?.naam)
  if (r.error) return NextResponse.json({ error: r.error }, { status: statusVoorFout(r.error) })
  return NextResponse.json({ ok: true, naam: r.naam })
}

// Verwijdert één document: eerst het bestand, dan de rij.
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const g = await documentenGebruiker()
  if ('fout' in g) return g.fout
  const { id } = await params
  const r = await verwijderDocument(documentenDb, g.userId, id)
  if (r.error) return NextResponse.json({ error: r.error }, { status: statusVoorFout(r.error) })
  return NextResponse.json({ ok: true })
}
