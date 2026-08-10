'use client'

import { useState, useEffect } from 'react'
import { useUser } from '@clerk/nextjs'
import Link from 'next/link'
import BotNav from '../BotNav'

type Cyclus = 'maandelijks' | 'jaarlijks'
type PlanKeuze = 'basis' | 'premium'

export default function DoorgaanClient({ demoLink }: { demoLink: string | null }) {
  const { isLoaded } = useUser()
  const previewIdle = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('preview') === 'idle'
  const [status, setStatus] = useState<'loading' | 'idle' | 'already_paid' | 'already_requested' | 'done' | 'error'>(previewIdle ? 'idle' : 'loading')
  const [gekozenPlan, setGekozenPlan] = useState<PlanKeuze | null>(null)
  const [submittingPlan, setSubmittingPlan] = useState<PlanKeuze | null>(null)
  const [cyclus, setCyclus] = useState<Cyclus>('jaarlijks')

  useEffect(() => {
    if (previewIdle) return
    fetch('/api/bot/confirm-renewal')
      .then(r => r.json())
      .then(d => {
        if (d.paid_at) setStatus('already_paid')
        else if (d.renewal_requested_at) { setStatus('already_requested'); setGekozenPlan(d.plan) }
        else setStatus('idle')
      })
      .catch(() => setStatus('idle'))
  }, [previewIdle])

  if (!isLoaded || status === 'loading') return null

  const label: React.CSSProperties = { fontSize: 14, fontWeight: 600, letterSpacing: '0.3em', textTransform: 'uppercase', color: '#f59e0b', marginBottom: 16, display: 'block' }
  const body: React.CSSProperties = { fontSize: 16, lineHeight: 1.65, color: '#94a3b8', marginBottom: 24 }
  const btn: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', borderRadius: 6, background: '#f59e0b',
    padding: '14px 32px', fontFamily: "'Oswald', sans-serif", fontSize: 16, fontWeight: 600,
    letterSpacing: '0.1em', color: '#111827', textTransform: 'uppercase', border: 'none', cursor: 'pointer',
    boxShadow: '0 12px 24px rgba(245,158,11,0.25)',
  }

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

  const planLabel = gekozenPlan === 'premium' ? 'Pro' : gekozenPlan === 'basis' ? 'Basic' : null

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Oswald:wght@500;600&family=Figtree:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #111827; color: #f8fafc; font-family: 'Figtree', sans-serif; font-size: 15px; }
        .primary-btn { transition: transform 0.2s; }
        .primary-btn:hover { transform: scale(1.03); }
        .doorgaan-toggle-rij {
          display: flex; flex-direction: column; align-items: flex-start; gap: 10px; margin-bottom: 24px;
        }
        .doorgaan-toggle {
          display: inline-flex; background: #111827; border: 1px solid #374151;
          border-radius: 999px; padding: 3px;
        }
        .doorgaan-toggle button {
          font-family: 'Oswald', sans-serif; font-weight: 600; font-size: 12px; letter-spacing: 0.08em;
          text-transform: uppercase; padding: 6px 16px; border-radius: 999px; border: none; cursor: pointer;
          background: transparent; color: #94a3b8; transition: all 0.2s;
        }
        .doorgaan-toggle button.actief { background: #f59e0b; color: #111827; }
        .plan-cols { max-width: 820px; display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 40px; }
        .plan-card {
          background: #1e293b; border: 1px solid #374151; border-radius: 12px;
          padding: 32px; display: flex; flex-direction: column; gap: 16px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        }
        .plan-card.aanbevolen { border-color: rgba(245,158,11,0.35); }
        .plan-kop { font-size: 15px; color: #f8fafc; line-height: 1.5; min-height: 46px; }
        .plan-naam { font-size: 13px; font-weight: 600; letter-spacing: 0.3em; text-transform: uppercase; color: #f59e0b; }
        .plan-amount { display: flex; align-items: baseline; gap: 6px; }
        .plan-currency { font-family: 'Oswald', sans-serif; font-weight: 600; font-size: 20px; color: #6b7280; }
        .plan-prijs { font-family: 'Oswald', sans-serif; font-weight: 600; font-size: clamp(40px, 4vw, 52px); color: #f8fafc; letter-spacing: -0.5px; line-height: 0.9; }
        .plan-periode { font-size: 14px; color: #6b7280; }
        .plan-billingnote { font-size: 13px; color: #94a3b8; min-height: 18px; }
        .plan-plus { font-size: 13px; font-weight: 500; letter-spacing: 0.1em; text-transform: uppercase; color: #6b7280; }
        .plan-bullets { list-style: none; display: flex; flex-direction: column; gap: 10px; margin: 4px 0; }
        .plan-bullets li { font-size: 14px; color: #94a3b8; line-height: 1.5; padding-left: 18px; position: relative; }
        .plan-bullets li::before { content: '•'; color: #f59e0b; position: absolute; left: 0; }
        .plan-btn {
          margin-top: auto; align-self: flex-start; display: inline-flex; align-items: center;
          font-family: 'Oswald', sans-serif; font-size: 15px; font-weight: 600;
          letter-spacing: 0.1em; text-transform: uppercase; padding: 12px 24px; border-radius: 6px;
          background: #f59e0b; color: #111827; border: none; cursor: pointer;
          box-shadow: 0 12px 24px rgba(245,158,11,0.25); transition: transform 0.2s;
        }
        .plan-btn:hover { transform: scale(1.05); }
        .plan-btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
        @media (max-width: 640px) { .plan-cols { grid-template-columns: 1fr; } }
      `}</style>

      <BotNav active="account" />

      <div style={{ maxWidth: 812, margin: '0 auto', padding: 'clamp(80px,12vw,120px) clamp(16px,4vw,20px) 80px' }}>

        <p style={label}>Abonnement</p>
        <h1 style={{ fontFamily: "'Oswald', sans-serif", fontSize: 'clamp(36px, 5vw, 56px)', fontWeight: 600, textTransform: 'uppercase', lineHeight: 1.1, color: '#f8fafc', marginBottom: 16 }}>
          Doorgaan met ArnoBot.
        </h1>

        {status === 'already_paid' && (
          <div style={{ background: '#1e293b', border: '1px solid #374151', borderLeft: '3px solid #44cc88', borderRadius: 8, padding: '20px 24px', marginBottom: 32 }}>
            <p style={{ ...body, marginBottom: 0, color: '#44cc88' }}>Je abonnement is actief. Betaling is ontvangen.</p>
          </div>
        )}

        {status === 'already_requested' && (
          <>
            <div style={{ background: '#1e293b', border: '1px solid #374151', borderLeft: '3px solid #f59e0b', borderRadius: 8, padding: '20px 24px', marginBottom: 32 }}>
              <p style={body}>Je hebt gekozen voor {planLabel ?? 'een abonnement'}. ArnoBot stuurt je een factuur. Je toegang blijft actief totdat de factuur is voldaan.</p>
              <p style={{ ...body, marginBottom: 0 }}>Vragen? Mail naar <a href="mailto:arno@arno.bot" style={{ color: '#f59e0b' }}>arno@arno.bot</a></p>
            </div>
            <Link href="/bot" style={{ ...btn, textDecoration: 'none' }} className="primary-btn">
              Terug naar ArnoBot
            </Link>
          </>
        )}

        {status === 'done' && (
          <>
            <div style={{ background: '#1e293b', border: '1px solid #374151', borderLeft: '3px solid #44cc88', borderRadius: 8, padding: '20px 24px', marginBottom: 32 }}>
              <p style={{ ...body, color: '#44cc88', marginBottom: 8 }}>✓ Bevestiging ontvangen, {planLabel}.</p>
              <p style={body}>ArnoBot stuurt je een factuur op het e-mailadres van je account. Je toegang blijft actief totdat de factuur is voldaan.</p>
              <p style={{ ...body, marginBottom: 0 }}>Vragen? Mail naar <a href="mailto:arno@arno.bot" style={{ color: '#f59e0b' }}>arno@arno.bot</a></p>
            </div>
            <Link href="/bot" style={{ ...btn, textDecoration: 'none' }} className="primary-btn">
              Terug naar ArnoBot
            </Link>
          </>
        )}

        {status === 'idle' && (
          <>
            <p style={body}>
              Je gratis proefperiode loopt binnenkort af. Kies hieronder het abonnement waarmee je door wil. Je ontvangt dan een factuur van ArnoBot.
            </p>

            <div className="doorgaan-toggle-rij">
              <div className="doorgaan-toggle">
                <button className={cyclus === 'jaarlijks' ? 'actief' : ''} onClick={() => setCyclus('jaarlijks')}>Jaarlijks</button>
                <button className={cyclus === 'maandelijks' ? 'actief' : ''} onClick={() => setCyclus('maandelijks')}>Maandelijks</button>
              </div>
            </div>

            <div className="plan-cols">
              <div className="plan-card">
                <span className="plan-naam">Basic</span>
                <p className="plan-kop">Een gesprekspartner die nooit moe wordt.</p>

                <div>
                  <div className="plan-amount">
                    <span className="plan-currency">€</span>
                    <span className="plan-prijs">{cyclus === 'jaarlijks' ? '19' : '29'}</span>
                    <span className="plan-periode">/ maand</span>
                  </div>
                  <p className="plan-billingnote">
                    {cyclus === 'jaarlijks' ? 'Bij jaarbetaling, €228 per jaar' : 'Maandelijks opzegbaar.'}
                  </p>
                </div>

                <ul className="plan-bullets">
                  <li>Dagelijks sparren met ArnoBot</li>
                  <li>Eén gespreksanalyse per dag</li>
                  <li>Geheugen over je recente gesprekken</li>
                </ul>
                <button className="plan-btn" onClick={() => kies('basis')} disabled={submittingPlan !== null}>
                  {submittingPlan === 'basis' ? 'Bezig...' : 'Kies Basic'}
                </button>
              </div>

              <div className="plan-card aanbevolen">
                <span className="plan-naam">Pro</span>
                <p className="plan-kop">Je topcoach, altijd binnen handbereik.</p>

                <div>
                  <div className="plan-amount">
                    <span className="plan-currency">€</span>
                    <span className="plan-prijs">{cyclus === 'jaarlijks' ? '39' : '59'}</span>
                    <span className="plan-periode">/ maand</span>
                  </div>
                  <p className="plan-billingnote">
                    {cyclus === 'jaarlijks' ? 'Bij jaarbetaling, €468 per jaar' : 'Maandelijks opzegbaar.'}
                  </p>
                </div>

                <span className="plan-plus">Alles van Basic, plus:</span>
                <ul className="plan-bullets">
                  <li>Onbeperkt chatten en oefenen</li>
                  <li>Uitgebreider gespreksgeheugen</li>
                  <li>Volledig archief van al je output</li>
                  <li>Coaching op mindset, systeem en actie</li>
                  <li>Gesproken antwoorden, Arno's stem</li>
                  <li>De ArnoBot-app (Android)</li>
                </ul>
                <button className="plan-btn" onClick={() => kies('premium')} disabled={submittingPlan !== null}>
                  {submittingPlan === 'premium' ? 'Bezig...' : 'Kies Pro'}
                </button>
              </div>
            </div>

            <p style={{ ...body, marginBottom: 0 }}>
              Wil je niet doorgaan? Dan stopt je toegang automatisch aan het einde van de proefperiode. Je data blijft daarna nog 30 dagen bewaard. Op zoek naar Team, het teamabonnement?{' '}
              {demoLink
                ? <a href={demoLink} target="_blank" rel="noopener noreferrer" style={{ color: '#f59e0b' }}>Vraag een demo aan</a>
                : <a href="mailto:arno@arno.bot?subject=Demo%20ArnoBot%20Team" style={{ color: '#f59e0b' }}>Vraag een demo aan</a>
              }.
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
