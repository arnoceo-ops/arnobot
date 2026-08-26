export const maxDuration = 30

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import * as Sentry from '@sentry/nextjs'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { getText } from '@/lib/ai'
import { getPersonaBeschrijving, WEERSTAND_INSTRUCTIE, WEERSTAND_OPENING_TOON } from '@/lib/sparringPersonas'
import { logEvent } from '@/lib/events'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Basic krijgt 1 sparsessie per dag (zie /prijzen: "Dagelijks sparren" vs Pro's "Onbeperkt
  // chatten en oefenen"), Pro/Team onbeperkt. Vóór 2026-08-26 had deze route geen enkele
  // plan-check, zie lib/kostenTarieven.ts regel 228 waar dit al in juli was gesignaleerd maar
  // nooit opgevolgd. Geteld via arnobot_events (sparring_open), niet via
  // arnobot_sparring_sessions: die tabel krijgt pas een rij bij het debriefen aan het eind,
  // en alleen als de gebruiker ook echt heeft gereageerd (zie sparring/debrief), dus een
  // geopende maar nooit afgesloten sessie zou anders niet meetellen.
  const [planRes, todayRes] = await Promise.all([
    supabase.from('approved_users').select('plan').eq('user_id', userId).single(),
    supabase.from('arnobot_events').select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('event_name', 'sparring_open')
      .gte('created_at', new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z'),
  ])
  const plan = (planRes.data?.plan as 'basis' | 'premium' | 'team') ?? 'basis'
  const todayCount = todayRes.count ?? 0
  if (plan === 'basis' && todayCount >= 1) {
    return NextResponse.json({ error: 'dagelijks_limiet', plan: 'basis' }, { status: 429 })
  }

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

  let answer = ''
  for (let i = 0; i < 2 && !answer; i++) {
    try {
      answer = getText(await callModel().then(r => r.content))
    } catch (e) {
      Sentry.captureException(e)
    }
  }
  if (!answer) {
    console.error('[sparring/open] lege opening na retry, userId:', userId)
    return NextResponse.json({ error: 'Kon geen opening genereren' }, { status: 502 })
  }
  await logEvent(userId, 'sparring_open')
  return NextResponse.json({ answer })
}
