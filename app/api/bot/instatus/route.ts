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

    return NextResponse.json({
      status: m.status,
      name: m.name,
      averageResponseTime: m.averageResponseTime,
      url: m.url,
      checkedAt: m.updatedAt,
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
