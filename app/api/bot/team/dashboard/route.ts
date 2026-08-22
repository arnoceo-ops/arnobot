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

  // Get all team members except the manager
  const { data: members } = await supabase
    .from('arnobot_team_members')
    .select('user_id, role, joined_at, display_name')
    .eq('team_id', team.id)
    .neq('role', 'manager')

  if (!members?.length) return NextResponse.json({ team, members: [] })

  const memberIds = members.map(m => m.user_id)

  // Fetch stats for all members in parallel
  const [sessionsRes, logsRes, analysesRes, profilesRes, coachingRes, oneOnOneRes] = await Promise.all([
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
    supabase
      .from('arnobot_coaching')
      .select('user_id, mindset_score, systeem_score, actie_score')
      .in('user_id', memberIds),
    supabase
      .from('arnobot_1on1_log')
      .select('member_id, actie, actie_status, created_at')
      .eq('manager_id', userId),
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

  const coachingMap: Record<string, { mindset_score: number | null; systeem_score: number | null; actie_score: number | null }> = {}
  for (const c of coachingRes.data ?? []) {
    coachingMap[c.user_id] = { mindset_score: c.mindset_score, systeem_score: c.systeem_score, actie_score: c.actie_score }
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
    mindset_score: coachingMap[m.user_id]?.mindset_score ?? null,
    systeem_score: coachingMap[m.user_id]?.systeem_score ?? null,
    actie_score: coachingMap[m.user_id]?.actie_score ?? null,
  }))

  enriched.sort((a, b) => {
    if (!a.last_activity && !b.last_activity) return 0
    if (!a.last_activity) return 1
    if (!b.last_activity) return -1
    return b.last_activity.localeCompare(a.last_activity)
  })

  // Feitelijke terugkoppeling op de eigen 1:1's van de manager, bewust geen AI-tekst (dat is
  // punt 5, dat op deze data bouwt): frequentie + dekking + openstaande acties. Follow-through
  // (opvolgdiscipline op eigen 1:1-acties) is verplaatst naar de leiderschapspagina
  // (zelfcoaching/route.ts), hoort inhoudelijk bij Execution, niet bij dit teamoverzicht.
  const oneOnOnes = oneOnOneRes.data ?? []
  const zevenDagenGeleden = Date.now() - 7 * 86400000
  const dertigDagenGeleden = Date.now() - 30 * 86400000
  const veertienDagenGeleden = Date.now() - 14 * 86400000
  const laatste30Dagen = oneOnOnes.filter(l => new Date(l.created_at).getTime() >= dertigDagenGeleden).length
  const openstaandOuderDan14Dagen = oneOnOnes.filter(l =>
    l.actie && !l.actie_status && new Date(l.created_at).getTime() < veertienDagenGeleden
  ).length

  // Actie-ratio: van alle ooit gelogde 1:1's, welk deel leverde een concrete actie op (los van
  // of die actie later ook is opgevolgd, dat meet follow-through op de leiderschapspagina). Meet
  // of de 1:1's zelf productief zijn, niet alleen of ze plaatsvinden (dekking) of afgerond worden
  // (follow-through).
  const actieRatioPct = oneOnOnes.length > 0
    ? Math.round((oneOnOnes.filter(l => !!l.actie).length / oneOnOnes.length) * 100)
    : null

  // Dekking: hoeveel teamleden hadden in de afgelopen 7 dagen minstens één 1:1. Bewust wekelijks
  // i.p.v. de 30-dagen-window van laatste30Dagen hierboven (Arno's expliciete norm: een 1:1 hoort
  // wekelijks te zijn), en bewust een apart concept van MINIMUMFREQUENTIE in TeamClient.tsx (dat
  // meet de eigen ArnoBot-activiteit van het teamlid, niet het 1:1-ritme met de manager).
  const leden1on1LaatsteWeek = new Set(
    oneOnOnes.filter(l => l.member_id && new Date(l.created_at).getTime() >= zevenDagenGeleden).map(l => l.member_id)
  )
  const dekkingAantal = members.filter(m => leden1on1LaatsteWeek.has(m.user_id)).length

  // Per lid: hoeveel 1:1's in de laatste 30 dagen, en omgerekend naar een weekgemiddelde.
  // Los van het teambrede totaal hierboven, dat zegt niets over spreiding (2 in 30 dagen kan
  // "1 lid 2x" of "2 leden 1x" zijn, een teambaas wil dat onderscheid zien).
  const perLid30Dagen: Record<string, number> = {}
  for (const l of oneOnOnes) {
    if (new Date(l.created_at).getTime() < dertigDagenGeleden) continue
    if (!l.member_id) continue
    perLid30Dagen[l.member_id] = (perLid30Dagen[l.member_id] ?? 0) + 1
  }
  const perLid = members.map(m => {
    const aantal = perLid30Dagen[m.user_id] ?? 0
    return {
      user_id: m.user_id,
      naam: nameMap[m.user_id] || (m as any).display_name || 'Onbekend',
      laatste30Dagen: aantal,
      perWeek: Math.round((aantal / 30 * 7) * 10) / 10,
    }
  })

  return NextResponse.json({
    team,
    members: enriched,
    oneOnOneRitme: { laatste30Dagen, openstaandOuderDan14Dagen, dekkingAantal, dekkingTotaal: members.length, actieRatioPct, perLid },
  })
}
