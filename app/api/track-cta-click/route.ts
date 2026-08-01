import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { randomUUID } from 'crypto'
import { isBotUserAgent } from '@/lib/botDetection'

// Klik op de aanmeldknop vóórdat er een account bestaat, dus nog niet te loggen via
// lib/events.ts (die vereist een Clerk user_id). Zelfde anonieme arnobot_vid-cookie als
// track-pageview, zodat klik en bezoek aan dezelfde bezoeker te koppelen zijn.

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

// Klikken zijn zeldzamer dan pageviews, dus een lager plafond volstaat; vooral bedoeld
// om een misgelopen script niet de tabel te laten volpompen.
const ipRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '1 m'),
  prefix: 'arnobot:cta-click-ip',
})

export async function POST(req: NextRequest) {
  const userAgent = req.headers.get('user-agent') || ''
  if (isBotUserAgent(userAgent)) return NextResponse.json({ ok: true })

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const { success } = await ipRateLimit.limit(ip)
  if (!success) return NextResponse.json({ ok: true })

  const body = await req.json().catch(() => ({}))
  const { path } = body as { path?: string }
  if (typeof path !== 'string' || !path) {
    return NextResponse.json({ error: 'path is verplicht' }, { status: 400 })
  }

  let anonId = req.cookies.get('arnobot_vid')?.value
  const res = NextResponse.json({ ok: true })
  if (!anonId) {
    anonId = randomUUID()
    res.cookies.set('arnobot_vid', anonId, {
      httpOnly: true, secure: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 365, path: '/',
    })
  }

  // Fire-and-forget: een mislukte insert mag nooit de klik/navigatie van een bezoeker
  // blokkeren. Supabase-js gooit normaliter geen exception bij een DB-fout (geeft
  // { error } terug), vandaar de expliciete check naast de try/catch.
  try {
    const { error } = await supabase.from('arnobot_cta_clicks').insert({
      anon_id: anonId,
      path: path.slice(0, 300),
    })
    if (error) console.error('track-cta-click insert mislukt', error.message)
  } catch (err) {
    console.error('track-cta-click insert mislukt', err)
  }

  return res
}
