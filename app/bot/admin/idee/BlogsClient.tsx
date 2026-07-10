'use client'

import { useState, useEffect, Fragment } from 'react'

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

function renderInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/)
  return parts.map((part, i) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={i} style={{ color: '#f1f5f9', fontWeight: 700 }}>{part.slice(2, -2)}</strong>
      : <Fragment key={i}>{part}</Fragment>
  )
}

function AnalyseText({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/)
  return (
    <div style={{ fontFamily: 'sans-serif', fontSize: 15, lineHeight: 1.9, color: '#9ca3af' }}>
      {blocks.map((block, i) => {
        const trimmed = block.trim()
        if (!trimmed) return null
        if (trimmed === '---') {
          return <hr key={i} style={{ border: 'none', borderTop: '1px solid #374151', margin: '28px 0' }} />
        }
        if (/^[A-ZÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞ\s]+$/.test(trimmed) && trimmed.length < 50) {
          return (
            <p key={i} style={{ fontFamily: 'sans-serif', fontWeight: 700, fontSize: 13, letterSpacing: 4, color: '#f59e0b', margin: '28px 0 12px 0' }}>
              {trimmed}
            </p>
          )
        }
        const lines = trimmed.split('\n')
        return (
          <div key={i} style={{ marginBottom: 24 }}>
            {lines.map((line, j) => {
              const isInvalshoek = line.startsWith('Invalshoek:')
              return (
                <p key={j} style={{ margin: j === 0 ? 0 : '4px 0 0 0', color: isInvalshoek ? '#6b7280' : '#9ca3af', fontSize: isInvalshoek ? 13 : 15 }}>
                  {isInvalshoek
                    ? <><span style={{ color: '#f59e0b', fontWeight: 700 }}>Invalshoek:</span>{renderInline(line.slice('Invalshoek:'.length))}</>
                    : renderInline(line)
                  }
                </p>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

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
              fontFamily: 'sans-serif',
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
          fontFamily: "'Bebas Neue', sans-serif",
          fontSize: 18,
          letterSpacing: 3,
          fontWeight: 400,
          padding: '12px 36px',
          borderRadius: 999,
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
                    <div style={{ padding: '20px 24px 28px 24px', borderTop: '1px solid #374151' }}>
                      <AnalyseText text={a.analyse_text} />
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
