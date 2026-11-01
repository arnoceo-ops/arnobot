import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import * as Sentry from '@sentry/nextjs'
import { liveTranscribeBeschikbaarVoor } from '@/lib/liveTranscribeToegang'

// Geeft de browser een kortlevende sessiecode (ek_...) voor live transcriptie met
// gpt-live-transcribe over WebRTC: de browser stuurt de microfoon rechtstreeks naar OpenAI en
// krijgt de tekst terug terwijl je praat. De echte API-sleutel verlaat de server nooit. De code
// leeft 2 minuten en is alleen goed voor een transcriptiesessie.
// Niet beschikbaar (404) of mislukt: de client valt terug op /api/transcribe (na het stoppen).

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

// Eigen limiter, los van chat en voice. Eén opname = één sessiecode.
const liveRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(120, '1 h'),
  prefix: 'arnobot:transcribe-live',
})

export async function POST() {
  const { userId } = await auth()
  if (!userId) return new NextResponse(null, { status: 401 })
  if (!liveTranscribeBeschikbaarVoor(userId)) return NextResponse.json({ error: 'not_available' }, { status: 404 })

  const { success } = await liveRateLimit.limit(userId)
  if (!success) return NextResponse.json({ error: 'rate_limit' }, { status: 429 })

  try {
    const res = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        expires_after: { anchor: 'created_at', seconds: 120 },
        session: {
          type: 'transcription',
          audio: {
            input: {
              format: { type: 'audio/pcm', rate: 24000 },
              transcription: { model: 'gpt-live-transcribe', language: 'nl' },
              // Geen automatische beurtdetectie: de gebruiker start en stopt zelf, bij stoppen
              // commit de client de opname en komt de definitieve tekst terug.
              turn_detection: null,
            },
          },
        },
      }),
    })
    if (!res.ok) {
      Sentry.captureMessage(`[transcribe/live] OpenAI client_secrets ${res.status}`, 'error')
      return NextResponse.json({ error: 'unavailable' }, { status: 502 })
    }
    const data = await res.json() as { value?: string; expires_at?: number }
    if (!data.value) return NextResponse.json({ error: 'unavailable' }, { status: 502 })
    return NextResponse.json({ value: data.value, expires_at: data.expires_at ?? null }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    Sentry.captureException(e)
    return NextResponse.json({ error: 'unavailable' }, { status: 502 })
  }
}
