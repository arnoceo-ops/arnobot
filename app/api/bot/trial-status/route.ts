import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isTeamCovered } from '@/lib/teamAccess'
import { trialDagenOver } from '@/lib/toegang'
import { leesActivatieStand } from '@/lib/teamActivatie'

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

  if (!data || data.is_active === false) return NextResponse.json({ dagenOver: null })

  // Een manager van een gratis agent-proef heeft geen eigen proefperiode, maar wel een team dat moet worden geactiveerd. In de
  // laatste 5 dagen en in de coulance krijgt hij daarvoor een balk (docs/TEAM_PROCES.md, fase 2). Alleen die twee standen:
  // eerder is er niets te melden en daarna sluit de toegangspoort hem buiten en landt hij op zijn accountpagina.
  if (data.command_manager === true) {
    const stand = await leesActivatieStand(userId)
    const proef = stand?.kanActiveren ? stand.proef : null
    if (proef && (proef.staat === 'bijna' || proef.staat === 'coulance')) {
      return NextResponse.json({ dagenOver: null, teamProef: { staat: proef.staat, dagen: proef.dagen, toegangTot: proef.toegangTot } })
    }
    // Teams betalen niet zelf en hebben geen eigen proefperiode die afloopt.
    return NextResponse.json({ dagenOver: null })
  }
  const dagenOver = trialDagenOver(data)
  if (dagenOver === null || (await isTeamCovered(userId))) return NextResponse.json({ dagenOver: null })

  return NextResponse.json({ dagenOver })
}
