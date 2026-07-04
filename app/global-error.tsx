'use client'

import { useEffect } from 'react'

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <html lang="nl">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Er ging iets mis: ArnoBot</title>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Space+Mono:wght@400;700&display=swap');
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { background: #111827; color: #f1f5f9; font-family: 'Space Mono', monospace; font-weight: 400; }
          .reset-btn { font-family: 'Bebas Neue', sans-serif; font-size: 18px; letter-spacing: 3px; padding: 12px 36px; border-radius: 999px; background: #f59e0b; color: #111827; border: none; cursor: pointer; display: inline-block; }
          .reset-btn:hover { background: #d97706; }
        `}</style>
      </head>
      <body>
        <div style={{ minHeight: '100vh', background: '#111827', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ maxWidth: 812, padding: 'clamp(16px,4vw,20px)', textAlign: 'center' }}>
            <p style={{ fontFamily: "'Space Mono', monospace", fontWeight: 400, fontSize: 13, letterSpacing: 4, color: '#f59e0b', marginBottom: 8 }}>ARNOBOT</p>
            <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(48px,10vw,96px)', letterSpacing: 3, color: '#f1f5f9', lineHeight: 1, marginBottom: 8 }}>Oeps.</h1>
            <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 15, color: '#9ca3af', lineHeight: 1.9, marginBottom: 40 }}>
              Er is een onverwachte fout opgetreden. Probeer het opnieuw of kom later terug.
            </p>
            <button className="reset-btn" onClick={reset}>OPNIEUW PROBEREN</button>
          </div>
        </div>
      </body>
    </html>
  )
}
