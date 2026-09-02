import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Gratis toegang tot een datum (comp), los van de betaalstroom. Zet expires_at en
// wist trial_start: anders pikt de trial-emails-cron de gebruiker op (filter
// trial_start gezet + paid_at leeg) en blokkeert 'm zodra de oorspronkelijke
// 30-dagen-trial voorbij is. paid_at, de referral-status en is_active blijven
// ongemoeid; een comp is geen betaling, en een uitgeschakelde gebruiker moet
// bewust via de aan/uit-knop weer aangezet worden (zie /api/admin/active).
export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get('arnobot_admin')?.value
  if (!token || token !== process.env.ARNOBOT_ADMIN_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { userId, expiresAt } = await req.json()
  if (!userId || typeof userId !== 'string') {
    return NextResponse.json({ error: 'Geen userId' }, { status: 400 })
  }
  if (!expiresAt) {
    return NextResponse.json({ error: 'Geen datum' }, { status: 400 })
  }
  const exp = new Date(expiresAt)
  if (isNaN(exp.getTime())) {
    return NextResponse.json({ error: 'Ongeldige datum' }, { status: 400 })
  }

  const { error } = await supabase
    .from('approved_users')
    .update({
      expires_at: exp.toISOString(),
      trial_start: null,
      paid_at: null,
    })
    .eq('user_id', userId)

  if (error) {
    console.error('[admin/comp]', error.message)
    return NextResponse.json({ error: 'Bijwerken mislukt' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
