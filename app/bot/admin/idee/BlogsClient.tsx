'use client'

import { useState, useEffect } from 'react'

type SavedAnalyse = {
  id: string
  created_at: string
  period_days: number
  session_count: number
  analyse_text: string
}

const periods = [
  { label: 'DEZE WEEK', days: 7 },
  { label: 'DEZE MAAND', days: 30 },
  { label: 'DIT KWARTAAL', days: 90 },
]

function periodLabel(days: number) {
  if (days === 7) return 'WEEK'
  if (days === 30) return 'MAAND'
  return 'KWARTAAL'
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function BlogsClient() {
  const [selected, setSelected] = useState(7)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [analyses, setAnalyses] = useState<SavedAnalyse[]>([])
  const [archiveLoading, setArchiveLoading] = useState(true)
  const [openIds, setOpenIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetch('/api/admin/blogs-analyse')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setAnalyses(data) })
      .catch(() => {})
      .finally(() => setArchiveLoading(false))
  }, [])

  function toggleOpen(id: string) {
    setOpenIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function generate() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/blogs-analyse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: selected }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Fout')
      if (data.analyse && data.id) {
        const newItem: SavedAnalyse = {
          id: data.id,
          created_at: new Date().toISOString(),
          period_days: selected,
          session_count: data.count,
          analyse_text: data.analyse,
        }
        setAnalyses(prev => [newItem, ...prev])
        setOpenIds(prev => new Set(prev).add(data.id))
      } else if (!data.analyse) {
        setError('Geen gesprekken gevonden in deze periode.')
      }
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
            onClick={() => setSelected(p.days)}
            style={{
              fontFamily: "'Space Mono', monospace",
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
          fontFamily: "'Space Mono', monospace",
          fontSize: 13,
          letterSpacing: 3,
          fontWeight: 700,
          padding: '12px 32px',
          borderRadius: 4,
          border: 'none',
          background: loading ? '#374151' : '#f59e0b',
          color: loading ? '#6b7280' : '#111827',
          cursor: loading ? 'wait' : 'pointer',
          marginBottom: 48,
        }}
      >
        {loading ? 'BEZIG...' : 'GENEREER ANALYSE →'}
      </button>

      {error && (
        <p style={{ color: '#cc2200', fontSize: 14, letterSpacing: 1, marginBottom: 32 }}>✗ {error}</p>
      )}

      {/* Archief */}
      {archiveLoading ? (
        <p style={{ color: '#374151', fontSize: 13, letterSpacing: 2 }}>Laden...</p>
      ) : analyses.length === 0 ? (
        <p style={{ color: '#374151', fontSize: 13, letterSpacing: 2 }}>Nog geen analyses gegenereerd.</p>
      ) : (
        <div>
          <p style={{ color: '#f59e0b', fontSize: 13, fontWeight: 700, letterSpacing: 4, marginBottom: 16 }}>
            ARCHIEF
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {analyses.map(a => {
              const isOpen = openIds.has(a.id)
              return (
                <div key={a.id} style={{ background: '#1f2937', border: '1px solid #374151' }}>
                  <button
                    onClick={() => toggleOpen(a.id)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 16,
                      padding: '16px 20px',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <span style={{ color: '#374151', fontSize: 12, flexShrink: 0 }}>
                      {isOpen ? '▼' : '▶'}
                    </span>
                    <span style={{ color: '#f59e0b', fontSize: 12, letterSpacing: 3, fontWeight: 700, flexShrink: 0 }}>
                      {periodLabel(a.period_days)}
                    </span>
                    <span style={{ color: '#9ca3af', fontSize: 13, flexShrink: 0 }}>
                      {formatDate(a.created_at)}
                    </span>
                    <span style={{ color: '#4b5563', fontSize: 12, letterSpacing: 1 }}>
                      {a.session_count} gesprekken
                    </span>
                  </button>
                  {isOpen && (
                    <div style={{
                      padding: '0 20px 24px 20px',
                      whiteSpace: 'pre-wrap',
                      fontSize: 15,
                      lineHeight: 1.9,
                      color: '#9ca3af',
                      fontFamily: "'Courier New', monospace",
                      borderTop: '1px solid #374151',
                      paddingTop: 20,
                    }}>
                      {a.analyse_text}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
