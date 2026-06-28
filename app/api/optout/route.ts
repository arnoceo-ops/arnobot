import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHmac } from 'crypto'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function verifyOptOutSig(userId: string, sig: string): boolean {
  const expected = createHmac('sha256', process.env.ARNOBOT_ADMIN_KEY ?? '')
    .update(userId)
    .digest('hex')
    .slice(0, 32)
  return expected === sig
}

export async function POST(req: NextRequest) {
  const { token, sig } = await req.json()
  if (!token || typeof token !== 'string') {
    return NextResponse.json({ error: 'Ongeldig verzoek' }, { status: 400 })
  }
  if (!sig || !verifyOptOutSig(token, sig)) {
    return NextResponse.json({ error: 'Ongeldige handtekening' }, { status: 403 })
  }

  const { error } = await supabase
    .from('approved_users')
    .update({ nudge_opt_out: true })
    .eq('user_id', token)

  if (error) return NextResponse.json({ error: 'Mislukt' }, { status: 500 })

  return NextResponse.json({ ok: true })
}
