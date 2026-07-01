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

export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ sessions: [] })

  const q = req.nextUrl.searchParams.get('q') ?? ''
  if (q.length < 2) return NextResponse.json({ sessions: [] })

  // Haal alle sessie-titels en samenvattingen op
  const { data: allSessions } = await supabase
    .from('arnobot_blog_sessions')
    .select('session_id, title, summary')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100)

  if (!allSessions || allSessions.length === 0) return NextResponse.json({ sessions: [] })

  // Laat Claude bepalen welke sessies inhoudelijk relevant zijn
  const sessionList = allSessions
    .map(s => `ID:${s.session_id} | ${s.title ?? ''} | ${s.summary ?? ''}`)
    .join('\n')

  let matchedIds: string[] = []
  try {
    const res = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: `Hieronder staan gesprekssessies in het formaat "ID:xxx | titel | samenvatting".\n\nGeef een JSON-array terug met alleen de session-IDs die inhoudelijk relevant zijn voor de zoekopdracht: "${q}"\n\nWees ruimhartig: als het gesprek ook maar raakvlak heeft met het onderwerp, neem het mee. Geef alleen de JSON-array terug, niets anders.\n\nSessies:\n${sessionList}`,
      }],
    })
    const text = getText(\.content, '[]').trim()
    const start = text.indexOf('[')
    const end = text.lastIndexOf(']')
    const parsed = JSON.parse(start >= 0 && end >= 0 ? text.slice(start, end + 1) : '[]')
    if (Array.isArray(parsed)) matchedIds = parsed.map(String)
  } catch {}

  if (matchedIds.length === 0) return NextResponse.json({ sessions: [] })

  const { data: sessions } = await supabase
    .from('arnobot_blog_sessions')
    .select('session_id, title, summary, message_count, created_at, blog_suggestions')
    .eq('user_id', userId)
    .in('session_id', matchedIds)
    .order('created_at', { ascending: false })

  return NextResponse.json({ sessions: sessions ?? [] })
}
