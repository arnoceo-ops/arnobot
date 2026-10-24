import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { datumToegang } from '@/lib/toegang'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ plan: null }, { status: 401 })

  const { data } = await supabase
    .from('approved_users')
    .select('plan, command_manager, is_active, paid_at, expires_at, trial_start')
    .eq('user_id', userId)
    .single()

  // Heeft de gebruiker op dit moment toegang? Zelfde beslissing als proxy.ts (is_active, eigen datums,
  // anders via een niet-geblokkeerd team), alleen voor het menu: de proxy blijft de echte poort.
  let toegang = false
  if (data && data.is_active !== false) {
    toegang = datumToegang(data)
    if (!toegang && data.command_manager === true) {
      const { data: eigenTeam } = await supabase.from('arnobot_teams').select('geblokkeerd_at').eq('manager_id', userId).maybeSingle()
      if (!eigenTeam?.geblokkeerd_at) toegang = true
    }
    if (!toegang) {
      const { data: lid } = await supabase.from('arnobot_team_members').select('team_id').eq('user_id', userId).maybeSingle()
      if (lid) {
        const { data: team } = await supabase.from('arnobot_teams').select('geblokkeerd_at').eq('id', lid.team_id).maybeSingle()
        if (!team?.geblokkeerd_at) toegang = true
      }
    }
  }

  return NextResponse.json({ plan: data?.plan ?? null, commandManager: data?.command_manager ?? false, toegang: data ? toegang : null })
}
