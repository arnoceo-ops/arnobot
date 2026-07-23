import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ plan: null }, { status: 401 })

  const { data } = await supabase
    .from('approved_users')
    .select('plan')
    .eq('user_id', userId)
    .single()

  return NextResponse.json({ plan: data?.plan ?? null })
}
