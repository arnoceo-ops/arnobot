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
  const { rolCategorie, persona, weerstand, context, profiel } = body
  if (context !== undefined && context !== null && (typeof context !== 'string' || context.length > 500)) {
    return NextResponse.json({ error: 'Ongeldig verzoek' }, { status: 400 })
  }
  // Bij persona "anders" is context de rolomschrijving zelf (wie ArnoBot speelt), niet
  // losse scène-aankleding, dus daar blijft context altijd verplicht.
  if (persona === 'anders' && !(typeof context === 'string' && context.trim())) {
    return NextResponse.json({ error: 'Ongeldig verzoek' }, { status: 400 })
  }

  const heeftContext = typeof context === 'string' && context.trim().length > 0
  const personaBeschrijving = getPersonaBeschrijving(rolCategorie, persona, context)
  const weerstandInstructie = WEERSTAND_INSTRUCTIE[weerstand] ?? WEERSTAND_INSTRUCTIE.stevig
  const openingToon = WEERSTAND_OPENING_TOON[weerstand] ?? WEERSTAND_OPENING_TOON.stevig

  const profielText = profiel
    ? `Profiel van de gebruiker: rol=${profiel.rol || 'onbekend'}, markt=${Array.isArray(profiel.markt) ? profiel.markt.join(', ') : profiel.markt || 'onbekend'}, verkoopt=${profiel.wat_verkoop_je || 'onbekend'}, ideale klant=${profiel.ideale_klant || 'onbekend'}, grootste uitdaging=${profiel.uitdaging || 'onbekend'}.`
    : ''

  const situatieInstructie = heeftContext
    ? `Context van de gebruiker: "${context}"

Jij opent dit gesprek als eerste, in karakter, gebaseerd op de context hierboven. ${openingToon}`
    : `De gebruiker heeft geen specifieke situatie meegegeven. ${profielText} Verzin zelf een realistische, passende situatie voor dit gesprek op basis van dit profiel en jouw rol. Jij opent het gesprek als eerste, in karakter, alsof die situatie al aan de gang is. ${openingToon}`

  const systemPrompt = `${personaBeschrijving}

${weerstandInstructie}

${situatieInstructie}

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
