'use client'

import { useState, useEffect } from 'react'
import { useUser } from '@clerk/nextjs'
import Link from 'next/link'
import BotNav from '../BotNav'

type Status = 'loading' | 'active' | 'winback_14' | 'full_30' | 'not_eligible' | 'done' | 'error'

export default function HerstartPage() {
  const { isLoaded } = useUser()
  const [status, setStatus] = useState<Status>('loading')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetch('/api/bot/herstart')
      .then(r => r.json())
      .then(d => setStatus(d.status as Status))
      .catch(() => setStatus('error'))
  }, [])

  if (!isLoaded || status === 'loading') return null

  const label: React.CSSProperties = { fontFamily: "'Space Mono', monospace", fontWeight: 700, fontSize: 13, letterSpacing: 4, color: '#f59e0b', marginBottom: 8, display: 'block' }
  const body: React.CSSProperties = { fontFamily: "'Space Mono', monospace", fontWeight: 400, fontSize: 15, lineHeight: 1.9, color: '#9ca3af', marginBottom: 24 }
  const btn: React.CSSProperties = { fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 3, padding: '12px 36px', borderRadius: 999, background: '#f59e0b', color: '#111827', border: 'none', cursor: 'pointer' }

  async function handleHerstart() {
    setSubmitting(true)
    try {
      const res = await fetch('/api/bot/herstart', { method: 'POST' })
      if (res.ok) setStatus('done')
      else setStatus('error')
    } catch {
      setStatus('error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Space+Mono:wght@400;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #111827; color: #f1f5f9; font-family: 'Space Mono', monospace; font-weight: 400; }
        .primary-btn:hover { background: #d97706 !important; }
      `}</style>

      <BotNav active="account" />

      <div style={{ maxWidth: 812, margin: '0 auto', padding: 'clamp(80px,12vw,120px) clamp(16px,4vw,20px) 80px' }}>

        <p style={label}>ARNOBOT</p>
        <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 64, letterSpacing: 3, color: '#f1f5f9', lineHeight: 1, marginBottom: 40 }}>
          WELKOM TERUG.
        </h1>

        {status === 'active' && (
          <>
            <p style={body}>Je account is al actief.</p>
            <Link href="/bot" style={{ ...btn, textDecoration: 'none', display: 'inline-block' }} className="primary-btn">
              NAAR ARNOBOT
            </Link>
          </>
        )}

        {status === 'winback_14' && (
          <>
            <p style={body}>
              Je hebt ArnoBot een tijdje gemist. Dat begrijpen we. Start een gratis trial van 14 dagen om te zien of je er klaar voor bent.
            </p>
            <p style={{ ...body, marginBottom: 40 }}>
              Geen verplichtingen. Je data staat er nog. Je kunt gewoon verdergaan waar je gebleven was.
            </p>
            <button
              onClick={handleHerstart}
              disabled={submitting}
              className="primary-btn"
              style={{ ...btn, opacity: submitting ? 0.6 : 1, cursor: submitting ? 'not-allowed' : 'pointer' }}
            >
              {submitting ? 'BEZIG...' : 'START 14-DAAGSE TRIAL'}
            </button>
          </>
        )}

        {status === 'full_30' && (
          <>
            <p style={body}>
              Je bent meer dan 6 maanden weg geweest. Je kunt nu opnieuw een volledige gratis trial van 30 dagen starten.
            </p>
            <p style={{ ...body, marginBottom: 40 }}>
              Je eerdere data staat er nog. Je kunt gewoon verdergaan.
            </p>
            <button
              onClick={handleHerstart}
              disabled={submitting}
              className="primary-btn"
              style={{ ...btn, opacity: submitting ? 0.6 : 1, cursor: submitting ? 'not-allowed' : 'pointer' }}
            >
              {submitting ? 'BEZIG...' : 'START 30-DAAGSE TRIAL'}
            </button>
          </>
        )}

        {status === 'done' && (
          <>
            <div style={{ background: '#1f2937', borderLeft: '3px solid #44cc88', padding: '20px 24px', marginBottom: 32 }}>
              <p style={{ ...body, color: '#44cc88', marginBottom: 0 }}>✓ Je account is weer actief.</p>
            </div>
            <Link href="/bot" style={{ ...btn, textDecoration: 'none', display: 'inline-block' }} className="primary-btn">
              NAAR ARNOBOT
            </Link>
          </>
        )}

        {status === 'not_eligible' && (
          <div style={{ background: '#1f2937', borderLeft: '3px solid #374151', padding: '20px 24px' }}>
            <p style={body}>Je komt nog niet in aanmerking voor een nieuwe trial. Heb je vragen? Mail naar <a href="mailto:arno@arno.bot" style={{ color: '#f59e0b' }}>arno@arno.bot</a>.</p>
          </div>
        )}

        {status === 'error' && (
          <p style={{ color: '#cc2200', fontSize: 14, letterSpacing: 1 }}>
            Er ging iets mis. Probeer het opnieuw of mail <a href="mailto:arno@arno.bot" style={{ color: '#f59e0b' }}>arno@arno.bot</a>.
          </p>
        )}

      </div>
    </>
  )
}
