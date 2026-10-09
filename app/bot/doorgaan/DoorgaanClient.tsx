'use client'

import { useState, useEffect } from 'react'
import { useUser } from '@clerk/nextjs'
import Link from 'next/link'
import BotNav from '../BotNav'
import { SUPPORT_WHATSAPP_VASTGELOPEN } from '@/lib/support'
import { berekenBedrag, type KlantType } from '@/lib/billing/prijzen'
import { formatEuro } from '@/lib/billing/geld'

type Cyclus = 'maandelijks' | 'jaarlijks'
type PlanKeuze = 'basis' | 'premium'
type Abonnement = {
  status: 'pending' | 'active' | 'cancelled'
  plan: PlanKeuze
  cyclus: Cyclus
  klantType: KlantType
  periodeEinde: string | null
  contractEinde: string | null
  opzeggingIngaatOp: string | null
  kanVerlengen: boolean
}

const fmtDatum = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' }) : ''

export default function DoorgaanClient({ demoLink }: { demoLink: string | null }) {
  const { isLoaded } = useUser()
  const previewIdle = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('preview') === 'idle'
  const [status, setStatus] = useState<'loading' | 'idle' | 'already_paid' | 'already_requested' | 'done' | 'error'>(previewIdle ? 'idle' : 'loading')
  const [gekozenPlan, setGekozenPlan] = useState<PlanKeuze | null>(null)
  const [submittingPlan, setSubmittingPlan] = useState<PlanKeuze | null>(null)
  const [cyclus, setCyclus] = useState<Cyclus>('jaarlijks')

  // Online betalen (Mollie). Zonder MOLLIE_API_KEY meldt de server mollieEnabled=false en
  // draait de oude handmatige factuurflow ongewijzigd door.
  const [billingLoaded, setBillingLoaded] = useState(previewIdle)
  const [mollieEnabled, setMollieEnabled] = useState(false)
  const [abonnement, setAbonnement] = useState<Abonnement | null>(null)
  const [stap, setStap] = useState<'kies' | 'gegevens'>('kies')
  const [klantType, setKlantType] = useState<KlantType>('particulier')
  const [bedrijfsnaam, setBedrijfsnaam] = useState('')
  const [kvk, setKvk] = useState('')
  const [btwNummer, setBtwNummer] = useState('')
  const [akkoord, setAkkoord] = useState(false)
  const [betaalFout, setBetaalFout] = useState('')
  const [betalen, setBetalen] = useState(false)
  const [terug, setTerug] = useState(false)
  const [verlengen, setVerlengen] = useState<'idle' | 'bezig' | 'klaar' | 'fout'>('idle')
  // Wie al eens betaald heeft verlengt; wie nog in de proefperiode zit gaat door met ArnoBot.
  const [eerderBetaald, setEerderBetaald] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (new URLSearchParams(window.location.search).get('betaling') === 'terug') setTerug(true)
  }, [])

  const laadBilling = () =>
    fetch('/api/bot/billing')
      .then(r => r.json())
      .then(d => {
        setMollieEnabled(!!d.mollieEnabled)
        setAbonnement(d.abonnement ?? null)
        return d.abonnement as Abonnement | null
      })
      .catch(() => null)

  useEffect(() => {
    if (previewIdle) return
    laadBilling().finally(() => setBillingLoaded(true))
  }, [previewIdle])

  // Na terugkomst van Mollie: wachten tot de webhook het abonnement heeft geactiveerd.
  useEffect(() => {
    if (!terug) return
    let pogingen = 0
    const timer = setInterval(async () => {
      pogingen++
      const a = await laadBilling()
      if (a?.status === 'active') { clearInterval(timer); setStatus('already_paid') }
      if (pogingen >= 20) clearInterval(timer)
    }, 2000)
    return () => clearInterval(timer)
  }, [terug])

  useEffect(() => {
    if (previewIdle) return
    fetch('/api/bot/confirm-renewal')
      .then(r => r.json())
      .then(d => {
        setEerderBetaald(!!d.paid_at)
        // Alleen "actief" als er betaald is en de toegang niet is verlopen (afgelopen of
        // terugbetaald): zo kan iemand na afloop gewoon opnieuw afrekenen.
        if (d.paid_at && !(d.expires_at && new Date(d.expires_at) < new Date())) setStatus('already_paid')
        else if (d.renewal_requested_at) { setStatus('already_requested'); setGekozenPlan(d.plan) }
        else setStatus('idle')
      })
      .catch(() => setStatus('idle'))
  }, [previewIdle])

  if (!isLoaded || status === 'loading' || !billingLoaded) return null

  const label: React.CSSProperties = { fontSize: 14, fontWeight: 600, letterSpacing: '0.3em', textTransform: 'uppercase', color: '#f59e0b', marginBottom: 16, display: 'block' }
  const body: React.CSSProperties = { fontSize: 16, lineHeight: 1.65, color: '#94a3b8', marginBottom: 24 }
  const btn: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', borderRadius: 6, background: '#f59e0b',
    padding: '14px 32px', fontFamily: "'Oswald', sans-serif", fontSize: 16, fontWeight: 600,
    letterSpacing: '0.1em', color: '#111827', textTransform: 'uppercase', border: 'none', cursor: 'pointer',
    boxShadow: '0 12px 24px rgba(245,158,11,0.25)',
  }

  async function betaal() {
    if (!gekozenPlan) return
    setBetaalFout('')
    setBetalen(true)
    try {
      const res = await fetch('/api/bot/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: gekozenPlan, cyclus, klantType, bedrijfsnaam, kvk, btwNummer, akkoordVoorwaarden: akkoord,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.checkoutUrl) { window.location.href = data.checkoutUrl; return }
      setBetaalFout(data.error ?? 'Er ging iets mis. Probeer het opnieuw.')
    } catch {
      setBetaalFout('Er ging iets mis. Probeer het opnieuw.')
    } finally {
      setBetalen(false)
    }
  }

  async function verlengNu() {
    setVerlengen('bezig')
    try {
      const res = await fetch('/api/bot/billing/verleng', { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (data.needsCheckout) { setVerlengen('idle'); setGekozenPlan(abonnement?.plan ?? 'premium'); setCyclus(abonnement?.cyclus ?? 'jaarlijks'); setStatus('idle'); setAbonnement(null); setStap('gegevens'); return }
      if (res.ok && data.ok) { setVerlengen('klaar'); await laadBilling(); return }
      setVerlengen('fout')
    } catch {
      setVerlengen('fout')
    }
  }

  async function kies(plan: PlanKeuze) {
    if (mollieEnabled) { setGekozenPlan(plan); setStap('gegevens'); return }
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
        .gegevens-card { max-width: 560px; background: #1e293b; border: 1px solid #374151; border-radius: 12px; padding: 32px; display: flex; flex-direction: column; gap: 18px; box-shadow: 0 10px 30px rgba(0,0,0,0.2); margin-bottom: 24px; }
        .gegevens-rij { display: flex; flex-direction: column; gap: 6px; }
        .gegevens-label { font-size: 13px; font-weight: 600; letter-spacing: 0.2em; text-transform: uppercase; color: #94a3b8; }
        .gegevens-input { font-family: 'Figtree', sans-serif; font-size: 15px; padding: 12px 14px; border-radius: 6px; border: 1.5px solid #374151; background: #111827; color: #f8fafc; outline: none; }
        .gegevens-input:focus { border-color: #f59e0b; }
        .gegevens-regel { display: flex; justify-content: space-between; gap: 16px; font-size: 15px; color: #94a3b8; }
        .gegevens-regel strong { color: #f8fafc; font-weight: 500; }
        .gegevens-akkoord { display: flex; gap: 10px; align-items: flex-start; font-size: 14px; color: #94a3b8; line-height: 1.5; cursor: pointer; }
        .gegevens-akkoord input { margin-top: 3px; accent-color: #f59e0b; }
        @media (max-width: 640px) { .plan-cols { grid-template-columns: 1fr; } }
      `}</style>

      <BotNav active="account" />

      <div style={{ maxWidth: 812, margin: '0 auto', padding: 'clamp(80px,12vw,120px) clamp(16px,4vw,20px) 80px' }}>

        <p style={label}>Abonnement</p>
        <h1 style={{ fontFamily: "'Oswald', sans-serif", fontSize: 'clamp(36px, 5vw, 56px)', fontWeight: 600, textTransform: 'uppercase', lineHeight: 1.1, color: '#f8fafc', marginBottom: 16 }}>
          {eerderBetaald || abonnement ? 'Verlengen.' : 'Doorgaan met ArnoBot.'}
        </h1>

        {status === 'already_paid' && (
          <>
            <div style={{ background: '#1e293b', border: '1px solid #374151', borderLeft: '3px solid #44cc88', borderRadius: 8, padding: '20px 24px', marginBottom: 32 }}>
              <p style={{ ...body, marginBottom: 0, color: '#44cc88' }}>Je abonnement is actief. Betaling is ontvangen.</p>
              {abonnement?.status === 'cancelled' && abonnement.opzeggingIngaatOp && (
                <p style={{ ...body, marginTop: 12, marginBottom: 0 }}>Je hebt opgezegd. Je abonnement eindigt op {fmtDatum(abonnement.opzeggingIngaatOp)}.</p>
              )}
              {abonnement?.status === 'active' && abonnement.klantType === 'particulier' && abonnement.contractEinde && (
                <p style={{ ...body, marginTop: 12, marginBottom: 0 }}>Je abonnement loopt tot {fmtDatum(abonnement.contractEinde)}. Daarna vragen we of je wilt verlengen.</p>
              )}
            </div>

            {abonnement?.kanVerlengen && verlengen !== 'klaar' && (
              <div className="gegevens-card">
                <p style={{ ...body, marginBottom: 0 }}>
                  Je abonnement loopt af op {fmtDatum(abonnement.contractEinde)}. Wil je nog {abonnement.cyclus === 'jaarlijks' ? 'een jaar' : '12 maanden'} verder? Met één klik verleng je, we gebruiken je bestaande betaalmethode.
                </p>
                <button className="plan-btn" onClick={verlengNu} disabled={verlengen === 'bezig'}>
                  {verlengen === 'bezig' ? 'Bezig...' : 'Verleng met één klik'}
                </button>
                {verlengen === 'fout' && (
                  <p style={{ color: '#cc2200', fontSize: 14 }}>Verlengen is niet gelukt. Probeer het opnieuw of mail <a href="mailto:hq@arno.bot" style={{ color: '#f59e0b' }}>hq@arno.bot</a>.</p>
                )}
              </div>
            )}
            {verlengen === 'klaar' && (
              <div style={{ background: '#1e293b', border: '1px solid #374151', borderLeft: '3px solid #44cc88', borderRadius: 8, padding: '20px 24px', marginBottom: 32 }}>
                <p style={{ ...body, marginBottom: 0, color: '#44cc88' }}>Verlengd. Je betaalt weer vanaf {fmtDatum(abonnement?.contractEinde ?? null)}.</p>
              </div>
            )}

            <Link href="/bot" style={{ ...btn, textDecoration: 'none' }} className="primary-btn">
              Terug naar ArnoBot
            </Link>
          </>
        )}

        {terug && status !== 'already_paid' && (
          <div style={{ background: '#1e293b', border: '1px solid #374151', borderLeft: '3px solid #f59e0b', borderRadius: 8, padding: '20px 24px', marginBottom: 32 }}>
            <p style={body}>We verwerken je betaling. Dit duurt meestal een paar seconden.</p>
            <p style={body}>Zie je na een minuut nog niets? Je ontvangt altijd een bevestiging per e-mail. Is je betaling niet gelukt of heb je geannuleerd, probeer het dan opnieuw.</p>
            <button className="plan-btn" onClick={() => { setTerug(false); setStap('kies') }}>Opnieuw proberen</button>
            <p style={{ ...body, marginTop: 16, marginBottom: 0 }}>Vragen? Mail naar <a href="mailto:hq@arno.bot" style={{ color: '#f59e0b' }}>hq@arno.bot</a>.</p>
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

        {status === 'idle' && !terug && stap === 'gegevens' && gekozenPlan && (() => {
          const bedrag = berekenBedrag(gekozenPlan, cyclus, klantType)
          const periode = cyclus === 'jaarlijks' ? 'per jaar' : 'per maand'
          const afspraak = klantType === 'zakelijk'
            ? 'Je abonnement loopt door tot je opzegt. De opzegtermijn is één maand.'
            : cyclus === 'jaarlijks'
              ? 'Je betaalt eenmalig voor een jaar. Daarna vragen we of je wilt verlengen.'
              : 'Je betaalt elke maand automatisch. Na 12 maanden vragen we of je wilt verlengen.'
          const zakelijkCompleet = klantType === 'particulier' || (bedrijfsnaam.trim().length >= 2 && kvk.trim() !== '' && btwNummer.trim() !== '')
          return (
            <div className="gegevens-card">
              <span className="plan-naam">{gekozenPlan === 'premium' ? 'Pro' : 'Basic'}, {cyclus === 'jaarlijks' ? 'jaarlijks' : 'maandelijks'}</span>

              <div className="gegevens-rij">
                <span className="gegevens-label">Ik koop als</span>
                <div className="doorgaan-toggle" style={{ alignSelf: 'flex-start' }}>
                  <button className={klantType === 'particulier' ? 'actief' : ''} onClick={() => setKlantType('particulier')}>Particulier</button>
                  <button className={klantType === 'zakelijk' ? 'actief' : ''} onClick={() => setKlantType('zakelijk')}>Zakelijk</button>
                </div>
              </div>

              {klantType === 'zakelijk' && (
                <>
                  <div className="gegevens-rij">
                    <label className="gegevens-label" htmlFor="bedrijfsnaam">Bedrijfsnaam</label>
                    <input id="bedrijfsnaam" className="gegevens-input" value={bedrijfsnaam} onChange={e => setBedrijfsnaam(e.target.value)} autoComplete="organization" />
                  </div>
                  <div className="gegevens-rij">
                    <label className="gegevens-label" htmlFor="kvk">KvK-nummer</label>
                    <input id="kvk" className="gegevens-input" value={kvk} onChange={e => setKvk(e.target.value)} inputMode="numeric" />
                  </div>
                  <div className="gegevens-rij">
                    <label className="gegevens-label" htmlFor="btw">Btw-nummer</label>
                    <input id="btw" className="gegevens-input" value={btwNummer} onChange={e => setBtwNummer(e.target.value)} placeholder="NL123456789B01" />
                  </div>
                </>
              )}

              <div style={{ borderTop: '1px solid #374151', paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {klantType === 'zakelijk' ? (
                  <>
                    <div className="gegevens-regel"><span>Abonnement {periode}</span><strong>{formatEuro(bedrag.nettoCent)}</strong></div>
                    <div className="gegevens-regel"><span>Btw 21%</span><strong>{formatEuro(bedrag.btwCent)}</strong></div>
                    <div className="gegevens-regel"><span>Totaal {periode}</span><strong>{formatEuro(bedrag.brutoCent)}</strong></div>
                  </>
                ) : (
                  <>
                    <div className="gegevens-regel"><span>Totaal {periode}</span><strong>{formatEuro(bedrag.brutoCent)}</strong></div>
                    <div className="gegevens-regel"><span>Inclusief btw</span><strong>{formatEuro(bedrag.btwCent)}</strong></div>
                  </>
                )}
              </div>

              <p style={{ fontSize: 14, color: '#94a3b8', lineHeight: 1.5 }}>
                {afspraak} {klantType === 'particulier' ? 'Als particulier heb je 14 dagen bedenktijd na je eerste betaling.' : ''}
              </p>

              <label className="gegevens-akkoord">
                <input type="checkbox" checked={akkoord} onChange={e => setAkkoord(e.target.checked)} />
                <span>Ik ga akkoord met de <a href="/voorwaarden" target="_blank" rel="noopener noreferrer" style={{ color: '#f59e0b' }}>algemene voorwaarden</a> en heb de <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: '#f59e0b' }}>privacyverklaring</a> gelezen.</span>
              </label>

              {betaalFout && <p style={{ color: '#cc2200', fontSize: 14 }}>{betaalFout}</p>}

              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <button className="plan-btn" onClick={betaal} disabled={!akkoord || !zakelijkCompleet || betalen}>
                  {betalen ? 'Bezig...' : 'Naar betalen'}
                </button>
                <button onClick={() => { setStap('kies'); setBetaalFout('') }} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: 14, cursor: 'pointer', textDecoration: 'underline' }}>
                  Terug
                </button>
              </div>
              <p style={{ fontSize: 13, color: '#6b7280' }}>Je betaalt veilig via Mollie, met iDEAL, Bancontact of creditcard.</p>
            </div>
          )
        })()}

        {status === 'idle' && !terug && stap === 'kies' && (
          <>
            <p style={body}>
              {mollieEnabled
                ? 'Je gratis proefperiode loopt binnenkort af. Kies hieronder het abonnement waarmee je door wil. Je betaalt veilig met iDEAL, Bancontact of creditcard.'
                : 'Je gratis proefperiode loopt binnenkort af. Kies hieronder het abonnement waarmee je door wil. Je ontvangt dan een factuur van ArnoBot.'}
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
                    {cyclus === 'jaarlijks' ? 'Bij jaarbetaling, €228 per jaar' : 'Per maand.'}
                  </p>
                </div>

                <ul className="plan-bullets">
                  <li>Dagelijks sparren met ArnoBot</li>
                  <li>Eén gespreksanalyse per dag</li>
                  <li>Geheugen van je recente gesprekken</li>
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
                    {cyclus === 'jaarlijks' ? 'Bij jaarbetaling, €468 per jaar' : 'Per maand.'}
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
            Er ging iets mis. Probeer het opnieuw of <a href={SUPPORT_WHATSAPP_VASTGELOPEN} style={{ color: '#f59e0b' }} target="_blank" rel="noopener noreferrer">stuur een WhatsApp</a>.
          </p>
        )}

      </div>
    </>
  )
}
