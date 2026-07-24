'use client'

import { useState } from 'react'

export default function CommandManagerToggle({ userId, initial }: { userId: string; initial: boolean }) {
  const [active, setActive] = useState(initial)
  const [loading, setLoading] = useState(false)

  async function toggle() {
    const next = !active
    setLoading(true)
    try {
      const res = await fetch('/api/admin/command-manager', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, commandManager: next }),
      })
      if (res.ok) setActive(next)
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
        borderRadius: 999,
        border: 'none',
        cursor: loading ? 'wait' : 'pointer',
        background: active ? '#22c55e' : '#374151',
        color: active ? '#111827' : '#9ca3af',
        transition: 'all 0.15s',
        minWidth: 68,
      }}
    >
      {active ? 'MANAGER' : 'GEEN'}
    </button>
  )
}
