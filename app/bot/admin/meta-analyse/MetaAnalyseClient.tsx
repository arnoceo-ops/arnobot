'use client'

import { useState, useEffect, Fragment } from 'react'

const loadingStyle = `
  .meta-loading { display: flex; align-items: center; gap: 16px; margin-bottom: 32px; }
  .meta-loading-dots { display: flex; gap: 6px; }
  .meta-loading-dot { width: 8px; height: 8px; background: #f59e0b; border-radius: 50%; animation: metaPulse 1.2s ease-in-out infinite; }
  .meta-loading-dot:nth-child(2) { animation-delay: 0.2s; }
  .meta-loading-dot:nth-child(3) { animation-delay: 0.4s; }
  .meta-loading-text { font-size: 11px; letter-spacing: 3px; text-transform: uppercase; color: #6b7280; }
  @keyframes metaPulse { 0%, 100% { opacity: 0.2; transform: scale(0.8); } 50% { opacity: 1; transform: scale(1); } }
`

type MetaInput = {
  id: string
  created_at: string
  content: string
}

type MetaAnalyse = {
  id: string
  created_at: string
  period_days: number
  session_count: number
  zelfbeoordeling_text: string
  expertpanel_text: string
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
    <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 15, lineHeight: 1.9, color: '#9ca3af', wordBreak: 'break-word', overflowWrap: 'break-word' }}>
      {blocks.map((block, i) => {
        const trimmed = block.trim()
        if (!trimmed) return null
        if (/^[A-ZÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞ\s\/0-9]+$/.test(trimmed) && trimmed.length < 60) {
          return (
            <p key={i} style={{ fontFamily: "'Space Mono', monospace", fontWeight: 400, fontSize: 13, letterSpacing: 4, color: '#f59e0b', margin: '28px 0 12px 0' }}>
              {trimmed}
            </p>
          )
        }
        const lines = trimmed.split('\n')
        return (
          <div key={i} style={{ marginBottom: 20 }}>
            {lines.map((line, j) => {
              const isScore = line.startsWith('Score:')
              const isKritisch = line.startsWith('Kritisch punt:')
              const isOverall = line.startsWith('OVERALL SCORE:') || line.startsWith('PANEL CONSENSUS:') || line.startsWith('PRIORITEIT 1:')
              return (
                <p key={j} style={{
                  margin: j === 0 ? 0 : '4px 0 0 0',
                  color: isScore ? '#f1f5f9' : isKritisch ? '#f59e0b' : isOverall ? '#f1f5f9' : '#9ca3af',
                  fontSize: isScore || isOverall ? 14 : 15,
                  fontWeight: isOverall ? 700 : 400,
                }}>
                  {isKritisch
                    ? <><span style={{ color: '#f59e0b', fontWeight: 400 }}>Kritisch punt:</span>{renderInline(line.slice('Kritisch punt:'.length))}</>
                    : isScore
                    ? <><span style={{ color: '#6b7280' }}>Score:</span>{renderInline(line.slice('Score:'.length))}</>
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

export default function MetaAnalyseClient() {
  const [selected, setSelected] = useState(30)
  const [customDays, setCustomDays] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [analyses, setAnalyses] = useState<MetaAnalyse[]>([])
  const [archiveLoading, setArchiveLoading] = useState(true)
  const [openIds, setOpenIds] = useState<Set<string>>(new Set())
  const [activeTab, setActiveTab] = useState<Record<string, 'zelf' | 'panel'>>({})

  const [input, setInput] = useState('')
  const [savedInput, setSavedInput] = useState<MetaInput | null>(null)
  const [inputLoading, setInputLoading] = useState(true)
  const [inputSaving, setInputSaving] = useState(false)
  const [inputSaved, setInputSaved] = useState(false)

  useEffect(() => {
    fetch('/api/admin/meta-analyse')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setAnalyses(data) })
      .catch(() => {})
      .finally(() => setArchiveLoading(false))

    fetch('/api/admin/meta-input')
      .then(r => r.json())
      .then(data => {
        if (data && data.content) {
          setSavedInput(data)
          setInput(data.content)
        }
      })
      .catch(() => {})
      .finally(() => setInputLoading(false))
  }, [])

  async function saveInput() {
    if (!input.trim()) return
    setInputSaving(true)
    setInputSaved(false)
    try {
      const res = await fetch('/api/admin/meta-input', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: input }),
      })
      const data = await res.json()
      if (res.ok) {
        setSavedInput({ id: data.id, created_at: data.created_at, content: input })
        setInputSaved(true)
        setTimeout(() => setInputSaved(false), 3000)
      }
    } catch { /* stil falen */ }
    setInputSaving(false)
  }

  function toggleOpen(id: string) {
    setOpenIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
    setActiveTab(prev => prev[id] ? prev : { ...prev, [id]: 'zelf' })
  }

  function setTab(id: string, tab: 'zelf' | 'panel') {
    setActiveTab(prev => ({ ...prev, [id]: tab }))
  }

  async function generate() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/meta-analyse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: selected }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Fout')
      if (data.zelfbeoordeling && data.id) {
        const newItem: MetaAnalyse = {
          id: data.id,
          created_at: new Date().toISOString(),
          period_days: selected,
          session_count: data.count,
          zelfbeoordeling_text: data.zelfbeoordeling,
          expertpanel_text: data.expertpanel,
        }
        setAnalyses(prev => [newItem, ...prev])
        setOpenIds(prev => new Set(prev).add(data.id))
        setActiveTab(prev => ({ ...prev, [data.id]: 'zelf' }))
      } else {
        setError('Geen gesprekken gevonden in deze periode.')
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Er ging iets mis')
    } finally {
      setLoading(false)
    }
  }

  const tabStyle = (active: boolean): React.CSSProperties => ({
    fontFamily: "'Space Mono', monospace",
    fontSize: 12,
    letterSpacing: 3,
    fontWeight: active ? 700 : 400,
    padding: '6px 16px',
    border: '1px solid',
    borderColor: active ? '#f59e0b' : '#374151',
    background: active ? '#1e293b' : 'transparent',
    color: active ? '#f59e0b' : '#6b7280',
    cursor: 'pointer',
    borderRadius: 2,
  })

  return (
    <div>
      <style>{loadingStyle}</style>
      {/* Jouw maandelijkse input */}
      <div style={{ marginBottom: 56 }}>
        <p style={{ fontFamily: "'Space Mono', monospace", fontWeight: 400, fontSize: 13, letterSpacing: 4, color: '#f59e0b', marginBottom: 8 }}>
          JOUW INPUT VOOR HET PANEL
        </p>
        <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 14, color: '#6b7280', lineHeight: 1.7, marginBottom: 20 }}>
          Schrijf wat je de afgelopen periode opviel aan ArnoBot. Wat herkende je niet? Wat miste er? Wat was raak?
          Dit wordt meegenomen als jouw eigen jurering bij de volgende analyse.
        </p>
        {inputLoading ? (
          <p style={{ color: '#374151', fontSize: 13, letterSpacing: 2 }}>Laden...</p>
        ) : (
          <>
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Arno's observaties"
              style={{
                width: '100%',
                minHeight: 180,
                fontFamily: "'Space Mono', monospace",
                fontSize: 14,
                fontWeight: 400,
                lineHeight: 1.8,
                color: '#f1f5f9',
                background: '#1f2937',
                border: '1.5px solid #374151',
                borderRadius: 4,
                padding: '14px 16px',
                resize: 'vertical',
                outline: 'none',
                boxSizing: 'border-box',
              }}
              onFocus={e => { e.target.style.borderColor = '#f59e0b' }}
              onBlur={e => { e.target.style.borderColor = '#374151' }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 12 }}>
              <button
                onClick={saveInput}
                disabled={inputSaving || !input.trim()}
                style={{
                  fontFamily: "'Bebas Neue', sans-serif",
                  fontSize: 16,
                  letterSpacing: 3,
                  padding: '10px 28px',
                  borderRadius: 999,
                  border: 'none',
                  background: inputSaving || !input.trim() ? '#374151' : '#f59e0b',
                  color: inputSaving || !input.trim() ? '#6b7280' : '#111827',
                  cursor: inputSaving || !input.trim() ? 'default' : 'pointer',
                }}
              >
                {inputSaving ? 'OPSLAAN...' : 'OPSLAAN'}
              </button>
              {inputSaved && (
                <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, color: '#4ade80', letterSpacing: 1 }}>
                  Opgeslagen.
                </span>
              )}
              {savedInput && !inputSaved && (
                <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 12, color: '#4b5563', letterSpacing: 1 }}>
                  Laatste opslag: {new Date(savedInput.created_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })}
                </span>
              )}
            </div>
          </>
        )}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 32 }}>
        {periods.map(p => (
          <button
            key={p.days}
            onClick={() => { setSelected(p.days); setCustomDays('') }}
            style={{
              fontFamily: "'Space Mono', monospace",
              fontSize: 13,
              letterSpacing: 3,
              fontWeight: 400,
              padding: '8px 20px',
              borderRadius: 4,
              border: '1px solid',
              borderColor: selected === p.days && !customDays ? '#f59e0b' : '#374151',
              background: selected === p.days && !customDays ? '#1e293b' : 'transparent',
              color: selected === p.days && !customDays ? '#f59e0b' : '#6b7280',
              cursor: 'pointer',
            }}
          >
            {p.label}
          </button>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 8 }}>
          <input
            type="number"
            min={1}
            max={365}
            value={customDays}
            onChange={e => {
              const v = e.target.value
              setCustomDays(v)
              const n = parseInt(v, 10)
              if (!isNaN(n) && n > 0) setSelected(n)
            }}
            placeholder="EIGEN"
            style={{
              fontFamily: "'Space Mono', monospace",
              fontSize: 13,
              letterSpacing: 2,
              fontWeight: 400,
              width: 90,
              padding: '8px 12px',
              borderRadius: 4,
              border: `1px solid ${customDays ? '#f59e0b' : '#374151'}`,
              background: customDays ? '#1e293b' : 'transparent',
              color: customDays ? '#f59e0b' : '#6b7280',
              outline: 'none',
            }}
          />
          {customDays && (
            <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 12, color: '#6b7280', letterSpacing: 1 }}>
              {selected} dagen
            </span>
          )}
        </div>
      </div>

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
        {loading ? 'BEZIG...' : 'GENEREER META-ANALYSE →'}
      </button>

      {loading && (
        <div className="meta-loading">
          <div className="meta-loading-dots">
            <div className="meta-loading-dot" />
            <div className="meta-loading-dot" />
            <div className="meta-loading-dot" />
          </div>
          <span className="meta-loading-text">Gesprekken ophalen en panel laten jureren. Dit kan wat langer duren.</span>
        </div>
      )}

      {error && (
        <p style={{ color: '#cc2200', fontSize: 14, letterSpacing: 1, marginBottom: 32 }}>✗ {error}</p>
      )}

      {archiveLoading ? (
        <p style={{ color: '#374151', fontSize: 13, letterSpacing: 2 }}>Laden...</p>
      ) : analyses.length === 0 ? (
        <p style={{ color: '#374151', fontSize: 13, letterSpacing: 2 }}>Nog geen analyses gegenereerd.</p>
      ) : (
        <div>
          <p style={{ color: '#f59e0b', fontSize: 13, fontWeight: 400, letterSpacing: 4, marginBottom: 16 }}>
            ARCHIEF
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {analyses.map(a => {
              const isOpen = openIds.has(a.id)
              const tab = activeTab[a.id] ?? 'zelf'
              return (
                <div key={a.id} style={{ background: '#1f2937', border: '1px solid #374151', overflow: 'hidden' }}>
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
                    <span style={{ color: '#f59e0b', fontSize: 12, letterSpacing: 3, fontWeight: 400, flexShrink: 0 }}>
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
                    <div style={{ borderTop: '1px solid #374151' }}>
                      <div style={{ display: 'flex', gap: 8, padding: '16px 20px 0 20px' }}>
                        <button style={tabStyle(tab === 'zelf')} onClick={() => setTab(a.id, 'zelf')}>
                          ZELFBEOORDELING
                        </button>
                        <button style={tabStyle(tab === 'panel')} onClick={() => setTab(a.id, 'panel')}>
                          EXPERTPANEL
                        </button>
                      </div>
                      <div style={{ padding: '24px 24px 28px 24px' }}>
                        <AnalyseText text={tab === 'zelf' ? a.zelfbeoordeling_text : a.expertpanel_text} />
                      </div>
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
