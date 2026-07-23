import { auth, currentUser } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const BOUWER_EMAIL = 'linkedin@royaldutchsales.com'

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

  const user = await currentUser()
  const email = user?.primaryEmailAddress?.emailAddress ?? ''
  if (email !== BOUWER_EMAIL) {
    const { data: approved } = await supabase
      .from('approved_users')
      .select('plan')
      .eq('user_id', userId)
      .single()
    if (approved?.plan !== 'team') return NextResponse.json({ error: 'Niet beschikbaar' }, { status: 403 })
  }

  const { name } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Teamnaam is verplicht' }, { status: 400 })

  const { data: existing } = await supabase
    .from('arnobot_team_members')
    .select('team_id')
    .eq('user_id', userId)
    .single()

  if (existing) return NextResponse.json({ error: 'Je bent al lid van een team' }, { status: 400 })

  const { data: team, error } = await supabase
    .from('arnobot_teams')
    .insert({ name: name.trim(), manager_id: userId })
    .select()
    .single()

  if (error || !team) return NextResponse.json({ error: 'Team aanmaken mislukt' }, { status: 500 })

  await supabase
    .from('arnobot_team_members')
    .insert({ team_id: team.id, user_id: userId, role: 'manager' })

  return NextResponse.json({ team })
}
