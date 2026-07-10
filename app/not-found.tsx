import Link from 'next/link'
import NotFoundCapture from './NotFoundCapture'

export const metadata = {
  title: 'Pagina niet gevonden: ArnoBot',
  robots: 'noindex',
}

export default function NotFound() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Space+Mono:wght@400;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #111827; color: #f1f5f9; font-family: 'Space Mono', monospace; font-weight: 400; }
      `}</style>
      <NotFoundCapture />
      <div style={{ minHeight: '100vh', background: '#111827', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ maxWidth: 812, padding: 'clamp(16px,4vw,20px)', textAlign: 'center' }}>
          <p style={{ fontFamily: "'Space Mono', monospace", fontWeight: 400, fontSize: 13, letterSpacing: 4, color: '#f59e0b', marginBottom: 8 }}>ARNOBOT</p>
          <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(48px,10vw,96px)', letterSpacing: 3, color: '#f1f5f9', lineHeight: 1, marginBottom: 8 }}>404.</h1>
          <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 15, color: '#9ca3af', lineHeight: 1.9, marginBottom: 40 }}>
            Deze pagina bestaat niet. Misschien is de URL veranderd.
          </p>
          <Link href="/" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 3, padding: '12px 36px', borderRadius: 999, background: '#f59e0b', color: '#111827', textDecoration: 'none', display: 'inline-block' }}>
            TERUG NAAR HOME
          </Link>
        </div>
      </div>
    </>
  )
}
