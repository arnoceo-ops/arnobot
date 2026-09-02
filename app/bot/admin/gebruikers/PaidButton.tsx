'use client'

import { useState } from 'react'

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

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
  const [comped, setComped] = useState(!paidAt && !!expiresAt)
  const [compDate, setCompDate] = useState(!paidAt && expiresAt ? expiresAt : null)
  const [expanded, setExpanded] = useState(false)
  const [expires, setExpires] = useState(expiresAt ? expiresAt.slice(0, 10) : '')
  const [loading, setLoading] = useState<'' | 'paid' | 'comp'>('')

  // Betaald is een bevestigde eindstatus in deze cel: geen verdere actie hier.
  if (paid) {
    return (
      <div style={{ textAlign: 'right' }}>
        <span style={{ fontSize: '12px', letterSpacing: '2px', fontWeight: 700, color: '#22c55e', display: 'block' }}>
          BETAALD
        </span>
        {expiresAt && (
          <span style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginTop: 2 }}>
            t/m {fmtDate(expiresAt)}
          </span>
        )}
      </div>
    )
  }

  async function submit(kind: 'paid' | 'comp') {
    if (!expires) return
    setLoading(kind)
    try {
      const endpoint = kind === 'paid' ? '/api/admin/payment' : '/api/admin/comp'
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, expiresAt: new Date(expires).toISOString() }),
      })
      if (res.ok) {
        if (kind === 'paid') {
          setPaid(true)
        } else {
          setComped(true)
          setCompDate(new Date(expires).toISOString())
          setExpanded(false)
        }
      }
    } finally {
      setLoading('')
    }
  }

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      {comped && compDate ? (
        <button
          onClick={() => setExpanded(v => !v)}
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'right' }}
        >
          <span style={{ fontSize: '12px', letterSpacing: '2px', fontWeight: 700, color: '#22c55e', display: 'block' }}>GRATIS</span>
          <span style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginTop: 2 }}>t/m {fmtDate(compDate)}</span>
        </button>
      ) : (
        <button
          onClick={() => setExpanded(v => !v)}
          style={{
            fontSize: '12px', letterSpacing: '1px', fontWeight: 700,
            padding: '3px 8px', borderRadius: 999, border: '1px solid #374151',
            cursor: 'pointer', background: 'transparent', color: '#9ca3af', whiteSpace: 'nowrap',
          }}
        >
          TOEGANG +
        </button>
      )}

      {expanded && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, marginTop: 4, zIndex: 20,
          width: 190, padding: 10, borderRadius: 6,
          background: '#111827', border: '1px solid #374151',
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          <label style={{ fontSize: '12px', letterSpacing: '2px', color: '#6b7280' }}>
            TOEGANG T/M
          </label>
          <input
            type="date"
            value={expires}
            onChange={e => setExpires(e.target.value)}
            style={{
              fontSize: '12px', padding: '4px 6px', background: '#1f2937',
              border: '1px solid #374151', color: '#f1f5f9', borderRadius: 4, width: '100%',
            }}
          />
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => submit('comp')}
              disabled={!expires || loading !== ''}
              style={{
                flex: 1, fontSize: '12px', letterSpacing: '1px', fontWeight: 700,
                padding: '5px 0', borderRadius: 999, border: 'none',
                cursor: !expires || loading !== '' ? 'not-allowed' : 'pointer',
                background: expires ? '#22c55e' : '#374151',
                color: expires ? '#111827' : '#6b7280',
              }}
            >
              {loading === 'comp' ? '...' : 'GRATIS'}
            </button>
            <button
              onClick={() => submit('paid')}
              disabled={!expires || loading !== ''}
              style={{
                flex: 1, fontSize: '12px', letterSpacing: '1px', fontWeight: 700,
                padding: '5px 0', borderRadius: 999, border: 'none',
                cursor: !expires || loading !== '' ? 'not-allowed' : 'pointer',
                background: expires ? '#f59e0b' : '#374151',
                color: expires ? '#111827' : '#6b7280',
              }}
            >
              {loading === 'paid' ? '...' : 'BETAALD'}
            </button>
          </div>
          <button
            onClick={() => setExpanded(false)}
            style={{
              fontSize: '12px', letterSpacing: '2px', padding: '3px 0', borderRadius: 999,
              border: '1px solid #374151', background: 'transparent', color: '#6b7280', cursor: 'pointer',
            }}
          >
            SLUIT
          </button>
        </div>
      )}
    </div>
  )
}
