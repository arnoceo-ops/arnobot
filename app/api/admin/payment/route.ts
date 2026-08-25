import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get('arnobot_admin')?.value
  if (!token || token !== process.env.ARNOBOT_ADMIN_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { userId, expiresAt } = await req.json()
  if (!userId) return NextResponse.json({ error: 'Geen userId' }, { status: 400 })

  const { data: updated, error } = await supabase
    .from('approved_users')
    .update({ paid_at: new Date().toISOString(), is_active: true, expires_at: expiresAt ?? null })
    .eq('user_id', userId)
    .select('plan')
    .single()

  if (error) {
    console.error('[admin/payment]', error.message)
    return NextResponse.json({ error: 'Bijwerken mislukt' }, { status: 500 })
  }

  // Referral-conversie: alleen Basic telt niet mee (zie docs/ABONNEMENTEN.md,
  // "Referralprogramma"). Zonder deze stap bleef de 'converted'-status voor altijd op
  // 'signed_up' staan, waardoor de BETALEND/TEGOED-tellers bij de referrer (en de
  // refConverted-teller in /bot/admin/gebruikers) altijd 0 toonden, ook na betaling.
  if (updated?.plan === 'premium' || updated?.plan === 'team') {
    await supabase
      .from('arnobot_referrals')
      .update({ status: 'converted' })
      .eq('referred_user_id', userId)
      .eq('status', 'signed_up')
  }

  return NextResponse.json({ ok: true })
}
