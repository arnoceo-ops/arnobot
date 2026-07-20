export const maxDuration = 30

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

async function checkPremiumAccess(userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('approved_users')
    .select('plan')
    .eq('user_id', userId)
    .single()
  return data?.plan !== 'basis'
}

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
  if (!await checkPremiumAccess(userId)) return NextResponse.json({ hasProgress: false })

  const [sessionsRes, analysesRes, prevCoachingRes] = await Promise.all([
    supabase
      .from('arnobot_blog_sessions')
      .select('session_id, title, summary')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('arnobot_analyses')
      .select('id, analyse_text')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('arnobot_coaching')
      .select('used_session_ids, used_analyse_ids, mindset_score, mindset_diagnose, systeem_score, systeem_diagnose, actie_score, actie_diagnose, weinig_voortgang')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const sessions = sessionsRes.data ?? []
  const analyses = analysesRes.data ?? []
  const prevCoaching = prevCoachingRes.data

  if (!prevCoaching || !(prevCoaching as any).weinig_voortgang) {
    return NextResponse.json({ hasProgress: false })
  }

  const prevSessionIds = new Set<string>((prevCoaching as any).used_session_ids ?? [])
  const prevAnalyseIds = new Set<string>((prevCoaching as any).used_analyse_ids ?? [])
  const newSessions = sessions.filter(s => !prevSessionIds.has(s.session_id))
  const newAnalyses = analyses.filter(a => !prevAnalyseIds.has(a.id))

  if (newSessions.length === 0 && newAnalyses.length === 0) {
    return NextResponse.json({ hasProgress: false })
  }

  const newSessiesText = newSessions
    .map(s => `- ${s.title}${s.summary ? `: ${s.summary}` : ''}`)
    .join('\n')
  const newAnalysesText = newAnalyses
    .map(a => `- ${a.analyse_text.slice(0, 200)}`)
    .join('\n')

  try {
    const precheck = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 10,
      system: 'Je beoordeelt of nieuwe gesprekken kwalitatief andere patronen laten zien dan de vorige coaching. Antwoord uitsluitend met "ja" of "nee".',
      messages: [{
        role: 'user',
        content: `Vorige coaching:\nMindset (${prevCoaching.mindset_score}/5): ${prevCoaching.mindset_diagnose}\nSysteem (${prevCoaching.systeem_score}/5): ${prevCoaching.systeem_diagnose}\nActie (${prevCoaching.actie_score}/5): ${prevCoaching.actie_diagnose}\n\nNieuwe gesprekken:\n${newSessiesText || '(geen)'}\n\nNieuwe analyses:\n${newAnalysesText || '(geen)'}\n\nIs er kwalitatief iets veranderd in het patroon?`,
      }],
    })
    const verdict = getText(precheck.content, 'nee').trim().toLowerCase()
    return NextResponse.json({ hasProgress: verdict.startsWith('ja') })
  } catch {
    return NextResponse.json({ hasProgress: false })
  }
}
