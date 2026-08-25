export const maxDuration = 120

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import type { Message } from '@anthropic-ai/sdk/resources'
import { getText } from '@/lib/ai'
import { ARNOBOT_MANDAAT, RULE_NO_DASH, RULE_NO_ACCENTS, RULE_NO_MOETEN, RULE_NO_TIME_PRESSURE, RULE_NO_INVENTED_DETAILS, RULE_NEVER_BREAK_CHARACTER } from '@/lib/systemPrompt'
import { gatherAdminAnalyseContext } from '@/lib/adminAnalyse'

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

function extractText(response: Message, label: string): string {
  if (response.stop_reason === 'refusal') {
    console.error(`[admin/analyse] ${label} refusal`)
    return ''
  }
  return getText(response.content)
}

// Fable 5, zelfde afweging als de coaching-hoofdsynthese en de meta-analyse: dit vervangt
// Arno's eigen handmatige uitzoekwerk vóór een echt gesprek, kwaliteit weegt zwaarder dan
// kosten. max_tokens ruim boven wat de vaste structuur (5 vaste onderdelen) normaal vraagt,
// voor Fable 5's thinking-overhead; bij afkapping één retry met dubbel budget.
const ANALYSE_MAX_TOKENS = 6000

function buildSystemPrompt(): string {
  return `Je bent ArnoBot's analytische blik, puur voor Arno zelf, nooit voor de gebruiker die je analyseert. Je krijgt de volledige, ruwe data van één gebruiker (gesprekken, coachingdata, profiel, eventueel teamdata) en schrijft daar een scherpe, bruikbare briefing over, ter voorbereiding op een echt gesprek dat Arno met deze persoon gaat voeren.

${ARNOBOT_MANDAAT}

Schrijf over deze persoon in de derde persoon (hij, zij, hen, of bij naam), nooit "jij" of "je": je spreekt hier tegen Arno, niet tegen de geanalyseerde gebruiker.
Structuur, in deze volgorde: (1) kort wie dit is, (2) terugkerende thema's en patronen, inclusief eventuele excuustaal, (3) sterktes en aandachtspunten, gegrond in concrete voorbeelden uit de data, (4) alleen als de gebruiker teambaas is: het Strategy People Execution-beeld en eventuele systemische signalen, (5) concrete openingsvragen of aandachtspunten voor het gesprek dat Arno gaat voeren.
Wees direct en concreet, geen vage samenvattingen. Onderbouw met specifieke voorbeelden uit de aangeleverde data.
Gebruik NOOIT markdown-opmaak zoals **tekst** of *tekst*. Schrijf platte tekst.

${RULE_NO_DASH}

${RULE_NO_ACCENTS}

${RULE_NO_MOETEN}

${RULE_NO_TIME_PRESSURE}

${RULE_NO_INVENTED_DETAILS}

${RULE_NEVER_BREAK_CHARACTER}`
}

export async function GET(req: NextRequest) {
  if (!(await checkAuth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = req.nextUrl.searchParams.get('userId')
  if (!userId) return NextResponse.json({ error: 'userId ontbreekt' }, { status: 400 })

  const [context, savedRes] = await Promise.all([
    gatherAdminAnalyseContext(userId),
    supabase.from('arnobot_admin_analyses').select('analyse_text, updated_at').eq('target_user_id', userId).maybeSingle(),
  ])

  if (!context) return NextResponse.json({ error: 'Gebruiker niet gevonden' }, { status: 404 })

  return NextResponse.json({
    user: { naam: context.naam, email: context.email, plan: context.plan, isTeamManager: context.isTeamManager, isTeamLid: context.isTeamLid, teamNaam: context.teamNaam },
    analyse: savedRes.data ? { text: savedRes.data.analyse_text, updatedAt: savedRes.data.updated_at } : null,
  })
}

export async function POST(req: NextRequest) {
  if (!(await checkAuth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { userId } = await req.json().catch(() => ({}))
  if (!userId) return NextResponse.json({ error: 'userId ontbreekt' }, { status: 400 })

  const [context, bestaandeRes] = await Promise.all([
    gatherAdminAnalyseContext(userId),
    supabase.from('arnobot_admin_analyses').select('generated_count').eq('target_user_id', userId).maybeSingle(),
  ])
  if (!context) return NextResponse.json({ error: 'Gebruiker niet gevonden' }, { status: 404 })
  const nieuweCount = (bestaandeRes.data?.generated_count ?? 0) + 1

  const callModel = (maxTokens = ANALYSE_MAX_TOKENS) => anthropic.messages.create({
    model: 'claude-fable-5',
    max_tokens: maxTokens,
    system: buildSystemPrompt(),
    messages: [{ role: 'user', content: `Analyseer deze gebruiker:\n\n${context.contextText}` }],
  })

  const response = await callModel()
  let analyse = extractText(response, 'analyse')
  if (!analyse) {
    console.error('[admin/analyse] lege/refusal analyse, retry')
    analyse = extractText(await callModel(), 'analyse retry')
  } else if (response.stop_reason === 'max_tokens') {
    console.error('[admin/analyse] analyse afgekapt op max_tokens, retry met meer ruimte')
    const retryText = extractText(await callModel(ANALYSE_MAX_TOKENS * 2), 'analyse retry (meer ruimte)')
    if (retryText) analyse = retryText
  }

  if (!analyse) {
    console.error('[admin/analyse] analyse na retry nog steeds leeg, userId:', userId)
    return NextResponse.json({ error: 'genereren_mislukt' }, { status: 500 })
  }

  const { data: saved, error } = await supabase
    .from('arnobot_admin_analyses')
    .upsert({ target_user_id: userId, analyse_text: analyse, generated_count: nieuweCount, updated_at: new Date().toISOString() }, { onConflict: 'target_user_id' })
    .select('updated_at, generated_count')
    .single()

  if (error) {
    console.error('[admin/analyse] opslaan mislukt:', error.message)
    return NextResponse.json({ error: 'opslaan_mislukt' }, { status: 500 })
  }

  return NextResponse.json({
    user: { naam: context.naam, email: context.email, plan: context.plan, isTeamManager: context.isTeamManager, isTeamLid: context.isTeamLid, teamNaam: context.teamNaam },
    analyse: { text: analyse, updatedAt: saved?.updated_at ?? new Date().toISOString(), count: saved?.generated_count ?? nieuweCount },
  })
}
