'use client'

import { useState } from 'react'

export default function PaidButton({ userId, paidAt }: { userId: string; paidAt: string | null }) {
  const [paid, setPaid] = useState(!!paidAt)
  const [loading, setLoading] = useState(false)

  if (paid) {
    return (
      <span style={{ fontSize: '11px', letterSpacing: '2px', fontWeight: 700, color: '#44cc88' }}>
        BETAALD
      </span>
    )
  }

  async function register() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      if (res.ok) setPaid(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={register}
      disabled={loading}
      style={{
        fontSize: '10px',
        letterSpacing: '1px',
        fontWeight: 700,
        padding: '3px 8px',
        borderRadius: 3,
        border: '1px solid #374151',
        cursor: loading ? 'wait' : 'pointer',
        background: 'transparent',
        color: '#9ca3af',
        transition: 'all 0.15s',
        whiteSpace: 'nowrap',
      }}
    >
      {loading ? '...' : 'BETALING +'}
    </button>
  )
}
