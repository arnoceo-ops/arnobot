import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { adminKeyMatches } from '@/lib/adminAuth'
import { logAdminActie } from '@/lib/adminLog'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Zet een gebruiker aan of uit vanuit de admin-tabel. Uitschakelen bounced de
// gebruiker direct uit /bot (proxy.ts checkt is_active === false als eerste).
// Bewust los van de betaal-/comp-status: intrekken raakt paid_at/expires_at niet.
export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get('arnobot_admin')?.value
  if (!adminKeyMatches(token)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { userId, active } = await req.json()
  if (!userId || typeof userId !== 'string' || typeof active !== 'boolean') {
    return NextResponse.json({ error: 'Ongeldige invoer' }, { status: 400 })
  }

  const patch = active
    ? { is_active: true, deactivated_at: null }
    : { is_active: false, deactivated_at: new Date().toISOString() }

  const { data: oud } = await supabase.from('approved_users').select('is_active').eq('user_id', userId).maybeSingle()

  const { error } = await supabase.from('approved_users').update(patch).eq('user_id', userId)
  if (error) {
    console.error('[admin/active]', error.message)
    return NextResponse.json({ error: 'Bijwerken mislukt' }, { status: 500 })
  }

  await logAdminActie({ actie: active ? 'toegang_aan' : 'toegang_uit', doelUserId: userId, details: { oud: { is_active: oud?.is_active ?? null }, nieuw: { is_active: active } } })
  return NextResponse.json({ ok: true })
}
