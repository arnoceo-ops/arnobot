import { NextRequest, NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'

// Zelfde patroon als app/api/arnobot-admin-login/route.ts, maar met een eigen
// env var en cookie: deze pagina heeft een eigen, losstaand wachtwoord, niet
// het volledige admin-wachtwoord, zodat de link los te delen is.
const ipAttempts = new Map<string, { count: number; firstAt: number }>()
const WINDOW_MS = 15 * 60 * 1000
const MAX_ATTEMPTS = 10

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const now = Date.now()

  const record = ipAttempts.get(ip)
  if (record) {
    if (now - record.firstAt > WINDOW_MS) {
      ipAttempts.delete(ip)
    } else if (record.count >= MAX_ATTEMPTS) {
      Sentry.captureMessage('kosten_login_rate_limited', { level: 'error', tags: { ip } })
      return NextResponse.json({ error: 'Too many attempts' }, { status: 429 })
    }
  }

  const { password } = await req.json()

  if (password !== process.env.ARNOBOT_KOSTEN_KEY) {
    await new Promise(r => setTimeout(r, 500))
    const current = ipAttempts.get(ip)
    if (current) {
      current.count++
    } else {
      ipAttempts.set(ip, { count: 1, firstAt: now })
    }
    Sentry.captureMessage('kosten_login_failed', { level: 'warning', tags: { ip } })
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  ipAttempts.delete(ip)

  const res = NextResponse.json({ ok: true })
  res.cookies.set('arnobot_kosten', process.env.ARNOBOT_KOSTEN_KEY!, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  })
  return res
}
