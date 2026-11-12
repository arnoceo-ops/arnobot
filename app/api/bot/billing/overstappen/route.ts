import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import * as Sentry from '@sentry/nextjs'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { isCyclus, isPlan } from '@/lib/billing/prijzen'
import { overstapBeschikbaarVoor, plaatsOverstap } from '@/lib/billing/overstap'

const ratelimit = new Ratelimit({
  redis: new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  }),
  limiter: Ratelimit.slidingWindow(10, '1 h'),
  prefix: 'arnobot:overstap',
})

const fout = (status: number, error: string) => NextResponse.json({ error }, { status })

// Plant een overstap per einde van de betaalde periode: maand naar jaar, of Pro naar Basic
// (docs/OVERSTAP_PLAN.md). Het bedrag en de regels komen van de server; de klant kiest alleen plan en
// cyclus. Tot OVERSTAP_OPEN=true alleen voor de eigenaar en de interne testaccounts.
export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return fout(401, 'Niet ingelogd')
  if (!overstapBeschikbaarVoor(userId)) return fout(503, 'Overstappen is nog niet beschikbaar')

  const { success } = await ratelimit.limit(userId)
  if (!success) return fout(429, 'Te veel pogingen, probeer het over een uur opnieuw')

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') return fout(400, 'Ongeldig verzoek')
  const { plan, cyclus, akkoordVoorwaarden } = body as Record<string, unknown>
  if (!isPlan(plan) || !isCyclus(cyclus)) return fout(400, 'Ongeldige keuze')
  if (akkoordVoorwaarden !== true) return fout(400, 'Ga akkoord met de algemene voorwaarden om door te gaan')

  try {
    const uitkomst = await plaatsOverstap(userId, { plan, cyclus })
    if (!uitkomst.ok) return fout(uitkomst.status, uitkomst.fout)
    return NextResponse.json({ ok: true, ingaatOp: uitkomst.ingaatOp, plan: uitkomst.plan, cyclus: uitkomst.cyclus, bedragCent: uitkomst.bedragCent })
  } catch (e) {
    // Nooit interne details of Mollie-meldingen naar de gebruiker; wel loggen en melden.
    Sentry.captureException(e, { tags: { onderdeel: 'billing-overstap' } })
    console.error('[overstappen]', e instanceof Error ? e.message : e)
    return fout(502, 'Overstappen is niet gelukt. Probeer het zo opnieuw of mail admin@arno.bot.')
  }
}
