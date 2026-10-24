import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { herstartStatus, type HerstartStatus } from '@/lib/herstart'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export type { HerstartStatus }

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

  const { data: user } = await supabase
    .from('approved_users')
    .select('is_active, deactivated_at, winback_sent_at, trial_reactivated_at, trial_start')
    .eq('user_id', userId)
    .maybeSingle()

  if (!user) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })

  return NextResponse.json({ status: herstartStatus(user) })
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

  const status = herstartStatus(user)
  if (!['winback', 'second_trial'].includes(status)) {
    return NextResponse.json({ error: 'Niet in aanmerking' }, { status: 400 })
  }

  const now = new Date()

  await supabase.from('approved_users').update({
    is_active: true,
    trial_start: now.toISOString(),
    trial_reactivated_at: now.toISOString(),
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
