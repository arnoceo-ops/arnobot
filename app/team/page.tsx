'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useUser } from '@clerk/nextjs'
import { berekenTeamPrijsPerMaand, TEAM_MIN_GEBRUIKERS, TEAM_ELITE_SURPLUS_PER_MAAND, type Cyclus } from '@/lib/teamPricing'

export default function TeamAanvraagPage() {
  const { isSignedIn, isLoaded } = useUser()
  const [status, setStatus] = useState<'idle' | 'submitting' | 'done' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const [bedrijfsnaam, setBedrijfsnaam] = useState('')
  const [kvkNummer, setKvkNummer] = useState('')
  const [btwNummer, setBtwNummer] = useState('')
  const [factuuradres, setFactuuradres] = useState('')
  const [postcode, setPostcode] = useState('')
  const [plaats, setPlaats] = useState('')
  const [aanvragerNaam, setAanvragerNaam] = useState('')
  const [functie, setFunctie] = useState('')
  const [email, setEmail] = useState('')
  const [telefoon, setTelefoon] = useState('')
  const [bestelnummer, setBestelnummer] = useState('')
  const [aantalSeats, setAantalSeats] = useState(TEAM_MIN_GEBRUIKERS)
  const [cyclus, setCyclus] = useState<Cyclus>('maandelijks')
  const [eliteInteresse, setEliteInteresse] = useState(false)
  const [eliteAantal, setEliteAantal] = useState(1)

  const prijs = useMemo(() => berekenTeamPrijsPerMaand(aantalSeats, cyclus), [aantalSeats, cyclus])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('submitting')
    setErrorMsg('')
    try {
      const res = await fetch('/api/team-aanvraag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bedrijfsnaam, kvkNummer, btwNummer, factuuradres, postcode, plaats,
          aanvragerNaam, functie, email, telefoon, bestelnummer, aantalSeats, cyclus,
          eliteAantal: eliteInteresse ? eliteAantal : 0,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setErrorMsg(data.error || 'Aanvraag mislukt'); setStatus('error'); return }
      setStatus('done')
    } catch {
      setErrorMsg('Er ging iets mis')
      setStatus('error')
    }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Oswald:wght@500;600&family=Figtree:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #111827; color: #f8fafc; font-family: 'Figtree', sans-serif; font-size: 15px; }

        .site-nav {
          position: fixed; top: 0; left: 0; right: 0; z-index: 100;
          padding: 0 40px; height: 60px; display: flex; align-items: center;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          background: rgba(17,24,39,0.9); backdrop-filter: blur(12px);
        }
        .nav-logo { font-family: 'Bebas Neue', sans-serif; font-size: 28px; letter-spacing: 3px; color: #f1f5f9; text-decoration: none; }
        .nav-logo span { color: #f59e0b; }
        .nav-spacer { flex: 1; }
        .nav-auth { display: flex; gap: 32px; align-items: center; }
        .nav-login { font-family: 'Bebas Neue', sans-serif; font-size: 28px; letter-spacing: 3px; color: #9ca3af; text-decoration: none; transition: color 0.2s; }
        .nav-login:hover { color: #f1f5f9; }

        .ca-wrap { max-width: 640px; margin: 0 auto; padding: 140px 24px 80px; }
        .ca-label { font-size: 14px; font-weight: 600; letter-spacing: 0.3em; text-transform: uppercase; color: #f59e0b; margin-bottom: 16px; }
        .ca-title { font-family: 'Oswald', sans-serif; font-size: clamp(36px, 5vw, 56px); font-weight: 600; text-transform: uppercase; line-height: 1.1; color: #f8fafc; margin-bottom: 16px; }
        .ca-sub { font-size: 18px; line-height: 1.625; color: #94a3b8; margin-bottom: 40px; }

        .ca-fieldset { border: none; margin-bottom: 32px; }
        .ca-fieldset legend { font-size: 14px; font-weight: 600; letter-spacing: 0.3em; text-transform: uppercase; color: #f59e0b; margin-bottom: 16px; padding: 0; }
        .ca-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
        .ca-field { display: flex; flex-direction: column; gap: 6px; }
        .ca-field label { font-size: 14px; color: #94a3b8; }
        .ca-field input {
          background: #1e293b; border: 1px solid #374151; border-radius: 6px; padding: 10px 14px;
          color: #f8fafc; font-family: 'Figtree', sans-serif; font-size: 15px; outline: none; transition: border-color 0.15s;
        }
        .ca-field input:focus { border-color: #f59e0b; }

        .ca-toggle { display: inline-flex; background: #111827; border: 1px solid #374151; border-radius: 999px; padding: 3px; margin-bottom: 20px; }
        .ca-toggle button {
          font-family: 'Oswald', sans-serif; font-weight: 600; font-size: 12px; letter-spacing: 0.08em;
          text-transform: uppercase; padding: 6px 16px; border-radius: 999px; border: none; cursor: pointer;
          background: transparent; color: #94a3b8; transition: all 0.2s;
        }
        .ca-toggle button.actief { background: #f59e0b; color: #111827; }
        .ca-toggle button:disabled { opacity: 0.4; cursor: not-allowed; }

        .ca-prijs-box { background: #1e293b; border: 1px solid #374151; border-radius: 8px; padding: 20px 24px; margin-bottom: 32px; }
        .ca-prijs-num { font-family: 'Oswald', sans-serif; font-size: 32px; font-weight: 600; color: #f8fafc; }
        .ca-prijs-sub { font-size: 13px; color: #6b7280; margin-top: 4px; }

        .ca-submit {
          display: inline-flex; align-items: center; border-radius: 6px; background: #f59e0b;
          padding: 14px 32px; font-family: 'Oswald', sans-serif; font-size: 16px; font-weight: 600;
          letter-spacing: 0.1em; color: #111827; text-transform: uppercase; border: none; cursor: pointer;
          box-shadow: 0 12px 24px rgba(245,158,11,0.25); transition: transform 0.2s;
        }
        .ca-submit:hover { transform: scale(1.03); }
        .ca-submit:disabled { opacity: 0.6; cursor: not-allowed; }

        @media (max-width: 600px) { .ca-row { grid-template-columns: 1fr; } }
      `}</style>

      <nav className="site-nav">
        <Link href="/" className="nav-logo">ARNO<span>BOT.</span></Link>
        <div className="nav-spacer" />
        <div className="nav-auth">
          {isSignedIn
            ? <Link href="/bot" className="nav-login">MIJN BOT</Link>
            : <Link href="/sign-in" className="nav-login">LOGIN</Link>
          }
        </div>
      </nav>

      <div className="ca-wrap">
        <p className="ca-label">Team</p>
        <h1 className="ca-title">Vraag een Team-abonnement aan.</h1>

        {status === 'done' ? (
          <div style={{ background: '#1e293b', border: '1px solid #374151', borderRadius: 8, padding: '24px 28px' }}>
            <p style={{ color: '#44cc88', fontSize: 15, marginBottom: 8, fontWeight: 500 }}>Dank voor je aanvraag.</p>
            <p style={{ color: '#94a3b8', fontSize: 15, lineHeight: 1.7 }}>Je krijgt van ons binnen 24 uur een offerte toegestuurd.</p>
          </div>
        ) : (
          <>
            <p className="ca-sub">
              Vul je gegevens in en je krijgt een offerte per e-mail toegestuurd.
              {isLoaded && !isSignedIn && <><br />Al een ArnoBot-account? Log eerst in, dan koppelen we deze aanvraag automatisch aan je account.</>}
            </p>

            <form onSubmit={submit}>
              <fieldset className="ca-fieldset">
                <legend>Bedrijfsgegevens</legend>
                <div className="ca-field" style={{ marginBottom: 16 }}>
                  <label>Bedrijfsnaam *</label>
                  <input required value={bedrijfsnaam} onChange={e => setBedrijfsnaam(e.target.value)} />
                </div>
                <div className="ca-row">
                  <div className="ca-field">
                    <label>KvK-nummer *</label>
                    <input required value={kvkNummer} onChange={e => setKvkNummer(e.target.value)} />
                  </div>
                  <div className="ca-field">
                    <label>Btw-nummer *</label>
                    <input required value={btwNummer} onChange={e => setBtwNummer(e.target.value)} />
                  </div>
                </div>
                <div className="ca-field" style={{ marginBottom: 16 }}>
                  <label>Factuuradres *</label>
                  <input required value={factuuradres} onChange={e => setFactuuradres(e.target.value)} placeholder="Straat en huisnummer" />
                </div>
                <div className="ca-row" style={{ marginBottom: 0 }}>
                  <div className="ca-field">
                    <label>Postcode *</label>
                    <input required value={postcode} onChange={e => setPostcode(e.target.value)} />
                  </div>
                  <div className="ca-field">
                    <label>Plaats *</label>
                    <input required value={plaats} onChange={e => setPlaats(e.target.value)} />
                  </div>
                </div>
              </fieldset>

              <fieldset className="ca-fieldset">
                <legend>Aanvrager</legend>
                <div className="ca-row">
                  <div className="ca-field">
                    <label>Naam *</label>
                    <input required value={aanvragerNaam} onChange={e => setAanvragerNaam(e.target.value)} />
                  </div>
                  <div className="ca-field">
                    <label>Functie *</label>
                    <input required value={functie} onChange={e => setFunctie(e.target.value)} />
                  </div>
                </div>
                <div className="ca-row" style={{ marginBottom: 0 }}>
                  <div className="ca-field">
                    <label>E-mail *</label>
                    <input required type="email" value={email} onChange={e => setEmail(e.target.value)} />
                  </div>
                  <div className="ca-field">
                    <label>Telefoon *</label>
                    <input required value={telefoon} onChange={e => setTelefoon(e.target.value)} />
                  </div>
                </div>
              </fieldset>

              <fieldset className="ca-fieldset">
                <legend>Team</legend>

                <div className="ca-row">
                  <div className="ca-field">
                    <label>Aantal gebruikers (inclusief jijzelf) *</label>
                    <input
                      required type="number" min={TEAM_MIN_GEBRUIKERS} value={aantalSeats}
                      onChange={e => {
                        const val = Number(e.target.value)
                        setAantalSeats(val)
                        setEliteAantal(prev => Math.min(prev, Math.max(1, val)))
                      }}
                    />
                  </div>
                  <div className="ca-field">
                    <label>Bestelnummer (optioneel)</label>
                    <input value={bestelnummer} onChange={e => setBestelnummer(e.target.value)} />
                  </div>
                </div>

                <div className="ca-toggle">
                  <button type="button" className={cyclus === 'maandelijks' ? 'actief' : ''} onClick={() => setCyclus('maandelijks')}>MAANDELIJKS</button>
                  <button type="button" className={cyclus === 'jaarlijks' ? 'actief' : ''} onClick={() => setCyclus('jaarlijks')}>JAARLIJKS</button>
                </div>
                <p style={{ fontSize: 13, color: '#6b7280', marginTop: -12, marginBottom: 20 }}>
                  {cyclus === 'jaarlijks' ? 'Jaarlijks vooruitbetaald, ~20% korting.' : 'Maandelijks opzegbaar.'} Vanaf {TEAM_MIN_GEBRUIKERS} gebruikers.
                </p>

                <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: eliteInteresse ? 12 : 20, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={eliteInteresse}
                    onChange={e => setEliteInteresse(e.target.checked)}
                    style={{ width: 16, height: 16, accentColor: '#f59e0b' }}
                  />
                  <span style={{ fontSize: 14, color: '#94a3b8' }}>Ook Elite-niveau voor een deel van je team</span>
                </label>

                {eliteInteresse && (
                  <div className="ca-field" style={{ marginBottom: 12, maxWidth: 220 }}>
                    <label>Aantal Elite-teamleden</label>
                    <input
                      type="number" min={1} max={aantalSeats} value={eliteAantal}
                      onChange={e => setEliteAantal(Math.min(aantalSeats, Math.max(1, Number(e.target.value))))}
                    />
                  </div>
                )}

                <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 20 }}>
                  Elite-teamleden krijgen naast alle Team-functies ook maandelijks een gesprek met Arno (of een door Arno aangewezen coach) en Telegram-toegang, voor €{TEAM_ELITE_SURPLUS_PER_MAAND} per maand extra per teamlid. We nemen dit mee in je offerte.
                </p>

                <div className="ca-prijs-box">
                  {prijs === null ? (
                    <>
                      <p className="ca-prijs-num">Vanaf {TEAM_MIN_GEBRUIKERS} gebruikers</p>
                      <p className="ca-prijs-sub">Vul het aantal gebruikers in voor een prijsberekening.</p>
                    </>
                  ) : cyclus === 'jaarlijks' ? (
                    <>
                      <p className="ca-prijs-num">€{prijs * 12} / jaar</p>
                      <p className="ca-prijs-sub">€77 platformtarief + €39 per gebruiker, maand-equivalent, exclusief btw</p>
                    </>
                  ) : (
                    <>
                      <p className="ca-prijs-num">€{prijs} / maand</p>
                      <p className="ca-prijs-sub">€97 platformtarief + €49 per gebruiker, exclusief btw</p>
                    </>
                  )}
                </div>
              </fieldset>

              {status === 'error' && <p style={{ color: '#cc2200', fontSize: 14, marginBottom: 16 }}>{errorMsg}</p>}

              <button type="submit" className="ca-submit" disabled={status === 'submitting'}>
                {status === 'submitting' ? 'Bezig...' : 'Aanvraag versturen'}
              </button>
            </form>
          </>
        )}
      </div>
    </>
  )
}
