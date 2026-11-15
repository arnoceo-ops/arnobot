import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { adminKeyMatches } from '@/lib/adminAuth'
import { herstelTestaccount, zetTeamproef, type TeamproefStand } from '@/lib/testTeamproef'

// Testknoppen TEAMPROEF (lib/testTeamproef.ts). Hardcoded naar het handmatige testaccount, accepteert nooit een userId.
const STANDEN: TeamproefStand[] = ['lopend', 'bijna', 'coulance', 'voorbij']

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  if (!adminKeyMatches(cookieStore.get('arnobot_admin')?.value)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { stand } = (await req.json().catch(() => ({}))) as { stand?: string }
  try {
    if (stand === 'uit') {
      await herstelTestaccount()
    } else if (STANDEN.includes(stand as TeamproefStand)) {
      await zetTeamproef(stand as TeamproefStand)
    } else {
      return NextResponse.json({ error: 'Ongeldige stand' }, { status: 400 })
    }
  } catch (e) {
    console.error('test-teamproef:', e instanceof Error ? e.message : e)
    return NextResponse.json({ error: 'Omzetten mislukt' }, { status: 500 })
  }
  return NextResponse.json({ ok: true, stand })
}
