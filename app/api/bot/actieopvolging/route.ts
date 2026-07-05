import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ uitdaging: null })

  const { data } = await supabase
    .from('arnobot_blog_sessions')
    .select('id, uitdaging')
    .eq('user_id', userId)
    .not('uitdaging', 'is', null)
    .is('actie_status', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!data?.uitdaging) return NextResponse.json({ uitdaging: null })

  return NextResponse.json({ uitdaging: data.uitdaging, sessionId: data.id })
}

export async function PATCH(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

  const { sessionId, status } = await req.json()
  if (!sessionId || !status) return NextResponse.json({ error: 'Ontbrekende velden' }, { status: 400 })

  await supabase
    .from('arnobot_blog_sessions')
    .update({ actie_status: status })
    .eq('id', sessionId)
    .eq('user_id', userId)

  return NextResponse.json({ ok: true })
}
