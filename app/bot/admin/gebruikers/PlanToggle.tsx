'use client'

import { useState } from 'react'

const PLANS = ['basis', 'premium'] as const
type Plan = typeof PLANS[number] | 'team'

const COLORS: Record<Plan, { bg: string; color: string }> = {
  basis: { bg: '#374151', color: '#9ca3af' },
  premium: { bg: '#f59e0b', color: '#111827' },
  // 'team' is niet meer actief toekenbaar (functieniveau en Command-managerschap zijn
  // losgekoppeld, zie command_manager), maar oudere rijen kunnen deze waarde nog hebben.
  team: { bg: '#22c55e', color: '#111827' },
}

// Databasewaarde blijft basis/premium/team (geen migratie, zie docs/PRICING_DECISIONS.md),
// alleen het getoonde label volgt de huidige marketingnaam (Basic/Pro/Team) i.p.v. de rauwe
// kolomwaarde. 'elite' verwijderd (2026-08-25): de losse €397/mnd Elite-plan had 0 gebruikers
// en is uit het systeem gehaald, zie geheugen project-elite-plan-removal.
const LABELS: Record<Plan, string> = { basis: 'BASIC', premium: 'PRO', team: 'TEAM' }

export default function PlanToggle({ userId, currentPlan }: { userId: string; currentPlan: Plan }) {
  const [plan, setPlan] = useState(currentPlan)
  const [loading, setLoading] = useState(false)

  async function cycle() {
    const idx = (PLANS as readonly string[]).indexOf(plan)
    const nextPlan = PLANS[(idx + 1) % PLANS.length]
    setLoading(true)
    try {
      const res = await fetch('/api/admin/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, plan: nextPlan }),
      })
      if (res.ok) setPlan(nextPlan)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={cycle}
      disabled={loading}
      style={{
        fontSize: '12px',
        letterSpacing: '2px',
        fontWeight: 700,
        padding: '3px 8px',
        borderRadius: 999,
        border: 'none',
        cursor: loading ? 'wait' : 'pointer',
        background: COLORS[plan].bg,
        color: COLORS[plan].color,
        transition: 'all 0.15s',
        minWidth: 68,
      }}
    >
      {LABELS[plan]}
    </button>
  )
}
