'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const input: React.CSSProperties = { fontSize: 13, padding: '4px 8px', borderRadius: 4, border: '1px solid #374151', background: '#111827', color: '#f1f5f9' }
const btn: React.CSSProperties = { fontSize: 12, letterSpacing: 1, fontWeight: 700, padding: '6px 12px', borderRadius: 4, border: 'none', cursor: 'pointer', background: '#374151', color: '#f1f5f9' }

export default function TeamFactuurActies({ factuurId, status, vandaag }: { factuurId: string; status: string; vandaag: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [datum, setDatum] = useState(vandaag)
  const [bezig, setBezig] = useState(false)
  const [melding, setMelding] = useState<{ tekst: string; kleur: string } | null>(null)

  const actie = status === 'paid' ? 'teruggedraaid' : ['open', 'overdue', 'expired'].includes(status) ? 'betaald_bank' : null

  async function bevestig() {
    setBezig(true)
    setMelding(null)
    const res = await fetch('/api/admin/teams/factuur', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ factuurId, actie, betaaldOp: datum }),
    })
    const data = await res.json().catch(() => ({}))
    setBezig(false)
    if (!res.ok) {
      setMelding({ tekst: String(data.error ?? 'Mislukt'), kleur: '#ef4444' })
      return
    }
    setOpen(false)
    if (data.waarschuwing) setMelding({ tekst: String(data.waarschuwing), kleur: '#f59e0b' })
    router.refresh()
  }

  return (
    <>
      {actie && !open && (
        <button onClick={() => { setOpen(true); setMelding(null) }} style={btn}>
          {actie === 'betaald_bank' ? 'BETAALD PER BANK' : 'TERUGGEDRAAID'}
        </button>
      )}
      {actie && open && (
        <span style={{ display: 'inline-flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
          <span style={{ color: '#cbd5e1' }}>
            {actie === 'betaald_bank'
              ? 'Ontvangen op deze datum. De betaallink gaat uit. Afletteren in Moneybird doe je zelf.'
              : 'Alleen vastleggen. Geld, creditnota en blokkade regel je zelf. Niet ongedaan te maken.'}
          </span>
          {actie === 'betaald_bank' && <input type="date" value={datum} max={vandaag} onChange={e => setDatum(e.target.value)} style={input} />}
          <button onClick={bevestig} disabled={bezig} style={{ ...btn, background: '#f59e0b', color: '#111827' }}>{bezig ? 'BEZIG...' : 'BEVESTIG'}</button>
          <button onClick={() => setOpen(false)} disabled={bezig} style={btn}>ANNULEER</button>
        </span>
      )}
      {melding && <p style={{ fontSize: 13, color: melding.kleur, marginTop: 4 }}>{melding.tekst}</p>}
    </>
  )
}
