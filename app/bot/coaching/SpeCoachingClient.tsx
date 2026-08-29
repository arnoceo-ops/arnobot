'use client'

import { useState, useEffect } from 'react'
import { useUser } from '@clerk/nextjs'
import Link from 'next/link'
import BotNav from '../BotNav'
import { ProgressieChart, SPE_SERIES } from '@/app/bot/components/ProgressieChart'
import { computeSpeScore } from '@/lib/msa'

interface CoachingDoc {
  voortgang: string
  strategy_score: number
  strategy_diagnose: string
  strategy_richting: 'stijgend' | 'stabiel' | 'dalend'
  people_score: number
  people_diagnose: string
  people_richting: 'stijgend' | 'stabiel' | 'dalend'
  execution_score: number
  execution_diagnose: string
  execution_richting: 'stijgend' | 'stabiel' | 'dalend'
  ontwikkelpunten: { tekst: string; pijlar: string }[]
  updated_at?: string
}

interface HistoryEntry {
  id: string
  created_at: string
  strategy_score: number
  strategy_diagnose: string
  people_score: number
  people_diagnose: string
  execution_score: number
  execution_diagnose: string
  voortgang: string
}

function getReportTitle(entry: HistoryEntry): string {
  const clean = (entry.voortgang ?? '').replace(/\n/g, ' ').trim()
  if (!clean) return 'Leiderschapsrapportage'
  if (clean.length <= 80) return clean
  const cut = clean.slice(0, 77)
  const lastSpace = cut.lastIndexOf(' ')
  return (lastSpace > 40 ? cut.slice(0, lastSpace) : cut) + '...'
}

function formatHistoryDate(iso: string): string {
  return new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })
}

const RICHTING_CONFIG: Record<string, { arrow: string; color: string }> = {
  stijgend: { arrow: '↑', color: '#f59e0b' },
  stabiel:  { arrow: '→', color: '#6b7280' },
  dalend:   { arrow: '↓', color: '#cc2200' },
}

