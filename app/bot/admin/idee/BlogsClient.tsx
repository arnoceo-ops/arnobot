'use client'

import { useState } from 'react'

const periods = [
  { label: 'DEZE WEEK', days: 7 },
  { label: 'DEZE MAAND', days: 30 },
  { label: 'DIT KWARTAAL', days: 90 },
]

export default function BlogsClient() {
  const [selected, setSelected] = useState(7)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ analyse: string | null; count: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function generate() {
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch('/api/admin/blogs-analyse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: selected }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Fout')
      setResult(data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Er ging iets mis')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      {/* Periode-knoppen */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 32 }}>
        {periods.map(p => (
          <button
            key={p.days}
            onClick={() => { setSelected(p.days); setResult(null) }}
            style={{
              fontFamily: 'monospace',
              fontSize: 13,
              letterSpacing: 3,
              fontWeight: 700,
              padding: '8px 20px',
              borderRadius: 4,
              border: '1px solid',
              borderColor: selected === p.days ? '#f59e0b' : '#374151',
              background: selected === p.days ? '#1e293b' : 'transparent',
              color: selected === p.days ? '#f59e0b' : '#6b7280',
              cursor: 'pointer',
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Genereer-knop */}
      <button
        onClick={generate}
        disabled={loading}
        style={{
          fontFamily: 'monospace',
          fontSize: 14,
          letterSpacing: 3,
          fontWeight: 700,
          padding: '12px 32px',
          borderRadius: 4,
          border: 'none',
          background: loading ? '#374151' : '#f59e0b',
          color: loading ? '#6b7280' : '#111827',
          cursor: loading ? 'wait' : 'pointer',
          marginBottom: 40,
        }}
      >
        {loading ? 'BEZIG...' : 'GENEREER ANALYSE →'}
      </button>

      {error && (
        <p style={{ color: '#cc2200', fontSize: 14, letterSpacing: 1 }}>✗ {error}</p>
      )}

      {result && result.analyse === null && (
        <p style={{ color: '#6b7280', fontSize: 14, letterSpacing: 1 }}>
          Geen gesprekken gevonden in deze periode.
        </p>
      )}

      {result?.analyse && (
        <div>
          <p style={{ color: '#6b7280', fontSize: 12, letterSpacing: 2, marginBottom: 24 }}>
            {result.count} gesprekken geanalyseerd
          </p>
          <div style={{
            background: '#1f2937',
            border: '1px solid #374151',
            padding: '32px 36px',
            whiteSpace: 'pre-wrap',
            fontSize: 15,
            lineHeight: 1.9,
            color: '#9ca3af',
            fontFamily: "'Courier New', monospace",
          }}>
            {result.analyse}
          </div>
        </div>
      )}
    </div>
  )
}
