'use client'

import { useState } from 'react'

export default function PaidButton({
  userId,
  paidAt,
  expiresAt,
}: {
  userId: string
  paidAt: string | null
  expiresAt: string | null
}) {
  const [paid, setPaid] = useState(!!paidAt)
  const [expanded, setExpanded] = useState(false)
  const [expires, setExpires] = useState(expiresAt ? expiresAt.slice(0, 10) : '')
  const [loading, setLoading] = useState(false)

  if (paid) {
    return (
      <div style={{ textAlign: 'right' }}>
        <span style={{ fontSize: '12px', letterSpacing: '2px', fontWeight: 700, color: '#22c55e', display: 'block' }}>
          BETAALD
        </span>
        {expiresAt && (
          <span style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginTop: 2 }}>
            t/m {new Date(expiresAt).toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: '2-digit' })}
          </span>
        )}
      </div>
    )
  }

  async function register() {
    if (!expires) return
    setLoading(true)
    try {
      const res = await fetch('/api/admin/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, expiresAt: new Date(expires).toISOString() }),
      })
      if (res.ok) setPaid(true)
    } finally {
      setLoading(false)
    }
  }

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        style={{
          fontSize: '12px', letterSpacing: '1px', fontWeight: 700,
          padding: '3px 8px', borderRadius: 999, border: '1px solid #374151',
          cursor: 'pointer', background: 'transparent', color: '#9ca3af',
          whiteSpace: 'nowrap',
        }}
      >
        BETALING +
      </button>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
      <input
        type="date"
        value={expires}
        onChange={e => setExpires(e.target.value)}
        style={{
          fontSize: '12px', padding: '3px 6px', background: '#111827',
          border: '1px solid #374151', color: '#f1f5f9', borderRadius: 4,
          width: '100%',
        }}
      />
      <div style={{ display: 'flex', gap: 4 }}>
        <button
          onClick={register}
          disabled={loading || !expires}
          style={{
            fontSize: '12px', letterSpacing: '1px', fontWeight: 700,
            padding: '3px 8px', borderRadius: 999, border: 'none',
            cursor: loading || !expires ? 'not-allowed' : 'pointer',
            background: expires ? '#f59e0b' : '#374151',
            color: expires ? '#111827' : '#6b7280',
            whiteSpace: 'nowrap',
          }}
        >
          {loading ? '...' : 'OK'}
        </button>
        <button
          onClick={() => setExpanded(false)}
          style={{
            fontSize: '12px', padding: '3px 6px', borderRadius: 999,
            border: '1px solid #374151', background: 'transparent',
            color: '#6b7280', cursor: 'pointer',
          }}
        >
          ✕
        </button>
      </div>
    </div>
  )
}
