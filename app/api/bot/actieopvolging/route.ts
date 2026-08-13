import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { berekenActiePatroon, moetVervolgvraagStellen } from '@/lib/actiePatroon'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ uitdaging: null })

  const { data } = await supabase
    .from('arnobot_blog_sessions')
    .select('session_id, uitdaging')
    .eq('user_id', userId)
    .not('uitdaging', 'is', null)
    .is('actie_status', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!data?.uitdaging) return NextResponse.json({ uitdaging: null })

  const patroon = await berekenActiePatroon(userId)
  const vraagVervolg = moetVervolgvraagStellen(patroon)

  return NextResponse.json({ uitdaging: data.uitdaging, sessionId: data.session_id, vraagVervolg })
}

export async function PATCH(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

  const { sessionId, status, klikMs, elaboratie } = await req.json()
  if (!sessionId || !status) return NextResponse.json({ error: 'Ontbrekende velden' }, { status: 400 })

  await supabase
    .from('arnobot_blog_sessions')
    .update({
      actie_status: status,
      actie_klik_ms: typeof klikMs === 'number' ? Math.round(klikMs) : null,
      actie_elaboratie: typeof elaboratie === 'string' && elaboratie.trim() ? elaboratie.trim().slice(0, 500) : null,
    })
    .eq('session_id', sessionId)
    .eq('user_id', userId)

  return NextResponse.json({ ok: true })
}
