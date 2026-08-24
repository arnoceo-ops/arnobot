import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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
      .select('role, arnobot_teams(id, name, invite_code)')
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

  return NextResponse.json({
    hasTeam: true,
    isManager: member.role === 'manager',
    team: member.arnobot_teams,
  })
}
