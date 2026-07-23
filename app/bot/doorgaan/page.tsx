'use client'

import { useState, useEffect } from 'react'
import { useUser } from '@clerk/nextjs'
import Link from 'next/link'
import BotNav from '../BotNav'

type Cyclus = 'maandelijks' | 'jaarlijks'
type PlanKeuze = 'premium' | 'elite'

export default function DoorgaanPage() {
  const { isLoaded } = useUser()
  const [status, setStatus] = useState<'loading' | 'idle' | 'already_paid' | 'already_requested' | 'done' | 'error'>('loading')
  const [gekozenPlan, setGekozenPlan] = useState<PlanKeuze | null>(null)
  const [submittingPlan, setSubmittingPlan] = useState<PlanKeuze | null>(null)
  const [cyclus, setCyclus] = useState<Cyclus>('maandelijks')

  useEffect(() => {
    fetch('/api/bot/confirm-renewal')
      .then(r => r.json())
      .then(d => {
        if (d.paid_at) setStatus('already_paid')
        else if (d.renewal_requested_at) { setStatus('already_requested'); setGekozenPlan(d.plan) }
        else setStatus('idle')
      })
      .catch(() => setStatus('idle'))
  }, [])

  if (!isLoaded || status === 'loading') return null

  const label: React.CSSProperties = { fontFamily: "'Space Mono', monospace", fontWeight: 400, fontSize: 13, letterSpacing: 4, color: '#f59e0b', marginBottom: 8, display: 'block' }
  const body: React.CSSProperties = { fontFamily: "'Space Mono', monospace", fontWeight: 400, fontSize: 15, lineHeight: 1.9, color: '#9ca3af', marginBottom: 24 }
  const btn: React.CSSProperties = { fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 3, padding: '12px 36px', borderRadius: 999, background: '#f59e0b', color: '#111827', border: 'none', cursor: 'pointer' }

  async function kies(plan: PlanKeuze) {
    setSubmittingPlan(plan)
    try {
      const res = await fetch('/api/bot/confirm-renewal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      })
      const data = await res.json()
      if (data.already_paid) setStatus('already_paid')
      else if (data.already_requested) setStatus('already_requested')
      else if (data.ok) { setGekozenPlan(plan); setStatus('done') }
      else setStatus('error')
    } catch {
      setStatus('error')
    } finally {
      setSubmittingPlan(null)
    }
  }

  const planLabel = gekozenPlan === 'elite' ? 'Elite (€397/maand)' : gekozenPlan === 'premium' ? 'Premium' : null

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Space+Mono:wght@400;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #111827; color: #f1f5f9; font-family: 'Space Mono', monospace; font-weight: 400; }
        .primary-btn:hover { background: #d97706 !important; }
        .doorgaan-toggle {
          display: inline-flex; background: #111827; border: 1px solid #374151;
          border-radius: 999px; padding: 3px; margin-bottom: 20px;
        }
        .doorgaan-toggle button {
          font-family: 'Bebas Neue', sans-serif; font-size: 14px; letter-spacing: 2px;
          padding: 6px 18px; border-radius: 999px; border: none; cursor: pointer;
          background: transparent; color: #9ca3af; transition: all 0.2s;
        }
        .doorgaan-toggle button.actief { background: #f59e0b; color: #111827; }
        .plan-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 40px; }
        .plan-card {
          background: #1f2937; border: 1px solid #374151; border-radius: 8px;
          padding: 28px; display: flex; flex-direction: column; gap: 12px;
        }
        .plan-naam { font-family: 'Space Mono', monospace; font-size: 13px; letter-spacing: 4px; color: #f59e0b; }
        .plan-prijs { font-family: 'Bebas Neue', sans-serif; font-size: 40px; color: #f1f5f9; line-height: 1; }
        .plan-periode { font-family: 'Space Mono', monospace; font-size: 13px; color: #6b7280; }
        .plan-bullets { list-style: none; display: flex; flex-direction: column; gap: 8px; margin: 8px 0; }
        .plan-bullets li { font-family: 'Space Mono', monospace; font-size: 14px; color: #9ca3af; padding-left: 16px; position: relative; }
        .plan-bullets li::before { content: '•'; color: #f59e0b; position: absolute; left: 0; }
        .plan-btn {
          margin-top: auto; font-family: 'Bebas Neue', sans-serif; font-size: 16px; letter-spacing: 2px;
          padding: 10px 24px; border-radius: 999px; background: #f59e0b; color: #111827;
          border: none; cursor: pointer; align-self: flex-start; transition: background 0.2s;
        }
        .plan-btn:hover { background: #d97706; }
        .plan-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        @media (max-width: 640px) { .plan-cols { grid-template-columns: 1fr; } }
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
              <p style={body}>Je hebt gekozen voor {planLabel ?? 'een abonnement'}. Arno stuurt je een factuur. Je toegang blijft actief totdat de factuur is voldaan.</p>
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
              <p style={{ ...body, color: '#44cc88', marginBottom: 8 }}>✓ Bevestiging ontvangen, {planLabel}.</p>
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
              Je gratis proefperiode loopt binnenkort af. Kies hieronder het abonnement waarmee je door wil. Je ontvangt dan een factuur van Arno. Je toegang blijft actief totdat de factuur is voldaan.
            </p>

            <div className="doorgaan-toggle">
              <button className={cyclus === 'maandelijks' ? 'actief' : ''} onClick={() => setCyclus('maandelijks')}>MAANDELIJKS</button>
              <button className={cyclus === 'jaarlijks' ? 'actief' : ''} onClick={() => setCyclus('jaarlijks')}>JAARLIJKS</button>
            </div>

            <div className="plan-cols">
              <div className="plan-card">
                <span className="plan-naam">PREMIUM</span>
                <div>
                  <span className="plan-prijs">€{cyclus === 'maandelijks' ? '97' : '777'}</span>
                  <span className="plan-periode"> {cyclus === 'maandelijks' ? '/ maand' : '/ jaar (4 mnd gratis)'}</span>
                </div>
                <ul className="plan-bullets">
                  <li>Onbeperkt aantal gesprekken</li>
                  <li>Coaching en patroonanalyses</li>
                  <li>Sparring met een realistische gesprekspartner</li>
                  <li>Gesproken antwoorden</li>
                </ul>
                <button className="plan-btn" onClick={() => kies('premium')} disabled={submittingPlan !== null}>
                  {submittingPlan === 'premium' ? 'BEZIG...' : 'KIES PREMIUM'}
                </button>
              </div>

              <div className="plan-card">
                <span className="plan-naam">ELITE</span>
                <div>
                  <span className="plan-prijs">€397</span>
                  <span className="plan-periode"> / maand</span>
                </div>
                <ul className="plan-bullets">
                  <li>Alles van Premium, plus:</li>
                  <li>Iedere maand een persoonlijk gesprek met Arno</li>
                  <li>Rechtstreeks contact met Arno via Telegram</li>
                  <li>Toegang tot de Elite Member Community</li>
                </ul>
                <button className="plan-btn" onClick={() => kies('elite')} disabled={submittingPlan !== null}>
                  {submittingPlan === 'elite' ? 'BEZIG...' : 'KIES ELITE'}
                </button>
              </div>
            </div>

            <p style={{ ...body, marginBottom: 0 }}>
              Wil je niet doorgaan? Dan stopt je toegang automatisch aan het einde van de proefperiode. Je data blijft nog 30 dagen bewaard. Op zoek naar Command, het teamabonnement? <Link href="/command" style={{ color: '#f59e0b' }}>Vraag een demo aan</Link>.
            </p>
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
