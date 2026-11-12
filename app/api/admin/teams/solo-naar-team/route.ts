import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { adminKeyMatches } from '@/lib/adminAuth'
import { bekijkSoloNaarTeam, voerSoloNaarTeamUit } from '@/lib/billing/soloNaarTeam'

// Een zakelijke solo-klant (maandabonnement) wordt Team: eerst een voorbeeld, dan uitvoeren
// (docs/OVERSTAP_PLAN.md, "Solo-maand naar Team"). Beide valideren alles opnieuw tegen de bron.
export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  if (!adminKeyMatches(cookieStore.get('arnobot_admin')?.value)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => null) as { teamId?: unknown; minSeats?: unknown; cyclus?: unknown; actie?: unknown } | null
  if (!body || typeof body.teamId !== 'string' || !body.teamId) return NextResponse.json({ error: 'Geen teamId' }, { status: 400 })
  const minSeats = Number(body.minSeats)
  if (body.cyclus !== 'maandelijks' && body.cyclus !== 'jaarlijks') return NextResponse.json({ error: 'Ongeldige cyclus' }, { status: 400 })
  if (body.actie !== 'voorbeeld' && body.actie !== 'uitvoeren') return NextResponse.json({ error: 'Ongeldige actie' }, { status: 400 })

  const cyclus: 'maandelijks' | 'jaarlijks' = body.cyclus
  const invoer = { minSeats, cyclus }
  const uitkomst = body.actie === 'voorbeeld'
    ? await bekijkSoloNaarTeam(body.teamId, invoer)
    : await voerSoloNaarTeamUit(body.teamId, invoer)
  if (!uitkomst.ok) return NextResponse.json({ error: uitkomst.fout }, { status: uitkomst.status })
  return NextResponse.json(uitkomst)
}
