import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { trekTeamOpzeggingIn } from '@/lib/teamOpzegging'

// De manager trekt de opzegging van zijn team in, tot en met de dag vóór de einddatum (docs/TEAM_PROCES.md, fase 6).
// De server controleert de datum, het scherm toont de knop alleen.
export async function POST() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
  const uitkomst = await trekTeamOpzeggingIn(userId)
  if (!uitkomst.ok) return NextResponse.json({ error: uitkomst.fout }, { status: uitkomst.status })
  return NextResponse.json({ ok: true })
}
