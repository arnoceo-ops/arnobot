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

  const [coachingRes, sessionsRes, sessionCountRes, analysesRes, profielRes] = await Promise.all([
    supabase
      .from('arnobot_coaching')
      .select('focus, blinde_vlekken, ontwikkelpunten, opdracht')
      .eq('user_id', userId)
      .single(),
    supabase
      .from('arnobot_blog_sessions')
      .select('title, summary, created_at')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('arnobot_blog_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .is('deleted_at', null),
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
  const totalSessionCount = sessionCountRes.count ?? 0

  // Weekend: altijd een generieke, inspirerende gedachte, geen gesprekscontext.
  // Doordeweeks: pas personaliseren op patronen/coachingdoc vanaf 3 gesprekken.
  // Daaronder is er te weinig basis en voelt de gedachte willekeurig (gevonden 29 aug 2026:
  // gebruiker met 1 gesprek kreeg een gedachte over een onderwerp dat hij niet herkende).
  const usePersonalContext = !isWeekend && totalSessionCount >= 3

  const contextParts: string[] = []

  if (profiel) {
    contextParts.push(`PROFIEL: ${profiel.rol || ''}${profiel.markt ? `, ${Array.isArray(profiel.markt) ? profiel.markt.join('/') : profiel.markt}` : ''}. Verkoopt: ${profiel.wat_verkoop_je || 'onbekend'}.`)
  }

  if (usePersonalContext) {
    if (coaching?.focus || coaching?.blinde_vlekken) {
      const punten = coaching.ontwikkelpunten ? (coaching.ontwikkelpunten as string[]).join(' / ') : ''
      contextParts.push(`COACHINGSPROFIEL: Focus op ${coaching.focus || 'onbekend'}. Ontwikkelpunten: ${punten}.`)
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
  }

  const context = contextParts.join('\n\n')

  const weekendInstructie = `Het is weekend. Maak er een gedachte van over het vak en het bestaan van een salesprofessional, iets om even bij stil te staan met een kop koffie. Niet over techniek, niet over targets, niet over acties. Iets dat perspectief geeft of inspireert, met een eerlijke ondertoon.`

  const doordeweeksInstructie = usePersonalContext
    ? `Sluit aan op de rol en de patronen hierboven, maar richt je op de manier van denken erachter, niet op een concrete verkooptechniek. Maak het herkenbaar en vooruitkijkend. Als uit de gesprekken blijkt dat iemand ergens groeit, verdiep die richting in plaats van een oud probleem te herhalen alsof het nog openstaat.`
    : `Maak een gedachte over de mindset van goede verkopers die breed herkenbaar is. Vooruitkijkend en inspirerend, met een eerlijk randje.`

  const toonInstructie = `Toon: je bent Arno Diepeveen, een scherpe mentor die in de lezer gelooft. De gedachte mag prikkelen en een randje hebben, maar iemand moet het graag lezen en er energie van krijgen. Geen verhoor, geen opsomming van wat er misgaat, geen woorden als "blinde vlek", "zwakte" of "waarom lukt het je niet". Geen vleierij of loze complimenten. Reik een idee aan dat een deur opent, niet een spiegel die een fout aanwijst.`

  const vormInstructie = `Vorm: kort. Ofwel een enkele rake gedachte van een of twee zinnen, ofwel een korte observatie gevolgd door een open vraag die uitnodigt om vooruit te denken, niet om jezelf te verdedigen. Kies zelf wat het sterkst is. Nooit meer dan drie zinnen. Geen inleiding, geen uitleg, geen opdrachten of acties.`

  const taalInstructie = `Schrijf in verzorgd Nederlands. Lees de zin terug voordat je antwoordt: als een bijzin grammaticaal onhandig loopt, herschrijf hem. Gebruik reflexieve constructies correct (bijvoorbeeld "waarbij je je" in plaats van "die je"). Geen accenten om woorden te benadrukken (geen écht, dát, zó, dít, én). Gebruik NOOIT markdown-opmaak zoals **tekst** of *tekst*. Schrijf platte tekst. Gebruik NOOIT een streepje als leesteken (—, –, of een losstaand koppelteken). Herschrijf zinnen zonder streepjes.`

  const prompt = [
    `Je bent Arno Diepeveen. Genereer de "thought of the day" voor een salesprofessional: iets korts om vandaag over na te denken.`,
    context,
    isWeekend ? weekendInstructie : doordeweeksInstructie,
    toonInstructie,
    vormInstructie,
    `Spreek de lezer ALTIJD aan met "je" en "jij". Nooit "u". Ongeacht hoe senior of formeel de persoon is.`,
    usePersonalContext ? `Gebruik alleen wat je weet uit het bovenstaande profiel; verzin geen details.` : '',
    taalInstructie,
  ].filter(Boolean).join('\n\n')

  const callModel = () => anthropic.messages.create({
    model: 'claude-fable-5',
    max_tokens: 600,
    messages: [{ role: 'user', content: prompt }],
  })

  let response
  try {
    response = await callModel()
  } catch (err: unknown) {
    console.error('[uitdaging] generate error', err)
    return NextResponse.json({ error: 'generate_error' }, { status: 500 })
  }

  if (response.stop_reason === 'refusal') {
    console.error('[uitdaging] refusal')
    return NextResponse.json({ error: 'generate_error' }, { status: 500 })
  }

  let uitdaging = getText(response.content).trim()

  if (!uitdaging) {
    console.error('[uitdaging] leeg antwoord, retry')
    try {
      response = await callModel()
    } catch (err: unknown) {
      console.error('[uitdaging] generate error bij retry', err)
      return NextResponse.json({ error: 'generate_error' }, { status: 500 })
    }
    if (response.stop_reason === 'refusal') {
      console.error('[uitdaging] refusal bij retry')
      return NextResponse.json({ error: 'generate_error' }, { status: 500 })
    }
    uitdaging = getText(response.content).trim()
  }

  if (!uitdaging) {
    console.error('[uitdaging] leeg antwoord na retry')
    return NextResponse.json({ error: 'generate_error' }, { status: 500 })
  }

  return NextResponse.json({ uitdaging })
}
