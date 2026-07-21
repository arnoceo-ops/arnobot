import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

  const { data } = await supabase
    .from('arnobot_sparring_sessions')
    .select('session_id, rol_categorie, persona, weerstand, debrief, message_count, favoriet, created_at')
    .eq('user_id', userId)
    .not('debrief', 'is', null)
    .order('created_at', { ascending: false })

  return NextResponse.json({ history: data ?? [] })
}

export async function PATCH(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

  const { sessionId, favoriet } = await req.json().catch(() => ({}))
  if (typeof sessionId !== 'string' || typeof favoriet !== 'boolean') {
    return NextResponse.json({ error: 'Ongeldig verzoek' }, { status: 400 })
  }

  const { error } = await supabase
    .from('arnobot_sparring_sessions')
    .update({ favoriet })
    .eq('user_id', userId)
    .eq('session_id', sessionId)

  if (error) return NextResponse.json({ error: 'Bijwerken mislukt' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
