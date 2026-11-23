'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function BeoordeeldKnop({ id }: { id: number }) {
  const router = useRouter()
  const [bezig, setBezig] = useState(false)
  const [klaar, setKlaar] = useState(false)
  const [fout, setFout] = useState(false)

  if (klaar) return null

  async function markeer() {
    setBezig(true)
    setFout(false)
    try {
      const res = await fetch('/api/admin/mobiel/beoordeeld', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (res.ok) {
        setKlaar(true)
        router.refresh()
      } else {
        setFout(true)
      }
    } catch {
      setFout(true)
    } finally {
      setBezig(false)
    }
  }

  return (
    <button
      onClick={markeer}
      disabled={bezig}
      style={{
        minHeight: 44, minWidth: 44, padding: '0 16px', background: '#111827', color: fout ? '#cc4444' : '#44cc88',
        border: `1.5px solid ${fout ? '#cc4444' : '#374151'}`, borderRadius: 4, fontSize: 13, letterSpacing: 2,
        fontWeight: 700, cursor: 'pointer', opacity: bezig ? 0.5 : 1,
      }}
    >
      {fout ? 'MISLUKT' : 'BEOORDEELD'}
    </button>
  )
}
