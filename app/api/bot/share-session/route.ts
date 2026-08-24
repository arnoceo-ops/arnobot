import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { randomBytes } from 'crypto'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

  const { data } = await supabase
    .from('arnobot_shared_sessions')
    .select('session_id')
    .eq('user_id', userId)

  return NextResponse.json({ sharedIds: (data ?? []).map(r => r.session_id) })
}

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

  const { sessionId } = await req.json().catch(() => ({}))
  if (!sessionId) return NextResponse.json({ error: 'Geen sessie opgegeven' }, { status: 400 })

  const { data: session } = await supabase
    .from('arnobot_blog_sessions')
    .select('session_id')
    .eq('session_id', sessionId)
    .eq('user_id', userId)
    .maybeSingle()

  if (!session) return NextResponse.json({ error: 'Sessie niet gevonden' }, { status: 404 })

  const { data: existing } = await supabase
    .from('arnobot_shared_sessions')
    .select('token')
    .eq('session_id', sessionId)
    .eq('user_id', userId)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ url: `https://arno.bot/gesprek/${existing.token}` })
  }

  const token = randomBytes(8).toString('base64url')
  await supabase.from('arnobot_shared_sessions').insert({ token, user_id: userId, session_id: sessionId })

  return NextResponse.json({ url: `https://arno.bot/gesprek/${token}` })
}

export async function DELETE(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

  const sessionId = req.nextUrl.searchParams.get('sessionId')
  if (!sessionId) return NextResponse.json({ error: 'Geen sessie opgegeven' }, { status: 400 })

  const { error } = await supabase
    .from('arnobot_shared_sessions')
    .delete()
    .eq('user_id', userId)
    .eq('session_id', sessionId)

  if (error) return NextResponse.json({ error: 'Intrekken mislukt' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
