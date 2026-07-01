import { ImageResponse } from 'next/og'
import { createClient } from '@supabase/supabase-js'

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image({ params }: { params: { token: string } }) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  let title = 'Gesprek met ArnoBot'

  const { data: shared } = await supabase
    .from('arnobot_shared_sessions')
    .select('session_id')
    .eq('token', params.token)
    .maybeSingle()

  if (shared) {
    const { data: session } = await supabase
      .from('arnobot_blog_sessions')
      .select('title')
      .eq('session_id', shared.session_id)
      .maybeSingle()
    if (session?.title) title = session.title
  }

  let fontData: ArrayBuffer | null = null
  try {
    const css = await fetch(
      'https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap',
      { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)' } }
    ).then(r => r.text())
    const url = css.match(/url\(([^)]+\.woff2[^)]*)\)/)?.[1]
    if (url) fontData = await fetch(url).then(r => r.arrayBuffer())
  } catch {}

  const fontSize = title.length > 80 ? 52 : title.length > 50 ? 60 : 72

  return new ImageResponse(
    (
      <div
        style={{
          background: '#111827',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '80px',
          fontFamily: fontData ? 'Bebas Neue' : 'sans-serif',
        }}
      >
        <div style={{ display: 'flex' }}>
          <span style={{ color: '#f1f5f9', fontSize: 48, letterSpacing: 6 }}>ARNO</span>
          <span style={{ color: '#f59e0b', fontSize: 48, letterSpacing: 6 }}>BOT</span>
        </div>
        <div
          style={{
            color: '#f1f5f9',
            fontSize,
            lineHeight: 1.1,
            letterSpacing: 2,
            maxWidth: 1000,
          }}
        >
          {title}
        </div>
        <div style={{ color: '#6b7280', fontSize: 24, letterSpacing: 4 }}>
          arno.bot
        </div>
      </div>
    ),
    {
      ...size,
      ...(fontData ? { fonts: [{ name: 'Bebas Neue', data: fontData, weight: 400, style: 'normal' as const }] } : {}),
    }
  )
}
