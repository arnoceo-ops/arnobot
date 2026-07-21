export const maxDuration = 30

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import * as Sentry from '@sentry/nextjs'
import Anthropic from '@anthropic-ai/sdk'
import { getText } from '@/lib/ai'
import { getPersonaBeschrijving, WEERSTAND_INSTRUCTIE } from '@/lib/sparringPersonas'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { message, history, rolCategorie, persona, weerstand, context } = body
  if (typeof message !== 'string' || message.length > 2000) {
    return NextResponse.json({ error: 'Ongeldig verzoek' }, { status: 400 })
  }
  if (Array.isArray(history) && history.length > 40) {
    return NextResponse.json({ error: 'Ongeldig verzoek' }, { status: 400 })
  }
  if (context && (typeof context !== 'string' || context.length > 500)) {
    return NextResponse.json({ error: 'Ongeldig verzoek' }, { status: 400 })
  }

  const personaBeschrijving = getPersonaBeschrijving(rolCategorie, persona, context)
  const weerstandInstructie = WEERSTAND_INSTRUCTIE[weerstand] ?? WEERSTAND_INSTRUCTIE.stevig

  const systemPrompt = `${personaBeschrijving}

${weerstandInstructie}

${context ? `Context van de gebruiker: "${context}"` : ''}

REGELS:
- Blijf altijd volledig in karakter. Nooit coachen of hints geven. Je bent de tegenstander.
- Spreek in het Nederlands.
- Spreek de gebruiker ALTIJD aan met "jij" en "jou". Nooit "u". Ongeacht hoe senior of formeel de persoon is die je speelt.
- Praat zoals een echte mens in een zakelijk gesprek. Geen gestructureerde betogen, geen opsommingen. Reageer op wat er net gezegd is. Gebruik de lengte die het gesprek vraagt, niet meer en niet minder.
- Nooit de vierde wand doorbreken.
- Gebruik NOOIT een streepje als leesteken (—, –, of een losstaand koppelteken). Herschrijf zinnen zonder streepjes.
- Gebruik geen accenten om woorden te benadrukken (geen écht, dát, zó, dít, én).
- Ga altijd uit van wat de gebruiker zegt. Zeg nooit "ik herinner me dat niet" of "dat heb ik niet gezegd". Accepteer de premisse als waar en reageer vanuit jouw eigen positie.
- Als de gebruiker expliciet uit het spel stapt ("hoe doe ik het?", "stop even", "geef feedback"), reageer dan kort en neutraal: "We stoppen hier. De debrief volgt direct." Niet meer dan dat.`

  const messages = [
    ...(history || []),
    { role: 'user' as const, content: message },
  ]

  const callModel = () => Sentry.startSpan({ name: 'sparring.main-response', op: 'ai.claude' }, () =>
    anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      system: systemPrompt,
      messages,
    })
  )

  let answer = getText(await callModel().then(r => r.content))
  if (!answer) {
    answer = getText(await callModel().then(r => r.content))
  }
  if (!answer) {
    console.error('[sparring/chat] leeg antwoord na retry, userId:', userId)
    answer = 'Sorry, kun je dat anders verwoorden?'
  }
  return NextResponse.json({ answer })
}
