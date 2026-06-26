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
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { userId, tier } = body
  if (!userId || !['basis', 'pro'].includes(tier)) {
    return NextResponse.json({ error: 'Ongeldig verzoek' }, { status: 400 })
  }

  const { error } = await supabase
    .from('approved_users')
    .update({ tier })
    .eq('user_id', userId)

  if (error) {
    console.error('Tier update error:', error.message)
    return NextResponse.json({ error: 'Opslaan mislukt' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
