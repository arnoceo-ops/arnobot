import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const { token } = await req.json()
  if (!token || typeof token !== 'string') {
    return NextResponse.json({ error: 'Ongeldig verzoek' }, { status: 400 })
  }

  const { error } = await supabase
    .from('approved_users')
    .update({ nudge_opt_out: true })
    .eq('user_id', token)

  if (error) return NextResponse.json({ error: 'Mislukt' }, { status: 500 })

  return NextResponse.json({ ok: true })
}