export default function SpeCoachingClient() {
  const { user } = useUser()
  const firstName = user?.firstName ?? ''
  const [doc, setDoc] = useState<CoachingDoc | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null)
  const [followThroughPct, setFollowThroughPct] = useState<number | null>(null)

  useEffect(() => {
    fetch('/api/bot/team/zelfcoaching')
      .then(r => r.json())
      .then(data => {
        setDoc(data.coaching ?? null)
        setHistory(data.history ?? [])
        setFollowThroughPct(data.followThroughPct ?? null)
      })
      .finally(() => setLoading(false))
  }, [])

  async function generate() {
    setGenerating(true)
    setError(null)
    try {
      const res = await fetch('/api/bot/team/zelfcoaching', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        if (data.error === 'te_weinig') {
          setError(`Je hebt ${data.count} 1:1's. Minimaal ${data.benodigd} nodig voor een analyse.`)
        } else if (data.error === 'te_vroeg') {
          setError(`Volgende analyse mogelijk over ${data.dagenResterend} ${data.dagenResterend === 1 ? 'dag' : 'dagen'}, of zodra er ${data.benodigd} nieuwe 1:1's zijn (nu ${data.nieuweEenOpEens}).`)
        } else if (data.error === 'geen_teamleden') {
          setError('Nog geen teamleden om een analyse op te baseren.')
        } else {
          setError('Er ging iets mis. Probeer opnieuw.')
        }
      } else {
        setDoc(data.coaching)
        fetch('/api/bot/team/zelfcoaching')
          .then(r => r.json())
          .then(d => setHistory(d.history ?? []))
          .catch(() => {})
      }
    } catch {
      setError('Er ging iets mis. Probeer opnieuw.')
    }
    setGenerating(false)
  }

  const speScore = doc ? computeSpeScore(doc.strategy_score, doc.people_score, doc.execution_score) : null

  const pijlars = doc ? [
    { key: 'strategy', label: 'STRATEGY', gewicht: '30%', score: doc.strategy_score, richting: doc.strategy_richting, diagnose: doc.strategy_diagnose },
    { key: 'people',   label: 'PEOPLE',   gewicht: '40%', score: doc.people_score,   richting: doc.people_richting,   diagnose: doc.people_diagnose },
    { key: 'execution', label: 'EXECUTION', gewicht: '30%', score: doc.execution_score, richting: doc.execution_richting, diagnose: doc.execution_diagnose },
  ] : []

  const chartHistory = history.map(h => ({
    strategy_score: h.strategy_score, people_score: h.people_score, execution_score: h.execution_score, created_at: h.created_at,
  }))

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Space+Mono:wght@400;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #111827; color: #f1f5f9; font-family: 'Space Mono', monospace; font-weight: 400; }
        @keyframes fadein { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0%,100% { opacity: 0.4; } 50% { opacity: 1; } }

        .coaching-section { padding: 48px 0; border-top: 1px solid #374151; animation: fadein 0.4s ease; }
        .coaching-label { font-family: 'Space Mono', monospace; font-size: 13px; font-weight: 400; letter-spacing: 4px; color: #f59e0b; display: block; margin-bottom: 16px; }
        .coaching-body { color: #9ca3af; font-size: 15px; line-height: 1.9; font-weight: 400; font-family: 'Space Mono', monospace; white-space: pre-wrap; }

        .ontwikkelpunt { display: flex; gap: 20px; align-items: flex-start; padding: 20px 0; border-bottom: 1px solid #374151; }
        .ontwikkelpunt:last-child { border-bottom: none; }
        .ontwikkelpunt-nr { font-family: 'Bebas Neue', sans-serif; font-size: 32px; color: #f59e0b; line-height: 1; min-width: 32px; padding-top: 2px; }
        .ontwikkelpunt-text { font-size: 15px; line-height: 1.9; color: #f1f5f9; font-family: 'Space Mono', monospace; font-weight: 400; }
        .pijlar-tag { font-family: 'Space Mono', monospace; font-size: 11px; letter-spacing: 3px; text-transform: uppercase; display: block; margin-bottom: 4px; }

        .msa-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2px; margin: 32px 0 48px; }
        .msa-card { background: #1f2937; padding: clamp(16px,4vw,32px) clamp(8px,3vw,28px); text-align: center; }
        .pijler-weight { font-size: 11px; letter-spacing: 2px; color: #6b7280; }
        .msa-score-number { font-family: 'Bebas Neue', sans-serif; font-size: 80px; color: #f1f5f9; line-height: 1; }
        .msa-dots { display: flex; gap: 6px; margin: 12px 0 8px; justify-content: center; }
        .msa-dot-filled { width: 10px; height: 10px; border-radius: 50%; background: #f59e0b; border: 1.5px solid #f59e0b; }
        .msa-dot-empty { width: 10px; height: 10px; border-radius: 50%; background: transparent; border: 1.5px solid #374151; }
        .msa-richting { font-family: 'Space Mono', monospace; font-size: 12px; letter-spacing: 3px; text-transform: uppercase; display: block; margin-bottom: 0; }

        .generate-btn { background: #f59e0b; border: none; cursor: pointer; font-family: 'Bebas Neue', sans-serif; font-size: 18px; letter-spacing: 3px; color: #111827; padding: 12px 36px; transition: background 0.2s; border-radius: 999px; min-width: 220px; }
        .generate-btn:hover:not(:disabled) { background: #d97706; }
        .generate-btn:disabled { background: #374151; color: #6b7280; cursor: not-allowed; }
        .pdf-btn { background: none; border: 1px solid #374151; cursor: pointer; font-family: 'Bebas Neue', sans-serif; font-size: 18px; letter-spacing: 3px; color: #9ca3af; padding: 11px 32px; transition: all 0.2s; border-radius: 999px; min-width: 220px; }
        .pdf-btn:hover { border-color: #6b7280; color: #f1f5f9; }

        .loading-dot { width: 8px; height: 8px; background: #f59e0b; border-radius: 50%; animation: pulse 1.2s ease-in-out infinite; display: inline-block; margin: 0 3px; }
        .loading-dot:nth-child(2) { animation-delay: 0.2s; }
        .loading-dot:nth-child(3) { animation-delay: 0.4s; }

        @media (max-width: 640px) {
          .msa-grid { grid-template-columns: repeat(3, 1fr); }
          .msa-score-number { font-size: clamp(36px, 10vw, 64px); }
        }
        .print-only { display: none; }
        @page { size: portrait; }
        @media print {
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          body { background: #ffffff !important; color: #111827 !important; }
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          h1 { color: #111827 !important; }
          .msa-total { color: #111827 !important; }
          .msa-score-number { color: #111827 !important; }
          .msa-card { background: #f1f5f9 !important; }
          .msa-dot-empty { border-color: #9ca3af !important; }
          .coaching-label { color: #f59e0b !important; }
          .coaching-body { color: #374151 !important; }
          .coaching-section { border-top-color: #e5e7eb !important; page-break-inside: avoid; }
          .pijlar-tag { color: #6b7280 !important; }
          .ontwikkelpunt-text { color: #111827 !important; }
          .ontwikkelpunt { border-bottom-color: #e5e7eb !important; page-break-inside: avoid; }
          .msa-grid { page-break-inside: avoid; }
          .pg-grid > div { background: #f1f5f9 !important; }
          .mc-label { color: #374151 !important; }
          svg circle[fill="#1f2937"] { fill: #f1f5f9 !important; }
        }
      `}</style>

      <div className="no-print"><BotNav active="coaching" /></div>

      <div className="print-only" style={{ maxWidth: 812, margin: '0 auto', padding: '40px clamp(16px,4vw,20px) 0' }}>
        <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 26, letterSpacing: 6, lineHeight: 1, color: '#111827', marginBottom: 6 }}>
          ARNO<span style={{ color: '#f59e0b' }}>BOT</span>
        </p>
        <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 48, letterSpacing: 3, lineHeight: 1, color: '#111827', marginBottom: 12 }}>MIJN LEIDERSCHAP</h1>
        {firstName && (
          <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, letterSpacing: 3, color: '#f59e0b', marginBottom: 4 }}>{firstName.toUpperCase()}</p>
        )}
        <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 12, letterSpacing: 1, color: '#6b7280', paddingBottom: 24, borderBottom: '2px solid #f59e0b' }}>
          {new Date().toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      <div style={{ maxWidth: 812, margin: '0 auto', padding: 'clamp(80px,12vw,120px) clamp(16px,4vw,20px) 80px' }}>

        <div className="no-print">
          <p style={{ fontFamily: "'Space Mono', monospace", fontWeight: 400, color: '#f59e0b', fontSize: 13, letterSpacing: 4, marginBottom: 8 }}>ARNOBOT</p>
          <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 64, letterSpacing: 3, lineHeight: 1, color: '#f1f5f9', marginBottom: 32 }}>MIJN LEIDERSCHAP</h1>
        </div>

        <div className="no-print" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', marginBottom: 16, paddingBottom: 48, borderBottom: '1px solid #374151', gap: 12 }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            {/* /bot/sparren heeft geen ander toegangspunt in de app (zie CoachingClient.tsx voor
                de individuele variant, en geheugen feedback_check_sole_access_point). Sinds de
                blokkade voor managers weg is (2026-08-29) hoort die link ook hier te staan. */}
            <Link href="/bot/sparren" className="pdf-btn" title="Oefen een lastig gesprek met ArnoBot als tegenspeler" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>SPARREN →</Link>
            <button className="generate-btn" onClick={generate} disabled={generating || loading}>
              {generating ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                  <span className="loading-dot" />
                  <span className="loading-dot" />
                  <span className="loading-dot" />
                  <span>ARNO GENEREERT</span>
                </span>
              ) : doc ? 'NIEUWE ANALYSE →' : 'GENEREER ANALYSE →'}
            </button>
            {doc && (
              <button className="pdf-btn no-print" onClick={() => window.print()} title="Download deze analyse als PDF">DOWNLOAD PDF ↓</button>
            )}
          </div>
          {!doc && !loading && !error && (
            <p style={{ fontFamily: "'Space Mono', monospace", fontWeight: 400, color: '#9ca3af', fontSize: 15, lineHeight: 1.9, maxWidth: 480 }}>
              Arno legt je eigen 1:1&apos;s, je eigen gesprekken en de ontwikkeling van je team naast elkaar, en spiegelt dat naar jouw functioneren als leidinggevende. Langs drie lijnen: strategy, people, execution.
            </p>
          )}
          {error && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#f59e0b', flexShrink: 0, marginTop: 10 }} />
              <p style={{ fontFamily: "'Space Mono', monospace", color: '#9ca3af', fontSize: 15, lineHeight: '29px', fontWeight: 400 }}>
                {error}
              </p>
            </div>
          )}
        </div>

        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="loading-dot" />
            <span className="loading-dot" />
            <span className="loading-dot" />
            <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, letterSpacing: 4, color: '#9ca3af' }}>LADEN</span>
          </div>
        )}

        {doc && (
          <div style={{ animation: 'fadein 0.5s ease' }}>

            <div style={{ textAlign: 'center', marginBottom: 8 }}>
              <span style={{ fontFamily: "'Space Mono', monospace", fontWeight: 400, fontSize: 13, letterSpacing: 4, color: '#f59e0b', display: 'block', marginBottom: 8 }}>SPE-SCORE</span>
              <span className="msa-total" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 96, color: '#f1f5f9', lineHeight: 1 }}>{speScore}</span>
              <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 15, color: '#9ca3af', display: 'block', marginTop: 4 }}>/ 100</span>
            </div>
            <div className="msa-grid">
              {pijlars.map(({ key, label, gewicht, score, richting }) => {
                const rc = RICHTING_CONFIG[richting] ?? RICHTING_CONFIG.stabiel
                return (
                  <div key={key} className="msa-card">
                    <span className="coaching-label">{label} <span className="pijler-weight">{gewicht}</span></span>
                    <div className="msa-score-number">{score}</div>
                    <div className="msa-dots">
                      {[1, 2, 3, 4, 5].map(i => (
                        <div key={i} className={i <= score ? 'msa-dot-filled' : 'msa-dot-empty'} />
                      ))}
                    </div>
                    <span className="msa-richting" style={{ color: rc.color }}>{rc.arrow} {richting?.toUpperCase() ?? ''}</span>
                  </div>
                )
              })}
            </div>

            {pijlars.map((p, i) => (
              <div key={p.key} className="coaching-section" style={i === 0 ? { borderTop: 'none', paddingTop: 0 } : undefined}>
                <span className="coaching-label" style={{ color: '#f1f5f9' }}>{p.label}</span>
                <p className="coaching-body">{p.diagnose}</p>
                {p.key === 'execution' && followThroughPct !== null && (
                  <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, letterSpacing: 2, color: '#6b7280', marginTop: 16 }}>
                    FOLLOW-THROUGH OP JE EIGEN 1:1-ACTIES:{' '}
                    <span style={{ color: followThroughPct >= 70 ? '#44cc88' : followThroughPct >= 40 ? '#f59e0b' : '#cc4444', fontWeight: 400 }}>{followThroughPct}%</span>
                  </p>
                )}
              </div>
            ))}

            <div className="coaching-section">
              <span className="coaching-label">JOUW ONTWIKKELPUNTEN</span>
              <div style={{ marginTop: 8 }}>
                {(doc.ontwikkelpunten ?? []).map((p, i) => (
                  <div key={i} className="ontwikkelpunt">
                    <span className="ontwikkelpunt-nr">{i + 1}</span>
                    <div>
                      <span className="pijlar-tag" style={{ color: '#f1f5f9' }}>[{p.pijlar?.toUpperCase() ?? ''}]</span>
                      <span className="ontwikkelpunt-text">{p.tekst}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="coaching-section">
              <span className="coaching-label">VOORTGANG</span>
              <p className="coaching-body">{doc.voortgang}</p>
            </div>

            {chartHistory.length > 0 && (
              <div className="coaching-section">
                <span className="coaching-label">PROGRESSIE</span>
                <div style={{ marginTop: 16 }}>
                  <ProgressieChart history={chartHistory} series={SPE_SERIES} />
                </div>
              </div>
            )}

            {history.length > 0 && (
              <div className="coaching-section">
                <span className="coaching-label">ARCHIEF</span>
                <div style={{ marginTop: 8 }}>
                  {[...history].reverse().map(h => (
                    <div key={h.id} style={{ borderTop: '1px solid #374151' }}>
                      <button
                        onClick={() => setExpandedHistoryId(expandedHistoryId === h.id ? null : h.id)}
                        style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: '20px 0', fontFamily: "'Space Mono', monospace" }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
                          <span style={{ color: '#9ca3af', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', whiteSpace: 'nowrap', width: 165, flexShrink: 0 }}>
                            {formatHistoryDate(h.created_at)}
                          </span>
                          <div style={{ flex: 1, minWidth: 200 }}>
                            <p style={{ color: '#f1f5f9', fontSize: 20, fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 1, lineHeight: 1.4, margin: 0 }}>
                              {getReportTitle(h)}
                            </p>
                          </div>
                          <span style={{ color: expandedHistoryId === h.id ? '#f59e0b' : '#9ca3af', fontSize: 18, fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 2, flexShrink: 0 }}>
                            {expandedHistoryId === h.id ? '↑ SLUITEN' : '↓ OPEN'}
                          </span>
                        </div>
                      </button>
                      {expandedHistoryId === h.id && (
                        <div style={{ paddingBottom: 32 }}>
                          <div style={{ marginBottom: 20 }}>
                            <span className="coaching-label" style={{ color: '#f1f5f9', marginBottom: 6 }}>STRATEGY</span>
                            <p className="coaching-body">{h.strategy_diagnose}</p>
                          </div>
                          <div style={{ marginBottom: 20 }}>
                            <span className="coaching-label" style={{ color: '#f1f5f9', marginBottom: 6 }}>PEOPLE</span>
                            <p className="coaching-body">{h.people_diagnose}</p>
                          </div>
                          <div>
                            <span className="coaching-label" style={{ color: '#f1f5f9', marginBottom: 6 }}>EXECUTION</span>
                            <p className="coaching-body">{h.execution_diagnose}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        )}

        <div className="no-print" style={{ borderTop: '1px solid #374151', paddingTop: 40, marginTop: doc ? 48 : 0 }}>
          <Link href="/bot" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 3, color: '#f59e0b', textDecoration: 'none' }}>
            ← TERUG NAAR DE BOT
          </Link>
        </div>

      </div>
    </>
  )
}
