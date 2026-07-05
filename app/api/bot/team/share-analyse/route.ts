import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function getMembership(userId: string) {
  const { data } = await supabase
    .from('arnobot_team_members')
    .select('team_id, display_name')
    .eq('user_id', userId)
    .neq('role', 'manager')
    .maybeSingle()
  return data
}

async function insertNotification(teamId: string, memberId: string, memberName: string, refId: string) {
  const { data: manager } = await supabase
    .from('arnobot_team_members')
    .select('user_id')
    .eq('team_id', teamId)
    .eq('role', 'manager')
    .maybeSingle()
  if (!manager) return

  await supabase.from('arnobot_team_notifications').insert({
    team_id: teamId,
    manager_id: manager.user_id,
    type: 'analyse_gedeeld',
    member_id: memberId,
    member_name: memberName,
    ref_id: refId,
  })
}

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

  const membership = await getMembership(userId)
  if (!membership) return NextResponse.json({ sharedIds: [] })

  const { data } = await supabase
    .from('arnobot_shared_analyses')
    .select('analyse_id')
    .eq('user_id', userId)
    .eq('team_id', membership.team_id)

  return NextResponse.json({ sharedIds: (data ?? []).map(r => r.analyse_id) })
}

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

  const { analyseId } = await req.json()
  if (!analyseId) return NextResponse.json({ error: 'Geen analyseId' }, { status: 400 })

  const membership = await getMembership(userId)
  if (!membership) return NextResponse.json({ error: 'Geen teamlidmaatschap' }, { status: 403 })

  // Verify the analyse belongs to this user
  const { data: analyse } = await supabase
    .from('arnobot_analyses')
    .select('id')
    .eq('id', analyseId)
    .eq('user_id', userId)
    .maybeSingle()

  if (!analyse) return NextResponse.json({ error: 'Analyse niet gevonden' }, { status: 404 })

  const { data: existing } = await supabase
    .from('arnobot_shared_analyses')
    .select('analyse_id')
    .eq('user_id', userId)
    .eq('analyse_id', analyseId)
    .eq('team_id', membership.team_id)
    .maybeSingle()

  const { error } = await supabase
    .from('arnobot_shared_analyses')
    .upsert(
      { user_id: userId, analyse_id: analyseId, team_id: membership.team_id },
      { onConflict: 'user_id,analyse_id,team_id', ignoreDuplicates: true }
    )

  if (error) return NextResponse.json({ error: 'Delen mislukt' }, { status: 500 })

  if (!existing) {
    await insertNotification(membership.team_id, userId, membership.display_name ?? 'Teamlid', analyseId)
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

  const analyseId = req.nextUrl.searchParams.get('analyseId')
  if (!analyseId) return NextResponse.json({ error: 'Geen analyseId' }, { status: 400 })

  const membership = await getMembership(userId)
  if (!membership) return NextResponse.json({ error: 'Geen teamlidmaatschap' }, { status: 403 })

  const { error } = await supabase
    .from('arnobot_shared_analyses')
    .delete()
    .eq('user_id', userId)
    .eq('analyse_id', analyseId)
    .eq('team_id', membership.team_id)

  if (error) return NextResponse.json({ error: 'Intrekken mislukt' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
