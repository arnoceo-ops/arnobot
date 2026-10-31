export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { haalGeheugenContext, bouwProfielContext } from '@/lib/geheugenContext'

// Toont EXACT welke geheugen- en gebruikerscontext de hoofdchat voor een gebruiker in de prompt zet
// (zelfde functies als app/api/chat/route.ts, lib/geheugenContext.ts), zonder het model aan te
// roepen en zonder iets te schrijven. Bedoeld om het geheugen op echte data te controleren:
// staat er geen oude situatie als feit in, klopt datum en naam. Alleen met de admin-cookie.

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function checkAuth() {
  const cookieStore = await cookies()
  const token = cookieStore.get('arnobot_admin')?.value
  return !!token && token === process.env.ARNOBOT_ADMIN_KEY
}

export async function POST(req: NextRequest) {
  if (!(await checkAuth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { userId, question, sessionId, history, negeerSessieIds } = await req.json().catch(() => ({}))
  if (typeof userId !== 'string' || !userId || typeof question !== 'string' || !question) {
    return NextResponse.json({ error: 'userId en question zijn verplicht' }, { status: 400 })
  }
  const hist = Array.isArray(history) ? history.slice(0, 40) : undefined
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  const negeer = Array.isArray(negeerSessieIds) ? negeerSessieIds.filter((x: unknown): x is string => typeof x === 'string' && UUID.test(x)).slice(0, 20) : []

  const [{ data: gebruiker }, { data: profielRij }] = await Promise.all([
    supabase.from('approved_users').select('plan, voornaam').eq('user_id', userId).maybeSingle(),
    supabase.from('arnobot_blog_profiles').select('profiel').eq('user_id', userId).maybeSingle(),
  ])
  if (!gebruiker) return NextResponse.json({ error: 'Gebruiker niet gevonden' }, { status: 404 })

  const plan = (gebruiker.plan as 'basis' | 'premium' | 'team') ?? 'basis'
  const voornaam = String(gebruiker.voornaam ?? '').replace(/[\r\n]+/g, ' ').trim().slice(0, 40)

  const geheugen = await haalGeheugenContext(supabase, {
    userId,
    sessionId: typeof sessionId === 'string' && sessionId ? sessionId : `preview-${Date.now()}`,
    question,
    history: hist,
    plan,
    negeerSessieIds: negeer,
  })

  return NextResponse.json({
    plan,
    profielContext: bouwProfielContext(profielRij?.profiel ?? null, voornaam),
    ...geheugen,
  })
}
