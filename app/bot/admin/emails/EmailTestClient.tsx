'use client'

import { useState, useEffect } from 'react'

type Template = { type: string; label: string; description: string; category: 'user' | 'admin' }

const sectionLabel: React.CSSProperties = {
  fontFamily: 'monospace',
  fontSize: 13,
  letterSpacing: 4,
  color: '#f59e0b',
  fontWeight: 400,
  marginBottom: 12,
  marginTop: 0,
}

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

  const userTemplates = templates.filter(t => t.category === 'user')
  const adminTemplates = templates.filter(t => t.category === 'admin')

  function renderRow({ type, label, description }: Template) {
    return (
      <div key={type} style={{
        display: 'grid',
        gridTemplateColumns: '200px 1fr auto',
        alignItems: 'center',
        gap: 24,
        background: '#1f2937',
        padding: '16px 24px',
        borderLeft: `3px solid ${results[type] === 'ok' ? '#44cc88' : results[type] === 'error' ? '#cc2200' : '#374151'}`,
      }}>
        <p style={{ fontWeight: 700, fontSize: 14, color: '#f1f5f9', letterSpacing: 1, margin: 0 }}>{label}</p>
        <p style={{ fontSize: 13, color: '#6b7280', letterSpacing: 1, margin: 0 }}>{description}</p>
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
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 48 }}>
      <div>
        <p style={sectionLabel}>NAAR GEBRUIKERS</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {userTemplates.map(renderRow)}
        </div>
      </div>

      <div>
        <p style={sectionLabel}>NAAR MIJZELF</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {adminTemplates.map(renderRow)}
        </div>
      </div>

      <p style={{ fontSize: 12, color: '#4b5563', letterSpacing: 1, marginTop: -24 }}>
        Gebruikerstests worden verzonden naar arno@arno.bot. Dagelijkse activiteit stuurt de echte mail met live data.
      </p>
    </div>
  )
}
