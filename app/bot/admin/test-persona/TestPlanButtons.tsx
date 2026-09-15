'use client'

import { useState } from 'react'
import { MANUAL_TEST_USER_ID } from '@/lib/internalTestAccounts'

// Databasewaarde blijft basis/premium/team, alleen het label volgt de marketingnaam
// (zelfde conventie als app/bot/admin/gebruikers/PlanToggle.tsx).
const PLANS: { value: 'basis' | 'premium' | 'team'; label: string }[] = [
  { value: 'basis', label: 'BASIC' },
  { value: 'premium', label: 'PRO' },
  { value: 'team', label: 'TEAM' },
]

export default function TestPlanButtons({ initial }: { initial: 'basis' | 'premium' | 'team' }) {
  const [active, setActive] = useState(initial)
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function switchTo(plan: 'basis' | 'premium' | 'team') {
    if (plan === active || loading) return
    setLoading(plan)
    setError('')
    try {
      const res = await fetch('/api/admin/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: MANUAL_TEST_USER_ID, plan }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error || 'Omzetten mislukt')
      }
      setActive(plan)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Omzetten mislukt')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {PLANS.map(p => (
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
