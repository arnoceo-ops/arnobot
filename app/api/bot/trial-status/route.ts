import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isTeamCovered } from '@/lib/teamAccess'
import { trialDagenOver } from '@/lib/toegang'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Voor de balk "je proefperiode loopt af" in de app: alleen eigen gegevens (userId uit de
// sessie), geeft het aantal resterende dagen (1 tot en met 5) of null als er niets te melden is.
export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

  const { data } = await supabase
    .from('approved_users')
    .select('trial_start, paid_at, expires_at, is_active, command_manager')
    .eq('user_id', userId)
    .maybeSingle()

  // Teams betalen niet zelf en hebben geen eigen proefperiode die afloopt.
  if (!data || data.is_active === false || data.command_manager === true) {
    return NextResponse.json({ dagenOver: null })
  }
  const dagenOver = trialDagenOver(data)
  if (dagenOver === null || (await isTeamCovered(userId))) return NextResponse.json({ dagenOver: null })

  return NextResponse.json({ dagenOver })
}
