import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function checkAuth() {
  const cookieStore = await cookies()
  const token = cookieStore.get('arnobot_admin')?.value
  return token === process.env.ARNOBOT_ADMIN_KEY
}

// GET, niet POST: een <audio src="..."> laat de browser de respons zelf progressief
// ophalen en afspelen zodra de eerste bytes binnen zijn. Een fetch().blob() zou wachten
// tot de hele respons compleet is, en daarmee precies het ding onbruikbaar maken dat
// hier getest wordt (de streaming-latency van ElevenLabs Flash v2.5).
export async function GET(req: NextRequest) {
  if (!(await checkAuth())) {
    return new NextResponse(null, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const text = (searchParams.get('text') || '').slice(0, 5000).trim()
  if (!text) return new NextResponse(null, { status: 400 })

  const voiceId = process.env.ELEVENLABS_VOICE_ID
  if (!process.env.ELEVENLABS_API_KEY || !voiceId) {
    console.error('[voice-test/tts] ELEVENLABS_API_KEY of ELEVENLABS_VOICE_ID ontbreekt')
    return NextResponse.json({ error: 'Voice niet geconfigureerd' }, { status: 500 })
  }

  const elevenRes = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream?output_format=mp3_44100_128`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text, model_id: 'eleven_flash_v2_5' }),
    }
  )

  if (!elevenRes.ok || !elevenRes.body) {
    const errText = await elevenRes.text().catch(() => '')
    console.error('[voice-test/tts] ElevenLabs error:', elevenRes.status, errText)
    return NextResponse.json({ error: 'TTS mislukt' }, { status: 502 })
  }

  // Fire-and-forget: char_count staat al vast vóór de stream begint, dus de logging
  // hoeft niet op de (mogelijk langlopende) audio-stream te wachten en blokkeert die niet.
  supabase.from('arnobot_elevenlabs_usage')
    .insert({ user_id: 'admin-voice-test', char_count: text.length })
    .then(({ error }) => { if (error) console.error('[voice-test/tts] log insert failed:', error.message) })

  return new Response(elevenRes.body, {
    headers: {
      'Content-Type': 'audio/mpeg',
      'Cache-Control': 'no-store',
    },
  })
}
