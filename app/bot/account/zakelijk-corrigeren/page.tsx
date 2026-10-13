'use client'

import { useState, useEffect } from 'react'
import BotNav from '../../BotNav'
import { formatEuro } from '@/lib/billing/geld'

type Abonnement = { planNaam: string; cyclus: 'maandelijks' | 'jaarlijks'; betaaldCent: number; verschilCent: number }

export default function ZakelijkCorrigerenPage() {
  const [laden, setLaden] = useState(true)
  const [abonnement, setAbonnement] = useState<Abonnement | null>(null)
  const [terug] = useState(() => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('betaling') === 'terug')

  const [bedrijfsnaam, setBedrijfsnaam] = useState('')
  const [kvk, setKvk] = useState('')
  const [btwNummer, setBtwNummer] = useState('')
  const [straat, setStraat] = useState('')
  const [postcode, setPostcode] = useState('')
  const [plaats, setPlaats] = useState('')
  const [akkoord, setAkkoord] = useState(false)
  const [bezig, setBezig] = useState(false)
  const [foutmelding, setFoutmelding] = useState('')

  useEffect(() => {
    fetch('/api/bot/klanttype-correctie')
      .then(r => r.json())
      .then(d => setAbonnement(d.abonnement ?? null))
      .catch(() => setAbonnement(null))
      .finally(() => setLaden(false))
  }, [])

  const compleet = bedrijfsnaam.trim().length >= 2 && kvk.trim() !== '' && btwNummer.trim() !== ''
    && straat.trim().length >= 3 && postcode.trim() !== '' && plaats.trim().length >= 2

  async function corrigeer() {
    setFoutmelding('')
    setBezig(true)
    try {
      const res = await fetch('/api/bot/klanttype-correctie', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bedrijfsnaam, kvk, btwNummer, straat, postcode, plaats }),
      })
      const data = await res.json()
      if (!res.ok) { setFoutmelding(data.error || 'Er ging iets mis'); setBezig(false); return }
      window.location.href = data.checkoutUrl
    } catch {
      setFoutmelding('Er ging iets mis, probeer het opnieuw')
      setBezig(false)
    }
  }

  const label: React.CSSProperties = { fontSize: 14, fontWeight: 600, letterSpacing: '0.3em', textTransform: 'uppercase', color: '#f59e0b', marginBottom: 16, display: 'block' }
  const body: React.CSSProperties = { fontSize: 16, lineHeight: 1.65, color: '#94a3b8', marginBottom: 24 }
  const btn: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', borderRadius: 6, background: '#f59e0b',
    padding: '14px 32px', fontFamily: "'Oswald', sans-serif", fontSize: 16, fontWeight: 600,
    letterSpacing: '0.1em', color: '#111827', textTransform: 'uppercase', border: 'none', cursor: 'pointer',
    boxShadow: '0 12px 24px rgba(245,158,11,0.25)',
  }

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        body { font-weight: 400; }
        .gegevens-rij { display: flex; flex-direction: column; gap: 6px; }
        .gegevens-label { font-size: 13px; font-weight: 600; letter-spacing: 0.2em; text-transform: uppercase; color: #94a3b8; }
        .gegevens-input { font-family: 'Figtree', sans-serif; font-size: 15px; padding: 12px 14px; border-radius: 6px; border: 1.5px solid #374151; background: #111827; color: #f8fafc; outline: none; }
        .gegevens-input:focus { border-color: #f59e0b; }
      `}</style>
      <div style={{ background: '#111827', minHeight: '100vh', color: '#f8fafc', fontFamily: "'Figtree', sans-serif" }}>
        <BotNav active="account" />
        <div style={{ maxWidth: 560, margin: '0 auto', padding: 'clamp(80px,12vw,120px) clamp(16px,4vw,20px) 80px' }}>
          <span style={label}>Correctie</span>
          <h1 style={{ fontFamily: "'Oswald', sans-serif", fontSize: 'clamp(28px,5vw,40px)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 20, lineHeight: 1.1 }}>
            Particulier naar zakelijk
          </h1>

          {laden ? null : terug ? (
            <p style={body}>
              Bedankt. We verwerken je betaling en sturen je zodra het klaar is een bevestiging met de nieuwe factuur per e-mail.
              Dat kan een paar minuten duren.
            </p>
          ) : !abonnement ? (
            <p style={body}>
              We konden geen particulier abonnement vinden om te corrigeren op je account. Klopt dat niet, mail dan naar{' '}
              <a href="mailto:admin@arno.bot" style={{ color: '#f59e0b' }}>admin@arno.bot</a>.
            </p>
          ) : (
            <>
              <p style={body}>
                Je hebt ArnoBot {abonnement.planNaam} ({abonnement.cyclus}) als particulier afgerekend voor {formatEuro(abonnement.betaaldCent)}.
                Vul hieronder je bedrijfsgegevens in: we maken er een correcte zakelijke btw-factuur van. Het al betaalde bedrag blijft
                gewoon staan, je betaalt alleen het verschil van {formatEuro(abonnement.verschilCent)}.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
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
                <div className="gegevens-rij">
                  <label className="gegevens-label" htmlFor="straat">Straat en huisnummer</label>
                  <input id="straat" className="gegevens-input" value={straat} onChange={e => setStraat(e.target.value)} autoComplete="street-address" />
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <div className="gegevens-rij" style={{ flex: '0 0 140px' }}>
                    <label className="gegevens-label" htmlFor="postcode">Postcode</label>
                    <input id="postcode" className="gegevens-input" value={postcode} onChange={e => setPostcode(e.target.value)} autoComplete="postal-code" placeholder="1234 AB" />
                  </div>
                  <div className="gegevens-rij" style={{ flex: 1 }}>
                    <label className="gegevens-label" htmlFor="plaats">Plaats</label>
                    <input id="plaats" className="gegevens-input" value={plaats} onChange={e => setPlaats(e.target.value)} autoComplete="address-level2" />
                  </div>
                </div>
              </div>

              <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 24, fontSize: 14, color: '#94a3b8' }}>
                <input type="checkbox" checked={akkoord} onChange={e => setAkkoord(e.target.checked)} />
                <span>Ik betaal het verschil van {formatEuro(abonnement.verschilCent)} om mijn abonnement te corrigeren naar zakelijk.</span>
              </label>

              {foutmelding && <p style={{ color: '#ef4444', fontSize: 14, marginBottom: 16 }}>{foutmelding}</p>}

              <button style={{ ...btn, opacity: compleet && akkoord && !bezig ? 1 : 0.5 }} disabled={!compleet || !akkoord || bezig} onClick={corrigeer}>
                {bezig ? 'Bezig...' : `Betaal ${formatEuro(abonnement.verschilCent)}`}
              </button>
            </>
          )}
        </div>
      </div>
    </>
  )
}
