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

  const { error } = await supabase
    .from('approved_users')
    .update({ paid_at: new Date().toISOString(), is_active: true, expires_at: expiresAt ?? null })
    .eq('user_id', userId)

  if (error) {
    console.error('[admin/payment]', error.message)
    return NextResponse.json({ error: 'Bijwerken mislukt' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
