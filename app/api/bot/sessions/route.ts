export const maxDuration = 60

import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { getMultilingualEmbedding } from '@/lib/rag'

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
          summary = summaryRes.content[0].type === 'text' ? summaryRes.content[0].text : ''
          feiten = feitenRes.content[0].type === 'text' ? feitenRes.content[0].text : ''
        } catch {}

        let embedding: number[] | null = null
        try {
          const embeddingText = [title, summary, feiten].filter(Boolean).join('\n')
          embedding = await getMultilingualEmbedding(embeddingText)
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
      })
    )
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
        const text = [s.title, s.summary, s.feiten].filter(Boolean).join('\n')
        const emb = await getMultilingualEmbedding(text)
        await supabase.from('arnobot_blog_sessions').update({ embedding: emb }).eq('session_id', s.session_id)
      }))
    }
  }

  const { data } = await supabase
    .from('arnobot_blog_sessions')
    .select('session_id, title, summary, message_count, blog_suggestions, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100)

  return NextResponse.json({ sessions: data ?? [] })
}
