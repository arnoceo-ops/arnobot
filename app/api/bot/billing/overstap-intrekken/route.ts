import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import * as Sentry from '@sentry/nextjs'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { overstapBeschikbaarVoor } from '@/lib/billing/overstap'
import { trekOverstapIn } from '@/lib/billing/intrekken'

const ratelimit = new Ratelimit({
  redis: new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  }),
  limiter: Ratelimit.slidingWindow(10, '1 h'),
  prefix: 'arnobot:intrekken',
})

const fout = (status: number, error: string) => NextResponse.json({ error }, { status })

// Trekt een geplande overstap in (docs/OVERSTAP_PLAN.md). Zelfde toegang als de overstap zelf: tot
// OVERSTAP_OPEN=true alleen de eigenaar en de interne testaccounts.
export async function POST() {
  const { userId } = await auth()
  if (!userId) return fout(401, 'Niet ingelogd')
  if (!overstapBeschikbaarVoor(userId)) return fout(503, 'Overstappen is nog niet beschikbaar')

  const { success } = await ratelimit.limit(userId)
  if (!success) return fout(429, 'Te veel pogingen, probeer het over een uur opnieuw')

  try {
    const uitkomst = await trekOverstapIn(userId)
    if (!uitkomst.ok) return fout(uitkomst.status, uitkomst.fout)
    return NextResponse.json({ ok: true })
  } catch (e) {
    Sentry.captureException(e, { tags: { onderdeel: 'billing-overstap-intrekken' } })
    console.error('[overstap-intrekken]', e instanceof Error ? e.message : e)
    return fout(502, 'Intrekken is niet gelukt. Probeer het zo opnieuw of mail admin@arno.bot.')
  }
}
