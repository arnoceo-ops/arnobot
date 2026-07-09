import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const apiKey = process.env.INSTATUS_API_KEY?.trim()
    if (!apiKey) return NextResponse.json({ error: 'no key' }, { status: 500 })

    const pages = await fetch('https://api.instatus.com/v1/pages', {
      headers: { Authorization: `Bearer ${apiKey}` }, cache: 'no-store'
    }).then(r => r.json())

    const pageId = Array.isArray(pages) ? (pages as { id: string }[])[0]?.id : null
    if (!pageId) return NextResponse.json({ error: 'no page id' }, { status: 500 })

    const monitorsData = await fetch(`https://api.instatus.com/${pageId}/monitors`, {
      headers: { Authorization: `Bearer ${apiKey}` }, cache: 'no-store'
    }).then(r => r.json())

    const m = monitorsData?.monitors?.[0]
    if (!m) return NextResponse.json({ error: 'no monitor' }, { status: 500 })

    let avgMs: number | null = m.averageResponseTime ?? null
    let p95: number | null = null
    let availDay: number | null = null
    let availWeek: number | null = null
    let downSeconds = 0

    try {
      const logsData = await fetch(`https://api.instatus.com/monitors/${m.id}/logs?limit=1000`, {
        headers: { Authorization: `Bearer ${apiKey}` }, cache: 'no-store'
      }).then(r => r.json())

      if (Array.isArray(logsData?.logs) && logsData.logs.length > 0) {
        const logs = logsData.logs
        const now = Date.now()
        const oneDayAgo = now - 24 * 60 * 60 * 1000
        const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000

        const logsDay = logs.filter((l: { createdAt: string }) => new Date(l.createdAt).getTime() > oneDayAgo)
        const logsWeek = logs.filter((l: { createdAt: string }) => new Date(l.createdAt).getTime() > oneWeekAgo)

        if (logsDay.length > 0)
          availDay = Math.round(logsDay.filter((l: { status: string }) => l.status === 'UP').length / logsDay.length * 100)
        if (logsWeek.length > 0)
          availWeek = Math.round(logsWeek.filter((l: { status: string }) => l.status === 'UP').length / logsWeek.length * 100)

        const times = logsWeek
          .map((l: { responseTime?: number }) => l.responseTime ?? 0)
          .filter((t: number) => t > 0)
          .sort((a: number, b: number) => a - b)

        if (times.length > 0) {
          avgMs = Math.round(times.reduce((s: number, t: number) => s + t, 0) / times.length)
          p95 = times[Math.floor(times.length * 0.95)]
        }

        downSeconds = logsWeek.filter((l: { status: string }) => l.status !== 'UP').length * (m.durationBetweenChecksInSeconds ?? 600)
      }
    } catch { /* logs endpoint niet beschikbaar */ }

    return NextResponse.json({
      status: m.status as string,
      name: m.name as string,
      avgMs,
      p95,
      availDay,
      availWeek,
      downSeconds,
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
