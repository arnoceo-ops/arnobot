'use client'

import { useSignIn, useUser } from '@clerk/nextjs'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function EnterpriseSignInPage() {
  const { signIn } = useSignIn()
  const { isSignedIn } = useUser()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isSignedIn) router.replace('/bot')
  }, [isSignedIn, router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!signIn) return
    setLoading(true)
    setError('')

    const { error: ssoError } = await signIn.sso({
      identifier: email,
      strategy: 'enterprise_sso',
      redirectUrl: `${window.location.origin}/sso-callback`,
      redirectCallbackUrl: '/bot',
    })

    if (ssoError) {
      setError('Geen bedrijfsaccount gevonden voor dit e-maildomein. Log in via LinkedIn.')
      setLoading(false)
    }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Space+Mono:wght@400;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #111827; color: #f1f5f9; font-family: 'Space Mono', monospace; }
        .ent-btn {
          padding: 10px 28px; background: #f59e0b; color: #111827;
          border: none; border-radius: 999px; font-family: 'Bebas Neue', sans-serif;
          font-size: 16px; letter-spacing: 3px; cursor: pointer; transition: background 0.2s;
        }
        .ent-btn:hover { background: #d97706; }
        .ent-btn:disabled { background: #a0651a; cursor: not-allowed; opacity: 0.85; }
      `}</style>
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: '#111827', padding: '40px 20px' }}>
        <div style={{ width: '100%', maxWidth: 400, display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 13, letterSpacing: 6, color: '#f59e0b', marginBottom: 8 }}>ARNOBOT UNLIMITED</p>
            <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 44, letterSpacing: 1, lineHeight: 1 }}>BEDRIJFSLOGIN</h1>
          </div>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="jouw@bedrijfsdomein.nl"
              style={{ width: '100%', padding: '10px 14px', borderRadius: 6, border: '1px solid #374151', background: '#1f2937', color: '#f1f5f9', fontFamily: "'Space Mono', monospace", fontSize: 14 }}
            />
            <button type="submit" disabled={loading} className="ent-btn">
              {loading ? 'VERBINDEN...' : 'DOORGAAN'}
            </button>
          </form>
          {error && <p style={{ color: '#cc3300', fontSize: 13, letterSpacing: 1, textAlign: 'center' }}>{error}</p>}
          <p style={{ fontSize: 12, color: '#6b7280', letterSpacing: 1, textAlign: 'center', lineHeight: 1.8 }}>
            Geen bedrijfsaccount? <Link href="/sign-in" style={{ color: '#6b7280' }}>Log in via LinkedIn.</Link>
          </p>
        </div>
      </div>
    </>
  )
}
