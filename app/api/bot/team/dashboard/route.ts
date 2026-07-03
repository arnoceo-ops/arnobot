import { auth, clerkClient } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

  // Verify manager
  const { data: managerMember } = await supabase
    .from('arnobot_team_members')
    .select('team_id, role, arnobot_teams(id, name, invite_code, min_interval_dagen)')
    .eq('user_id', userId)
    .eq('role', 'manager')
    .single()

  if (!managerMember) return NextResponse.json({ error: 'Geen manager-toegang' }, { status: 403 })

  const team = managerMember.arnobot_teams as unknown as { id: string; name: string; invite_code: string; min_interval_dagen: number | null }

  // Get all team members
  const { data: members } = await supabase
    .from('arnobot_team_members')
    .select('user_id, role, joined_at, display_name')
    .eq('team_id', team.id)

  if (!members?.length) return NextResponse.json({ team, members: [] })

  const memberIds = members.map(m => m.user_id)

  // Fetch stats for all members in parallel
  const [sessionsRes, logsRes, analysesRes, profilesRes] = await Promise.all([
    supabase
      .from('arnobot_blog_sessions')
      .select('user_id, created_at')
      .in('user_id', memberIds),
    supabase
      .from('arnobot_rds_logs')
      .select('user_id, created_at')
      .in('user_id', memberIds)
      .order('created_at', { ascending: false }),
    supabase
      .from('arnobot_analyses')
      .select('user_id')
      .in('user_id', memberIds),
    supabase
      .from('arnobot_blog_profiles')
      .select('user_id, profiel')
      .in('user_id', memberIds),
  ])

  // Get Clerk user names
  const clerk = await clerkClient()
  const usersResponse = await clerk.users.getUserList({ userId: memberIds, limit: 50 })
  const clerkUsers = usersResponse.data

  const nameMap: Record<string, string> = {}
  for (const u of clerkUsers) {
    const name = [u.firstName, u.lastName].filter(Boolean).join(' ') || u.emailAddresses[0]?.emailAddress || u.id
    nameMap[u.id] = name
  }

  // Aggregate stats per member
  const sessionCounts: Record<string, number> = {}
  for (const s of sessionsRes.data ?? []) {
    sessionCounts[s.user_id] = (sessionCounts[s.user_id] ?? 0) + 1
  }

  const lastActivity: Record<string, string> = {}
  for (const l of logsRes.data ?? []) {
    if (!lastActivity[l.user_id]) lastActivity[l.user_id] = l.created_at
  }

  const analysesCounts: Record<string, number> = {}
  for (const a of analysesRes.data ?? []) {
    analysesCounts[a.user_id] = (analysesCounts[a.user_id] ?? 0) + 1
  }

  const profielRolMap: Record<string, string> = {}
  for (const p of profilesRes.data ?? []) {
    if (p.profiel?.rol) profielRolMap[p.user_id] = p.profiel.rol
  }

  const enriched = members.map(m => ({
    user_id: m.user_id,
    role: m.role,
    profiel_rol: profielRolMap[m.user_id] ?? null,
    joined_at: m.joined_at,
    name: nameMap[m.user_id] || (m as any).display_name || 'Onbekend',
    sessions: sessionCounts[m.user_id] ?? 0,
    last_activity: lastActivity[m.user_id] ?? null,
    analyses: analysesCounts[m.user_id] ?? 0,
  }))

  return NextResponse.json({ team, members: enriched })
}
