import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { computeSpiegelSignaal } from '@/lib/spiegel'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

  const { data: managerMember } = await supabase
    .from('arnobot_team_members')
    .select('team_id')
    .eq('user_id', userId)
    .eq('role', 'manager')
    .single()

  if (!managerMember) return NextResponse.json({ onvoldoende: true })

  const { data: members } = await supabase
    .from('arnobot_team_members')
    .select('user_id')
    .eq('team_id', managerMember.team_id)

  const memberIds = (members ?? []).map(m => m.user_id)
  const signaal = await computeSpiegelSignaal(memberIds)
  return NextResponse.json(signaal)
}
