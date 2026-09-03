'use client'

import { useState, useEffect } from 'react'
import { useSignIn, useUser } from '@clerk/nextjs'

// Verborgen, nergens gelinkte inlogroute voor Arno's eigen handmatige testaccount
// (test@arno.bot, zie lib/internalTestAccounts.ts), analoog aan het al bestaande patroon
// van app/sign-in/enterprise/page.tsx: alleen bereikbaar met de directe URL. Wachtwoord-login
// i.p.v. LinkedIn, zodat inloggen niet afhangt van een tweede LinkedIn-account. Zelfde
// Clerk-methode als de Capacitor-app gebruikt in ../AppSignIn.tsx.
export default function InternSignInPage() {
  const { signIn, fetchStatus } = useSignIn()
  const { isSignedIn } = useUser()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isSignedIn) window.location.href = '/bot'
  }, [isSignedIn])

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
      setLoading(false)
    } catch (err: unknown) {
      const clerr = err as { errors?: { message: string; longMessage?: string }[] }
      const msg = clerr?.errors?.[0]?.longMessage || clerr?.errors?.[0]?.message || 'Onjuist e-mailadres of wachtwoord.'
      setError(msg)
      setLoading(false)
    }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Space+Mono:wght@400;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #111827; color: #f1f5f9; font-family: 'Space Mono', monospace; }
        .intern-input {
          padding: 12px 16px; border-radius: 4px; border: 1.5px solid #374151;
          background: #1f2937; color: #f1f5f9; font-family: 'Space Mono', monospace;
          font-size: 15px; outline: none;
        }
        .intern-input:focus { border-color: #f59e0b; }
        .intern-btn {
          padding: 12px 36px; background: #f59e0b; color: #111827; border: none;
          border-radius: 999px; font-family: 'Bebas Neue', sans-serif; font-size: 18px;
          letter-spacing: 3px; cursor: pointer; transition: background 0.2s;
        }
        .intern-btn:hover { background: #d97706; }
        .intern-btn:disabled { background: #374151; color: #6b7280; cursor: not-allowed; }
      `}</style>
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: '#111827', padding: '40px 20px' }}>
        <div style={{ width: '100%', maxWidth: 400, display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, letterSpacing: 4, color: '#f59e0b', marginBottom: 8 }}>ARNOBOT</p>
            <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 64, letterSpacing: 3, lineHeight: 1 }}>TESTLOGIN</h1>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="E-mailadres"
              className="intern-input"
            />
            <input
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Wachtwoord"
              className="intern-input"
            />
            <button type="submit" disabled={loading} className="intern-btn" style={{ alignSelf: 'center' }}>
              {loading ? 'BEZIG...' : 'INLOGGEN'}
            </button>
            {error && <p style={{ color: '#cc2200', fontSize: 13, letterSpacing: 1, textAlign: 'center' }}>{error}</p>}
          </form>
        </div>
      </div>
    </>
  )
}
