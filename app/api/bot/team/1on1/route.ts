export const maxDuration = 30

import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { getText } from '@/lib/ai'

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
  return parts.join(' ').replace(/\*\*/g, '').replace(/—|–|---|-{2,}/g, '').replace(/\s{2,}/g, ' ').trim()
}

export async function POST(req: NextRequest) {
  const { userId: managerId } = await auth()
  if (!managerId) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

  const { targetUserId, name: rawName } = await req.json()
  if (!targetUserId) return NextResponse.json({ error: 'Geen userId' }, { status: 400 })
  const name = typeof rawName === 'string' ? rawName.slice(0, 100) : 'Onbekend'

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

  const [coachingRes, analysesRes, historyRes, sessiesRes] = await Promise.all([
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
    supabase
      .from('arnobot_blog_sessions')
      .select('title, summary, feiten, created_at')
      .eq('user_id', targetUserId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(3),
  ])

  const coaching = coachingRes.data
  const analyses = analysesRes.data ?? []
  const history = historyRes.data ?? []
  const sessies = sessiesRes.data ?? []

  if (!coaching && analyses.length === 0) {
    return NextResponse.json({ error: 'Nog geen coachingdata beschikbaar voor dit lid.' }, { status: 422 })
  }

  const lines: string[] = [`Naam: ${name}`]

  if (coaching) {
    lines.push('\nCOACHINGPROFIEL (huidig)')
    if (coaching.mindset_score !== null) lines.push(`Mindset: ${coaching.mindset_score}/5: ${coaching.mindset_diagnose ?? ''}`)
    if (coaching.systeem_score !== null) lines.push(`Systeem: ${coaching.systeem_score}/5: ${coaching.systeem_diagnose ?? ''}`)
    if (coaching.actie_score !== null) lines.push(`Actie: ${coaching.actie_score}/5: ${coaching.actie_diagnose ?? ''}`)
    if (coaching.voortgang) lines.push(`\nVoortgang: ${coaching.voortgang}`)
  }

  if (history.length > 0) {
    lines.push('\nEERDERE 1:1 GESPREKKEN')
    for (const h of history) {
      const wekenGeleden = Math.round((Date.now() - new Date(h.created_at).getTime()) / (7 * 86400000))
      const scoreStr = [h.mindset_score, h.systeem_score, h.actie_score].filter(s => s !== null).join(' / ')
      lines.push(`${wekenGeleden} weken geleden | scores: ${scoreStr || 'onbekend'} | aandachtspunt: ${h.aandachtspunt || 'niet vastgelegd'}${h.notitie ? ` | notitie: ${h.notitie}` : ''}`)
    }
  }

  if (analyses.length > 0) {
    lines.push('\nRECENTE ANALYSE')
    lines.push(analyses[0].analyse_text)
  }

  if (sessies.length > 0) {
    lines.push('\nRECENTE GESPREKKEN MET ARNOBOT')
    for (const s of sessies) {
      const dagenGeleden = Math.round((Date.now() - new Date(s.created_at).getTime()) / 86400000)
      const wanneer = dagenGeleden === 0 ? 'Vandaag' : dagenGeleden === 1 ? 'Gisteren' : `${dagenGeleden} dagen geleden`
      lines.push(`${wanneer}: ${s.title}`)
      if (s.summary) lines.push(`Samenvatting: ${s.summary}`)
      if (s.feiten) lines.push(`Kernpunten: ${s.feiten}`)
    }
  }

  const context = lines.join('\n')

  const historyInstruction = history.length > 0
    ? '\nEr zijn eerdere 1:1-gesprekken. Benoem expliciet of het aandachtspunt van de vorige keer is verbeterd, gelijk gebleven of verslechterd. Als hetzelfde thema terugkomt, benoem dat dan ook.'
    : ''

  const sessiesInstruction = sessies.length > 0
    ? '\nEr zijn recente gesprekken met ArnoBot beschikbaar. Gebruik die actief: wanneer een sessie een concreet thema, actie of voornemen bevatte dat daarna niet meer teruggekomen is, zet dat dan in VRAGEN OM TE STELLEN. Schrijf het als een echte vraag, niet als template. Bijv.: "Je had het X dagen geleden over [thema]. Hoe is dat gegaan?"'
    : ''

  const systemPrompt = `Je bent een sales management coach die managers helpt om betere 1:1-gesprekken te voeren met hun verkopers. Je werkt uitsluitend op basis van het coachingprofiel dat je krijgt aangeleverd. Je ziet nooit ruwe gesprekken of klantnamen.${historyInstruction}${sessiesInstruction}

Schrijf een concrete 1:1-agenda voor de manager. Gebruik precies deze structuur en koppen:

WAT GAAT GOED
Noem één of twee concrete sterke punten op basis van de scores en diagnoses. Wees specifiek, geen lege complimenten.

AANDACHTSPUNT
Het voornaamste groeithema dit gesprek. Koppel het aan de laagste score of het patroon in de analyse. Één aandachtspunt, niet meerdere.

ARNO ADVISEERT
Geef concrete instructies voor de manager: welke vragen stelt hij letterlijk, en welk gedrag observeert hij actief in dit gesprek of de komende week. Schrijf dit als directe coaching aan de manager. Niet als twee aparte blokken, maar als één samenhangende aanbeveling van maximaal vijf zinnen.

Schrijf in jij-vorm gericht aan de manager. Geen inleiding, geen samenvatting achteraf. Direct beginnen met de eerste kop. Zorg dat alle drie de secties altijd volledig aanwezig zijn.
Gebruik NOOIT markdown-opmaak zoals **tekst** of *tekst*. Gebruik NOOIT een streepje als leesteken (—, –, of een losstaand koppelteken). Herschrijf zinnen zonder streepjes.
Gebruik geen accenten om woorden te benadrukken (geen écht, dát, zó, dít, én). Gebruik het woord "moeten" niet; gebruik alternatieven als "kun je", "wil je", "loont het om".
Gebruik bij gedragspatronen altijd hedging-taal: "lijkt", "heeft de neiging tot", "geeft de indruk van". Noem nooit percentages of specifieke getallen die je niet direct kunt afleiden uit de aangeleverde data. Formuleer gedragsobservaties als iets wat de manager in het gesprek kan verifiëren en bespreken met het lid, niet als vaststaand feit. Niet: "ze neemt te veel spreektijd." Wel: "Het is de moeite waard om in dit gesprek te checken hoeveel ruimte ze neemt om te praten versus te luisteren."`

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 2500,
    system: systemPrompt,
    messages: [{ role: 'user', content: context }],
  })

  const agenda = getText(response.content)
  const aandachtspunt = extractAandachtspunt(agenda)

  return NextResponse.json({ agenda, aandachtspunt })
}
