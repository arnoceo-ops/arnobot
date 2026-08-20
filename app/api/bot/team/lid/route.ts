import { auth, clerkClient } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function DELETE(req: NextRequest) {
  const { userId: managerId } = await auth()
  if (!managerId) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

  const targetUserId = req.nextUrl.searchParams.get('userId')
  if (!targetUserId) return NextResponse.json({ error: 'Geen userId' }, { status: 400 })

  const { data: managerMember } = await supabase
    .from('arnobot_team_members')
    .select('team_id')
    .eq('user_id', managerId)
    .eq('role', 'manager')
    .single()

  if (!managerMember) return NextResponse.json({ error: 'Geen manager-toegang' }, { status: 403 })

  // Verifieer dat het lid in hetzelfde team zit en niet de manager zelf is
  if (targetUserId === managerId) return NextResponse.json({ error: 'Je kunt jezelf niet verwijderen' }, { status: 400 })

  const { error } = await supabase
    .from('arnobot_team_members')
    .delete()
    .eq('user_id', targetUserId)
    .eq('team_id', managerMember.team_id)
    .neq('role', 'manager')

  if (error) return NextResponse.json({ error: 'Verwijderen mislukt' }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function GET(req: NextRequest) {
  const { userId: managerId } = await auth()
  if (!managerId) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

  const targetUserId = req.nextUrl.searchParams.get('userId')
  if (!targetUserId) return NextResponse.json({ error: 'Geen userId' }, { status: 400 })

  // Verify manager role and get team
  const { data: managerMember } = await supabase
    .from('arnobot_team_members')
    .select('team_id')
    .eq('user_id', managerId)
    .eq('role', 'manager')
    .single()

  if (!managerMember) return NextResponse.json({ error: 'Geen manager-toegang' }, { status: 403 })

  // Verify target user is in same team
  const { data: targetMember } = await supabase
    .from('arnobot_team_members')
    .select('role, display_name')
    .eq('user_id', targetUserId)
    .eq('team_id', managerMember.team_id)
    .single()

  if (!targetMember) return NextResponse.json({ error: 'Lid niet gevonden in jouw team' }, { status: 404 })

  // Fetch coaching profile + gedeelde analyses + 1:1 geschiedenis (synthese-laag, nooit ruwe gesprekken)
  const [coachingRes, sharedRefsRes, profileRes, historyRes] = await Promise.all([
    supabase
      .from('arnobot_coaching')
      .select('mindset_score, mindset_diagnose, systeem_score, systeem_diagnose, actie_score, actie_diagnose, voortgang, updated_at')
      .eq('user_id', targetUserId)
      .maybeSingle(),
    supabase
      .from('arnobot_shared_analyses')
      .select('id, analyse_id, created_at')
      .eq('user_id', targetUserId)
      .eq('team_id', managerMember.team_id)
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('arnobot_blog_profiles')
      .select('profiel')
      .eq('user_id', targetUserId)
      .single(),
    supabase
      .from('arnobot_1on1_log')
      .select('id, aandachtspunt, agenda, notitie, actie, actie_status, mindset_score, systeem_score, actie_score, created_at')
      .eq('manager_id', managerId)
      .eq('member_id', targetUserId)
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  // Fetch the actual analyse texts for shared analyses
  const sharedRefs = sharedRefsRes.data ?? []
  const analyseIds = sharedRefs.map(r => r.analyse_id)
  const { data: analysesData } = analyseIds.length > 0
    ? await supabase
        .from('arnobot_analyses')
        .select('id, analyse_text, created_at, session_count')
        .in('id', analyseIds)
    : { data: [] }

  const analyseMap = Object.fromEntries((analysesData ?? []).map(a => [a.id, a]))
  const sharedAnalyses = sharedRefs.map(r => ({
    id: r.id,
    shared_at: r.created_at,
    analyse_id: r.analyse_id,
    analyse_text: analyseMap[r.analyse_id]?.analyse_text ?? '',
    session_count: analyseMap[r.analyse_id]?.session_count ?? null,
    analyse_created_at: analyseMap[r.analyse_id]?.created_at ?? r.created_at,
  }))

  // Get name from Clerk
  const clerk = await clerkClient()
  let name = targetMember.display_name || 'Teamlid'
  try {
    const clerkUser = await clerk.users.getUser(targetUserId)
    name = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ') || name
  } catch {}

  return NextResponse.json({
    name,
    role: targetMember.role,
    profiel_rol: profileRes.data?.profiel?.rol ?? null,
    coaching: coachingRes.data ?? null,
    sharedAnalyses,
    history: historyRes.data ?? [],
  })
}
