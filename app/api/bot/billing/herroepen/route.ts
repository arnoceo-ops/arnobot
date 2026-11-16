import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import * as Sentry from '@sentry/nextjs'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { herroepingBeschikbaarVoor, isProefmodus, voerHerroepingUit, zoekHerroepbaar } from '@/lib/billing/herroeping'

const ratelimit = new Ratelimit({
  redis: new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  }),
  limiter: Ratelimit.slidingWindow(10, '1 h'),
  prefix: 'arnobot:herroepen',
})

const fout = (status: number, error: string) => NextResponse.json({ error }, { status })

// Herroepen binnen de bedenktijd van 14 dagen (voorwaarden artikel 8), door de klant zelf. GET zegt of er
// iets te herroepen valt, POST doet het. userId komt altijd uit de sessie.
export async function GET() {
  const { userId } = await auth()
  if (!userId) return fout(401, 'Niet ingelogd')
  if (!herroepingBeschikbaarVoor(userId)) return NextResponse.json({ beschikbaar: false, herroepbaar: null })
  try {
    const { herroepbaar } = await zoekHerroepbaar(userId)
    return NextResponse.json({ beschikbaar: true, proef: isProefmodus(userId), herroepbaar })
  } catch (e) {
    Sentry.captureException(e, { tags: { onderdeel: 'billing-herroepen-status' } })
    return NextResponse.json({ beschikbaar: false, herroepbaar: null })
  }
}

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return fout(401, 'Niet ingelogd')
  if (!herroepingBeschikbaarVoor(userId)) return fout(503, 'Herroepen is nog niet beschikbaar')

  const { bevestigd } = await req.json().catch(() => ({}))
  if (bevestigd !== true) return fout(400, 'Bevestig dat je de koop ongedaan wilt maken.')

  const { success } = await ratelimit.limit(userId)
  if (!success) return fout(429, 'Te veel pogingen, probeer het over een uur opnieuw')

  try {
    const uitkomst = await voerHerroepingUit(userId)
    if (!uitkomst.ok) return fout(uitkomst.status, uitkomst.fout)
    return NextResponse.json({ ok: true, soort: uitkomst.soort, bedragCent: uitkomst.bedragCent, proef: uitkomst.proef })
  } catch (e) {
    Sentry.captureException(e, { tags: { onderdeel: 'billing-herroepen' } })
    console.error('[herroepen]', e instanceof Error ? e.message : e)
    return fout(502, 'Ongedaan maken is niet gelukt. Probeer het zo opnieuw of mail admin@arno.bot.')
  }
}
