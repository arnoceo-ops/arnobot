'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import Link from 'next/link'
import { colors, text, btn, layout, globalCss } from '@/lib/styles'
import { track } from '@/lib/posthog'

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
      track('teamlid_geactiveerd')
      setStatus('done')
      setTimeout(() => router.push('/bot'), 2000)
    } catch {
      setErrorMsg('Er ging iets mis')
      setStatus('error')
    }
  }

  return (
    <>
      <style>{`
        ${globalCss}
        .join-link { color: ${colors.amber}; text-decoration: none; }
        .join-link:hover { text-decoration: underline; }
        .loading-dot { width: 7px; height: 7px; background: #f59e0b; border-radius: 50%; animation: dot-pulse 1.2s infinite; display: inline-block; }
        .loading-dot:nth-child(2) { animation-delay: 0.2s; }
        .loading-dot:nth-child(3) { animation-delay: 0.4s; }
        @keyframes dot-pulse { 0%,80%,100%{opacity:0.2;transform:scale(0.85)} 40%{opacity:1;transform:scale(1)} }
      `}</style>

      <div style={layout.page}>
        <div style={layout.container}>

          <p style={{ ...text.label, marginBottom: 8 }}>ARNOBOT</p>

          {status === 'loading' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span className="loading-dot" />
              <span className="loading-dot" />
              <span className="loading-dot" />
              <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, letterSpacing: 4, color: '#9ca3af' }}>LADEN</span>
            </div>
          )}

          {status === 'invalid' && (
            <>
              <h1 style={{ ...text.h1, marginBottom: 16 }}>ONGELDIGE LINK.</h1>
              <p style={{ ...text.body, marginBottom: 32 }}>Deze uitnodigingslink is niet geldig of al verlopen.</p>
              <Link href="https://arno.bot" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 3, color: colors.amber, textDecoration: 'none' }}>
                ← NAAR ARNO.BOT
              </Link>
            </>
          )}

          {status === 'ready' && (
            <>
              <h1 style={{ ...text.h1, marginBottom: 24 }}>JE BENT UITGENODIGD.</h1>
              <p style={{ ...text.body, marginBottom: 32 }}>
                Je bent uitgenodigd om deel te nemen aan team <span style={{ color: colors.textBright }}>{teamName}</span>.
              </p>
              {isSignedIn ? (
                <button onClick={() => setStatus('trust')} className="btn-primary" style={btn.primary}>
                  MEER INFORMATIE →
                </button>
              ) : (
                <>
                  <p style={{ ...text.muted, marginBottom: 20 }}>Je hebt een account nodig om deel te nemen.</p>
                  <Link
                    href={`/sign-in?redirect_url=${encodeURIComponent(`/bot/team/join?code=${code}`)}`}
                    className="btn-primary"
                    style={{ ...btn.primary, textDecoration: 'none', display: 'inline-block' }}
                  >
                    INLOGGEN OF AANMELDEN
                  </Link>
                </>
              )}
            </>
          )}

          {status === 'trust' && (
            <>
              <h1 style={{ ...text.h1, marginBottom: 32 }}>WELKOM BIJ ARNOBOT.</h1>
              <p style={{ ...text.label, marginBottom: 32 }}>VOORDAT JE VERDERGAAT…</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24, marginBottom: 48 }}>
                <p style={text.body}>
                  ArnoBot coacht je eerlijk, maar alleen als jij &apos;t ook bent. Garbage in, is garbage out. Je snap &apos;t wel. Hoe opener je bent over wat je in de praktijk tegenkomt, hoe beter de output wordt.
                </p>
                <div style={{ borderLeft: `3px solid ${colors.border}`, paddingLeft: 20 }}>
                  <p style={text.body}>
                    Je manager ziet niet wat jij met ArnoBot bespreekt. Nooit. Wat hij wel ziet, is wat er uit die gesprekken wordt gedestilleerd: jouw ontwikkelrichting en groeipunten. Je kunt in de app checken hoe dat er uit ziet, dus je komt nooit voor verrassingen te staan.
                  </p>
                </div>
                <div style={{ background: colors.card, borderLeft: `3px solid ${colors.amber}`, padding: '16px 20px' }}>
                  <p style={{ ...text.body, color: colors.textBright }}>
                    Je gesprekken zijn van jou. Alleen jij ziet ze en worden in jouw beveiligde omgeving bewaard. Geen quotes, geen situaties, geen klantnamen. Niets van dat alles.
                  </p>
                </div>
                <p style={text.body}>
                  Weet wel dat kwetsbaarheid in coaching nooit een risico is of mag zijn. Het is wat je verder brengt in jouw groei als sales pro.
                </p>
                <p style={text.body}>
                  ArnoBot bestaat bij de gratie van integriteit. Dus deze info is essentieel om vooraf tot je te nemen en akkoord mee te gaan. We zijn hier super serieus in.
                </p>
                <p style={text.body}>
                  Wil je meer weten voordat je verder gaat? Check met Arno. Niet de bot, de man. Dat kan via{' '}
                  <a href="https://t.me/arnodiepeveen" target="_blank" rel="noopener noreferrer" className="join-link">t.me/arnodiepeveen</a>.
                  {' '}Weet je genoeg? Klik dan hieronder op DEELNEMEN en je bent binnen.
                </p>
              </div>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <button onClick={join} className="btn-primary" style={btn.primary}>
                  DEELNEMEN
                </button>
              </div>
            </>
          )}

          {status === 'joining' && (
            <p style={{ ...text.muted, color: colors.amber, letterSpacing: 2 }}>JOINEN...</p>
          )}

          {status === 'done' && (
            <>
              <h1 style={{ ...text.h1, marginBottom: 16 }}>WELKOM!</h1>
              <p style={text.body}>Je bent nu lid van {teamName}. Je wordt doorgestuurd...</p>
            </>
          )}

          {status === 'error' && (
            <>
              <h1 style={{ ...text.h1, marginBottom: 16 }}>OEPS.</h1>
              <p style={{ ...text.body, marginBottom: 32 }}>{errorMsg}</p>
              <Link href="https://arno.bot" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 3, color: colors.amber, textDecoration: 'none' }}>
                ← NAAR ARNO.BOT
              </Link>
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
