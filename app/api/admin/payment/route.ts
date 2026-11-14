import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { adminKeyMatches } from '@/lib/adminAuth'
import { logAdminActie } from '@/lib/adminLog'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get('arnobot_admin')?.value
  if (!adminKeyMatches(token)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { userId, expiresAt } = await req.json()
  if (!userId) return NextResponse.json({ error: 'Geen userId' }, { status: 400 })

  const { data: oud } = await supabase.from('approved_users').select('paid_at, is_active, expires_at').eq('user_id', userId).maybeSingle()
  const nu = new Date().toISOString()

  const { data: updated, error } = await supabase
    .from('approved_users')
    .update({ paid_at: nu, is_active: true, expires_at: expiresAt ?? null })
    .eq('user_id', userId)
    .select('plan')
    .single()

  if (error) {
    console.error('[admin/payment]', error.message)
    return NextResponse.json({ error: 'Bijwerken mislukt' }, { status: 500 })
  }

  // Een handmatige BETAALD-vlag maakt geen arnobot_payments-rij en is dus geen omzet voor de MRR.
  // Het logboek is het enige spoor van wie dit wanneer zette.
  await logAdminActie({
    actie: 'betaald_gezet', doelUserId: userId,
    details: {
      oud: { paid_at: oud?.paid_at ?? null, is_active: oud?.is_active ?? null, expires_at: oud?.expires_at ?? null },
      nieuw: { paid_at: nu, is_active: true, expires_at: expiresAt ?? null },
    },
  })

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
