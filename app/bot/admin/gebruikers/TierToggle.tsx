'use client'

import { useState } from 'react'

export default function TierToggle({ userId, currentTier }: { userId: string; currentTier: 'basis' | 'pro' }) {
  const [tier, setTier] = useState(currentTier)
  const [loading, setLoading] = useState(false)

  async function toggle() {
    const newTier = tier === 'pro' ? 'basis' : 'pro'
    setLoading(true)
    try {
      const res = await fetch('/api/admin/tier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, tier: newTier }),
      })
      if (res.ok) setTier(newTier)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      style={{
        fontSize: '12px',
        letterSpacing: '2px',
        fontWeight: 700,
        padding: '3px 8px',
        borderRadius: 3,
        border: 'none',
        cursor: loading ? 'wait' : 'pointer',
        background: tier === 'pro' ? '#f59e0b' : '#374151',
        color: tier === 'pro' ? '#111827' : '#9ca3af',
        transition: 'all 0.15s',
        minWidth: 52,
      }}
    >
      {tier.toUpperCase()}
    </button>
  )
}
