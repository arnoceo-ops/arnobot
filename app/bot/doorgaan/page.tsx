'use client'

import { useState, useEffect } from 'react'
import { useUser } from '@clerk/nextjs'
import Link from 'next/link'
import BotNav from '../BotNav'

export default function DoorgaanPage() {
  const { isLoaded } = useUser()
  const [status, setStatus] = useState<'loading' | 'idle' | 'already_paid' | 'already_requested' | 'done' | 'error'>('loading')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetch('/api/bot/confirm-renewal')
      .then(r => r.json())
      .then(d => {
        if (d.paid_at) setStatus('already_paid')
        else if (d.renewal_requested_at) setStatus('already_requested')
        else setStatus('idle')
      })
      .catch(() => setStatus('idle'))
  }, [])

  if (!isLoaded || status === 'loading') return null

  const label: React.CSSProperties = { fontFamily: "'Space Mono', monospace", fontWeight: 400, fontSize: 13, letterSpacing: 4, color: '#f59e0b', marginBottom: 8, display: 'block' }
  const body: React.CSSProperties = { fontFamily: "'Space Mono', monospace", fontWeight: 400, fontSize: 15, lineHeight: 1.9, color: '#9ca3af', marginBottom: 24 }
  const btn: React.CSSProperties = { fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 3, padding: '12px 36px', borderRadius: 999, background: '#f59e0b', color: '#111827', border: 'none', cursor: 'pointer' }

  async function handleConfirm() {
    setSubmitting(true)
    try {
      const res = await fetch('/api/bot/confirm-renewal', { method: 'POST' })
      const data = await res.json()
      if (data.already_paid) setStatus('already_paid')
      else if (data.already_requested) setStatus('already_requested')
      else if (data.ok) setStatus('done')
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

        <p style={label}>ABONNEMENT</p>
        <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 64, letterSpacing: 3, color: '#f1f5f9', lineHeight: 1, marginBottom: 40 }}>
          DOORGAAN MET ARNOBOT.
        </h1>

        {status === 'already_paid' && (
          <div style={{ background: '#1f2937', borderLeft: '3px solid #44cc88', padding: '20px 24px', marginBottom: 32 }}>
            <p style={{ ...body, marginBottom: 0, color: '#44cc88' }}>Je abonnement is actief. Betaling is ontvangen.</p>
          </div>
        )}

        {status === 'already_requested' && (
          <>
            <div style={{ background: '#1f2937', borderLeft: '3px solid #f59e0b', padding: '20px 24px', marginBottom: 32 }}>
              <p style={body}>Je bevestiging is al ontvangen. Arno stuurt je een factuur. Je toegang blijft actief totdat de factuur is voldaan.</p>
              <p style={{ ...body, marginBottom: 0 }}>Vragen? Mail naar <a href="mailto:arno@arno.bot" style={{ color: '#f59e0b' }}>arno@arno.bot</a></p>
            </div>
            <Link href="/bot" style={{ ...btn, textDecoration: 'none', display: 'inline-block' }} className="primary-btn">
              TERUG NAAR ARNOBOT
            </Link>
          </>
        )}

        {status === 'done' && (
          <>
            <div style={{ background: '#1f2937', borderLeft: '3px solid #44cc88', padding: '20px 24px', marginBottom: 32 }}>
              <p style={{ ...body, color: '#44cc88', marginBottom: 8 }}>✓ Bevestiging ontvangen.</p>
              <p style={body}>Arno stuurt je een factuur op het e-mailadres van je account. Je toegang blijft actief totdat de factuur is voldaan.</p>
              <p style={{ ...body, marginBottom: 0 }}>Vragen? Mail naar <a href="mailto:arno@arno.bot" style={{ color: '#f59e0b' }}>arno@arno.bot</a></p>
            </div>
            <Link href="/bot" style={{ ...btn, textDecoration: 'none', display: 'inline-block' }} className="primary-btn">
              TERUG NAAR ARNOBOT
            </Link>
          </>
        )}

        {status === 'idle' && (
          <>
            <p style={body}>
              Je gratis proefperiode loopt binnenkort af. Bevestig hieronder dat je wil doorgaan. Je ontvangt dan een factuur van Arno. Je toegang blijft actief totdat de factuur is voldaan.
            </p>
            <p style={{ ...body, marginBottom: 40 }}>
              Wil je niet doorgaan? Dan stopt je toegang automatisch aan het einde van de proefperiode. Je data blijft nog 30 dagen bewaard.
            </p>
            <button
              onClick={handleConfirm}
              disabled={submitting}
              className="primary-btn"
              style={{ ...btn, opacity: submitting ? 0.6 : 1, cursor: submitting ? 'not-allowed' : 'pointer' }}
            >
              {submitting ? 'BEZIG...' : 'JA, IK GA DOOR'}
            </button>
          </>
        )}

        {status === 'error' && (
          <p style={{ color: '#cc2200', fontSize: 14, letterSpacing: 1, marginTop: 16 }}>
            Er ging iets mis. Probeer het opnieuw of <a href="https://wa.me/31650695999?text=Hoi%20Arno%2C%20ik%20loop%20vast%20in%20ArnoBot." style={{ color: '#f59e0b' }} target="_blank" rel="noopener noreferrer">stuur een WhatsApp</a>.
          </p>
        )}

      </div>
    </>
  )
}
