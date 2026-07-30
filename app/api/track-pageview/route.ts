import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { randomUUID } from 'crypto'

// Anonieme pageview-teller voor de publieke marketingpagina's, om de
// Bezoeker -> Trial conversie te kunnen meten naast de al bestaande
// Trial -> Paid conversie op /bot/admin/stats. Geen IP-opslag, geen koppeling
// aan een Clerk user_id, alleen een willekeurige sessie-cookie.

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

// Per-IP: max 20 pageviews per minuut. Ruim genoeg voor normaal doorklikken,
// voorkomt dat een enkel script of misgelopen bot de tabel volpompt.
const ipRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(20, '1 m'),
  prefix: 'arnobot:pageview-ip',
})

const BOT_UA_PATTERN = /bot|crawler|spider|slurp|bingpreview|facebookexternalhit|headlesschrome|python-requests|curl\/|wget\//i

export async function POST(req: NextRequest) {
  const userAgent = req.headers.get('user-agent') || ''
  if (BOT_UA_PATTERN.test(userAgent)) return NextResponse.json({ ok: true })

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const { success } = await ipRateLimit.limit(ip)
  if (!success) return NextResponse.json({ ok: true })

  const body = await req.json().catch(() => ({}))
  const { path, referrer } = body as { path?: string; referrer?: string }
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

  // Fire-and-forget: een mislukte insert (bv. tabel nog niet aangemaakt) mag
  // nooit de pagina-request van een bezoeker laten falen. Supabase-js gooit
  // normaliter geen exception bij een DB-fout (geeft { error } terug), vandaar
  // de expliciete check naast de try/catch.
  try {
    const { error } = await supabase.from('arnobot_pageviews').insert({
      anon_id: anonId,
      path: path.slice(0, 300),
      referrer: typeof referrer === 'string' ? referrer.slice(0, 300) : null,
    })
    if (error) console.error('track-pageview insert mislukt', error.message)
  } catch (err) {
    console.error('track-pageview insert mislukt', err)
  }

  return res
}
