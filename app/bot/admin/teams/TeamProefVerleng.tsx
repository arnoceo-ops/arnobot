'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

// VERLENG PROEF: zet de einddatum van de gratis agent-proef van dit team later en heft een blokkade door
// het einde van de proef op. Kan altijd, ook na het einde. Alleen zichtbaar bij een team met een agent-proef.
const btn = {
  fontFamily: 'sans-serif', fontSize: 12, letterSpacing: 2, fontWeight: 700, padding: '6px 16px', borderRadius: 999,
  border: 'none', cursor: 'pointer', background: '#f59e0b', color: '#111827', whiteSpace: 'nowrap',
} as const

export default function TeamProefVerleng({ teamId, standaardDatum }: { teamId: string; standaardDatum: string }) {
  const router = useRouter()
  const [datum, setDatum] = useState(standaardDatum)
  const [status, setStatus] = useState<'idle' | 'bezig' | 'klaar' | 'fout'>('idle')
  const [fout, setFout] = useState('')

  async function verleng() {
    setStatus('bezig')
    const res = await fetch('/api/admin/teams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teamId, verlengProefTot: new Date(`${datum}T23:59:59`).toISOString() }),
    })
    if (res.ok) {
      setStatus('klaar')
      router.refresh()
    } else {
      setFout(String((await res.json().catch(() => ({}))).error ?? ''))
      setStatus('fout')
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', margin: '0 0 12px 2px' }}>
      <input
        type="date" value={datum} onChange={e => setDatum(e.target.value)}
        style={{ fontSize: 13, padding: '4px 8px', background: '#1f2937', border: '1px solid #374151', color: '#f1f5f9', borderRadius: 4 }}
      />
      <button onClick={verleng} disabled={!datum || status === 'bezig'} style={btn}>
        {status === 'bezig' ? 'BEZIG...' : 'VERLENG PROEF'}
      </button>
      {status === 'klaar' && <span style={{ fontSize: 12, color: '#22c55e' }}>Verlengd</span>}
      {status === 'fout' && <span style={{ fontSize: 12, color: '#ef4444' }}>Mislukt{fout ? `: ${fout}` : ''}</span>}
    </div>
  )
}
