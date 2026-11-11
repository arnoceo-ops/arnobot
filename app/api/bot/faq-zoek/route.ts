import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { isExcludedFromProductAnalytics } from '@/lib/internalTestAccounts'
import { normaliseerZoekterm, FAQ_ZOEK_MIN_TEKENS, FAQ_ZOEK_MAX_TEKENS } from '@/lib/faqZoek'

// Logt een zoekterm van de FAQ-pagina die geen enkel antwoord opleverde. Alleen de term en het
// tijdstip worden opgeslagen, bewust zonder user_id (zie docs/sql/2026-11-11-faq-zoekmislukkingen.sql).
// De Clerk-sessie is alleen een toegangscontrole, het user_id wordt na de rate limit niet meer gebruikt.

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

const rateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(20, '1 h'),
  prefix: 'arnobot:faq-zoek',
})

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

  // Interne testaccounts en de oprichter vervuilen de lijst, die loggen we niet.
  if (isExcludedFromProductAnalytics(userId)) return NextResponse.json({ ok: true })

  const { success } = await rateLimit.limit(userId)
  if (!success) return NextResponse.json({ ok: true })

  const body = await req.json().catch(() => ({}))
  const { term } = body as { term?: unknown }
  if (typeof term !== 'string') return NextResponse.json({ error: 'term is verplicht' }, { status: 400 })

  const genormaliseerd = normaliseerZoekterm(term).slice(0, FAQ_ZOEK_MAX_TEKENS)
  if (genormaliseerd.length < FAQ_ZOEK_MIN_TEKENS) return NextResponse.json({ ok: true })

  const { error } = await supabase.from('faq_zoekmislukkingen').insert({ term: genormaliseerd })
  if (error) {
    console.error('[faq-zoek] insert mislukt:', error.message)
    return NextResponse.json({ ok: true })
  }
  return NextResponse.json({ ok: true })
}
