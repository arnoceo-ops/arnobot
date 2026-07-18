export const maxDuration = 30

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import Anthropic from '@anthropic-ai/sdk'
import { getText } from '@/lib/ai'
import { createClient } from '@supabase/supabase-js'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const PERSONA_LABELS: Record<string, Record<string, string>> = {
  verkoper: { dga: 'DGA', cfo: 'CFO', inkoopmanager: 'Inkoopmanager', sales_director: 'Sales Director', anders: 'Gesprekspartner' },
  salesbaas: { underperformer: 'Underperformer', marketing: 'Marketing Director', ceo: 'CEO', grote_klant: 'Grote Klant', anders: 'Gesprekspartner' },
  solopreneur: { prospect: 'Prospect', te_duur: 'Opdrachtgever (prijsbezwaar)', grote_klant: 'Grote klant', oud_klant: 'Oud-klant', anders: 'Gesprekspartner' },
  eindbaas: { investeerder: 'Investeerder', grote_klant: 'Grote klant', partner: 'Potentiële partner', mt_lid: 'MT-lid', anders: 'Gesprekspartner' },
}

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { messages, profiel, persona, weerstand, rolCategorie, sessionId } = body
  if (!Array.isArray(messages) || messages.length > 40) {
    return NextResponse.json({ error: 'Ongeldig verzoek' }, { status: 400 })
  }

  const { data: coachingScores } = await supabase
    .from('arnobot_coaching_scores')
    .select('msa_score, notes, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(3)

  const personaLabel = PERSONA_LABELS[rolCategorie]?.[persona] ?? persona
  const transcript = (messages as { role: string; content: string }[])
    .map(m => `${m.role === 'user' ? 'GEBRUIKER' : personaLabel.toUpperCase()}: ${m.content}`)
    .join('\n\n')

  const coachingContext = coachingScores?.length
    ? `Recente coaching-aantekeningen van deze gebruiker:\n${coachingScores.map(s => s.notes || '').filter(Boolean).join('\n')}`
    : ''

  const prompt = `Je bent een harde maar eerlijke sales coach. Analyseer dit sparring-gesprek en schrijf een debrief.

PERSONA: ${personaLabel} (weerstand: ${weerstand})
GESPREK (${messages.length} berichten):
${transcript}

${coachingContext}

Schrijf een debrief van maximaal 200 woorden. Geen titel, geen 'Debrief' als kopje. Begin direct met het eerste punt. Gebruik geen horizontale lijnen (---). Gebruik een lege regel als scheiding tussen punten. Gebruik NOOIT een streepje als leesteken (—, –, of een losstaand koppelteken). Gebruik geen accenten om woorden te benadrukken (geen écht, dát, zó). Herschrijf zinnen zonder streepjes.

1. Wat ging goed (1-2 zinnen)
2. Het kritieke moment: wanneer verloor de gebruiker de controle of het momentum? Citeer de exacte woorden.
3. Eén herkenbaar patroon (gebruik coaching-context als beschikbaar, anders observeer vanuit het gesprek)
4. Één concrete tip voor het volgende gesprek`

  const callModel = () => anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 600,
    messages: [{ role: 'user', content: prompt }],
  })

  let debrief = getText(await callModel().then(r => r.content))
  if (!debrief) {
    debrief = getText(await callModel().then(r => r.content))
  }
  if (!debrief) {
    console.error('[sparring/debrief] lege debrief na retry, sessionId:', sessionId ?? '(onbekend)')
    debrief = 'Er kon geen debrief worden gegenereerd voor dit gesprek.'
  }

  // Sparring-gebruik loggen, analoog aan arnobot_blog_sessions voor gewone gesprekken (die
  // tot vanavond compleet ontbrak, waardoor "hoe vaak wordt sparren gebruikt" onbeantwoordbaar
  // was). sessionId kan ontbreken bij oudere clients die nog niet zijn bijgewerkt, dan gewoon
  // niet loggen in plaats van de debrief zelf te laten falen.
  if (typeof sessionId === 'string' && sessionId) {
    const { error: logError } = await supabase.from('arnobot_sparring_sessions').upsert({
      user_id: userId,
      session_id: sessionId,
      rol_categorie: rolCategorie ?? null,
      persona: persona ?? null,
      weerstand: weerstand ?? null,
      debrief,
      message_count: messages.length,
    }, { onConflict: 'session_id' })
    if (logError) console.error('[sparring/debrief] loggen mislukt:', logError.message)
  }

  return NextResponse.json({ debrief })
}
