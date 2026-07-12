'use client'

import { useSignIn, useUser } from '@clerk/nextjs'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

function getClerkFrontendApi(): string {
  const key = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? ''
  const b64 = key.replace(/^pk_(live|test)_/, '')
  try {
    return atob(b64).replace(/\$$/, '')
  } catch {
    return ''
  }
}

async function linkedInViaDirectFetch(): Promise<boolean> {
  const frontendApi = getClerkFrontendApi()
  if (!frontendApi) return false

  const res = await fetch(`https://${frontendApi}/v1/client/sign_ins`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    credentials: 'include',
    body: new URLSearchParams({
      strategy: 'oauth_linkedin_oidc',
      redirect_url: `${window.location.origin}/sso-callback`,
      action_complete_redirect_url: '/bot',
    }),
  })

  const data = await res.json()
  const oauthUrl =
    data?.response?.first_factor_verification?.external_verification_redirect_url ||
    data?.response?.external_account?.verification?.external_verification_redirect_url

  if (oauthUrl) {
    window.location.href = oauthUrl
    return true
  }
  return false
}

export default function SignInPage() {
  const { fetchStatus, signIn } = useSignIn()
  const { isSignedIn } = useUser()
  const router = useRouter()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [autoTriggered, setAutoTriggered] = useState(false)

  // LinkedIn-fallback: alleen zichtbaar als Arno de schakelaar in het adminpaneel heeft
  // aangezet (bij een LinkedIn-storing). Standaard uit, dan is dit hele blok onzichtbaar
  // en verandert er niets aan het normale, keuzevrije LinkedIn-only inloggen.
  const [fallbackChecked, setFallbackChecked] = useState(false)
  const [fallbackEnabled, setFallbackEnabled] = useState(false)
  const [emailStep, setEmailStep] = useState<'hidden' | 'email' | 'code'>('hidden')
  const [emailValue, setEmailValue] = useState('')
  const [codeValue, setCodeValue] = useState('')
  const [emailError, setEmailError] = useState('')
  const [emailLoading, setEmailLoading] = useState(false)

  useEffect(() => {
    fetch('/api/auth-mode')
      .then(res => res.json())
      .then(data => setFallbackEnabled(!!data.linkedinFallbackEnabled))
      .catch(() => setFallbackEnabled(false))
      .finally(() => setFallbackChecked(true))
  }, [])

  useEffect(() => {
    if (isSignedIn) router.replace('/bot')
  }, [isSignedIn, router])

  // Bfcache fix: na LinkedIn-redirect kan de browser de pagina ingevroren herstellen
  // met loading=true en de knop disabled. pageshow detecteert dit en reset de state.
  useEffect(() => {
    function handlePageShow(e: PageTransitionEvent) {
      if (e.persisted) {
        setLoading(false)
        setAutoTriggered(false)
      }
    }
    window.addEventListener('pageshow', handlePageShow)
    return () => window.removeEventListener('pageshow', handlePageShow)
  }, [])

  // Auto-redirect naar LinkedIn alleen in de normale situatie. Staat de fallback aan
  // (Arno heeft 'm bij een storing aangezet), dan wachten we tot de gebruiker zelf kiest.
  useEffect(() => {
    if (fetchStatus === 'idle' && signIn && !isSignedIn && !autoTriggered && fallbackChecked && !fallbackEnabled) {
      setAutoTriggered(true)
      handleLinkedIn()
    }
  }, [fetchStatus, signIn, isSignedIn, autoTriggered, fallbackChecked, fallbackEnabled])

  async function handleEmailCodeRequest(e: React.FormEvent) {
    e.preventDefault()
    if (!signIn) return
    setEmailLoading(true)
    setEmailError('')
    const { error: sendError } = await signIn.emailCode.sendCode({ emailAddress: emailValue })
    if (sendError) {
      setEmailError(sendError.longMessage || sendError.message || 'Kon geen code versturen. Controleer het e-mailadres.')
      setEmailLoading(false)
      return
    }
    setEmailStep('code')
    setEmailLoading(false)
  }

  async function handleEmailCodeConfirm(e: React.FormEvent) {
    e.preventDefault()
    if (!signIn) return
    setEmailLoading(true)
    setEmailError('')
    const { error: verifyError } = await signIn.emailCode.verifyCode({ code: codeValue })
    if (verifyError) {
      setEmailError(verifyError.longMessage || verifyError.message || 'Onjuiste code. Probeer opnieuw.')
      setEmailLoading(false)
      return
    }
    if (signIn.status === 'complete') {
      const { error: finalizeError } = await signIn.finalize()
      if (finalizeError) {
        setEmailError(finalizeError.longMessage || finalizeError.message || 'Inloggen niet voltooid. Probeer opnieuw.')
        setEmailLoading(false)
        return
      }
      router.push('/bot')
    } else {
      setEmailError('Inloggen niet voltooid. Probeer opnieuw.')
      setEmailLoading(false)
    }
  }

  async function handleLinkedIn() {
    if (fetchStatus !== 'idle' || !signIn) {
      setError('Pagina nog niet geladen. Ververs de pagina.')
      return
    }
    setError('')
    setLoading(true)

    // MetaMask's SES lockdown breekt Clerk's SDK — bypass via directe fetch
    const hasMetaMask = typeof window !== 'undefined' &&
      !!(window as unknown as { ethereum?: { isMetaMask?: boolean } }).ethereum?.isMetaMask

    if (hasMetaMask) {
      try {
        const ok = await linkedInViaDirectFetch()
        if (!ok) {
          setError('Verbinding mislukt. Ververs de pagina en probeer opnieuw.')
          setLoading(false)
        }
      } catch {
        setError('Verbinding mislukt. Ververs de pagina en probeer opnieuw.')
        setLoading(false)
      }
      return
    }

    const timer = setTimeout(() => {
      setLoading(false)
      setError('Verbinding mislukt. Ververs de pagina en probeer opnieuw.')
    }, 20000)

    try {
      await signIn.sso({
        strategy: 'oauth_linkedin_oidc',
        redirectUrl: `${window.location.origin}/sso-callback`,
        redirectCallbackUrl: '/bot',
      })
      clearTimeout(timer)
    } catch (err: unknown) {
      clearTimeout(timer)
      const clerr = err as { errors?: { message: string; longMessage?: string }[] }
      const msg = clerr?.errors?.[0]?.longMessage
        || clerr?.errors?.[0]?.message
        || (err as Error)?.message
        || 'Er is iets misgegaan'
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
        .li-btn {
          padding: 10px 28px; background: #0A66C2; color: #fff;
          border: none; border-radius: 999px; font-family: 'Bebas Neue', sans-serif;
          font-size: 16px; letter-spacing: 3px; cursor: pointer; transition: background 0.2s;
          display: inline-flex; align-items: center; justify-content: center; gap: 8px;
        }
        .li-btn:hover { background: #0856A4; }
        .li-btn:disabled { background: #1a56a0; cursor: not-allowed; opacity: 0.85; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .spinner { width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite; flex-shrink: 0; }
      `}</style>
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: '#111827', padding: '40px 20px' }}>
        <div style={{ width: '100%', maxWidth: 400, display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 13, letterSpacing: 6, color: '#f59e0b', marginBottom: 8 }}>ARNOBOT UNLIMITED</p>
            <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 44, letterSpacing: 1, lineHeight: 1 }}>INLOGGEN</h1>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <button className="li-btn" onClick={handleLinkedIn} type="button" disabled={loading}>
              {loading ? <div className="spinner" /> : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                </svg>
              )}
              {loading ? 'VERBINDEN MET LINKEDIN...' : 'DOORGAAN MET LINKEDIN'}
            </button>
          </div>
          {error && <p style={{ color: '#cc3300', fontSize: 13, letterSpacing: 1, textAlign: 'center' }}>{error}</p>}
          {fetchStatus === 'fetching' && <p style={{ color: '#6b7280', fontSize: 11, letterSpacing: 1, textAlign: 'center' }}>LADEN...</p>}

          {fallbackEnabled && emailStep === 'hidden' && (
            <div style={{ textAlign: 'center' }}>
              <button
                type="button"
                onClick={() => setEmailStep('email')}
                style={{ background: 'none', border: 'none', color: '#f59e0b', fontSize: 13, letterSpacing: 1, cursor: 'pointer', textDecoration: 'underline' }}
              >
                LinkedIn ligt er tijdelijk uit? Log in via e-mail
              </button>
            </div>
          )}

          {fallbackEnabled && emailStep === 'email' && (
            <form onSubmit={handleEmailCodeRequest} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <p style={{ fontSize: 12, color: '#f59e0b', letterSpacing: 1, textAlign: 'center' }}>
                Tijdelijke inlogmethode zolang LinkedIn eruit ligt.
              </p>
              <input
                type="email"
                required
                value={emailValue}
                onChange={e => setEmailValue(e.target.value)}
                placeholder="jouw@email.nl"
                style={{ padding: '10px 14px', borderRadius: 6, border: '1px solid #374151', background: '#1f2937', color: '#f1f5f9', fontFamily: "'Space Mono', monospace", fontSize: 14 }}
              />
              <button type="submit" disabled={emailLoading} className="li-btn" style={{ background: '#f59e0b', color: '#111827' }}>
                {emailLoading ? 'VERSTUREN...' : 'VERSTUUR CODE'}
              </button>
              {emailError && <p style={{ color: '#cc3300', fontSize: 13, letterSpacing: 1, textAlign: 'center' }}>{emailError}</p>}
            </form>
          )}

          {fallbackEnabled && emailStep === 'code' && (
            <form onSubmit={handleEmailCodeConfirm} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <p style={{ fontSize: 12, color: '#f59e0b', letterSpacing: 1, textAlign: 'center' }}>
                Code verstuurd naar {emailValue}.
              </p>
              <input
                type="text"
                inputMode="numeric"
                required
                value={codeValue}
                onChange={e => setCodeValue(e.target.value)}
                placeholder="6-cijferige code"
                style={{ padding: '10px 14px', borderRadius: 6, border: '1px solid #374151', background: '#1f2937', color: '#f1f5f9', fontFamily: "'Space Mono', monospace", fontSize: 14, letterSpacing: 4, textAlign: 'center' }}
              />
              <button type="submit" disabled={emailLoading} className="li-btn" style={{ background: '#f59e0b', color: '#111827' }}>
                {emailLoading ? 'BEVESTIGEN...' : 'BEVESTIG'}
              </button>
              {emailError && <p style={{ color: '#cc3300', fontSize: 13, letterSpacing: 1, textAlign: 'center' }}>{emailError}</p>}
            </form>
          )}

          <p style={{ fontSize: 12, color: '#6b7280', letterSpacing: 1, textAlign: 'center', lineHeight: 1.8 }}>
            Door in te loggen ga je akkoord met onze voorwaarden.
          </p>
        </div>
      </div>
    </>
  )
}
