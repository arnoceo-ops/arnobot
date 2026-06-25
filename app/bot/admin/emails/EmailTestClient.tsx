'use client'

import { useState } from 'react'

const EMAIL_TYPES: { type: string; label: string; description: string }[] = [
  { type: 'dag1',                  label: 'Dag 1',                  description: 'Welkom, waar begin je?' },
  { type: 'dag4',                  label: 'Dag 4',                  description: 'Nog geen gesprek gevoerd' },
  { type: 'first_conversation',    label: 'Eerste gesprek',         description: 'Na het eerste gesprek' },
  { type: 'dag14',                 label: 'Dag 14',                 description: 'Halverwege de trial' },
  { type: 'first_coaching',        label: 'Eerste coaching',        description: 'Na 5+ sessies, nog geen rapport' },
  { type: 'dag25',                 label: 'Dag 25',                 description: 'Trial bijna afgelopen, opt-in CTA' },
  { type: 'betaalwaarschuwing',    label: 'Betaalwaarschuwing',     description: '7 dagen na opt-in, geen betaling' },
  { type: 'geblokkeerd',           label: 'Geblokkeerd',            description: '24u na waarschuwing, geen betaling' },
  { type: 'trial_afgelopen',       label: 'Trial afgelopen',        description: 'Dag 30, nooit opt-in gedaan' },
  { type: 'opzegging_bevestiging', label: 'Opzegging bevestiging',  description: 'Na opzegging via account pagina' },
]

export default function EmailTestClient() {
  const [sending, setSending] = useState<string | null>(null)
  const [results, setResults] = useState<Record<string, 'ok' | 'error'>>({})

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {EMAIL_TYPES.map(({ type, label, description }) => (
        <div key={type} style={{
          display: 'grid',
          gridTemplateColumns: '180px 1fr auto',
          alignItems: 'center',
          gap: 24,
          background: '#1f2937',
          padding: '16px 24px',
          borderLeft: `3px solid ${results[type] === 'ok' ? '#44cc88' : results[type] === 'error' ? '#cc2200' : '#374151'}`,
        }}>
          <div>
            <p style={{ fontWeight: 700, fontSize: 14, color: '#f1f5f9', letterSpacing: 1 }}>{label}</p>
          </div>
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
