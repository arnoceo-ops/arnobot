import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { fetchElevenLabsSpeech, isElevenLabsConfigured, hasVoiceAccess } from '@/lib/voice'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

// Los van chat-voice: de handmatige herafspeelknop roept dit endpoint zonder chat-voice
// aan te roepen, dus een eigen, iets ruimere drempel.
const voiceTtsRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(60, '1 h'),
  prefix: 'arnobot:voice-tts',
})

// GET, niet POST: een <audio src="..."> laat de browser de respons zelf progressief
// ophalen en afspelen zodra de eerste bytes binnen zijn (zelfde reden als de
// admin-testroute, zie app/api/admin/voice-test/tts/route.ts).
export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return new NextResponse(null, { status: 401 })

  const { success } = await voiceTtsRateLimit.limit(userId)
  if (!success) return new NextResponse(null, { status: 429 })

  const { data: approved } = await supabase
    .from('approved_users')
    .select('plan, trial_start')
    .eq('user_id', userId)
    .single()
  const access = await hasVoiceAccess(supabase, userId, {
    plan: (approved?.plan as 'basis' | 'premium' | 'team') ?? 'basis',
    trial_start: approved?.trial_start ?? null,
  })
  if (!access.access) return new NextResponse(null, { status: 403 })

  const { searchParams } = new URL(req.url)
  const text = (searchParams.get('text') || '').slice(0, 5000).trim()
  if (!text) return new NextResponse(null, { status: 400 })

  if (!isElevenLabsConfigured()) {
    console.error('[tts-voice] ELEVENLABS_API_KEY of ELEVENLABS_VOICE_ID ontbreekt')
    return NextResponse.json({ error: 'Voice niet geconfigureerd' }, { status: 500 })
  }

  const elevenRes = await fetchElevenLabsSpeech(text)

  if (!elevenRes.ok || !elevenRes.body) {
    const errText = await elevenRes.text().catch(() => '')
    console.error('[tts-voice] ElevenLabs error:', elevenRes.status, errText)
    return NextResponse.json({ error: 'TTS mislukt' }, { status: 502 })
  }

  // Fire-and-forget, met de echte Clerk userId i.p.v. de vaste testwaarde uit de admin-route.
  supabase.from('arnobot_elevenlabs_usage')
    .insert({ user_id: userId, char_count: text.length })
    .then(({ error }) => { if (error) console.error('[tts-voice] log insert failed:', error.message) })

  return new Response(elevenRes.body, {
    headers: {
      'Content-Type': 'audio/mpeg',
      'Cache-Control': 'no-store',
    },
  })
}
