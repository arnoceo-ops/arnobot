import { NextRequest, NextResponse } from 'next/server'
import { clientIp, unsubscribeIpLimit } from '@/lib/blogRateLimit'
import { isTokenShape, unsubscribeByToken } from '@/lib/blogSubscribers'

// Twee ingangen, beide POST:
// 1. De afmeldpagina (knop), met het token in de JSON-body.
// 2. Eén-klik-afmelden vanuit mailclients (RFC 8058): de client POST naar de URL uit de
//    List-Unsubscribe-header, met het token in de query en "List-Unsubscribe=One-Click" als body.
export async function POST(req: NextRequest) {
  const { success } = await unsubscribeIpLimit.limit(clientIp(req))
  if (!success) return NextResponse.json({ error: 'Te veel pogingen' }, { status: 429 })

  let token = req.nextUrl.searchParams.get('token')
  if (!token) {
    const body = (await req.json().catch(() => null)) as { token?: unknown } | null
    token = typeof body?.token === 'string' ? body.token : null
  }
  if (!token || !isTokenShape(token)) return NextResponse.json({ error: 'Ongeldig token' }, { status: 400 })

  try {
    const result = await unsubscribeByToken(token)
    return result === 'ok' ? NextResponse.json({ ok: true }) : NextResponse.json({ error: 'Ongeldig token' }, { status: 400 })
  } catch (err) {
    console.error('[blog/unsubscribe]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Mislukt' }, { status: 500 })
  }
}
