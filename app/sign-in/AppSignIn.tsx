'use client'

import { useState } from 'react'
import { useSignIn } from '@clerk/nextjs'
import { Browser } from '@capacitor/browser'

// Losse, simpele inlogflow voor binnen de Capacitor-app: e-mail/wachtwoord in plaats van
// LinkedIn-OAuth, want OAuth-via-systeembrowser-met-terugkeer-naar-de-app is (nog) niet
// betrouwbaar gebleken (zie docs/MOBILE_PLAN.md). Aanmelden blijft alleen via LinkedIn op
// de webapp; hier alleen inloggen met een account dat daar al een wachtwoord heeft ingesteld
// (app/bot/account/page.tsx).
export default function AppSignIn() {
  const { signIn, fetchStatus } = useSignIn()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!signIn || fetchStatus !== 'idle') return
    setLoading(true)
    setError('')
    try {
      await signIn.create({ identifier: email, password })
      if (signIn.status === 'complete') {
        const { error: finalizeError } = await signIn.finalize()
        if (finalizeError) {
          setError(finalizeError.longMessage || finalizeError.message || 'Inloggen niet voltooid. Probeer opnieuw.')
          setLoading(false)
          return
        }
        window.location.href = '/bot'
        return
      }
      setError('Inloggen niet voltooid. Controleer je gegevens.')
    } catch (err: unknown) {
      const clerr = err as { errors?: { message: string; longMessage?: string }[] }
      const msg = clerr?.errors?.[0]?.longMessage || clerr?.errors?.[0]?.message || 'Onjuist e-mailadres of wachtwoord.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Space+Mono:wght@400;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #111827; color: #f1f5f9; font-family: 'Space Mono', monospace; }
        .app-signin-input {
          padding: 12px 16px; border-radius: 4px; border: 1.5px solid #374151;
          background: #1f2937; color: #f1f5f9; font-family: 'Space Mono', monospace;
          font-size: 15px; outline: none;
        }
        .app-signin-input:focus { border-color: #f59e0b; }
        .app-signin-btn {
          padding: 12px 36px; background: #f59e0b; color: #111827; border: none;
          border-radius: 999px; font-family: 'Bebas Neue', sans-serif; font-size: 18px;
          letter-spacing: 3px; cursor: pointer; transition: background 0.2s;
        }
        .app-signin-btn:hover { background: #d97706; }
        .app-signin-btn:disabled { background: #374151; color: #4b5563; cursor: not-allowed; }
      `}</style>
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: '#111827', padding: '40px 20px' }}>
        <div style={{ width: '100%', maxWidth: 400, display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, letterSpacing: 4, color: '#f59e0b', marginBottom: 8 }}>ARNOBOT</p>
            <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 64, letterSpacing: 3, lineHeight: 1 }}>INLOGGEN</h1>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="E-mailadres"
              className="app-signin-input"
            />
            <input
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Wachtwoord"
              className="app-signin-input"
            />
            <button type="submit" disabled={loading} className="app-signin-btn" style={{ alignSelf: 'center' }}>
              {loading ? 'BEZIG...' : 'INLOGGEN'}
            </button>
            {error && <p style={{ color: '#cc2200', fontSize: 13, letterSpacing: 1, textAlign: 'center' }}>{error}</p>}
          </form>

          <p style={{ fontSize: 13, color: '#6b7280', letterSpacing: 1, textAlign: 'center', lineHeight: 1.8 }}>
            Nog geen account?{' '}
            <button
              type="button"
              onClick={() => Browser.open({ url: 'https://www.arno.bot/sign-up' })}
              style={{ background: 'none', border: 'none', color: '#f59e0b', textDecoration: 'underline', cursor: 'pointer', fontFamily: "'Space Mono', monospace", fontSize: 13, padding: 0 }}
            >
              Meld je aan op de website
            </button>
          </p>
        </div>
      </div>
    </>
  )
}
