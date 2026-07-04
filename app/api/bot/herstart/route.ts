import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export type HerstartStatus =
  | 'active'
  | 'not_eligible'
  | 'winback'
  | 'too_late'
  | 'paid_only'
  | 'second_trial'

function eligibility(user: {
  is_active: boolean
  deactivated_at: string | null
  winback_sent_at: string | null
  trial_reactivated_at: string | null
  trial_start: string | null
}): HerstartStatus {
  if (user.is_active) return 'active'
  if (!user.deactivated_at) return 'not_eligible'

  const now = Date.now()

  if (user.trial_reactivated_at) return 'paid_only'

  if (!user.winback_sent_at) return 'not_eligible'

  const daysSinceWinback = (now - new Date(user.winback_sent_at).getTime()) / (1000 * 60 * 60 * 24)
  if (daysSinceWinback <= 5) return 'winback'

  const daysSinceDeactivation = (now - new Date(user.deactivated_at).getTime()) / (1000 * 60 * 60 * 24)
  if (daysSinceDeactivation >= 201) return 'second_trial'

  return 'too_late'
}

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

  const { data: user } = await supabase
    .from('approved_users')
    .select('is_active, deactivated_at, winback_sent_at, trial_reactivated_at, trial_start')
    .eq('user_id', userId)
    .maybeSingle()

  if (!user) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })

  return NextResponse.json({ status: eligibility(user) })
}

export async function POST() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

  const { data: user } = await supabase
    .from('approved_users')
    .select('is_active, deactivated_at, winback_sent_at, trial_reactivated_at, trial_start')
    .eq('user_id', userId)
    .maybeSingle()

  if (!user) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })

  const status = eligibility(user)
  if (!['winback', 'second_trial'].includes(status)) {
    return NextResponse.json({ error: 'Niet in aanmerking' }, { status: 400 })
  }

  const now = new Date()

  await supabase.from('approved_users').update({
    is_active: true,
    trial_start: now.toISOString(),
    trial_reactivated_at: user.trial_reactivated_at ?? now.toISOString(),
    cancelled_at: null,
    deactivated_at: null,
    renewal_requested_at: null,
    renewal_warning_sent_at: null,
    paid_at: null,
    expires_at: null,
  }).eq('user_id', userId)

  // Clear email log so trial sequence restarts from dag1
  await supabase.from('arnobot_email_log').delete().eq('user_id', userId)

  return NextResponse.json({ ok: true, status })
}
