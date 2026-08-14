import { NextRequest, NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'

// In-memory rate limiter: werkt per serverless instance, zelfde patroon als arnobot-admin-login.
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
      Sentry.captureMessage('sd_verdien_login_rate_limited', { level: 'error', tags: { ip } })
      return NextResponse.json({ error: 'Too many attempts' }, { status: 429 })
    }
  }

  const { password } = await req.json()

  // Arno's eigen adminwachtwoord werkt hier ook: zet dan de bestaande arnobot_admin-cookie
  // (zelfde als /bot/admin/login), zodat hij in één stap zowel op /agents als op /bot/admin
  // is ingelogd, geen apart wachtwoord voor zichzelf nodig.
  if (password === process.env.ARNOBOT_ADMIN_KEY) {
    ipAttempts.delete(ip)
    const res = NextResponse.json({ ok: true })
    res.cookies.set('arnobot_admin', process.env.ARNOBOT_ADMIN_KEY!, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    })
    return res
  }

  if (password !== process.env.SD_VERDIEN_PASSWORD) {
    await new Promise(r => setTimeout(r, 500))
    const current = ipAttempts.get(ip)
    if (current) {
      current.count++
    } else {
      ipAttempts.set(ip, { count: 1, firstAt: now })
    }
    Sentry.captureMessage('sd_verdien_login_failed', { level: 'warning', tags: { ip } })
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  ipAttempts.delete(ip)

  const res = NextResponse.json({ ok: true })
  res.cookies.set('arnobot_sd_verdien', process.env.SD_VERDIEN_PASSWORD!, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  })
  return res
}
