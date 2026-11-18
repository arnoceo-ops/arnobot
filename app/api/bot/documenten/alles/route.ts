import { NextResponse } from 'next/server'
import { documentenDb, documentenGebruiker, statusVoorFout } from '@/lib/documentenApi'
import { verwijderGebruikersDocumenten } from '@/lib/documenten'

// "Verwijder alles" in Docs en in het account: alle documenten van de gebruiker, bewaard en tijdelijk, met bestanden en koppelingen.
export async function DELETE() {
  const g = await documentenGebruiker()
  if ('fout' in g) return g.fout
  const r = await verwijderGebruikersDocumenten(documentenDb, g.userId)
  if (r.error) return NextResponse.json({ error: r.error }, { status: statusVoorFout(r.error) })
  return NextResponse.json({ ok: true, aantal: r.aantal })
}
