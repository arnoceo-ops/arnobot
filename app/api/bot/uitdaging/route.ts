export const maxDuration = 15

import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { getText } from '@/lib/ai'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

function getDayOfWeek(): number {
  // 0 = Sunday, 6 = Saturday — in Amsterdam time (UTC+1/+2)
  const now = new Date()
  const amsterdam = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Amsterdam' }))
  return amsterdam.getDay()
}

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

  const day = getDayOfWeek()
  const isWeekend = day === 0 || day === 6

  const [coachingRes, sessionsRes, analysesRes, profielRes] = await Promise.all([
    supabase
      .from('arnobot_coaching')
      .select('focus, blinde_vlekken, ontwikkelpunten, opdracht')
      .eq('user_id', userId)
      .single(),
    supabase
      .from('arnobot_blog_sessions')
      .select('title, summary, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('arnobot_analyses')
      .select('analyse_text')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1),
    supabase
      .from('arnobot_blog_profiles')
      .select('profiel')
      .eq('user_id', userId)
      .single(),
  ])

  const coaching = coachingRes.data
  const sessions = sessionsRes.data ?? []
  const analyse = analysesRes.data?.[0]?.analyse_text ?? ''
  const profiel = profielRes.data?.profiel

  const contextParts: string[] = []

  if (profiel) {
    contextParts.push(`PROFIEL: ${profiel.rol || ''}${profiel.markt ? `, ${Array.isArray(profiel.markt) ? profiel.markt.join('/') : profiel.markt}` : ''}. Verkoopt: ${profiel.wat_verkoop_je || 'onbekend'}. Uitdaging: ${profiel.uitdaging || 'onbekend'}.`)
  }

  if (coaching?.focus || coaching?.blinde_vlekken) {
    const punten = coaching.ontwikkelpunten ? (coaching.ontwikkelpunten as string[]).join(' / ') : ''
    contextParts.push(`COACHING: Focus op ${coaching.focus || 'onbekend'}. Blinde vlekken: ${coaching.blinde_vlekken || 'onbekend'}. Ontwikkelpunten: ${punten}. Opdracht: ${coaching.opdracht || 'onbekend'}.`)
  }

  if (sessions.length > 0) {
    const sessiesSummary = sessions
      .map(s => s.summary ? `"${s.title}": ${s.summary}` : `"${s.title}"`)
      .join(' | ')
    contextParts.push(`LAATSTE ${sessions.length} GESPREKKEN: ${sessiesSummary}`)
  }

  if (analyse) {
    contextParts.push(`PATROONANALYSE: ${analyse.slice(0, 400)}`)
  }

  const context = contextParts.join('\n\n')

  const weekendInstructie = isWeekend
    ? `Het is weekend. Stel een reflectieve mindsetvraag die iemand met zichzelf laat nadenken over wie hij is als salesprofessional. Geen acties, geen bellen, geen afspraken. Filosofisch, confronterend op het niveau van overtuigingen en identiteit.`
    : `Stel een mindsetvraag die rechtstreeks aansluit op de patronen en blinde vlekken uit het coachingsprofiel hierboven. Geen acties als "bel nu een klant" of "maak een lijst". Die staan al in het coachingsdocument. Richt je op overtuigingen, zelfbeeld, en de manier van denken die bepaalt of iemand groeit of stilstaat.`

  const hasContext = contextParts.length > 0

  const prompt = hasContext
    ? `Je bent Arno Diepeveen. Genereer één dagelijkse mindsetvraag op basis van dit coachingsprofiel.\n\n${context}\n\n${weekendInstructie}\n\nRegel: alleen de vraag zelf. Max 2 zinnen. Spreek aan met "je". Geen inleiding, geen uitleg. Geen acties of opdrachten, alleen een vraag die raakt aan mindset, overtuiging of identiteit. Gebruik alleen wat je weet uit het bovenstaande profiel; verzin geen details. Gebruik nooit een em dash (—): gebruik een komma, dubbele punt of nieuwe zin.`
    : `Je bent Arno Diepeveen. ${weekendInstructie}\n\nRegel: alleen de vraag zelf. Max 2 zinnen. Spreek aan met "je". Geen inleiding, geen uitleg. Gebruik nooit een em dash (—): gebruik een komma, dubbele punt of nieuwe zin.`

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 120,
    messages: [{ role: 'user', content: prompt }],
  })

  const uitdaging = getText(response.content).trim()

  return NextResponse.json({ uitdaging })
}
