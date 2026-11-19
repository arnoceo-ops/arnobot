import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { fetchElevenLabsSpeechWithAlignment, isElevenLabsConfigured, hasVoiceAccess } from '@/lib/voice'
import { toegangsWeigering } from '@/lib/toegangsPoort'
import { haalAlleRijen } from '@/lib/haalAlleRijen'
import { VOICE_MAX_TEKENS_PER_AANROEP, amsterdamMaandStart, overMaandPlafond } from '@/lib/voiceLimiet'

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

// Geeft JSON terug (audio_base64 + karakter-alignment, zie lib/voice.ts), geen ruwe
// audio-stream: de client bouwt hier een afspeelbare blob uit plus de karaoke-achtige
// meescrollende/highlightende weergave (SparClient.tsx). Bewust geen <audio src="...">
// meer op dit endpoint, dat kan geen JSON consumeren.
export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return new NextResponse(null, { status: 401 })

  // Geen toegang meer (verlopen proef, geblokkeerd team): geen AI-aanroep. Zie lib/toegangsPoort.ts.
  const geenToegang = await toegangsWeigering(userId)
  if (geenToegang) return geenToegang

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
  const text = (searchParams.get('text') || '').trim()
  if (!text) return new NextResponse(null, { status: 400 })
  // Te lang voor een echt antwoord: geen spraak, de chat toont de tekst al (zie lib/voiceLimiet.ts).
  if (text.length > VOICE_MAX_TEKENS_PER_AANROEP) {
    return NextResponse.json({ error: 'voice_tekst_te_lang' }, { status: 413 })
  }

  // Maandplafond per gebruiker: zacht, de client valt terug op tekst. Bij een fout in de telling
  // laten we de aanroep door: een haperende database mag voice niet stilleggen.
  try {
    const rijen = await haalAlleRijen<{ char_count: number | null }>((van, tot) =>
      supabase.from('arnobot_elevenlabs_usage').select('char_count')
        .eq('user_id', userId).gte('created_at', amsterdamMaandStart())
        .order('id', { ascending: true }).range(van, tot))
    const dezeMaand = rijen.reduce((som, r) => som + (r.char_count ?? 0), 0)
    if (overMaandPlafond(dezeMaand, text.length)) {
      return NextResponse.json({ error: 'voice_maandplafond' }, { status: 429 })
    }
  } catch (err) {
    console.error('[tts-voice] maandtelling mislukt:', err instanceof Error ? err.message : err)
  }

  if (!isElevenLabsConfigured()) {
    console.error('[tts-voice] ELEVENLABS_API_KEY of ELEVENLABS_VOICE_ID ontbreekt')
    return NextResponse.json({ error: 'Voice niet geconfigureerd' }, { status: 500 })
  }

  let ttsData
  try {
    ttsData = await fetchElevenLabsSpeechWithAlignment(text)
  } catch (err) {
    console.error('[tts-voice] ElevenLabs error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'TTS mislukt' }, { status: 502 })
  }

  // Fire-and-forget, met de echte Clerk userId i.p.v. de vaste testwaarde uit de admin-route.
  supabase.from('arnobot_elevenlabs_usage')
    .insert({ user_id: userId, char_count: text.length })
    .then(({ error }) => { if (error) console.error('[tts-voice] log insert failed:', error.message) })

  return NextResponse.json(ttsData, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
