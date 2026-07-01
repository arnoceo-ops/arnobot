import { ImageResponse } from 'next/og'

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const headers = { apikey: key, Authorization: `Bearer ${key}` }

  let title = 'Gesprek met ArnoBot'

  try {
    const sharedRes = await fetch(
      `${baseUrl}/rest/v1/arnobot_shared_sessions?token=eq.${token}&select=session_id&limit=1`,
      { headers, signal: AbortSignal.timeout(3000) }
    )
    const [shared] = await sharedRes.json()

    if (shared?.session_id) {
      const sessionRes = await fetch(
        `${baseUrl}/rest/v1/arnobot_blog_sessions?session_id=eq.${shared.session_id}&select=title&limit=1`,
        { headers, signal: AbortSignal.timeout(3000) }
      )
      const [session] = await sessionRes.json()
      if (session?.title) title = session.title
    }
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
          fontFamily: 'sans-serif',
        }}>
          <div style={{ display: 'flex', gap: 0 }}>
            <span style={{ color: '#f1f5f9', fontSize: 38, fontWeight: 700, letterSpacing: 6 }}>ARNO</span>
            <span style={{ color: '#f59e0b', fontSize: 38, fontWeight: 700, letterSpacing: 6 }}>BOT</span>
          </div>
          <div style={{ color: '#f1f5f9', fontSize, fontWeight: 700, lineHeight: 1.15, letterSpacing: 1, maxWidth: 980 }}>
            {title}
          </div>
          <div style={{ color: '#6b7280', fontSize: 22, letterSpacing: 4 }}>
            arno.bot
          </div>
        </div>
      </div>
    ),
    { ...size }
  )
}
