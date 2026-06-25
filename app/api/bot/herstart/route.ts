import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function eligibility(deactivatedAt: string): 'winback_14' | 'full_30' | 'not_eligible' {
  const days = (Date.now() - new Date(deactivatedAt).getTime()) / (1000 * 60 * 60 * 24)
  if (days >= 180) return 'full_30'
  if (days >= 30) return 'winback_14'
  return 'not_eligible'
}

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

  const { data: user } = await supabase
    .from('approved_users')
    .select('is_active, deactivated_at, trial_reactivated_at')
    .eq('user_id', userId)
    .maybeSingle()

  if (!user) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })
  if (user.is_active) return NextResponse.json({ status: 'active' })
  if (!user.deactivated_at) return NextResponse.json({ status: 'not_eligible' })

  const type = eligibility(user.deactivated_at)
  return NextResponse.json({ status: type })
}

export async function POST() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

  const { data: user } = await supabase
    .from('approved_users')
    .select('is_active, deactivated_at')
    .eq('user_id', userId)
    .maybeSingle()

  if (!user || !user.deactivated_at) return NextResponse.json({ error: 'Niet in aanmerking' }, { status: 400 })

  const type = eligibility(user.deactivated_at)
  if (type === 'not_eligible') return NextResponse.json({ error: 'Nog niet in aanmerking' }, { status: 400 })

  // 14-daagse trial: trial_start 16 dagen terug zodat trial over 14 dagen eindigt
  // 30-daagse trial: trial_start = nu
  const trialStart = type === 'winback_14'
    ? new Date(Date.now() - 16 * 24 * 60 * 60 * 1000).toISOString()
    : new Date().toISOString()

  await supabase.from('approved_users').update({
    is_active: true,
    trial_start: trialStart,
    trial_reactivated_at: new Date().toISOString(),
    cancelled_at: null,
    deactivated_at: null,
    renewal_requested_at: null,
    renewal_warning_sent_at: null,
    paid_at: null,
    expires_at: null,
  }).eq('user_id', userId)

  return NextResponse.json({ ok: true, type })
}
