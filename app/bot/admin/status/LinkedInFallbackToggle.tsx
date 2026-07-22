'use client'

import { useState } from 'react'

export default function LinkedInFallbackToggle({ initialEnabled }: { initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled)
  const [loading, setLoading] = useState(false)

  async function toggle() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/linkedin-fallback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !enabled }),
      })
      if (res.ok) setEnabled(!enabled)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      background: enabled ? '#2a1a0a' : '#1f2937',
      border: enabled ? '1px solid #f59e0b' : 'none',
      borderRadius: 4, padding: '16px 20px', marginBottom: 40,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap',
    }}>
      <div>
        <p style={{ fontFamily: 'sans-serif', fontSize: 12, letterSpacing: 3, color: '#f59e0b', marginBottom: 6 }}>LINKEDIN-FALLBACK</p>
        <p style={{ fontFamily: 'sans-serif', fontSize: 14, color: enabled ? '#f59e0b' : '#6b7280' }}>
          {enabled ? 'AAN, e-mail-inloggen is nu zichtbaar op de inlogpagina' : 'Uit, alleen inloggen via LinkedIn mogelijk'}
        </p>
      </div>
      <button
        onClick={toggle}
        disabled={loading}
        style={{
          fontFamily: 'sans-serif', fontSize: 12, letterSpacing: 2,
          padding: '8px 20px', borderRadius: 999,
          border: enabled ? '1px solid #f59e0b' : '1px solid #374151',
          background: enabled ? '#f59e0b' : 'transparent',
          color: enabled ? '#111827' : '#9ca3af',
          cursor: loading ? 'wait' : 'pointer', flexShrink: 0,
        }}
      >
        {enabled ? 'ZET UIT' : 'ZET AAN'}
      </button>
    </div>
  )
}
