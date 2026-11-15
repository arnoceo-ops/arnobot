import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { mollieBeschikbaarVoor } from '@/lib/billing/mollie'
import { activatieBedrag, activeerTeam, leesActivatieStand, MAX_SEATS, valideerActivatie } from '@/lib/teamActivatie'
import { TEAM_MIN_GEBRUIKERS } from '@/lib/teamPricing'

// Een manager activeert zelf zijn team na de gratis agent-proef (docs/TEAM_PROCES.md).
// GET: de teamstand (en met ?seats&cyclus het bedrag van de eerste factuur voor het voorbeeld).
// POST: bevestigen. De server controleert alles opnieuw; het scherm toont alleen.

const ratelimit = new Ratelimit({
  redis: new Redis({ url: process.env.UPSTASH_REDIS_REST_URL!, token: process.env.UPSTASH_REDIS_REST_TOKEN! }),
  limiter: Ratelimit.slidingWindow(10, '1 h'),
  prefix: 'arnobot:team-activeren',
})

const fout = (status: number, error: string) => NextResponse.json({ error }, { status })

export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return fout(401, 'Niet ingelogd')
  const stand = await leesActivatieStand(userId)
  if (!stand) return NextResponse.json({ stand: null })

  const seats = Number(req.nextUrl.searchParams.get('seats'))
  const cyclus = req.nextUrl.searchParams.get('cyclus')
  const bedrag = Number.isInteger(seats) && seats >= TEAM_MIN_GEBRUIKERS && seats <= MAX_SEATS && (cyclus === 'maandelijks' || cyclus === 'jaarlijks')
    ? activatieBedrag(seats, cyclus)
    : null
  return NextResponse.json({ stand, bedrag, betalenBeschikbaar: mollieBeschikbaarVoor(userId) })
}

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return fout(401, 'Niet ingelogd')
  if (!mollieBeschikbaarVoor(userId)) return fout(503, 'Online betalen is nog niet beschikbaar')

  const { success } = await ratelimit.limit(userId)
  if (!success) return fout(429, 'Te veel pogingen, probeer het over een uur opnieuw')

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') return fout(400, 'Ongeldig verzoek')
  if ((body as Record<string, unknown>).akkoordVoorwaarden !== true) return fout(400, 'Ga akkoord met de algemene voorwaarden om door te gaan')

  const invoer = await valideerActivatie(body as Record<string, unknown>)
  if (!invoer.ok) return fout(400, invoer.fout)

  const uitkomst = await activeerTeam(userId, invoer.waarde)
  if (!uitkomst.ok) return fout(uitkomst.status, uitkomst.fout)
  return NextResponse.json({ ok: true, bedragCent: uitkomst.bedragCent, seats: uitkomst.seats, betaalLink: uitkomst.betaalLink })
}
