import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function PATCH(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

  const { sessionId, done } = await req.json()
  if (!sessionId) return NextResponse.json({ error: 'sessionId verplicht' }, { status: 400 })

  const { error } = await supabase
    .from('arnobot_blog_sessions')
    .update({ uitdaging_done: done })
    .eq('session_id', sessionId)
    .eq('user_id', userId)

  if (error) {
    console.error('[uitdaging-done]', error.message)
    return NextResponse.json({ error: 'Opslaan mislukt' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
