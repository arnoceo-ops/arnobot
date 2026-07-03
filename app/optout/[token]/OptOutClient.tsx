'use client'

import { useState } from 'react'

export default function OptOutClient({ token, sig }: { token: string; sig: string }) {
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')

  async function handleOptOut() {
    setState('loading')
    try {
      const res = await fetch('/api/optout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, sig }),
      })
      setState(res.ok ? 'done' : 'error')
    } catch {
      setState('error')
    }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Space+Mono:wght@400;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #111827; color: #f1f5f9; font-family: 'Space Mono', monospace; font-weight: 400; }
      `}</style>
      <main style={{ background: '#111827', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
        <div style={{ maxWidth: 480, width: '100%' }}>
          <p style={{ fontFamily: "'Space Mono', monospace", color: '#f59e0b', fontSize: 13, fontWeight: 400, letterSpacing: 4, marginBottom: 24 }}>
            ARNOBOT
          </p>

          {state === 'done' ? (
            <>
              <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 48, letterSpacing: 3, color: '#f1f5f9', marginBottom: 24, lineHeight: 1 }}>
                Je bent uitgeschreven
              </h1>
              <p style={{ fontSize: 15, lineHeight: 1.9, color: '#9ca3af' }}>
                Je ontvangt geen activiteitsherinneringen meer van ArnoBot.
              </p>
            </>
          ) : (
            <>
              <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 48, letterSpacing: 3, color: '#f1f5f9', marginBottom: 16, lineHeight: 1 }}>
                Geen herinneringen meer
              </h1>
              <p style={{ fontSize: 15, lineHeight: 1.9, color: '#9ca3af', marginBottom: 40 }}>
                Klik hieronder om te bevestigen. Je ontvangt daarna geen activiteitsherinneringen meer van ArnoBot.
              </p>
              {state === 'error' && (
                <p style={{ fontSize: 13, color: '#cc2200', letterSpacing: 1, marginBottom: 24 }}>
                  Er ging iets mis. Probeer het opnieuw of mail naar arno@arno.bot.
                </p>
              )}
              <button
                onClick={handleOptOut}
                disabled={state === 'loading'}
                style={{
                  fontFamily: "'Bebas Neue', sans-serif",
                  fontSize: 18,
                  letterSpacing: 3,
                  padding: '12px 36px',
                  borderRadius: 999,
                  border: '1px solid #cc2200',
                  background: 'transparent',
                  color: '#cc2200',
                  cursor: state === 'loading' ? 'wait' : 'pointer',
                  opacity: state === 'loading' ? 0.5 : 1,
                }}
              >
                {state === 'loading' ? 'BEZIG...' : 'STOP HERINNERINGEN'}
              </button>
            </>
          )}
        </div>
      </main>
    </>
  )
}
