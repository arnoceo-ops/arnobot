'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

// Het blok UPLOADS op de accountpagina (docs/DOCUMENTEN_PLAN.md): het aantal bewaarde documenten en "verwijder alles".
// Alleen voor wie de documentenfunctie heeft: voor iedereen anders geeft de server een 404 en toont dit niets.

const section: React.CSSProperties = { borderTop: '1px solid #374151', paddingTop: '32px', marginBottom: '48px' }
const label: React.CSSProperties = { fontFamily: "'Space Mono', monospace", fontWeight: 400, color: '#f59e0b', fontSize: '13px', letterSpacing: '4px', marginBottom: '16px', display: 'block' }
const body: React.CSSProperties = { fontWeight: 400, color: '#9ca3af', fontSize: '15px', lineHeight: '1.9', marginBottom: '24px' }
const pil: React.CSSProperties = { fontFamily: "'Bebas Neue', sans-serif", fontSize: 13, letterSpacing: 3, padding: '7px 20px', borderRadius: 999, background: 'none', cursor: 'pointer', border: '1px solid #374151', color: '#9ca3af' }

export default function DocumentenBlok() {
  const [aantal, setAantal] = useState<number | null>(null)
  const [bevestig, setBevestig] = useState(false)
  const [bezig, setBezig] = useState(false)
  const [fout, setFout] = useState<string | null>(null)

  useEffect(() => {
    let actueel = true
    fetch('/api/bot/documenten')
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (actueel && d && Array.isArray(d.documenten)) setAantal(d.documenten.length) })
      .catch(() => {})
    return () => { actueel = false }
  }, [])

  if (aantal === null) return null

  async function verwijderAlles() {
    setBezig(true)
    setFout(null)
    try {
      const r = await fetch('/api/bot/documenten/alles', { method: 'DELETE' })
      if (!r.ok) throw new Error('verwijderen mislukt')
      setAantal(0)
      setBevestig(false)
    } catch {
      setFout('Verwijderen mislukt. Probeer het opnieuw.')
    } finally {
      setBezig(false)
    }
  }

  return (
    <div style={section}>
      <p style={label}>JOUW UPLOADS</p>
      <p style={body}>
        {aantal === 0
          ? 'Je hebt geen bewaarde uploads.'
          : `Je hebt ${aantal} ${aantal === 1 ? 'bewaarde upload' : 'bewaarde uploads'}.`}
        {' '}Je beheert ze in je <Link href="/bot/analyses?tab=uploads" style={{ color: '#f59e0b' }}>archief</Link>.
      </p>
      {aantal > 0 && (bevestig ? (
        <div>
          <p style={{ ...body, color: '#f1f5f9', marginBottom: 12 }}>Alle uploads verwijderen? Dit kan niet ongedaan worden gemaakt.</p>
          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={() => setBevestig(false)} style={pil}>ANNULEER</button>
            <button onClick={verwijderAlles} disabled={bezig} style={{ ...pil, borderColor: '#cc2200', color: '#cc2200' }}>{bezig ? 'BEZIG...' : 'JA, VERWIJDER ALLES'}</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setBevestig(true)} style={{ ...pil, borderColor: '#cc2200', color: '#cc2200', fontSize: 16, padding: '10px 28px' }}>VERWIJDER ALLE UPLOADS</button>
      ))}
      {fout && <p style={{ color: '#cc4444', fontSize: 13, marginTop: 12 }}>{fout}</p>}
    </div>
  )
}
