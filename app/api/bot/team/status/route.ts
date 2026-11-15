import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { heeftEigenAbonnement } from '@/lib/teamLid'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ hasTeam: false, isManager: false })

  const [memberRes, profileRes] = await Promise.all([
    supabase
      .from('arnobot_team_members')
      .select('role, arnobot_teams(id, name, invite_code, geblokkeerd_at)')
      .eq('user_id', userId)
      .single(),
    supabase
      .from('arnobot_blog_profiles')
      .select('profiel')
      .eq('user_id', userId)
      .single(),
  ])

  const member = memberRes.data
  const gebruik = profileRes.data?.profiel?.gebruik ?? null

  if (!member || gebruik === 'individueel') {
    return NextResponse.json({ hasTeam: false, isManager: false })
  }

  const isManager = member.role === 'manager'
  // memberCount alleen voor de manager opgehaald (extra query, niet nodig voor een gewoon
  // teamlid): gebruikt door de accountpagina om te laten zien hoeveel mensen een opzegging
  // door de manager zou raken.
  let memberCount: number | null = null
  if (isManager) {
    const teams = member.arnobot_teams as unknown as { id: string }[] | { id: string } | null
    const teamId = Array.isArray(teams) ? teams[0]?.id : teams?.id
    if (teamId) {
      const { count } = await supabase
        .from('arnobot_team_members')
        .select('*', { count: 'exact', head: true })
        .eq('team_id', teamId)
      memberCount = count ?? null
    }
  }

  // Voor een gewoon lid: is het team geblokkeerd, en heeft hij zelf een abonnement (afgenomen toen het team geblokkeerd was)?
  // Daar hangt af of zijn accountpagina het kader TEAM NIET ACTIEF en de abonnementssecties toont.
  const teamRij = (Array.isArray(member.arnobot_teams) ? member.arnobot_teams[0] : member.arnobot_teams) as { name?: string; geblokkeerd_at?: string | null } | null
  const teamGeblokkeerd = !isManager && !!teamRij?.geblokkeerd_at
  const eigenAbonnement = isManager ? false : await heeftEigenAbonnement(userId)

  return NextResponse.json({
    hasTeam: true,
    isManager,
    memberCount,
    team: member.arnobot_teams,
    teamNaam: teamRij?.name ?? null,
    teamGeblokkeerd,
    heeftEigenAbonnement: eigenAbonnement,
  })
}
