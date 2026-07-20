import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { logEvent } from '@/lib/events'

// Vaste, expliciete lijst i.p.v. een willekeurige string uit de client accepteren: voorkomt
// dat de events-tabel wordt volgeplempt met arbitraire waarden vanuit een aangepast verzoek.
const ALLOWED_CLIENT_EVENTS = new Set(['coaching_gesprek_click', 'upgrade_premium_click', 'upgrade_team_click'])

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { eventName } = await req.json()
  if (typeof eventName !== 'string' || !ALLOWED_CLIENT_EVENTS.has(eventName)) {
    return NextResponse.json({ error: 'Ongeldig event' }, { status: 400 })
  }

  await logEvent(userId, eventName)
  return NextResponse.json({ ok: true })
}
