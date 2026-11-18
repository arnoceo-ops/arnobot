import { NextRequest, NextResponse } from 'next/server'
import { historieImportDb, historieImportGebruiker } from '@/lib/historieImportApi'
import { bewaarProfiel, leesProfiel, verwijderProfiel } from '@/lib/historieImport'
import { isImportBron } from '@/lib/historieImportRegels'

// Het opgeslagen profiel uit een andere AI: lezen, het gecontroleerde voorstel opslaan (vervangt een eerder profiel) en verwijderen.

export async function GET() {
  const g = await historieImportGebruiker({ metToegangscontrole: false })
  if ('fout' in g) return g.fout
  const p = await leesProfiel(historieImportDb, g.userId)
  return NextResponse.json({ profiel: p })
}

export async function PUT(req: NextRequest) {
  const g = await historieImportGebruiker({ metToegangscontrole: true })
  if ('fout' in g) return g.fout
  const body = await req.json().catch(() => null) as { bron?: unknown; profiel?: unknown } | null
  if (!body || typeof body !== 'object' || !isImportBron(body.bron)) return NextResponse.json({ error: 'ongeldig' }, { status: 400 })
  const r = await bewaarProfiel(historieImportDb, g.userId, body.bron, body.profiel)
  if (r.error === 'ongeldig' || r.error === 'leeg') return NextResponse.json({ error: r.error }, { status: 400 })
  if (r.error) return NextResponse.json({ error: r.error }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// Verwijderen kan altijd, ook als de toegang is verlopen.
export async function DELETE() {
  const g = await historieImportGebruiker({ metToegangscontrole: false })
  if ('fout' in g) return g.fout
  const r = await verwijderProfiel(historieImportDb, g.userId)
  if (r.error) return NextResponse.json({ error: 'verwijderen_mislukt' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
