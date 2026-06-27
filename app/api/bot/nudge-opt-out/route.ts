import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase
    .from('approved_users')
    .select('nudge_opt_out')
    .eq('user_id', userId)
    .maybeSingle()

  return NextResponse.json({ nudge_opt_out: data?.nudge_opt_out ?? false })
}

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { nudge_opt_out } = await req.json()

  await supabase
    .from('approved_users')
    .update({ nudge_opt_out: !!nudge_opt_out })
    .eq('user_id', userId)

  return NextResponse.json({ ok: true, nudge_opt_out: !!nudge_opt_out })
}
