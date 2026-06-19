import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get('arnobot_admin')?.value
  if (!token || token !== process.env.ARNOBOT_ADMIN_KEY) {
    return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
  }

  const { data: users, error } = await supabase
    .from('approved_users')
    .select('user_id, voornaam, referral_code')
    .not('referral_code', 'is', null)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const results = []
  for (const u of users ?? []) {
    const voornaam = (u.voornaam || '').toUpperCase().replace(/[^A-Z]/g, '')
    if (!voornaam || !u.referral_code) continue

    // Behoud het bestaande achtervoegsel (na de laatste streepje)
    const parts = (u.referral_code as string).split('-')
    const suffix = parts[parts.length - 1]
    const newCode = `${voornaam}-${suffix}`

    if (newCode === u.referral_code) continue // al correct

    const { error: upErr } = await supabase
      .from('approved_users')
      .update({ referral_code: newCode })
      .eq('user_id', u.user_id)

    results.push({ user_id: u.user_id, old: u.referral_code, new: newCode, ok: !upErr })
  }

  return NextResponse.json({ updated: results.length, results })
}
