'use client'

import { useState } from 'react'

const FREQUENTIE = ['Dagelijks', '2-3x per week', '1x per week', 'Minder dan 1x per week']
const ONDERDELEN = ['ArnoBot chat', 'Bieb', 'Analyses', 'Coaching']
const PERSONA_OPTIES = ['Verkoper', 'Salesbaas', 'Eindbaas', 'Anders']
const AANBEVELEN_OPTIES = ['Ja', 'Misschien', 'Nee']

function Chip({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '8px 18px',
        border: selected ? '2px solid #f59e0b' : '1.5px solid #374151',
        background: selected ? 'rgba(245,158,11,0.12)' : '#1f2937',
        color: selected ? '#f59e0b' : '#9ca3af',
        fontFamily: "'Space Mono', monospace",
        fontSize: 15,
        fontWeight: 400,
        cursor: 'pointer',
        borderRadius: 4,
        transition: 'all 0.15s',
      }}
    >
      {label}
    </button>
  )
}

function Block({ nr, title, sub, children }: { nr: string; title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 48, borderBottom: '1px solid #374151', paddingBottom: 40 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: sub ? 8 : 20 }}>
        <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, letterSpacing: 4, color: '#f59e0b' }}>{nr}</span>
        <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 26, fontWeight: 400, color: '#f1f5f9', margin: 0, letterSpacing: 1 }}>{title}</h3>
      </div>
      {sub && <p style={{ fontSize: 13, color: '#6b7280', letterSpacing: 2, marginBottom: 20 }}>{sub}</p>}
      {children}
    </div>
  )
}

