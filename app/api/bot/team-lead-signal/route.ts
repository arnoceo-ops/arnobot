import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { notifyTeamLead } from '@/lib/teamLeadNotify'

const serviceDb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Vroege lead-trigger: vuurt zodra iemand tijdens de profiel-intake "voor mijn team" én een
// teamgrootte heeft aangeklikt, in plaats van te wachten tot het hele intakeformulier (markt,
// uitdaging, dealgrootte, salescyclus, jaren-in-sales, ...) is afgerond. Wie na dit punt afhaakt
// werd voorheen nergens als lead gezien, zie app/bot/profiel/page.tsx.
export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { rol, teamgrootte } = await req.json()
  if (typeof rol !== 'string' || typeof teamgrootte !== 'string') {
    return NextResponse.json({ error: 'Ongeldig verzoek' }, { status: 400 })
  }

  await notifyTeamLead(serviceDb, userId, rol, teamgrootte)

  return NextResponse.json({ ok: true })
}
