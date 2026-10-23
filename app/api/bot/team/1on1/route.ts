export const maxDuration = 60

import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { getText } from '@/lib/ai'
import { buildEenOpEenSystemPrompt, agendaVerwijstGoed } from '@/lib/teamEenOpEenPrompt'
import { stripEmphasisAccents } from '@/lib/accenten'

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
      .select('id, aandachtspunt, mindset_score, systeem_score, actie_score, notitie, actie, actie_status, created_at')
      .eq('manager_id', managerId)
      .eq('member_id', targetUserId)
      .order('created_at', { ascending: false })
      .limit(3),
    supabase
      .from('arnobot_blog_sessions')
      .select('title, summary, feiten, created_at')
      .eq('user_id', targetUserId)
      .is('deleted_at', null)
      .eq('community_excluded', false)
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
    if (coaching.mindset_score !== null) lines.push(`Mindset: ${coaching.mindset_score}/5: ${(coaching.mindset_diagnose ?? '').slice(0, 150)}`)
    if (coaching.systeem_score !== null) lines.push(`Systeem: ${coaching.systeem_score}/5: ${(coaching.systeem_diagnose ?? '').slice(0, 150)}`)
    if (coaching.actie_score !== null) lines.push(`Actie: ${coaching.actie_score}/5: ${(coaching.actie_diagnose ?? '').slice(0, 150)}`)
    if (coaching.voortgang) lines.push(`\nVoortgang: ${coaching.voortgang.slice(0, 400)}`)
  }

  if (history.length > 0) {
    lines.push('\nEERDERE 1:1 GESPREKKEN')
    for (const h of history) {
      const wekenGeleden = Math.round((Date.now() - new Date(h.created_at).getTime()) / (7 * 86400000))
      const scoreStr = [h.mindset_score, h.systeem_score, h.actie_score].filter(s => s !== null).join(' / ')
      const notitie = h.notitie ? ` | notitie: ${h.notitie.slice(0, 120)}` : ''
      lines.push(`${wekenGeleden} weken geleden | scores: ${scoreStr || 'onbekend'} | aandachtspunt: ${h.aandachtspunt || 'niet vastgelegd'}${notitie}`)
    }
  }

  if (analyses.length > 0) {
    lines.push('\nRECENTE ANALYSE')
    lines.push(analyses[0].analyse_text.slice(0, 600))
  }

  if (sessies.length > 0) {
    lines.push('\nRECENTE GESPREKKEN MET ARNOBOT')
    for (const s of sessies) {
      const dagenGeleden = Math.round((Date.now() - new Date(s.created_at).getTime()) / 86400000)
      const wanneer = dagenGeleden === 0 ? 'Vandaag' : dagenGeleden === 1 ? 'Gisteren' : `${dagenGeleden} dagen geleden`
      lines.push(`${wanneer}: ${s.title}`)
      if (s.summary) lines.push(`Samenvatting: ${s.summary.slice(0, 200)}`)
      if (s.feiten) lines.push(`Kernpunten: ${s.feiten.slice(0, 150)}`)
    }
  }

  const context = lines.join('\n')

  const systemPrompt = buildEenOpEenSystemPrompt(history.length > 0, sessies.length > 0)

  // Maximaal twee pogingen: bij een agenda die het teamlid met je/jij aanspreekt of met hij/zij
  // aanduidt volgt een tweede poging, daarna geldt het laatste antwoord als het niet leeg is.
  let agenda = ''
  for (let poging = 0; poging < 2; poging++) {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1000,
      system: systemPrompt,
      messages: [{ role: 'user', content: context }],
    })
    const tekst = getText(response.content)
    if (tekst) agenda = tekst
    if (tekst && agendaVerwijstGoed(tekst)) break
  }
  agenda = stripEmphasisAccents(agenda)
  const aandachtspunt = extractAandachtspunt(agenda)

  return NextResponse.json({ agenda, aandachtspunt })
}
