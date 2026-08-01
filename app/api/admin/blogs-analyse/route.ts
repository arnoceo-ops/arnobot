export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { getText } from '@/lib/ai'
import { E2E_TEST_USER_ID, MANUAL_TEST_USER_ID } from '@/lib/internalTestAccounts'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

async function checkAuth() {
  const cookieStore = await cookies()
  const token = cookieStore.get('arnobot_admin')?.value
  return token === process.env.ARNOBOT_ADMIN_KEY
}

export async function GET() {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('arnobot_idee_analyses')
    .select('id, created_at, period_days, session_count, analyse_text')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[admin/blogs-analyse]', error.message)
    return NextResponse.json({ error: 'Ophalen mislukt' }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { days } = await req.json()
  if (!days || typeof days !== 'number') {
    return NextResponse.json({ error: 'Ongeldig verzoek' }, { status: 400 })
  }

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
  const ownerUserId = process.env.ARNOBOT_OWNER_USER_ID

  let query = supabase
    .from('arnobot_blog_sessions')
    .select('title, summary, created_at')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .neq('user_id', E2E_TEST_USER_ID)
    .neq('user_id', MANUAL_TEST_USER_ID)

  if (ownerUserId) {
    query = query.neq('user_id', ownerUserId)
  }

  const { data: sessions } = await query

  if (!sessions?.length) {
    return NextResponse.json({ analyse: null, count: 0, id: null })
  }

  const sessiesText = sessions
    .map((s, i) =>
      `Gesprek ${i + 1} (${new Date(s.created_at).toLocaleDateString('nl-NL')}): ${s.title}${s.summary ? `\n${s.summary}` : ''}`
    )
    .join('\n\n')

  const periodeLabel = days === 7 ? 'afgelopen week' : days === 30 ? 'afgelopen maand' : 'afgelopen kwartaal'

  const callModel = () => anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1500,
    system: `Je schrijft een redactionele briefing voor Arno Diepeveen. Arno is salesexpert en schrijft over sales, leiderschap en commercieel succes voor managers en eindbazen. De input zijn gesprekstitels en samenvattingen van gesprekken die gebruikers de ${periodeLabel} hebben gevoerd met ArnoBot, zijn AI-salescoach. Geef een briefing in drie onderdelen: THEMA'S, PATRONEN, BLOGINSPIRATIE. Schrijf direct. Geen inleiding. Begin gewoon. Gebruik NOOIT een streepje als leesteken (—, –, of een losstaand koppelteken). Herschrijf zinnen zonder streepjes. Gebruik het woord "moeten" niet.`,
    messages: [{
      role: 'user',
      content: `${sessions.length} gesprekken uit de ${periodeLabel}:\n\n${sessiesText}\n\nGeef de briefing in drie blokken:\n\nTHEMA'S DEZE PERIODE\n[Wat speelt er? Welke uitdagingen komen terug? Schrijf in alinea's. Max 200 woorden.]\n\nPATRONEN\n[Wat is structureel? Wat komt meerdere keren terug? Max 150 woorden.]\n\nBLOGINSPIRATIE\n[4-5 concrete artikel-suggesties. Per suggestie: een werktitel en één zin over de invalshoek. Specifiek genoeg om morgen mee te beginnen.]`,
    }],
  })

  let analyse = getText(await callModel().then(r => r.content))
  if (!analyse) {
    analyse = getText(await callModel().then(r => r.content))
  }
  if (!analyse) {
    console.error('[admin/blogs-analyse] lege analyse na retry')
    return NextResponse.json({ error: 'genereren_mislukt' }, { status: 500 })
  }

  const { data: saved } = await supabase
    .from('arnobot_idee_analyses')
    .insert({ period_days: days, session_count: sessions.length, analyse_text: analyse })
    .select('id')
    .single()

  return NextResponse.json({ analyse, count: sessions.length, id: saved?.id ?? null })
}
