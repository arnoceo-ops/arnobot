export const maxDuration = 60

import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { getText } from '@/lib/ai'
import { ANALYSE_SYSTEM_PROMPT, actieOpvolgingBlok, contextBlok, schoonContext, sessiesAlsTekst } from '@/lib/analyseContext'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

const MAX_AANVULLINGEN_PER_DAG = 5

// Aanvulling op een bestaande analyse: de gebruiker vertelt wat er buiten ArnoBot is gedaan en
// ArnoBot schrijft op basis daarvan een bijgewerkte kijk. Privé: wordt niet meegenomen bij DEEL MET
// MANAGER (die leest alleen analyse_text).
export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const analyseId = typeof body.analyseId === 'string' ? body.analyseId : ''
  const context = schoonContext(body.context)
  if (!analyseId || !context) return NextResponse.json({ error: 'ongeldig' }, { status: 400 })

  const { data: analyse } = await supabase
    .from('arnobot_analyses')
    .select('id, analyse_text, session_ids')
    .eq('id', analyseId)
    .eq('user_id', userId)
    .maybeSingle()
  if (!analyse) return NextResponse.json({ error: 'niet_gevonden' }, { status: 404 })

  const vandaag = new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z'
  const { count } = await supabase
    .from('arnobot_analyses')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('aanvulling_at', vandaag)
  if ((count ?? 0) >= MAX_AANVULLINGEN_PER_DAG) {
    return NextResponse.json({ error: 'dagelijks_limiet' }, { status: 429 })
  }

  const ids = Array.isArray(analyse.session_ids) ? (analyse.session_ids as string[]) : []
  const { data: sessions } = ids.length > 0
    ? await supabase
        .from('arnobot_blog_sessions')
        .select('title, summary, created_at')
        .eq('user_id', userId)
        .in('session_id', ids)
    : { data: [] }

  const userContent = `Eerder zei je dit over deze persoon:\n"${analyse.analyse_text}"\n\nDe persoon reageert nu zelf met wat er buiten ArnoBot is gedaan. Schrijf een aanvulling op je analyse in precies drie delen, elk met een eigen kopregel in hoofdletters op een aparte regel, gevolgd door één alinea gewone tekst: WAT JE ME VERTELD HEBT, WAT DIT VERANDERT, VOLGENDE STAP. Onder WAT DIT VERANDERT benoem je eerlijk welke conclusies uit je eerdere analyse niet meer kloppen of scherper moeten. Geen andere kopjes, geen opsomming.${await actieOpvolgingBlok(userId)}${contextBlok(context)}\n\nGESPREKKEN WAAR DE ANALYSE OP GEBASEERD WAS:\n${sessiesAlsTekst(sessions ?? [])}`

  const callModel = () => anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1200,
    system: ANALYSE_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userContent }],
  })

  let tekst = getText(await callModel().then(r => r.content))
  if (!tekst) tekst = getText(await callModel().then(r => r.content))
  if (!tekst) {
    console.error('[bot/coaching-analyse/aanvulling] lege aanvulling na retry, userId:', userId)
    return NextResponse.json({ error: 'genereren_mislukt' }, { status: 500 })
  }

  const aanvullingAt = new Date().toISOString()
  const { error } = await supabase
    .from('arnobot_analyses')
    .update({ aanvulling_context: context, aanvulling_tekst: tekst, aanvulling_at: aanvullingAt })
    .eq('id', analyseId)
    .eq('user_id', userId)
  if (error) {
    console.error('[bot/coaching-analyse/aanvulling] opslaan mislukt:', error.message)
    return NextResponse.json({ error: 'opslaan_mislukt' }, { status: 500 })
  }

  return NextResponse.json({ aanvulling_tekst: tekst, aanvulling_context: context, aanvulling_at: aanvullingAt })
}
