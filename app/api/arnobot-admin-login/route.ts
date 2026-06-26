import { NextRequest, NextResponse } from 'next/server'

// In-memory rate limiter: werkt per serverless instance (good enough voor admin endpoint)
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
      return NextResponse.json({ error: 'Too many attempts' }, { status: 429 })
    }
  }

  const { password } = await req.json()

  if (password !== process.env.ARNOBOT_ADMIN_KEY) {
    await new Promise(r => setTimeout(r, 500))
    const current = ipAttempts.get(ip)
    if (current) {
      current.count++
    } else {
      ipAttempts.set(ip, { count: 1, firstAt: now })
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  ipAttempts.delete(ip)

  const res = NextResponse.json({ ok: true })
  res.cookies.set('arnobot_admin', process.env.ARNOBOT_ADMIN_KEY!, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: 60 * 60 * 2,
    path: '/',
  })
  return res
}
