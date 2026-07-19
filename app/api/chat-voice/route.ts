import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { getVoiceAnswer } from '@/lib/voice'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

// Los van de bestaande arnobot:user-limiter van /api/chat, zodat voice-gebruik het
// gewone chat-quotum niet raakt. Voorlopige drempel, later mogelijk losser zodra het
// tekens-per-maand-plafond uit VOICE_PLAN.md fase 2 er is.
const voiceChatRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(30, '1 h'),
  prefix: 'arnobot:voice-chat',
})

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { success } = await voiceChatRateLimit.limit(userId)
  if (!success) return NextResponse.json({ error: 'rate_limit' }, { status: 429 })

  const { data: approved } = await supabase
    .from('approved_users')
    .select('voice_enabled')
    .eq('user_id', userId)
    .single()
  if (!approved?.voice_enabled) return NextResponse.json({ error: 'voice_not_enabled' }, { status: 403 })

  const { text } = await req.json().catch(() => ({}))
  if (!text || typeof text !== 'string' || !text.trim()) {
    return NextResponse.json({ error: 'Geen tekst' }, { status: 400 })
  }

  try {
    const answer = await getVoiceAnswer(text)
    return NextResponse.json({ answer })
  } catch (err) {
    console.error('[chat-voice] error:', err instanceof Error ? err.message : String(err))
    return NextResponse.json({ error: 'Verzoek mislukt' }, { status: 500 })
  }
}
