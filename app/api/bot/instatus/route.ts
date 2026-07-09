import { NextResponse } from 'next/server'

const MONITOR_ID = 'cmrd7yc363x4v6i501x1p1q6j'

export const revalidate = 300

export async function GET() {
  try {
    const apiKey = process.env.INSTATUS_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'no key' }, { status: 500 })

    const pagesRes = await fetch('https://api.instatus.com/v1/pages', {
      headers: { Authorization: `Bearer ${apiKey}` },
      next: { revalidate: 300 }
    })
    const pages = await pagesRes.json()
    const pageId = Array.isArray(pages) ? pages[0]?.id : null
    if (!pageId) return NextResponse.json({ error: 'no page', raw: pages }, { status: 500 })

    const monitorRes = await fetch(`https://api.instatus.com/v1/${pageId}/monitors/${MONITOR_ID}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      next: { revalidate: 300 }
    })
    const monitor = await monitorRes.json()

    return NextResponse.json(monitor)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
