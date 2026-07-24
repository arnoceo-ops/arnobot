import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

  const { invite_code } = await req.json()
  if (!invite_code) return NextResponse.json({ error: 'Geen uitnodigingscode' }, { status: 400 })

  const { data: existing } = await supabase
    .from('arnobot_team_members')
    .select('team_id')
    .eq('user_id', userId)
    .single()

  if (existing) return NextResponse.json({ error: 'Je bent al lid van een team' }, { status: 400 })

  const { data: team } = await supabase
    .from('arnobot_teams')
    .select('id, name, niveau')
    .eq('invite_code', invite_code)
    .single()

  if (!team) return NextResponse.json({ error: 'Ongeldige uitnodigingscode' }, { status: 404 })

  const { count: memberCount } = await supabase
    .from('arnobot_team_members')
    .select('*', { count: 'exact', head: true })
    .eq('team_id', team.id)

  if ((memberCount ?? 0) >= 25) {
    return NextResponse.json({ error: 'Team is vol (maximaal 25 leden)' }, { status: 400 })
  }

  const { error } = await supabase
    .from('arnobot_team_members')
    .insert({ team_id: team.id, user_id: userId, role: 'member' })

  if (error) return NextResponse.json({ error: 'Joinen mislukt' }, { status: 500 })

  // Teamlid krijgt het niveau van het team (premium of elite), zodat iedereen
  // in een Command-deal daadwerkelijk het niveau krijgt waarvoor betaald is.
  if (team.niveau === 'premium' || team.niveau === 'elite') {
    await supabase
      .from('approved_users')
      .update({ plan: team.niveau })
      .eq('user_id', userId)
  }

  return NextResponse.json({ team })
}

export async function GET(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  if (!code) return NextResponse.json({ error: 'Geen code' }, { status: 400 })

  const { data: team } = await supabase
    .from('arnobot_teams')
    .select('name')
    .eq('invite_code', code)
    .single()

  if (!team) return NextResponse.json({ error: 'Ongeldig' }, { status: 404 })
  return NextResponse.json({ teamName: team.name })
}
