export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get('arnobot_admin')?.value
  if (!token || token !== process.env.ARNOBOT_ADMIN_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const host = req.headers.get('host') ?? 'arno.bot'
  const proto = host.includes('localhost') ? 'http' : 'https'
  const baseUrl = `${proto}://${host}`

  const res = await fetch(`${baseUrl}/api/cron/rss-ingest`, {
    headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) return NextResponse.json({ error: body.error ?? `RSS ingest mislukt (${res.status})` }, { status: 500 })
  return NextResponse.json(body)
}
