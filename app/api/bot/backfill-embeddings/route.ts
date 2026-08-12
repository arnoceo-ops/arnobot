import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { embedSessionText } from '@/lib/rag'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: sessions } = await supabase
    .from('arnobot_blog_sessions')
    .select('session_id, title, summary, feiten')
    .is('embedding', null)
    .limit(100)

  if (!sessions?.length) return NextResponse.json({ ok: true, processed: 0 })

  let processed = 0
  for (const s of sessions) {
    try {
      const embedding = await embedSessionText(s.title, s.summary, s.feiten)
      await supabase.from('arnobot_blog_sessions').update({ embedding }).eq('session_id', s.session_id)
      processed++
      // Kleine pauze om rate limits te respecteren
      await new Promise(r => setTimeout(r, 100))
    } catch (e) {
      console.error(`[backfill-embeddings] ${s.session_id}:`, e)
    }
  }

  return NextResponse.json({ ok: true, processed, remaining: (sessions.length === 100) ? '100+' : 0 })
}
