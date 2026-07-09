import { NextResponse } from 'next/server'

const MONITOR_ID = 'cmrd7yc363x4v6i501x1p1q6j'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const apiKey = process.env.INSTATUS_API_KEY?.trim()
    if (!apiKey) return NextResponse.json({ error: 'no key' }, { status: 500 })

    const pagesRes = await fetch('https://api.instatus.com/v1/pages', {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: 'no-store'
    })
    const pagesText = await pagesRes.text()
    let pages: unknown
    try {
      pages = JSON.parse(pagesText)
    } catch {
      return NextResponse.json({ error: 'pages not json', httpStatus: pagesRes.status, body: pagesText.slice(0, 500) }, { status: 500 })
    }
    const pageId = Array.isArray(pages) ? (pages as {id:string}[])[0]?.id : null
    if (!pageId) return NextResponse.json({ error: 'no page id', raw: pages }, { status: 500 })

    // Try without /v1/ prefix — docs show /:page_id/monitors
    const monitorsRes = await fetch(`https://api.instatus.com/${pageId}/monitors`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: 'no-store'
    })
    const monitorsText = await monitorsRes.text()
    let monitors: unknown
    try { monitors = JSON.parse(monitorsText) } catch {
      return NextResponse.json({ error: 'monitors not json', httpStatus: monitorsRes.status, body: monitorsText.slice(0, 500) }, { status: 500 })
    }

    return NextResponse.json({ pageId, monitors })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
