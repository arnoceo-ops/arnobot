import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export async function POST(req: NextRequest) {
  const { userId: managerId } = await auth()
  if (!managerId) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

  const { targetUserId, name } = await req.json()
  if (!targetUserId) return NextResponse.json({ error: 'Geen userId' }, { status: 400 })

  // Verify manager role and get team
  const { data: managerMember } = await supabase
    .from('arnobot_team_members')
    .select('team_id')
    .eq('user_id', managerId)
    .eq('role', 'manager')
    .single()

  if (!managerMember) return NextResponse.json({ error: 'Geen manager-toegang' }, { status: 403 })

  // Verify target is in same team
  const { data: targetMember } = await supabase
    .from('arnobot_team_members')
    .select('role')
    .eq('user_id', targetUserId)
    .eq('team_id', managerMember.team_id)
    .single()

  if (!targetMember) return NextResponse.json({ error: 'Lid niet gevonden' }, { status: 404 })

  // Fetch coaching profile + recent analyses
  const [coachingRes, analysesRes] = await Promise.all([
    supabase
      .from('arnobot_coaching')
      .select('mindset_score, mindset_diagnose, systeem_score, systeem_diagnose, actie_score, actie_diagnose, voortgang')
      .eq('user_id', targetUserId)
      .maybeSingle(),
    supabase
      .from('arnobot_analyses')
      .select('analyse_text, created_at')
      .eq('user_id', targetUserId)
      .order('created_at', { ascending: false })
      .limit(2),
  ])

  const coaching = coachingRes.data
  const analyses = analysesRes.data ?? []

  if (!coaching && analyses.length === 0) {
    return NextResponse.json({ error: 'Nog geen coachingdata beschikbaar voor dit lid.' }, { status: 422 })
  }

  // Build context string
  const lines: string[] = [`Naam: ${name}`]

  if (coaching) {
    lines.push('\nCOACHINGPROFIEL')
    if (coaching.mindset_score !== null) lines.push(`Mindset: ${coaching.mindset_score}/5 — ${coaching.mindset_diagnose ?? ''}`)
    if (coaching.systeem_score !== null) lines.push(`Systeem: ${coaching.systeem_score}/5 — ${coaching.systeem_diagnose ?? ''}`)
    if (coaching.actie_score !== null) lines.push(`Actie: ${coaching.actie_score}/5 — ${coaching.actie_diagnose ?? ''}`)
    if (coaching.voortgang) lines.push(`\nVoortgang: ${coaching.voortgang}`)
  }

  if (analyses.length > 0) {
    lines.push('\nRECENTE ANALYSE')
    lines.push(analyses[0].analyse_text)
  }

  const context = lines.join('\n')

  const systemPrompt = `Je bent een sales management coach die managers helpt om betere 1:1-gesprekken te voeren met hun verkopers. Je werkt uitsluitend op basis van het coachingprofiel dat je krijgt aangeleverd. Je ziet nooit ruwe gesprekken of klantnamen.

Schrijf een concrete 1:1-agenda voor de manager. Gebruik precies deze structuur en koppen:

WAT GAAT GOED
Noem één of twee concrete sterke punten op basis van de scores en diagnoses. Wees specifiek, geen lege complimenten.

AANDACHTSPUNT
Het voornaamste groeithema dit gesprek. Koppel het aan de laagste score of het patroon in de analyse. Één aandachtspunt, niet meerdere.

VRAGEN OM TE STELLEN
Geef precies drie gerichte vragen die de manager kan stellen. Vragen die de verkoper aan het denken zetten, niet vragen waarop ja of nee het antwoord is.

WAT TE OBSERVEREN
Twee concrete dingen die de manager kan letten op in dit gesprek of in de komende week.

Schrijf in jij-vorm gericht aan de manager. Geen inleiding, geen samenvatting achteraf. Direct beginnen met de eerste kop.`

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1200,
    system: systemPrompt,
    messages: [{ role: 'user', content: context }],
  })

  const agenda = response.content[0].type === 'text' ? response.content[0].text : ''
  return NextResponse.json({ agenda })
}
