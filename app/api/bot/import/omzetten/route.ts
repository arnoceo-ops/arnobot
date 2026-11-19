import { NextRequest, NextResponse } from 'next/server'
import { maakAnthropic } from '@/lib/anthropicClient'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { historieImportGebruiker } from '@/lib/historieImportApi'
import { zetOmInProfiel } from '@/lib/historieImport'
import { MAX_INVOER_TEKENS } from '@/lib/historieImportRegels'
import { isInternalTestUser } from '@/lib/internalTestAccounts'
import { limietVeilig } from '@/lib/limietVeilig'

export const maxDuration = 30

const anthropic = maakAnthropic()

// Per gebruiker 5 omzettingen per uur. Fail-open bij een Upstash-storing (lib/limietVeilig.ts), daarom wordt de lengte van de
// invoer al vóór de limiter en vóór het model gecontroleerd.
const omzetLimiet = new Ratelimit({
  redis: new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  }),
  limiter: Ratelimit.slidingWindow(5, '1 h'),
  prefix: 'arnobot:historie-import',
})

// Een geplakt antwoord aan een voorstel omzetten. Bewaart niets: de gebruiker controleert het voorstel en slaat het daarna zelf op (PUT /profiel).
export async function POST(req: NextRequest) {
  const g = await historieImportGebruiker({ metToegangscontrole: true })
  if ('fout' in g) return g.fout

  // Een request body ruim boven de toegestane tekst wordt niet eens gelezen (een teken kan tot vier bytes zijn).
  const lengte = Number(req.headers.get('content-length') ?? 0)
  if (lengte > MAX_INVOER_TEKENS * 4 + 2000) return NextResponse.json({ error: 'invoer_te_lang' }, { status: 413 })

  const body = await req.json().catch(() => null)
  const tekst = body && typeof body === 'object' ? (body as { tekst?: unknown }).tekst : undefined
  if (typeof tekst !== 'string' || tekst.trim().length === 0) return NextResponse.json({ error: 'invoer_leeg' }, { status: 400 })
  if (tekst.length > MAX_INVOER_TEKENS) return NextResponse.json({ error: 'invoer_te_lang' }, { status: 400 })

  if (!isInternalTestUser(g.userId)) {
    const { success } = await limietVeilig(omzetLimiet, g.userId)
    if (!success) return NextResponse.json({ error: 'rate_limit' }, { status: 429 })
  }

  const r = await zetOmInProfiel(anthropic, tekst)
  if (r.fout) return NextResponse.json({ error: r.fout }, { status: r.fout === 'omzetten_mislukt' ? 502 : 400 })
  return NextResponse.json({ profiel: r.profiel, leeg: r.leeg })
}
