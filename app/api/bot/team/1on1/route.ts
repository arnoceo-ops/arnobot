import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

function extractAandachtspunt(agenda: string): string {
  const lines = agenda.split('\n')
  let capturing = false
  const parts: string[] = []
  for (const line of lines) {
    const t = line.trim()
    if (t === 'AANDACHTSPUNT') { capturing = true; continue }
    if (capturing) {
      if (t.length < 60 && t === t.toUpperCase() && /[A-Z]/.test(t)) break
      if (t) parts.push(t)
    }
  }
  return parts.join(' ').replace(/\*\*/g, '').slice(0, 300)
}

export async function POST(req: NextRequest) {
  const { userId: managerId } = await auth()
  if (!managerId) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

  const { targetUserId, name } = await req.json()
  if (!targetUserId) return NextResponse.json({ error: 'Geen userId' }, { status: 400 })

  const { data: managerMember } = await supabase
    .from('arnobot_team_members')
    .select('team_id')
    .eq('user_id', managerId)
    .eq('role', 'manager')
    .single()

  if (!managerMember) return NextResponse.json({ error: 'Geen manager-toegang' }, { status: 403 })

  const { data: targetMember } = await supabase
    .from('arnobot_team_members')
    .select('role')
    .eq('user_id', targetUserId)
    .eq('team_id', managerMember.team_id)
    .single()

  if (!targetMember) return NextResponse.json({ error: 'Lid niet gevonden' }, { status: 404 })

  const [coachingRes, analysesRes, historyRes] = await Promise.all([
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
    supabase
      .from('arnobot_1on1_log')
      .select('aandachtspunt, mindset_score, systeem_score, actie_score, notitie, created_at')
      .eq('manager_id', managerId)
      .eq('member_id', targetUserId)
      .order('created_at', { ascending: false })
      .limit(3),
  ])

  const coaching = coachingRes.data
  const analyses = analysesRes.data ?? []
  const history = historyRes.data ?? []

  if (!coaching && analyses.length === 0) {
    return NextResponse.json({ error: 'Nog geen coachingdata beschikbaar voor dit lid.' }, { status: 422 })
  }

  const lines: string[] = [`Naam: ${name}`]

  if (coaching) {
    lines.push('\nCOACHINGPROFIEL (huidig)')
    if (coaching.mindset_score !== null) lines.push(`Mindset: ${coaching.mindset_score}/5 — ${coaching.mindset_diagnose ?? ''}`)
    if (coaching.systeem_score !== null) lines.push(`Systeem: ${coaching.systeem_score}/5 — ${coaching.systeem_diagnose ?? ''}`)
    if (coaching.actie_score !== null) lines.push(`Actie: ${coaching.actie_score}/5 — ${coaching.actie_diagnose ?? ''}`)
    if (coaching.voortgang) lines.push(`\nVoortgang: ${coaching.voortgang}`)
  }

  if (history.length > 0) {
    lines.push('\nEERDERE 1:1 GESPREKKEN')
    for (const h of history) {
      const wekenGeleden = Math.round((Date.now() - new Date(h.created_at).getTime()) / (7 * 86400000))
      const scoreStr = [h.mindset_score, h.systeem_score, h.actie_score].filter(s => s !== null).join(' / ')
      lines.push(`${wekenGeleden} weken geleden — scores: ${scoreStr || 'onbekend'} — aandachtspunt: ${h.aandachtspunt || 'niet vastgelegd'}${h.notitie ? ` — notitie: ${h.notitie}` : ''}`)
    }
  }

  if (analyses.length > 0) {
    lines.push('\nRECENTE ANALYSE')
    lines.push(analyses[0].analyse_text)
  }

  const context = lines.join('\n')

  const historyInstruction = history.length > 0
    ? '\nEr zijn eerdere 1:1-gesprekken. Benoem expliciet of het aandachtspunt van de vorige keer is verbeterd, gelijk gebleven of verslechterd. Als hetzelfde thema terugkomt, benoem dat dan ook.'
    : ''

  const systemPrompt = `Je bent een sales management coach die managers helpt om betere 1:1-gesprekken te voeren met hun verkopers. Je werkt uitsluitend op basis van het coachingprofiel dat je krijgt aangeleverd. Je ziet nooit ruwe gesprekken of klantnamen.${historyInstruction}

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
  const aandachtspunt = extractAandachtspunt(agenda)

  return NextResponse.json({ agenda, aandachtspunt })
}
