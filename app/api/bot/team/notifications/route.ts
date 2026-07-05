import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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
    .maybeSingle()

  if (!managerMember) return NextResponse.json({ notifications: [], unread: 0 })

  const { data } = await supabase
    .from('arnobot_team_notifications')
    .select('*')
    .eq('manager_id', userId)
    .eq('team_id', managerMember.team_id)
    .order('created_at', { ascending: false })
    .limit(20)

  const notifications = data ?? []
  const unread = notifications.filter(n => !n.read_at).length

  return NextResponse.json({ notifications, unread })
}
