import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import * as Sentry from '@sentry/nextjs'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { overstapBeschikbaarVoor, plaatsUpgrade } from '@/lib/billing/overstap'

const ratelimit = new Ratelimit({
  redis: new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  }),
  limiter: Ratelimit.slidingWindow(10, '1 h'),
  prefix: 'arnobot:upgrade',
})

const fout = (status: number, error: string) => NextResponse.json({ error }, { status })

// Upgrade van Basic naar Pro, direct (docs/OVERSTAP_PLAN.md): Pro meteen, het prijsverschil naar rato
// direct bijbetaald met de bestaande machtiging. Het bedrag komt van de server. Tot OVERSTAP_OPEN=true
// alleen voor de eigenaar en de interne testaccounts.
export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return fout(401, 'Niet ingelogd')
  if (!overstapBeschikbaarVoor(userId)) return fout(503, 'Upgraden is nog niet beschikbaar')

  const { success } = await ratelimit.limit(userId)
  if (!success) return fout(429, 'Te veel pogingen, probeer het over een uur opnieuw')

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') return fout(400, 'Ongeldig verzoek')
  if ((body as Record<string, unknown>).akkoordVoorwaarden !== true) return fout(400, 'Ga akkoord met de algemene voorwaarden om door te gaan')

  try {
    const uitkomst = await plaatsUpgrade(userId)
    if (!uitkomst.ok) return fout(uitkomst.status, uitkomst.fout)
    return NextResponse.json({ ok: true, ingaatOp: uitkomst.ingaatOp, plan: uitkomst.plan, cyclus: uitkomst.cyclus, bedragCent: uitkomst.bedragCent, upgrade: uitkomst.upgrade })
  } catch (e) {
    // Nooit interne details of Mollie-meldingen naar de gebruiker; wel loggen en melden.
    Sentry.captureException(e, { tags: { onderdeel: 'billing-upgrade' } })
    console.error('[upgrade]', e instanceof Error ? e.message : e)
    return fout(502, 'Upgraden is niet gelukt. Probeer het zo opnieuw of mail admin@arno.bot.')
  }
}
