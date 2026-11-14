import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
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

  const body = await req.json()
  const { userId, plan } = body
  if (!userId || !['basis', 'premium', 'team'].includes(plan)) {
    return NextResponse.json({ error: 'Ongeldig verzoek' }, { status: 400 })
  }

  const { data: oud } = await supabase.from('approved_users').select('plan').eq('user_id', userId).maybeSingle()

  const { error } = await supabase
    .from('approved_users')
    .update({ plan })
    .eq('user_id', userId)

  if (error) {
    console.error('Plan update error:', error.message)
    return NextResponse.json({ error: 'Opslaan mislukt' }, { status: 500 })
  }
  await logAdminActie({ actie: 'plan_gewijzigd', doelUserId: userId, details: { oud: { plan: oud?.plan ?? null }, nieuw: { plan } } })
  return NextResponse.json({ ok: true })
}
