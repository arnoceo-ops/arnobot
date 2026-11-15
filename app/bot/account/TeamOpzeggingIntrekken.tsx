'use client'

import { useState } from 'react'

// Knop om de opzegging van het team in te trekken, voor de manager, tot en met de dag vóór de einddatum
// (docs/TEAM_PROCES.md, fase 6). De server controleert de datum nog eens; deze knop verdwijnt alleen eerder.
export default function TeamOpzeggingIntrekken({ stoptOp, onIngetrokken }: { stoptOp: string; onIngetrokken: () => void }) {
  const [bezig, setBezig] = useState(false)
  const [fout, setFout] = useState<string | null>(null)

  if (new Date().toISOString().slice(0, 10) >= stoptOp.slice(0, 10)) return null

  async function trekIn() {
    setBezig(true)
    setFout(null)
    try {
      const res = await fetch('/api/bot/team/opzegging-intrekken', { method: 'POST' })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setFout(d.error || 'Intrekken is niet gelukt.'); return }
      onIngetrokken()
    } catch {
      setFout('Intrekken is niet gelukt. Probeer het zo opnieuw.')
    } finally {
      setBezig(false)
    }
  }

  return (
    <div style={{ marginBottom: 24 }}>
      <button
        onClick={trekIn}
        disabled={bezig}
        style={{ padding: '12px 36px', background: 'transparent', color: '#f59e0b', border: '1px solid #f59e0b', fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 3, cursor: bezig ? 'not-allowed' : 'pointer', borderRadius: 999, minWidth: 260, textAlign: 'center' }}
      >
        {bezig ? 'VERWERKEN...' : 'OPZEGGING INTREKKEN'}
      </button>
      {fout && <p style={{ color: '#cc2200', fontSize: 14, letterSpacing: 1, lineHeight: 1.6, marginTop: 16 }}>{fout}</p>}
    </div>
  )
}
