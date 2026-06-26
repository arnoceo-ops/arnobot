import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const { userId: managerId } = await auth()
  if (!managerId) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

  const { targetUserId, aandachtspunt, notitie } = await req.json()
  if (!targetUserId) return NextResponse.json({ error: 'Geen userId' }, { status: 400 })

  const { data: managerMember } = await supabase
    .from('arnobot_team_members')
    .select('team_id')
    .eq('user_id', managerId)
    .eq('role', 'manager')
    .single()

  if (!managerMember) return NextResponse.json({ error: 'Geen manager-toegang' }, { status: 403 })

  const { data: targetMember } = await supabase
    .from('arnobot_team_members')
    .select('role')
    .eq('user_id', targetUserId)
    .eq('team_id', managerMember.team_id)
    .single()

  if (!targetMember) return NextResponse.json({ error: 'Lid niet gevonden' }, { status: 404 })

  const { data: coaching } = await supabase
    .from('arnobot_coaching')
    .select('mindset_score, systeem_score, actie_score')
    .eq('user_id', targetUserId)
    .maybeSingle()

  const { error } = await supabase.from('arnobot_1on1_log').insert({
    manager_id: managerId,
    member_id: targetUserId,
    team_id: managerMember.team_id,
    mindset_score: coaching?.mindset_score ?? null,
    systeem_score: coaching?.systeem_score ?? null,
    actie_score: coaching?.actie_score ?? null,
    aandachtspunt: aandachtspunt || null,
    notitie: notitie || null,
  })

  if (error) {
    console.error('1on1 save error:', error.message)
    return NextResponse.json({ error: 'Opslaan mislukt' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
