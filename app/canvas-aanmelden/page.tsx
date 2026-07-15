'use client';

import Link from 'next/link';
import { useState } from 'react';

const HOW_OPTIONS = [
  'Google / zoekmachine',
  'LinkedIn',
  'Aanbeveling / mond-tot-mond',
  'Royal Dutch Sales blog',
  'Social media',
  'Anders',
];

export default function CanvasAanmeldenPage() {
  const [plan, setPlan] = useState<'solo' | 'team' | ''>('');
  const [seats, setSeats] = useState('2');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    naam: '',
    email: '',
    bedrijf: '',
    opmerkingen: '',
    hoe: '',
    startdatum: '',
    voorwaarden: false,
    marketing: false,
  });

  const set = (k: string, v: string | boolean) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.naam || !form.email || !form.bedrijf || !plan || !form.voorwaarden) {
      setError('Vul alle verplichte velden in en ga akkoord met de voorwaarden.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/canvas/aanmelden', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, plan, seats: plan === 'team' ? seats : '1' }),
      });
      if (!res.ok) throw new Error();
      setSubmitted(true);
    } catch {
      setError('Er ging iets mis. Probeer het opnieuw of mail naar arno@royaldutchsales.com.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Space+Mono:wght@400;700&family=Barlow:wght@400;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #111827; color: #f1f5f9; font-family: 'Space Mono', monospace; }

        .site-nav {
          position: fixed; top: 0; left: 0; right: 0; z-index: 100;
          padding: 16px 40px; display: flex; justify-content: center;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          background: rgba(17,24,39,0.9); backdrop-filter: blur(12px);
        }
        .nav-links { display: flex; gap: 48px; align-items: center; }
        .nav-links a {
          color: #9ca3af; text-decoration: none;
          font-family: 'Bebas Neue', sans-serif;
          font-size: 22px; letter-spacing: 3px; transition: color 0.2s;
        }
        .nav-links a:hover { color: #f1f5f9; }
        .nav-active { color: #f59e0b !important; }
        .nav-cta { color: #f59e0b !important; }

        .page { padding-top: 80px; min-height: 100vh; }

        .hero {
          padding: 80px 60px 60px;
          border-bottom: 3px solid #f59e0b;
          display: flex; justify-content: space-between; align-items: flex-end;
          flex-wrap: wrap; gap: 32px;
        }
        .hero-title {
          font-family: 'Bebas Neue', sans-serif;
          font-size: clamp(56px, 9vw, 108px); line-height: 0.9;
        }
        .hero-title span:first-child { color: #f59e0b; display: block; }
        .hero-title span:last-child { color: #f1f5f9; display: block; }
        .hero-meta { text-align: right; padding-bottom: 8px; }
        .hero-meta p { font-family: 'Space Mono', monospace; font-size: 13px; line-height: 1.9; color: #9ca3af; }
        .no-cc {
          display: inline-flex; align-items: center; gap: 8px;
          font-family: 'Bebas Neue', sans-serif; font-size: 16px; letter-spacing: 2px;
          color: #f59e0b; margin-top: 12px;
        }
        .no-cc::before { content: '✓'; }

        .body { max-width: 760px; margin: 0 auto; padding: 80px 40px 120px; }

        .field { margin-bottom: 32px; }
        .label {
          display: block; font-family: 'Bebas Neue', sans-serif;
          font-size: 16px; letter-spacing: 2px; color: #9ca3af; margin-bottom: 10px;
        }
        .label span { color: #f59e0b; }
        .input {
          width: 100%; background: #1f2937; border: 1px solid #222;
          color: #f1f5f9; font-family: 'Space Mono', monospace; font-size: 14px;
          padding: 14px 18px; outline: none; transition: border-color 0.2s;
          appearance: none;
        }
        .input:focus { border-color: #f59e0b; }
        .input::placeholder { color: #4b5563; }
        select.input { cursor: pointer; }
        textarea.input { resize: vertical; min-height: 100px; }

        .plan-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2px; }
        .plan-card {
          background: #1f2937; border: 1px solid #222;
          padding: 28px 24px; cursor: pointer; transition: border-color 0.2s;
          position: relative;
        }
        .plan-card:hover { border-color: #4b5563; }
        .plan-card.active { border-color: #f59e0b; }
        .plan-card.active::before {
          content: ''; position: absolute; top: 0; left: 0; right: 0;
          height: 2px; background: #f59e0b;
        }
        .plan-name {
          font-family: 'Bebas Neue', sans-serif; font-size: 32px;
          letter-spacing: 2px; color: #f1f5f9; margin-bottom: 8px;
        }
        .plan-desc { font-size: 12px; color: #6b7280; line-height: 1.7; }
        .plan-card.active .plan-name { color: #f59e0b; }

        .seats-row { display: flex; gap: 8px; margin-top: 16px; }
        .seat-btn {
          width: 44px; height: 44px; background: #1f2937; border: 1px solid #222;
          color: #9ca3af; font-family: 'Space Mono', monospace; font-size: 14px;
          cursor: pointer; transition: all 0.15s;
        }
        .seat-btn:hover { border-color: #4b5563; color: #f1f5f9; }
        .seat-btn.active { border-color: #f59e0b; color: #f59e0b; background: #1a1000; }

        .check-row { display: flex; align-items: flex-start; gap: 14px; margin-bottom: 18px; cursor: pointer; }
        .check-box {
          width: 20px; height: 20px; min-width: 20px; background: #1f2937;
          border: 1px solid #374151; display: flex; align-items: center; justify-content: center;
          transition: border-color 0.2s; margin-top: 1px;
        }
        .check-box.checked { border-color: #f59e0b; background: #1a1000; }
        .check-box.checked::after { content: '✓'; color: #f59e0b; font-size: 12px; }
        .check-label { font-size: 12px; color: #6b7280; line-height: 1.7; }
        .check-label a { color: #f59e0b; text-decoration: none; }
        .check-label a:hover { text-decoration: underline; }

        .divider { height: 1px; background: #1e293b; margin: 40px 0; }

        .submit-btn {
          font-family: 'Bebas Neue', sans-serif; font-size: 22px; letter-spacing: 3px;
          color: #111827; background: #f59e0b; border: none; padding: 18px 0;
          width: 100%; cursor: pointer; transition: opacity 0.2s;
        }
        .submit-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .submit-btn:hover:not(:disabled) { opacity: 0.9; }

        .error { font-size: 12px; color: #c0392b; margin-bottom: 20px; line-height: 1.6; }

        .success {
          text-align: center; padding: 120px 40px;
        }
        .success-title {
          font-family: 'Bebas Neue', sans-serif; font-size: clamp(48px, 8vw, 96px);
          color: #f59e0b; line-height: 0.9; margin-bottom: 24px;
        }
        .success-sub { font-size: 13px; color: #9ca3af; line-height: 1.9; max-width: 480px; margin: 0 auto; }

        footer {
          background: #0d1117; padding: 40px 60px;
          display: flex; justify-content: space-between; align-items: center;
          border-top: 1px solid #1f2937;
        }
        .footer-logo { font-family: 'Bebas Neue', sans-serif; font-size: 24px; color: #f59e0b; letter-spacing: 3px; }
        .footer-copy { font-size: 10px; color: #374151; }

        @media (max-width: 600px) {
          .hero { padding: 60px 24px 40px; }
          .body { padding: 60px 24px 80px; }
          .plan-grid { grid-template-columns: 1fr; }
          .hero-meta { text-align: left; }
          footer { padding: 32px 24px; flex-direction: column; gap: 12px; }
        }
      `}</style>

      <nav className="site-nav">
        <div className="nav-links">
          <Link href="/">HOME</Link>
          <a href="https://arno.blog/bio">ARNO</a>
          <a href="https://www.arno.bot/">BOT</a>
          <a href="https://salescanvas.app" target="_blank" rel="noopener noreferrer" className="nav-active">CANVAS</a>
          <a href="https://arno.blog/subscribe" target="_blank" rel="noopener noreferrer" className="nav-cta">SUBSCRIBE</a>
        </div>
      </nav>

      <div className="page">
        <div className="hero">
          <h1 className="hero-title">
            <span>CANVAS</span>
            <span>AANMELDEN.</span>
          </h1>
          <div className="hero-meta">
            <p>8 dagen gratis proberen.<br />Geen creditcard nodig.</p>
            <div className="no-cc">Geen creditcard vereist</div>
          </div>
        </div>

        {submitted ? (
          <div className="success">
            <div className="success-title">AANMELDING<br />ONTVANGEN.</div>
            <p className="success-sub">
              Bedankt. Je ontvangt binnen 24 uur een bevestiging op {form.email}.<br /><br />
              Vragen? Mail naar <a href="mailto:arno@royaldutchsales.com" style={{ color: '#f59e0b' }}>arno@royaldutchsales.com</a>
            </p>
          </div>
        ) : (
          <div className="body">

            {/* Plan keuze */}
            <div className="field">
              <label className="label">KIES JE PLAN <span>*</span></label>
              <div className="plan-grid">
                <div className={`plan-card${plan === 'solo' ? ' active' : ''}`} onClick={() => setPlan('solo')}>
                  <div className="plan-name">SOLO</div>
                  <div className="plan-desc">Voor individuele sales professionals en zelfstandigen. Jij vult het Canvas in, ArnoBot geeft feedback.</div>
                </div>
                <div className={`plan-card${plan === 'team' ? ' active' : ''}`} onClick={() => setPlan('team')}>
                  <div className="plan-name">TEAM</div>
                  <div className="plan-desc">Voor salesteams van 2 tot 5 personen. Iedereen vult in, jij ziet de alignment en vergelijkt de plannen.</div>
                </div>
              </div>

              {plan === 'team' && (
                <div style={{ marginTop: 16 }}>
                  <div className="label" style={{ marginBottom: 10 }}>AANTAL GEBRUIKERS <span>*</span></div>
                  <div className="seats-row">
                    {['2', '3', '4', '5'].map(n => (
                      <button key={n} className={`seat-btn${seats === n ? ' active' : ''}`} onClick={() => setSeats(n)}>{n}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="divider" />

            {/* Persoonlijke gegevens */}
            <div className="field">
              <label className="label">NAAM <span>*</span></label>
              <input className="input" placeholder="Voornaam Achternaam" value={form.naam} onChange={e => set('naam', e.target.value)} />
            </div>

            <div className="field">
              <label className="label">EMAILADRES <span>*</span></label>
              <input className="input" type="email" placeholder="naam@bedrijf.nl" value={form.email} onChange={e => set('email', e.target.value)} />
            </div>

            <div className="field">
              <label className="label">BEDRIJFSNAAM <span>*</span></label>
              <input className="input" placeholder="Bedrijf B.V." value={form.bedrijf} onChange={e => set('bedrijf', e.target.value)} />
            </div>

            <div className="field">
              <label className="label">HOE HEEFT U ONS GEVONDEN?</label>
              <select className="input" value={form.hoe} onChange={e => set('hoe', e.target.value)}>
                <option value="">Selecteer een optie</option>
                {HOW_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>

            <div className="field">
              <label className="label">GEWENSTE STARTDATUM</label>
              <input className="input" type="date" value={form.startdatum} onChange={e => set('startdatum', e.target.value)}
                style={{ colorScheme: 'dark' }} />
            </div>

            <div className="field">
              <label className="label">OPMERKINGEN OF VRAGEN</label>
              <textarea className="input" placeholder="Stel een vraag of geef extra context..." value={form.opmerkingen} onChange={e => set('opmerkingen', e.target.value)} />
            </div>

            <div className="divider" />

            {/* Akkoord */}
            <div className="check-row" onClick={() => set('voorwaarden', !form.voorwaarden)}>
              <div className={`check-box${form.voorwaarden ? ' checked' : ''}`} />
              <div className="check-label">
                Ik ga akkoord met de <a href="/voorwaarden" onClick={e => e.stopPropagation()}>algemene voorwaarden</a> en <a href="/privacy" onClick={e => e.stopPropagation()}>privacyverklaring</a> van Royal Dutch Sales. <span style={{ color: '#f59e0b' }}>*</span>
              </div>
            </div>

            <div className="check-row" onClick={() => set('marketing', !form.marketing)}>
              <div className={`check-box${form.marketing ? ' checked' : ''}`} />
              <div className="check-label">
                Ja, ik wil tips, updates en salesinzichten ontvangen van Royal Dutch Sales. Afmelden kan altijd.
              </div>
            </div>

            <div className="divider" />

            {error && <div className="error">{error}</div>}

            <button className="submit-btn" onClick={handleSubmit} disabled={loading}>
              {loading ? 'VERZENDEN...' : 'AANMELDEN VOOR 8 DAGEN GRATIS'}
            </button>

            <p style={{ marginTop: 16, fontSize: 11, color: '#4b5563', textAlign: 'center', lineHeight: 1.7 }}>
              Na aanmelding ontvang je binnen 24 uur een bevestiging. Geen automatische afschrijving. Geen creditcard nodig.
            </p>

          </div>
        )}
      </div>

      <footer>
        <span className="footer-logo">Royal Dutch Sales</span>
        <span className="footer-copy">© Since 2007 · CC BY-ND 4.0</span>
      </footer>
    </>
  );
}
