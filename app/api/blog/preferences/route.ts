import { NextRequest, NextResponse } from 'next/server'
import { clientIp, tokenIpLimit } from '@/lib/blogRateLimit'
import { isTokenShape, updatePreferences } from '@/lib/blogSubscribers'

export async function POST(req: NextRequest) {
  const { success } = await tokenIpLimit.limit(clientIp(req))
  if (!success) return NextResponse.json({ error: 'Te veel pogingen' }, { status: 429 })

  const body = (await req.json().catch(() => null)) as { token?: unknown; topics?: unknown } | null
  if (!body || typeof body.token !== 'string' || !isTokenShape(body.token)) {
    return NextResponse.json({ error: 'Ongeldig token' }, { status: 400 })
  }
  try {
    const result = await updatePreferences(body.token, body.topics)
    return result === 'ok' ? NextResponse.json({ ok: true }) : NextResponse.json({ error: 'Ongeldig token' }, { status: 400 })
  } catch (err) {
    console.error('[blog/preferences]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Mislukt' }, { status: 500 })
  }
}
