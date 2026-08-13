'use client'

import { useEffect, useState } from 'react'

interface OpenActie {
  session_id: string
  uitdaging: string
  created_at: string
}

function formatDateShort(iso: string) {
  return new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
}

export default function OpenActiesWidget() {
  const [acties, setActies] = useState<OpenActie[]>([])
  const [loading, setLoading] = useState(true)
  const [beantwoord, setBeantwoord] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetch('/api/bot/open-acties')
      .then(r => r.json())
      .then(d => setActies(d.acties ?? []))
      .finally(() => setLoading(false))
  }, [])

  function beantwoordActie(sessionId: string, status: 'ja' | 'deels' | 'nee') {
    setBeantwoord(prev => new Set(prev).add(sessionId))
    fetch('/api/bot/actieopvolging', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, status }),
    }).catch(() => {})
  }

  const zichtbaar = acties.filter(a => !beantwoord.has(a.session_id))
  if (loading || zichtbaar.length === 0) return null

  return (
    <div style={{ marginBottom: 48 }}>
      <p style={{ fontFamily: "'Space Mono', monospace", fontWeight: 400, color: '#f59e0b', fontSize: 13, letterSpacing: 4, marginBottom: 12 }}>
        OPENSTAANDE ACTIES
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {zichtbaar.map(actie => (
          <div key={actie.session_id} style={{ background: '#1f2937', padding: 'clamp(16px,3vw,24px)', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 12, color: '#6b7280', letterSpacing: 1 }}>{formatDateShort(actie.created_at)}</span>
              <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 15, fontWeight: 400, lineHeight: 1.9, color: '#9ca3af', marginTop: 4 }}>{actie.uitdaging}</p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {([
                { label: 'JA, GEDAAN', status: 'ja' as const, primary: true },
                { label: 'INGEPLAND', status: 'deels' as const, primary: false },
                { label: 'NOG NIET', status: 'nee' as const, primary: false },
              ] as const).map(({ label, status, primary }) => (
                <button
                  key={status}
                  onClick={() => beantwoordActie(actie.session_id, status)}
                  style={{
                    flex: 1,
                    fontFamily: "'Bebas Neue', sans-serif", fontSize: 15, letterSpacing: 2,
                    padding: '9px 4px', borderRadius: 999, cursor: 'pointer',
                    background: primary ? '#f59e0b' : 'none',
                    color: primary ? '#111827' : '#9ca3af',
                    border: primary ? 'none' : '1px solid #374151',
                    transition: 'all 0.15s',
                  }}
                >{label}</button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
