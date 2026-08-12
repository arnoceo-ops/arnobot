import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { embedSessionText, getMultilingualEmbedding } from '@/lib/rag'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

  const { data: sessions, error: fetchErr } = await supabase
    .from('arnobot_blog_sessions')
    .select('session_id, title, summary, feiten')
    .eq('user_id', userId)
    .is('embedding', null)
    .limit(20)

  if (fetchErr) {
    console.error('[bot/sessions/embed fetch]', fetchErr.message)
    return NextResponse.json({ error: 'Ophalen mislukt' }, { status: 500 })
  }

  const results: { session_id: string; ok: boolean; error?: string }[] = []

  for (const s of sessions ?? []) {
    try {
      const emb = await embedSessionText(s.title, s.summary, s.feiten)
      const { error: updateErr } = await supabase
        .from('arnobot_blog_sessions')
        .update({ embedding: emb })
        .eq('session_id', s.session_id)
      if (updateErr) throw new Error(updateErr.message)
      results.push({ session_id: s.session_id, ok: true })
    } catch (e) {
      console.error('[bot/sessions/embed]', s.session_id, e)
      results.push({ session_id: s.session_id, ok: false, error: 'Embedding mislukt' })
    }
  }

  const ok = results.filter(r => r.ok).length
  const failed = results.filter(r => !r.ok)

  // Test: run match_sessions voor "forecast" en toon raw scores
  let testScores: { session_id: string; title: string; similarity: number }[] = []
  try {
    const { getMultilingualEmbedding: getEmb } = await import('@/lib/rag')
    const emb = await getEmb('forecast')
    const { data } = await supabase.rpc('match_sessions', {
      query_embedding: emb,
      match_user_id: userId,
      match_count: 10,
    })
    testScores = (data ?? []).map((r: { session_id: string; title: string; similarity: number }) => ({
      session_id: r.session_id,
      title: r.title,
      similarity: r.similarity,
    }))
  } catch (e) {
    testScores = [{ session_id: 'error', title: String(e), similarity: 0 }]
  }

  return NextResponse.json({ processed: results.length, ok, failed, testScores })
}
