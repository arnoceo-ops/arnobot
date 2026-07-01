import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function renderContent(text: string) {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
  return escaped
    .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
    .replace(/_([^_\n]+)_/g, '<em>$1</em>')
}

export default async function GedeeldGesprekPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  const { data: shared } = await supabase
    .from('arnobot_shared_sessions')
    .select('session_id, user_id, created_at')
    .eq('token', token)
    .maybeSingle()

  if (!shared) notFound()

  const [{ data: session }, { data: messages }] = await Promise.all([
    supabase
      .from('arnobot_blog_sessions')
      .select('title, created_at')
      .eq('session_id', shared.session_id)
      .maybeSingle(),
    supabase
      .from('arnobot_rds_logs')
      .select('question, answer, created_at')
      .eq('session_id', shared.session_id)
      .order('created_at', { ascending: true }),
  ])

  const title = session?.title || 'Gesprek met ArnoBot'
  const datum = new Date(session?.created_at || shared.created_at).toLocaleDateString('nl-NL', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <>
      <style href="gesprek-shared" precedence="default">{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Space+Mono:wght@400;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #111827; font-family: 'Space Mono', monospace; font-weight: 400; }
      `}</style>

      <div style={{ background: '#111827', minHeight: '100vh', padding: 'clamp(40px,6vw,80px) clamp(16px,4vw,20px) 80px' }}>
        <div style={{ maxWidth: 812, margin: '0 auto' }}>

          <div style={{ marginBottom: 48 }}>
            <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, letterSpacing: 6, color: '#f1f5f9', marginBottom: 4, lineHeight: 1 }}>
              <span style={{ color: '#f1f5f9' }}>ARNO</span><span style={{ color: '#f59e0b' }}>BOT</span>
            </p>
            <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(28px,5vw,48px)', letterSpacing: 2, color: '#f1f5f9', lineHeight: 1.1, marginBottom: 8 }}>
              {title}
            </h1>
            <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, color: '#6b7280', letterSpacing: 1 }}>{datum}</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {(messages ?? []).map((msg, i) => (
              <div key={i}>
                <div style={{ display: 'flex', gap: 'clamp(16px,3vw,40px)', padding: 'clamp(20px,3vw,32px)', background: 'transparent', alignItems: 'flex-start' }}>
                  <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 3, color: '#6b7280', whiteSpace: 'nowrap', paddingTop: 2, minWidth: 48 }}>JIJ</span>
                  <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(18px,3vw,26px)', lineHeight: 1.5, color: '#f1f5f9', letterSpacing: 0.5 }}>{msg.question}</p>
                </div>
                <div style={{ display: 'flex', gap: 'clamp(16px,3vw,40px)', padding: 'clamp(20px,3vw,32px)', background: '#1f2937', alignItems: 'flex-start' }}>
                  <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 3, color: '#f59e0b', whiteSpace: 'nowrap', paddingTop: 2, minWidth: 48 }}>ARNO</span>
                  <p
                    style={{ fontFamily: "'Space Mono', monospace", fontSize: 15, lineHeight: 1.9, color: '#9ca3af', fontWeight: 400 }}
                    dangerouslySetInnerHTML={{ __html: renderContent(msg.answer) }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 64, paddingTop: 32, borderTop: '1px solid #1f2937', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, color: '#6b7280' }}>
              Gedeeld via <a href="https://arno.bot" style={{ color: '#f59e0b', textDecoration: 'none' }}>arno.bot</a>
            </p>
            <a
              href="https://arno.bot"
              style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 14, letterSpacing: 3, color: '#6b7280', textDecoration: 'none' }}
            >
              PROBEER ARNOBOT →
            </a>
          </div>

        </div>
      </div>
    </>
  )
}
