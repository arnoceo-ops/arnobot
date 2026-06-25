'use client'

import { useState, useEffect } from 'react'

type Template = { type: string; label: string; description: string }

export default function EmailTestClient() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [sending, setSending] = useState<string | null>(null)
  const [results, setResults] = useState<Record<string, 'ok' | 'error'>>({})

  useEffect(() => {
    fetch('/api/admin/test-email')
      .then(r => r.json())
      .then(d => setTemplates(d.templates ?? []))
      .catch(() => {})
  }, [])

  async function send(type: string) {
    setSending(type)
    try {
      const res = await fetch('/api/admin/test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      })
      setResults(r => ({ ...r, [type]: res.ok ? 'ok' : 'error' }))
    } catch {
      setResults(r => ({ ...r, [type]: 'error' }))
    } finally {
      setSending(null)
    }
  }

  if (!templates.length) return (
    <p style={{ fontSize: 13, color: '#4b5563', letterSpacing: 1 }}>Laden...</p>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {templates.map(({ type, label, description }) => (
        <div key={type} style={{
          display: 'grid',
          gridTemplateColumns: '180px 1fr auto',
          alignItems: 'center',
          gap: 24,
          background: '#1f2937',
          padding: '16px 24px',
          borderLeft: `3px solid ${results[type] === 'ok' ? '#44cc88' : results[type] === 'error' ? '#cc2200' : '#374151'}`,
        }}>
          <p style={{ fontWeight: 700, fontSize: 14, color: '#f1f5f9', letterSpacing: 1 }}>{label}</p>
          <p style={{ fontSize: 13, color: '#6b7280', letterSpacing: 1 }}>{description}</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {results[type] === 'ok' && (
              <span style={{ fontSize: 12, color: '#44cc88', letterSpacing: 2 }}>VERZONDEN</span>
            )}
            {results[type] === 'error' && (
              <span style={{ fontSize: 12, color: '#cc2200', letterSpacing: 2 }}>FOUT</span>
            )}
            <button
              onClick={() => send(type)}
              disabled={sending === type}
              style={{
                fontFamily: 'monospace',
                fontSize: 12,
                letterSpacing: 2,
                fontWeight: 700,
                padding: '6px 16px',
                borderRadius: 3,
                border: '1px solid #374151',
                cursor: sending === type ? 'wait' : 'pointer',
                background: 'transparent',
                color: sending === type ? '#4b5563' : '#9ca3af',
                transition: 'all 0.15s',
                whiteSpace: 'nowrap',
              }}
            >
              {sending === type ? 'BEZIG...' : 'STUUR TEST →'}
            </button>
          </div>
        </div>
      ))}
      <p style={{ marginTop: 24, fontSize: 12, color: '#4b5563', letterSpacing: 1 }}>
        Alle tests worden verzonden naar arno@arno.bot. Onderwerp bevat [TEST] prefix.
      </p>
    </div>
  )
}
