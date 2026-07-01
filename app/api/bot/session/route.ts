import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ messages: [], history: [] })

  const sessionId = req.nextUrl.searchParams.get('sessionId')
  if (!sessionId) return NextResponse.json({ messages: [], history: [] })

  const { data, error } = await supabase
    .from('arnobot_rds_logs')
    .select('question, answer, created_at')
    .eq('user_id', userId)
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })

  if (error || !data?.length) return NextResponse.json({ messages: [], history: [] })

  const messages: Array<{ role: 'user' | 'arno'; content: string }> = []
  const history: Array<{ role: string; content: string }> = []

  for (const row of data) {
    messages.push({ role: 'user', content: row.question })
    messages.push({ role: 'arno', content: row.answer })
    history.push({ role: 'user', content: row.question })
    history.push({ role: 'assistant', content: row.answer })
  }

  return NextResponse.json({ messages, history })
}

export async function DELETE(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

  const sessionId = req.nextUrl.searchParams.get('sessionId')
  if (!sessionId) return NextResponse.json({ error: 'Geen sessionId' }, { status: 400 })

  await supabase
    .from('arnobot_blog_sessions')
    .update({ deleted_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('session_id', sessionId)

  return NextResponse.json({ ok: true })
}
