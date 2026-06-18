'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import Link from 'next/link'

function JoinContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { isLoaded, isSignedIn } = useUser()
  const code = searchParams.get('code') ?? ''
  const [teamName, setTeamName] = useState('')
  const [status, setStatus] = useState<'loading' | 'ready' | 'trust' | 'joining' | 'done' | 'error' | 'invalid'>('loading')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (!isLoaded) return
    if (!code) { setStatus('invalid'); return }
    fetch(`/api/bot/team/join?code=${code}`)
      .then(r => r.json())
      .then(data => {
        if (data.teamName) { setTeamName(data.teamName); setStatus('ready') }
        else setStatus('invalid')
      })
      .catch(() => setStatus('invalid'))
  }, [code, isLoaded])

  async function join() {
    setStatus('joining')
    try {
      const res = await fetch('/api/bot/team/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invite_code: code }),
      })
      const data = await res.json()
      if (!res.ok) { setErrorMsg(data.error || 'Mislukt'); setStatus('error'); return }
      setStatus('done')
      setTimeout(() => router.push('/bot'), 2000)
    } catch {
      setErrorMsg('Er ging iets mis')
      setStatus('error')
    }
  }

  const body: React.CSSProperties = {
    fontFamily: "'Space Mono', monospace", fontWeight: 400,
    fontSize: 15, color: '#9ca3af', lineHeight: 1.9,
  }

  const btnPrimary: React.CSSProperties = {
    fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 3,
    padding: '12px 36px', background: '#f59e0b', color: '#111827',
    border: 'none', borderRadius: 999, cursor: 'pointer', transition: 'background 0.2s',
  }

  const btnSecondary: React.CSSProperties = {
    fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 3,
    padding: '12px 32px', background: 'none', border: '1px solid #374151',
    color: '#9ca3af', borderRadius: 999, cursor: 'pointer',
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Space+Mono:wght@400;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #111827; color: #f1f5f9; font-family: 'Space Mono', monospace; font-weight: 400; }
        .join-link { color: #f59e0b; text-decoration: none; }
        .join-link:hover { text-decoration: underline; }
      `}</style>

      <div style={{ minHeight: '100vh', background: '#111827' }}>
        <div style={{ maxWidth: 812, margin: '0 auto', padding: 'clamp(80px,12vw,120px) clamp(16px,4vw,20px) 80px' }}>

          <p style={{ fontFamily: "'Space Mono', monospace", fontWeight: 400, fontSize: 13, letterSpacing: 4, color: '#f59e0b', marginBottom: 8 }}>ARNOBOT</p>

          {status === 'loading' && (
            <p style={{ ...body, color: '#6b7280', letterSpacing: 2 }}>LADEN...</p>
          )}

          {status === 'invalid' && (
            <>
              <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 64, letterSpacing: 3, color: '#f1f5f9', lineHeight: 1, marginBottom: 16 }}>ONGELDIGE LINK.</h1>
              <p style={{ ...body, marginBottom: 32 }}>Deze uitnodigingslink is niet geldig of al verlopen.</p>
              <Link href="/" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 3, color: '#f59e0b', textDecoration: 'none' }}>← NAAR ROYALDUTCHSALES.COM</Link>
            </>
          )}

          {status === 'ready' && (
            <>
              <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 64, letterSpacing: 3, color: '#f1f5f9', lineHeight: 1, marginBottom: 24 }}>
                JE BENT UITGENODIGD.
              </h1>
              <p style={{ ...body, marginBottom: 32 }}>
                Je bent uitgenodigd om deel te nemen aan team <span style={{ color: '#f1f5f9' }}>{teamName}</span>.
              </p>
              {isSignedIn ? (
                <button onClick={() => setStatus('trust')} style={btnPrimary}>
                  MEER INFORMATIE →
                </button>
              ) : (
                <>
                  <p style={{ ...body, fontSize: 13, color: '#6b7280', marginBottom: 20 }}>
                    Je hebt een account nodig om deel te nemen.
                  </p>
                  <Link
                    href={`/sign-in?redirect_url=${encodeURIComponent(`/bot/team/join?code=${code}`)}`}
                    style={{ ...btnPrimary, textDecoration: 'none', display: 'inline-block' }}
                  >
                    INLOGGEN OF AANMELDEN
                  </Link>
                </>
              )}
            </>
          )}

          {status === 'trust' && (
            <>
              <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 64, letterSpacing: 3, color: '#f1f5f9', lineHeight: 1, marginBottom: 32 }}>
                WELKOM BIJ ARNOBOT.
              </h1>
              <p style={{ fontFamily: "'Space Mono', monospace", fontWeight: 400, fontSize: 13, letterSpacing: 4, color: '#f59e0b', marginBottom: 32 }}>
                VOORDAT JE VERDERGAAT…
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24, marginBottom: 48 }}>
                <p style={body}>
                  ArnoBot coacht je eerlijk, maar alleen als jij &apos;t ook bent. Garbage in, is garbage out. Je snap &apos;t wel. Hoe opener je bent over wat je in de praktijk tegenkomt, hoe beter de output wordt.
                </p>
                <div style={{ borderLeft: '3px solid #374151', paddingLeft: 20 }}>
                  <p style={body}>
                    Je manager ziet niet wat jij met ArnoBot bespreekt. Nooit. Wat hij wel ziet, is wat er uit die gesprekken wordt gedestilleerd: jouw ontwikkelrichting en groeipunten. Je kunt zelf checken hoe dat er uit ziet.
                  </p>
                </div>
                <div style={{ background: '#1f2937', borderLeft: '3px solid #f59e0b', padding: '16px 20px' }}>
                  <p style={{ ...body, color: '#f1f5f9' }}>
                    Je gesprekken zijn van jou. Alleen jij ziet ze en worden in jouw beveiligde omgeving bewaard. Geen quotes, geen situaties, geen klantnamen. Niets van dat alles.
                  </p>
                </div>
                <p style={body}>
                  Weet wel dat kwetsbaarheid in coaching nooit een risico is of mag zijn. Het is wat je verder brengt in jouw groei als sales pro.
                </p>
                <p style={body}>
                  ArnoBot bestaat bij de gratie van integriteit. Dus deze info is essentieel om vooraf tot je te nemen en akkoord mee te gaan. We zijn hier super serieus in.
                </p>
                <p style={body}>
                  Wil je meer weten voordat je verder gaat? Check met Arno. Niet de bot, de man. Dat kan via{' '}
                  <a href="https://t.me/arnodiepeveen" target="_blank" rel="noopener noreferrer" className="join-link">t.me/arnodiepeveen</a>.
                  {' '}If not, klik hieronder op DEELNEMEN en je bent binnen.
                </p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                <button onClick={join} style={btnPrimary}>
                  DEELNEMEN
                </button>
                <button onClick={() => setStatus('ready')} style={btnSecondary}>
                  ← TERUG
                </button>
              </div>
            </>
          )}

          {status === 'joining' && (
            <p style={{ ...body, color: '#f59e0b', letterSpacing: 2 }}>JOINEN...</p>
          )}

          {status === 'done' && (
            <>
              <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 64, letterSpacing: 3, color: '#f59e0b', lineHeight: 1, marginBottom: 16 }}>WELKOM!</h1>
              <p style={body}>Je bent nu lid van {teamName}. Je wordt doorgestuurd...</p>
            </>
          )}

          {status === 'error' && (
            <>
              <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 64, letterSpacing: 3, color: '#f1f5f9', lineHeight: 1, marginBottom: 16 }}>OEPS.</h1>
              <p style={{ ...body, marginBottom: 32 }}>{errorMsg}</p>
              <Link href="/" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 3, color: '#f59e0b', textDecoration: 'none' }}>← NAAR ROYALDUTCHSALES.COM</Link>
            </>
          )}

        </div>
      </div>
    </>
  )
}

export default function JoinPage() {
  return (
    <Suspense>
      <JoinContent />
    </Suspense>
  )
}
