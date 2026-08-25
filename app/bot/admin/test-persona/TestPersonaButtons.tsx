'use client'

import { useState } from 'react'

const PERSONAS: { value: string; label: string }[] = [
  { value: 'verkoper', label: 'VERKOPER' },
  { value: 'teammanager', label: 'TEAMMANAGER' },
  { value: 'teamlid', label: 'TEAMLID' },
  { value: 'ceo', label: 'CEO/DGA' },
  { value: 'solopreneur', label: 'SOLOPRENEUR' },
]

export default function TestPersonaButtons({ initial }: { initial: string }) {
  const [active, setActive] = useState(initial)
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function switchTo(persona: string) {
    if (persona === active || loading) return
    setLoading(persona)
    setError('')
    try {
      const res = await fetch('/api/admin/test-persona', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ persona }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error || 'Omzetten mislukt')
      }
      setActive(persona)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Omzetten mislukt')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {PERSONAS.map(p => (
          <button
            key={p.value}
            onClick={() => switchTo(p.value)}
            disabled={!!loading}
            style={{
              fontSize: '12px',
              letterSpacing: '2px',
              fontWeight: 700,
              padding: '8px 16px',
              borderRadius: 999,
              border: 'none',
              cursor: loading ? 'wait' : 'pointer',
              background: active === p.value ? '#f59e0b' : '#1e293b',
              color: active === p.value ? '#111827' : '#9ca3af',
              transition: 'all 0.15s',
            }}
          >
            {loading === p.value ? 'BEZIG...' : p.label}
          </button>
        ))}
      </div>
      {error && <p style={{ fontSize: '12px', color: '#cc2200', marginTop: 16 }}>{error}</p>}
    </div>
  )
}
