import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

// Openbaar, voor de aanmeldpagina: "[Voornaam] nodigt je uit." Geeft bij een geldige referralcode alleen de
// voornaam van de aanbrenger terug (die staat meestal al in de code zelf), verder niets.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const ratelimit = new Ratelimit({
  redis: new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  }),
  limiter: Ratelimit.slidingWindow(20, '1 h'),
  prefix: 'arnobot:referral-naam',
})

export async function GET(req: NextRequest) {
  const niets = NextResponse.json({ voornaam: null })
  const code = req.nextUrl.searchParams.get('code')?.toUpperCase() ?? ''
  if (!/^[A-Z0-9-]{4,20}$/.test(code)) return niets

  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'onbekend'
    const { success } = await ratelimit.limit(ip)
    if (!success) return niets

    const { data } = await supabase
      .from('approved_users')
      .select('voornaam')
      .eq('referral_code', code)
      .maybeSingle<{ voornaam: string | null }>()
    return NextResponse.json({ voornaam: data?.voornaam ?? null })
  } catch {
    return niets
  }
}
