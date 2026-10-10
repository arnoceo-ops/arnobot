import { NextRequest, NextResponse } from 'next/server'
import { clientIp, tokenIpLimit } from '@/lib/blogRateLimit'
import { confirmSubscription, isTokenShape } from '@/lib/blogSubscribers'

// Bevestigen gebeurt via POST (knop op de pagina), niet bij het openen van de link: mailscanners
// openen links automatisch en zouden anders namens de ontvanger bevestigen.
export async function POST(req: NextRequest) {
  const { success } = await tokenIpLimit.limit(clientIp(req))
  if (!success) return NextResponse.json({ error: 'Te veel pogingen' }, { status: 429 })

  const body = (await req.json().catch(() => null)) as { token?: unknown } | null
  if (!body || typeof body.token !== 'string' || !isTokenShape(body.token)) {
    return NextResponse.json({ error: 'Ongeldig token' }, { status: 400 })
  }
  try {
    const result = await confirmSubscription(body.token)
    return result === 'ok' ? NextResponse.json({ ok: true }) : NextResponse.json({ error: 'Ongeldig token' }, { status: 400 })
  } catch (err) {
    console.error('[blog/confirm]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Mislukt' }, { status: 500 })
  }
}
