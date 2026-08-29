export const maxDuration = 60

import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { getText } from '@/lib/ai'
import { embedSessionText } from '@/lib/rag'
import { extractAndStoreEntities, pruneEntitiesForDeletedSessions } from '@/lib/memoryEntities'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ sessions: [] })

  // Existing saved sessions
  const { data: existing } = await supabase
    .from('arnobot_blog_sessions')
    .select('session_id')
    .eq('user_id', userId)

  const existingIds = new Set((existing ?? []).map(s => s.session_id))

  // All raw log entries for this user
  const { data: logs } = await supabase
    .from('arnobot_rds_logs')
    .select('session_id, question, answer, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })

  // Group by session_id
  const sessionGroups: Record<string, { question: string; answer: string; created_at: string }[]> = {}
  for (const log of logs ?? []) {
    if (!sessionGroups[log.session_id]) sessionGroups[log.session_id] = []
    sessionGroups[log.session_id].push(log)
  }

  // Orphaned: in rds_logs but not yet in blog_sessions
  const orphaned = Object.entries(sessionGroups).filter(([sid]) => !existingIds.has(sid))

  if (orphaned.length > 0) {
    await Promise.all(
      orphaned.slice(0, 10).map(async ([sessionId, messages]) => {
        const conversationText = messages
          .map(m => `GEBRUIKER: ${m.question}\n\nARNO: ${m.answer}`)
          .join('\n\n')
          .slice(0, 4000)

        const title = messages[0]?.question?.slice(0, 100) || 'Gesprek'
        const messageCount = messages.length
        const createdAt = messages[0]?.created_at

        let summary = ''
        let feiten = ''
        try {
          const [summaryRes, feitenRes] = await Promise.all([
            anthropic.messages.create({
              model: 'claude-haiku-4-5-20251001',
              max_tokens: 150,
              system: 'Je bent Arno Diepeveen. Direct, ongefilterd, geen bullshit. Geen accenten op woorden voor nadruk.',
              messages: [{ role: 'user', content: `Schrijf een terugblik op dit gesprek in maximaal 2-3 zinnen. Wat was de kern en wat is de ene concrete takeaway. Geen inleiding. Direct de essentie, in eerste persoon als Arno.\n\n${conversationText}` }],
            }),
            anthropic.messages.create({
              model: 'claude-haiku-4-5-20251001',
              max_tokens: 200,
              system: 'Extraheer alleen concrete, feitelijke informatie. Maximaal 8 korte bullets. Begin elk punt met een asterisk *.',
              messages: [{ role: 'user', content: `Extraheer de feiten uit dit gesprek:\n\n${conversationText}` }],
            }),
          ])
          summary = getText(summaryRes.content)
          feiten = getText(feitenRes.content)
        } catch {}

        let embedding: number[] | null = null
        try {
          embedding = await embedSessionText(title, summary, feiten)
        } catch {}

        await supabase.from('arnobot_blog_sessions').upsert({
          user_id: userId,
          session_id: sessionId,
          title,
          summary,
          feiten,
          message_count: messageCount,
          blog_suggestions: [],
          created_at: createdAt,
          ...(embedding ? { embedding } : {}),
        }, { onConflict: 'session_id' })

        try {
          await extractAndStoreEntities(userId, sessionId, conversationText)
        } catch (e) {
          console.error('[sessions] Entiteiten-extractie error (wees-sessie):', e)
        }
      })
    )
  }

  // Bewaargrens: alleen basis (25 gesprekken), premium/team onbeperkt.
  // Zachte verwijdering via deleted_at, zelfde mechanisme als de handmatige DELETE
  // in app/api/bot/session/route.ts, zodat dit consistent blijft met bestaand gedrag.
  const { data: planRow } = await supabase
    .from('approved_users')
    .select('plan')
    .eq('user_id', userId)
    .maybeSingle()
  const plan = (planRow?.plan as 'basis' | 'premium' | 'team') ?? 'basis'

  if (plan === 'basis') {
    const { data: allSessions } = await supabase
      .from('arnobot_blog_sessions')
      .select('session_id')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
    if (allSessions && allSessions.length > 25) {
      const toSoftDelete = allSessions.slice(25).map(s => s.session_id)
      await supabase.from('arnobot_blog_sessions').update({ deleted_at: new Date().toISOString() }).in('session_id', toSoftDelete)
      await pruneEntitiesForDeletedSessions(userId, toSoftDelete)
    }
  }

  // Backfill embeddings voor sessies die er nog geen hebben
  const { data: noEmbedding } = await supabase
    .from('arnobot_blog_sessions')
    .select('session_id, title, summary, feiten')
    .eq('user_id', userId)
    .is('embedding', null)
    .limit(20)

  if (noEmbedding && noEmbedding.length > 0) {
    const BATCH = 5
    for (let i = 0; i < Math.min(noEmbedding.length, 20); i += BATCH) {
      await Promise.allSettled(noEmbedding.slice(i, i + BATCH).map(async s => {
        const emb = await embedSessionText(s.title, s.summary, s.feiten)
        await supabase.from('arnobot_blog_sessions').update({ embedding: emb }).eq('session_id', s.session_id)
      }))
    }
  }

  const { data } = await supabase
    .from('arnobot_blog_sessions')
    .select('session_id, title, summary, message_count, blog_suggestions, created_at')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .eq('community_excluded', false)
    .order('created_at', { ascending: false })
    .limit(100)

  return NextResponse.json({ sessions: data ?? [] })
}
