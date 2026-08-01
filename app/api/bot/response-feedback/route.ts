import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

  const { log_id, feedback } = await req.json()
  if (!log_id || !['pos', 'neg'].includes(feedback)) {
    return NextResponse.json({ error: 'Ongeldige input' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('arnobot_rds_logs')
    .update({ feedback })
    .eq('id', log_id)
    .eq('user_id', userId)
    .is('feedback', null)
    .select('id')

  if (error) {
    console.error('[response-feedback]', error.message)
    return NextResponse.json({ error: 'Opslaan mislukt' }, { status: 500 })
  }
  if (!data || data.length === 0) return NextResponse.json({ error: 'Al beoordeeld' }, { status: 409 })
  return NextResponse.json({ ok: true })
}
