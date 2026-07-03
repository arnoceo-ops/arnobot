import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function PATCH(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

  const body = await req.json()
  const raw = body.min_interval_dagen
  const val = (raw === null || raw === 0 || raw === '') ? null : Number(raw)

  const { data: member } = await supabase
    .from('arnobot_team_members')
    .select('team_id')
    .eq('user_id', userId)
    .eq('role', 'manager')
    .single()

  if (!member) return NextResponse.json({ error: 'Geen manager-toegang' }, { status: 403 })

  const { error } = await supabase
    .from('arnobot_teams')
    .update({ min_interval_dagen: val })
    .eq('id', member.team_id)

  if (error) return NextResponse.json({ error: 'Opslaan mislukt' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
