export const maxDuration = 30

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import * as Sentry from '@sentry/nextjs'
import Anthropic from '@anthropic-ai/sdk'
import { getText } from '@/lib/ai'
import { getPersonaBeschrijving, WEERSTAND_INSTRUCTIE, WEERSTAND_OPENING_TOON } from '@/lib/sparringPersonas'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { rolCategorie, persona, weerstand, context } = body
  if (typeof context !== 'string' || !context.trim() || context.length > 500) {
    return NextResponse.json({ error: 'Ongeldig verzoek' }, { status: 400 })
  }

  const personaBeschrijving = getPersonaBeschrijving(rolCategorie, persona, context)
  const weerstandInstructie = WEERSTAND_INSTRUCTIE[weerstand] ?? WEERSTAND_INSTRUCTIE.stevig
  const openingToon = WEERSTAND_OPENING_TOON[weerstand] ?? WEERSTAND_OPENING_TOON.stevig

  const systemPrompt = `${personaBeschrijving}

${weerstandInstructie}

Context van de gebruiker: "${context}"

Jij opent dit gesprek als eerste, in karakter, gebaseerd op de context hierboven. ${openingToon}

REGELS:
- Blijf altijd volledig in karakter. Nooit coachen of hints geven. Je bent de tegenstander.
- Spreek in het Nederlands.
- Spreek de gebruiker ALTIJD aan met "jij" en "jou". Nooit "u". Ongeacht hoe senior of formeel de persoon is die je speelt.
- Praat zoals een echte mens in een zakelijk gesprek. Geen gestructureerde betogen, geen opsommingen. Kort en natuurlijk, zoals een echte openingszin.
- Geen samenvatting van jezelf of de situatie, gewoon de eerste zin van het gesprek zelf.
- Nooit de vierde wand doorbreken.
- Gebruik NOOIT een streepje als leesteken (—, –, of een losstaand koppelteken). Herschrijf zinnen zonder streepjes.
- Gebruik geen accenten om woorden te benadrukken (geen écht, dát, zó, dít, én).`

  const callModel = () => Sentry.startSpan({ name: 'sparring.opening', op: 'ai.claude' }, () =>
    anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 300,
      system: systemPrompt,
      messages: [{ role: 'user', content: 'Open het gesprek.' }],
    })
  )

  let answer = getText(await callModel().then(r => r.content))
  if (!answer) {
    answer = getText(await callModel().then(r => r.content))
  }
  if (!answer) {
    console.error('[sparring/open] lege opening na retry, userId:', userId)
    answer = 'Kom binnen. Ga zitten.'
  }
  return NextResponse.json({ answer })
}
