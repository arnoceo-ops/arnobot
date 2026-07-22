'use client'

import { useState } from 'react'

const PLANS = ['basis', 'premium', 'team'] as const
type Plan = typeof PLANS[number]

const COLORS: Record<Plan, { bg: string; color: string }> = {
  basis: { bg: '#374151', color: '#9ca3af' },
  premium: { bg: '#f59e0b', color: '#111827' },
  team: { bg: '#22c55e', color: '#111827' },
}

export default function PlanToggle({ userId, currentPlan }: { userId: string; currentPlan: Plan }) {
  const [plan, setPlan] = useState(currentPlan)
  const [loading, setLoading] = useState(false)

  async function cycle() {
    const nextPlan = PLANS[(PLANS.indexOf(plan) + 1) % PLANS.length]
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
      {plan.toUpperCase()}
    </button>
  )
}
