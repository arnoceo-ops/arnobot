'use client'

import { useState } from 'react'

interface Evaluatie {
  id: string
  naam: string | null
  frequentie: string | null
  onderdelen: string[] | null
  waardevol: string | null
  ontbreekt: string | null
  persona: string[] | null
  persona_anders: string | null
  tariefstelling: string | null
  aanbevelen: string | null
  aanbevelen_toelichting: string | null
  slotwoord: string | null
  created_at: string
}

function Row({ label, value }: { label: string; value: string | string[] | null | undefined }) {
  if (!value || (Array.isArray(value) && value.length === 0)) return null
  const v = Array.isArray(value) ? value.join(', ') : value
  return (
    <div style={{ display: 'flex', gap: 16, padding: '6px 0', borderBottom: '1px solid #1f2937' }}>
      <span style={{ fontSize: 11, letterSpacing: 2, color: '#4b5563', minWidth: 140, paddingTop: 2 }}>{label}</span>
      <span style={{ fontSize: 13, color: '#9ca3af', lineHeight: 1.7, flex: 1 }}>{v}</span>
    </div>
  )
}

interface NegativeRating {
  question: string
  answer: string
  created_at: string
}

interface Props {
  evaluaties: Evaluatie[]
  totalRatings: number
  positiveRatings: number
  negativeRatings: NegativeRating[]
}

