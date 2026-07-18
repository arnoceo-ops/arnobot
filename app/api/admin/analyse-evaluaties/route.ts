export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { getText } from '@/lib/ai'
import { cookies } from 'next/headers'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get('arnobot_admin')?.value
  if (!token || token !== process.env.ARNOBOT_ADMIN_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: evaluaties } = await supabase
    .from('arnobot_evaluaties')
    .select('*')
    .order('created_at', { ascending: true })

  if (!evaluaties || evaluaties.length === 0) {
    return NextResponse.json({ error: 'Geen evaluaties gevonden' }, { status: 404 })
  }

  const tekst = evaluaties.map((e, i) => {
    const delen = [
      `EVALUATIE ${i + 1}: ${e.naam ?? 'anoniem'} (${new Date(e.created_at).toLocaleDateString('nl-NL')})`,
      e.frequentie ? `Frequentie: ${e.frequentie}` : '',
      e.onderdelen?.length ? `Onderdelen gebruikt: ${e.onderdelen.join(', ')}` : '',
      e.waardevol ? `Meest waardevol: ${e.waardevol}` : '',
      e.ontbreekt ? `Ontbreekt/werkt niet: ${e.ontbreekt}` : '',
      e.persona?.length ? `Ideale doelgroep: ${e.persona.join(', ')}${e.persona_anders ? ` (anders: ${e.persona_anders})` : ''}` : '',
      e.tariefstelling ? `Tariefstelling: ${e.tariefstelling}` : '',
      e.aanbevelen ? `Aanbevelen: ${e.aanbevelen}${e.aanbevelen_toelichting ? `: ${e.aanbevelen_toelichting}` : ''}` : '',
      e.slotwoord ? `Slotwoord: ${e.slotwoord}` : '',
    ].filter(Boolean).join('\n')
    return delen
  }).join('\n\n---\n\n')

  const callModel = () => anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1500,
    system: `Je bent Arno Diepeveen. Direct, ongefilterd. Je analyseert evaluaties van testers van jouw ArnoBot-app. Geen inleiding, geen conclusie-kopje. Gewoon de patronen, wat ze zeggen, wat het betekent, en wat je er concreet mee moet doen. Gebruik NOOIT een streepje als leesteken (—, –, of een losstaand koppelteken). Herschrijf zinnen zonder streepjes.`,
    messages: [{
      role: 'user',
      content: `Analyseer de onderstaande ${evaluaties.length} evaluatie${evaluaties.length !== 1 ? 's' : ''} en geef een heldere samenvatting per thema:
1. Gebruik (frequentie + onderdelen)
2. Wat werkt
3. Wat mist of stoort
4. Ideale doelgroep
5. Tariefstelling
6. Aanbevelingsbereidheid
7. De concrete actie die hieruit volgt

EVALUATIES:
${tekst}`,
    }],
  })

  let analyse = getText(await callModel().then(r => r.content))
  if (!analyse) {
    analyse = getText(await callModel().then(r => r.content))
  }
  if (!analyse) {
    console.error('[admin/analyse-evaluaties] lege analyse na retry')
    return NextResponse.json({ error: 'genereren_mislukt' }, { status: 500 })
  }
  return NextResponse.json({ analyse, count: evaluaties.length })
}
