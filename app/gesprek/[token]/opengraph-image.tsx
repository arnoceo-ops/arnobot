import { ImageResponse } from 'next/og'

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image({ params }: { params: { token: string } }) {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const headers = { apikey: key, Authorization: `Bearer ${key}` }

  let title = 'Gesprek met ArnoBot'

  try {
    const sharedRes = await fetch(
      `${baseUrl}/rest/v1/arnobot_shared_sessions?token=eq.${params.token}&select=session_id&limit=1`,
      { headers }
    )
    const [shared] = await sharedRes.json()

    if (shared?.session_id) {
      const sessionRes = await fetch(
        `${baseUrl}/rest/v1/arnobot_blog_sessions?session_id=eq.${shared.session_id}&select=title&limit=1`,
        { headers }
      )
      const [session] = await sessionRes.json()
      if (session?.title) title = session.title
    }
  } catch {}

  let fontData: ArrayBuffer | null = null
  try {
    const css = await fetch(
      'https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap',
      { headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' } }
    ).then(r => r.text())
    const urlMatch = css.match(/src: url\(([^)]+)\) format\('woff2'\)/)
    if (urlMatch) fontData = await fetch(urlMatch[1]).then(r => r.arrayBuffer())
  } catch {}

  const fontSize = title.length > 80 ? 52 : title.length > 50 ? 62 : 76

  return new ImageResponse(
    (
      <div style={{ background: '#111827', width: '100%', height: '100%', display: 'flex', flexDirection: 'row' }}>
        <div style={{ width: 14, background: '#f59e0b', height: '100%', flexShrink: 0 }} />
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '64px 80px',
          fontFamily: fontData ? 'Bebas Neue' : 'sans-serif',
        }}>
          <div style={{ display: 'flex' }}>
            <span style={{ color: '#f1f5f9', fontSize: 38, letterSpacing: 6 }}>ARNO</span>
            <span style={{ color: '#f59e0b', fontSize: 38, letterSpacing: 6 }}>BOT</span>
          </div>
          <div style={{ color: '#f1f5f9', fontSize, lineHeight: 1.15, letterSpacing: 2, maxWidth: 980 }}>
            {title}
          </div>
          <div style={{ color: '#6b7280', fontSize: 22, letterSpacing: 4 }}>
            arno.bot
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      ...(fontData ? { fonts: [{ name: 'Bebas Neue', data: fontData, weight: 400, style: 'normal' as const }] } : {}),
    }
  )
}