export default function EvaluatiePage() {
  const [frequentie, setFrequentie] = useState('')
  const [onderdelen, setOnderdelen] = useState<string[]>([])
  const [waardevol, setWaardevol] = useState('')
  const [ontbreekt, setOntbreekt] = useState('')
  const [persona, setPersona] = useState<string[]>([])
  const [personaAnders, setPersonaAnders] = useState('')
  const [tariefstelling, setTariefstelling] = useState('')
  const [aanbevelen, setAanbevelen] = useState('')
  const [aanbevelenToelichting, setAanbevelenToelichting] = useState('')
  const [referentie, setReferentie] = useState('')
  const [referentieTekst, setReferentieTekst] = useState('')
  const [naam, setNaam] = useState('')
  const [slotwoord, setSlotwoord] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  function toggleOnderdeel(o: string) {
    setOnderdelen(prev => prev.includes(o) ? prev.filter(x => x !== o) : [...prev, o])
  }

  function togglePersona(o: string) {
    setPersona(prev => prev.includes(o) ? prev.filter(x => x !== o) : [...prev, o])
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!naam.trim()) { setError('Vul je naam in.'); return }
    if (!frequentie || !aanbevelen) { setError('Vul minimaal de meerkeuzevragen in.'); return }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/evaluatie', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ naam, frequentie, onderdelen, waardevol, ontbreekt, persona, personaAnders, tariefstelling, aanbevelen, aanbevelenToelichting, referentie, referentieTekst, slotwoord }),
      })
      if (!res.ok) throw new Error()
      setSent(true)
    } catch {
      setError('Er ging iets mis. Probeer opnieuw.')
    }
    setLoading(false)
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Space+Mono:wght@400;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #111827; color: #f1f5f9; font-family: 'Space Mono', monospace; font-weight: 400; }
        textarea, input[type="text"] {
          width: 100%; background: #1f2937; border: 1.5px solid #374151;
          color: #f1f5f9; font-family: 'Space Mono', monospace;
          font-size: 15px; padding: 12px 16px; border-radius: 4px;
          outline: none; resize: vertical; transition: border-color 0.15s;
        }
        textarea:focus, input[type="text"]:focus { border-color: #f59e0b; }
        .submit-btn { background: #f59e0b; }
        .submit-btn:hover:not(:disabled) { background: #d97706; }
        textarea::placeholder, input[type="text"]::placeholder { color: #4b5563; }
      `}</style>

      <div style={{ maxWidth: 812, margin: '0 auto', padding: 'clamp(80px,12vw,120px) clamp(16px,4vw,20px) 80px' }}>

        <p style={{ fontFamily: "'Space Mono', monospace", fontWeight: 400, color: '#f59e0b', fontSize: 13, letterSpacing: 4, marginBottom: 8 }}>ARNOBOT</p>
        <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 64, letterSpacing: 3, lineHeight: 1, color: '#f1f5f9', marginBottom: 16 }}>EVALUATIE</h1>
        {sent ? (
          <div style={{ background: '#1f2937', borderLeft: '3px solid #f59e0b', padding: '32px 28px' }}>
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, letterSpacing: 2, color: '#f1f5f9', marginBottom: 12 }}>MUITO OBRIGADO</h2>
            <p style={{ fontSize: 15, lineHeight: 1.9, color: '#9ca3af' }}>Je feedback is binnen.</p>
          </div>
        ) : (
          <form onSubmit={submit}>

            <Block nr="" title="Naam">
              <input type="text" value={naam} onChange={e => setNaam(e.target.value)} placeholder="Jouw naam" />
            </Block>

            <Block nr="01" title="Hoe vaak heb je ArnoBot de afgelopen 30 dagen gebruikt?">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {FREQUENTIE.map(f => (
                  <Chip key={f} label={f} selected={frequentie === f} onClick={() => setFrequentie(f)} />
                ))}
              </div>
            </Block>

            <Block nr="02" title="Welke onderdelen heb je gebruikt?" sub="MEERDERE MOGELIJK">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {ONDERDELEN.map(o => (
                  <Chip key={o} label={o} selected={onderdelen.includes(o)} onClick={() => toggleOnderdeel(o)} />
                ))}
              </div>
            </Block>

            <Block nr="03" title="Wat is het meest waardevolle dat ArnoBot je heeft gegeven?">
              <textarea rows={4} value={waardevol} onChange={e => setWaardevol(e.target.value)} placeholder="Concreet, graag." />
            </Block>

            <Block nr="04" title="Wat ontbreekt er, of werkt niet zoals je verwacht?">
              <textarea rows={4} value={ontbreekt} onChange={e => setOntbreekt(e.target.value)} placeholder="Geen sugarcoating nodig." />
            </Block>

            <Block nr="05" title="Wat is de ideale doelgroep voor ArnoBot?" sub="MEERDERE MOGELIJK">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: persona.includes('Anders') ? 16 : 0 }}>
                {PERSONA_OPTIES.map(o => (
                  <Chip key={o} label={o} selected={persona.includes(o)} onClick={() => togglePersona(o)} />
                ))}
              </div>
              {persona.includes('Anders') && (
                <input type="text" value={personaAnders} onChange={e => setPersonaAnders(e.target.value)} placeholder="Ik ben benieuwd." style={{ marginTop: 16 }} />
              )}
            </Block>

            <Block nr="06" title="Wat vind je van de tariefstelling?" sub="€97 P/M — 4 MAANDEN GRATIS: €777 P/J — PER GEBRUIKER">
              <textarea rows={3} value={tariefstelling} onChange={e => setTariefstelling(e.target.value)} placeholder="Te duur, precies goed, te laag? Graag met onderbouwing." />
            </Block>

            <Block nr="07" title="Zou je ArnoBot aan anderen aanbevelen?">
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                {AANBEVELEN_OPTIES.map(o => (
                  <Chip key={o} label={o} selected={aanbevelen === o} onClick={() => setAanbevelen(o)} />
                ))}
              </div>
              {aanbevelen === 'Ja' && (
                <div style={{ background: '#1f2937', borderLeft: '3px solid #f59e0b', padding: '16px 20px' }}>
                  <p style={{ fontSize: 15, lineHeight: 1.9, color: '#9ca3af' }}>
                    Gebruik dan de referral code op de accountpagina. Per betalende referral ontvang je €97 tegoed, automatisch verrekend op je volgende factuur.
                  </p>
                </div>
              )}
              {aanbevelen === 'Misschien' && (
                <input type="text" value={aanbevelenToelichting} onChange={e => setAanbevelenToelichting(e.target.value)} placeholder="Wat zou je over de streep trekken?" />
              )}
              {aanbevelen === 'Nee' && (
                <input type="text" value={aanbevelenToelichting} onChange={e => setAanbevelenToelichting(e.target.value)} placeholder="😰 Nee, toch...?" />
              )}
            </Block>

            <Block nr="08" title="Zou je een wervelende aanbeveling willen schrijven als user reference op de landing page?">
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: referentie === 'Tuurlijk' ? 16 : 0 }}>
                {['Tuurlijk', 'Nope'].map(o => (
                  <Chip key={o} label={o} selected={referentie === o} onClick={() => setReferentie(o)} />
                ))}
              </div>
              {referentie === 'Tuurlijk' && (
                <textarea rows={4} value={referentieTekst} onChange={e => setReferentieTekst(e.target.value)} placeholder="Go go, Gadget!" />
              )}
            </Block>

            <Block nr="09" title="Is er iets wat nog gezegd wil worden?">
              <textarea rows={4} value={slotwoord} onChange={e => setSlotwoord(e.target.value)} placeholder="Ja? Dat kan dan hier." />
            </Block>

            {error && (
              <p style={{ fontSize: 14, color: '#cc2200', letterSpacing: 1, marginBottom: 24 }}>{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="submit-btn"
              style={{
                fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 3,
                padding: '12px 36px', borderRadius: 999, border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                background: loading ? '#374151' : undefined, color: '#111827',
                transition: 'background 0.15s',
              }}
            >
              {loading ? 'VERSTUREN...' : 'VERSTUUR EVALUATIE'}
            </button>

          </form>
        )}
      </div>
    </>
  )
}
