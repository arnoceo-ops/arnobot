export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import Anthropic from '@anthropic-ai/sdk'
import type { Message } from '@anthropic-ai/sdk/resources'
import { getText } from '@/lib/ai'
import { ARNOBOT_MANDAAT, RULE_NO_DASH, RULE_NO_ACCENTS, RULE_NO_MOETEN, RULE_NO_TIME_PRESSURE, RULE_NO_INVENTED_DETAILS, RULE_NEVER_BREAK_CHARACTER } from '@/lib/systemPrompt'
import { gatherAdminAnalyseContext } from '@/lib/adminAnalyse'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

async function checkAuth() {
  const cookieStore = await cookies()
  const token = cookieStore.get('arnobot_admin')?.value
  return token === process.env.ARNOBOT_ADMIN_KEY
}

function extractText(response: Message, label: string): string {
  if (response.stop_reason === 'refusal') {
    console.error(`[admin/analyse-chat] ${label} refusal`)
    return ''
  }
  return getText(response.content)
}

// Doorvragen op de ANALYSE-tab. Bewust niet opgeslagen (zie docs/TEAM_PLAN.md-gesprek van
// 25 aug 2026): het gesprek bestaat alleen voor het huidige bezoek, alleen de analyse zelf
// (het openingsbericht) blijft bewaard in arnobot_admin_analyses.
const CHAT_MAX_TOKENS = 1200

export async function POST(req: NextRequest) {
  if (!(await checkAuth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { userId, question, history, analyse } = await req.json().catch(() => ({}))
  if (!userId || typeof question !== 'string' || !question.trim()) {
    return NextResponse.json({ error: 'Ontbrekende velden' }, { status: 400 })
  }

  const context = await gatherAdminAnalyseContext(userId)
  if (!context) return NextResponse.json({ error: 'Gebruiker niet gevonden' }, { status: 404 })

  const historyText = Array.isArray(history) && history.length
    ? history.map((h: { role: string; content: string }) => `${h.role === 'admin' ? 'ARNO' : 'ARNOBOT'}: ${h.content}`).join('\n\n') + '\n\n'
    : ''

  const systeem = `Je bent ArnoBot's analytische blik, puur voor Arno zelf. Arno stelt je vervolgvragen over een gebruiker waarover je hem net een analyse gaf. Beantwoord kort en concreet, gegrond in de aangeleverde data. Verzin nooit iets dat niet in de data staat, zeg dan gewoon dat het er niet in staat.

${ARNOBOT_MANDAAT}

Schrijf over deze persoon in de derde persoon, nooit "jij" of "je" tegen de geanalyseerde gebruiker: je spreekt tegen Arno.
Gebruik NOOIT markdown-opmaak zoals **tekst** of *tekst*. Schrijf platte tekst.

${RULE_NO_DASH}

${RULE_NO_ACCENTS}

${RULE_NO_MOETEN}

${RULE_NO_TIME_PRESSURE}

${RULE_NO_INVENTED_DETAILS}

${RULE_NEVER_BREAK_CHARACTER}`

  const userContent = `VOLLEDIGE DATA OVER DEZE GEBRUIKER:\n${context.contextText}\n\nEERDER GEGEVEN ANALYSE:\n${typeof analyse === 'string' && analyse ? analyse : '(geen)'}\n\n${historyText}VERVOLGVRAAG VAN ARNO: ${question.trim()}`

  const callModel = () => anthropic.messages.create({
    model: 'claude-fable-5',
    max_tokens: CHAT_MAX_TOKENS,
    system: systeem,
    messages: [{ role: 'user', content: userContent }],
  })

  let antwoord = extractText(await callModel(), 'antwoord')
  if (!antwoord) {
    console.error('[admin/analyse-chat] leeg/refusal antwoord, retry')
    antwoord = extractText(await callModel(), 'antwoord retry')
  }
  if (!antwoord) {
    return NextResponse.json({ error: 'genereren_mislukt' }, { status: 500 })
  }

  return NextResponse.json({ antwoord })
}
