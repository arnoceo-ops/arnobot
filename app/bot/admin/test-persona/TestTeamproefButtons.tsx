'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { TeamproefHuidig } from '@/lib/testTeamproef'

const STANDEN: { value: 'lopend' | 'bijna' | 'coulance' | 'voorbij' | 'betaald40' | 'betaald10' | 'uit'; label: string }[] = [
  { value: 'lopend', label: 'LOPEND (NOG 20 DAGEN)' },
  { value: 'bijna', label: 'BIJNA VOORBIJ (NOG 3 DAGEN)' },
  { value: 'coulance', label: 'COULANCE (NOG 7 DAGEN)' },
  { value: 'voorbij', label: 'VOORBIJ EN GEBLOKKEERD' },
  { value: 'betaald40', label: 'BETAALD (EINDE PERIODE OVER 40 DAGEN)' },
  { value: 'betaald10', label: 'BETAALD (EINDE PERIODE OVER 10 DAGEN)' },
  { value: 'uit', label: 'UIT' },
]

export default function TestTeamproefButtons({ initial }: { initial: TeamproefHuidig }) {
  const [active, setActive] = useState<TeamproefHuidig>(initial)
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function switchTo(stand: string) {
    if (stand === active || loading) return
    setLoading(stand)
    setError('')
    try {
      const res = await fetch('/api/admin/test-teamproef', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stand }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error || 'Omzetten mislukt')
      }
      setActive(stand as TeamproefHuidig)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Omzetten mislukt')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {STANDEN.map(s => (
          <button
            key={s.value}
            onClick={() => switchTo(s.value)}
            disabled={!!loading}
            style={{
              fontSize: '12px', letterSpacing: '2px', fontWeight: 700, padding: '8px 16px', borderRadius: 999, border: 'none',
              cursor: loading ? 'wait' : 'pointer',
              background: active === s.value ? '#f59e0b' : '#1e293b',
              color: active === s.value ? '#111827' : '#9ca3af',
              transition: 'all 0.15s',
            }}
          >
            {loading === s.value ? 'BEZIG...' : s.label}
          </button>
        ))}
      </div>
      {active === 'geactiveerd' && <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: 12 }}>Het testteam is geactiveerd. Kies een stand om opnieuw te beginnen.</p>}
      {error && <p style={{ fontSize: '12px', color: '#cc2200', marginTop: 16 }}>{error}</p>}
    </div>
  )
}
