import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Bewust géén hardgecodeerde bouwer-uitzondering meer (Arno's eigen LinkedIn-account kon
// altijd een team aanmaken, ongeacht command_manager, verwijderd 2026-08-24 op zijn
// verzoek): zijn account gedraagt zich nu identiek aan elk ander account.
export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

  const { data: approved } = await supabase
    .from('approved_users')
    .select('command_manager, plan')
    .eq('user_id', userId)
    .single()

  if (!approved?.command_manager) {
    return NextResponse.json({ error: 'Niet beschikbaar' }, { status: 403 })
  }

  const { name } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Teamnaam is verplicht' }, { status: 400 })

  const { data: existing } = await supabase
    .from('arnobot_team_members')
    .select('team_id')
    .eq('user_id', userId)
    .single()

  if (existing) return NextResponse.json({ error: 'Je bent al lid van een team' }, { status: 400 })

  // Het niveau van het team volgt het eigen plan van de manager (die is bij het
  // onboarden al op het juiste niveau gezet), 'elite' expliciet, anders 'premium'.
  const niveau = approved?.plan === 'elite' ? 'elite' : 'premium'

  const { data: team, error } = await supabase
    .from('arnobot_teams')
    .insert({ name: name.trim(), manager_id: userId, niveau })
    .select()
    .single()

  if (error || !team) return NextResponse.json({ error: 'Team aanmaken mislukt' }, { status: 500 })

  await supabase
    .from('arnobot_team_members')
    .insert({ team_id: team.id, user_id: userId, role: 'manager' })

  return NextResponse.json({ team })
}
