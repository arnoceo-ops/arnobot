import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

  const { data } = await supabase
    .from('arnobot_coaching_history')
    .select('id, created_at, mindset_score, mindset_diagnose, systeem_score, systeem_diagnose, actie_score, actie_diagnose, voortgang')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  return NextResponse.json({ history: data ?? [] })
}