export default function EvaluatiesClient({ evaluaties, totalRatings, positiveRatings, negativeRatings }: Props) {
  const [analyse, setAnalyse] = useState('')
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [expandedRating, setExpandedRating] = useState<number | null>(null)

  async function runAnalyse() {
    setLoading(true)
    setAnalyse('')
    try {
      const res = await fetch('/api/admin/analyse-evaluaties', { method: 'POST' })
      const data = await res.json()
      if (data.analyse) setAnalyse(data.analyse)
    } catch {}
    setLoading(false)
  }

  return (
    <>
      {/* Antwoordbeoordelingen */}
      {totalRatings > 0 && (
        <div style={{ marginBottom: 48 }}>
          <p style={{ fontSize: 11, letterSpacing: 4, color: '#f59e0b', marginBottom: 20, fontFamily: "'Space Mono', monospace" }}>ANTWOORDBEOORDELINGEN</p>
          <div style={{ display: 'flex', gap: 40, marginBottom: 24, alignItems: 'flex-end' }}>
            <div>
              <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 56, color: '#f1f5f9', lineHeight: 1 }}>
                {Math.round((positiveRatings / totalRatings) * 100)}%
              </span>
              <p style={{ fontSize: 11, letterSpacing: 3, color: '#6b7280', marginTop: 6, fontFamily: "'Space Mono', monospace" }}>POSITIEF</p>
            </div>
            <div>
              <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 56, color: '#f1f5f9', lineHeight: 1 }}>
                {totalRatings}
              </span>
              <p style={{ fontSize: 11, letterSpacing: 3, color: '#6b7280', marginTop: 6, fontFamily: "'Space Mono', monospace" }}>BEOORDELINGEN</p>
            </div>
            <div>
              <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 56, color: '#cc4444', lineHeight: 1 }}>
                {totalRatings - positiveRatings}
              </span>
              <p style={{ fontSize: 11, letterSpacing: 3, color: '#6b7280', marginTop: 6, fontFamily: "'Space Mono', monospace" }}>NEGATIEF</p>
            </div>
          </div>
          {negativeRatings.length > 0 && (
            <>
              <p style={{ fontSize: 11, letterSpacing: 3, color: '#6b7280', marginBottom: 10, fontFamily: "'Space Mono', monospace" }}>NEGATIEF BEOORDEELD (LAATSTE {negativeRatings.length})</p>
              {negativeRatings.map((r, idx) => (
                <div key={idx} style={{ background: '#1f2937', marginBottom: 2 }}>
                  <button
                    onClick={() => setExpandedRating(expandedRating === idx ? null : idx)}
                    style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', gap: 16, textAlign: 'left' }}
                  >
                    <span style={{ fontSize: 13, color: '#9ca3af', fontFamily: "'Space Mono', monospace", flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.question.slice(0, 80)}{r.question.length > 80 ? '...' : ''}
                    </span>
                    <span style={{ fontSize: 12, color: '#4b5563', whiteSpace: 'nowrap', flexShrink: 0 }}>
                      {new Date(r.created_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
                      {' '}{expandedRating === idx ? '↑' : '↓'}
                    </span>
                  </button>
                  {expandedRating === idx && (
                    <div style={{ padding: '0 20px 16px' }}>
                      <p style={{ fontSize: 12, letterSpacing: 2, color: '#4b5563', marginBottom: 6, fontFamily: "'Space Mono', monospace" }}>VRAAG</p>
                      <p style={{ fontSize: 13, color: '#9ca3af', lineHeight: 1.7, marginBottom: 16, fontFamily: "'Space Mono', monospace" }}>{r.question}</p>
                      <p style={{ fontSize: 12, letterSpacing: 2, color: '#4b5563', marginBottom: 6, fontFamily: "'Space Mono', monospace" }}>ARNO'S ANTWOORD</p>
                      <p style={{ fontSize: 13, color: '#9ca3af', lineHeight: 1.7, fontFamily: "'Space Mono', monospace", whiteSpace: 'pre-wrap' }}>{r.answer}</p>
                    </div>
                  )}
                </div>
              ))}
            </>
          )}
          <div style={{ borderBottom: '1px solid #1f2937', marginTop: 32 }} />
        </div>
      )}

      {/* Analyseer knop */}
      <div style={{ marginBottom: 48 }}>
        <button
          onClick={runAnalyse}
          disabled={loading || evaluaties.length === 0}
          style={{
            fontFamily: 'sans-serif', fontSize: 14, letterSpacing: 3, fontWeight: 700,
            padding: '12px 32px', borderRadius: 999, border: 'none',
            background: loading || evaluaties.length === 0 ? '#374151' : '#f59e0b',
            color: '#111827', cursor: loading || evaluaties.length === 0 ? 'not-allowed' : 'pointer',
            transition: 'background 0.15s',
          }}
        >
          {loading ? 'ANALYSEREN...' : `ANALYSEER ${evaluaties.length} EVALUATIE${evaluaties.length !== 1 ? 'S' : ''}`}
        </button>
      </div>

      {/* Analyse output */}
      {analyse && (
        <div style={{ background: '#1f2937', borderLeft: '3px solid #f59e0b', padding: '24px 28px', marginBottom: 48 }}>
          <p style={{ fontSize: 11, letterSpacing: 4, color: '#f59e0b', marginBottom: 16 }}>CLAUDE ANALYSE</p>
          <p style={{ fontSize: 14, lineHeight: 1.9, color: '#9ca3af', whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>{analyse}</p>
        </div>
      )}

      {/* Evaluaties lijst */}
      {evaluaties.length === 0 && (
        <p style={{ color: '#374151', fontSize: 13, letterSpacing: 3 }}>NOG GEEN EVALUATIES ONTVANGEN</p>
      )}
      {evaluaties.map(e => (
        <div key={e.id} style={{ background: '#1f2937', marginBottom: 2 }}>
          <button
            onClick={() => setExpanded(expanded === e.id ? null : e.id)}
            style={{
              width: '100%', background: 'none', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '16px 20px', gap: 16,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: '#f1f5f9' }}>{e.naam ?? 'Anoniem'}</span>
              {e.aanbevelen && (
                <span style={{ fontSize: 11, letterSpacing: 2, color: e.aanbevelen === 'Ja' ? '#44cc88' : e.aanbevelen === 'Nee' ? '#cc4444' : '#f59e0b' }}>
                  {e.aanbevelen === 'Ja' ? 'BEVEELT AAN' : e.aanbevelen === 'Nee' ? 'BEVEELT NIET AAN' : 'MISSCHIEN'}
                </span>
              )}
            </div>
            <span style={{ fontSize: 12, color: '#4b5563', whiteSpace: 'nowrap' }}>
              {new Date(e.created_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })}
              {' '}{expanded === e.id ? '↑' : '↓'}
            </span>
          </button>
          {expanded === e.id && (
            <div style={{ padding: '0 20px 20px' }}>
              <Row label="FREQUENTIE" value={e.frequentie} />
              <Row label="ONDERDELEN" value={e.onderdelen} />
              <Row label="WAARDEVOL" value={e.waardevol} />
              <Row label="ONTBREEKT" value={e.ontbreekt} />
              <Row label="DOELGROEP" value={e.persona} />
              <Row label="ANDERS" value={e.persona_anders} />
              <Row label="TARIEFSTELLING" value={e.tariefstelling} />
              <Row label="AANBEVELEN" value={e.aanbevelen + (e.aanbevelen_toelichting ? `: ${e.aanbevelen_toelichting}` : '')} />
              <Row label="SLOTWOORD" value={e.slotwoord} />
            </div>
          )}
        </div>
      ))}
    </>
  )
}
