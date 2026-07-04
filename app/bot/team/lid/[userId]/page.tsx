'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import BotNav from '@/app/bot/BotNav'
import { ProgressieChart } from '@/app/bot/components/ProgressieChart'

interface Coaching {
  mindset_score: number | null
  mindset_diagnose: string | null
  systeem_score: number | null
  systeem_diagnose: string | null
  actie_score: number | null
  actie_diagnose: string | null
  voortgang: string | null
  updated_at: string
}

interface SharedAnalyse {
  id: string
  shared_at: string
  analyse_id: string
  analyse_text: string
  session_count: number | null
  analyse_created_at: string
}

interface OneononeLog {
  id: string
  aandachtspunt: string | null
  notitie: string | null
  mindset_score: number | null
  systeem_score: number | null
  actie_score: number | null
  created_at: string
}

interface LidData {
  name: string
  role: string
  profiel_rol: string | null
  coaching: Coaching | null
  sharedAnalyses: SharedAnalyse[]
  history: OneononeLog[]
}

const label: React.CSSProperties = {
  fontFamily: "'Space Mono', monospace", fontWeight: 400,
  fontSize: 13, letterSpacing: 4, color: '#f59e0b',
  display: 'block', marginBottom: 16,
}

const body: React.CSSProperties = {
  fontFamily: "'Space Mono', monospace", fontWeight: 400,
  fontSize: 15, color: '#9ca3af', lineHeight: '1.9',
}

const section: React.CSSProperties = {
  borderTop: '1px solid #374151', paddingTop: 32, marginBottom: 48,
}

function ScoreBar({ score }: { score: number | null }) {
  const pct = score ? (score / 5) * 100 : 0
  const color = score === null ? '#374151' : score >= 4 ? '#44cc88' : score >= 3 ? '#f59e0b' : '#cc4444'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
      <div style={{ flex: 1, height: 6, background: '#1e293b', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 0.6s ease' }} />
      </div>
      <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, letterSpacing: 2, color, minWidth: 24, textAlign: 'right' }}>
        {score ?? 0}
      </span>
    </div>
  )
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })
}

function wekenGeleden(iso: string) {
  const dagen = Math.round((Date.now() - new Date(iso).getTime()) / 86400000)
  if (dagen === 0) return 'Vandaag'
  if (dagen === 1) return 'Gisteren'
  if (dagen < 7) return `${dagen} dagen geleden`
  const weken = Math.round(dagen / 7)
  return `${weken} ${weken === 1 ? 'week' : 'weken'} geleden`
}

function getAnalyseTitle(text: string): string {
  const clean = text.replace(/\n/g, ' ').trim()
  if (clean.length <= 80) return clean
  const cut = clean.slice(0, 77)
  const lastSpace = cut.lastIndexOf(' ')
  return (lastSpace > 40 ? cut.slice(0, lastSpace) : cut) + '...'
}

function renderAnalyse(text: string): string {
  const safe = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const items = safe.split('\n').map(line => {
    const t = line.trim()
    if (!t || /^-{2,}$/.test(t)) return ''
    const fullBold = t.match(/^\*\*([^*]+)\*\*$/)
    if (fullBold) return `<span class="ah">${fullBold[1]}</span>`
    if (t.length < 60 && t === t.toUpperCase() && /[A-Z]/.test(t) && !/\*/.test(t)) {
      return `<span class="ah">${t}</span>`
    }
    return t.replace(/\*\*([^*]+)\*\*/g, '<strong style="color:#f1f5f9;font-weight:700">$1</strong>')
  }).filter(s => s.length > 0)
  return items.map((item, i) => {
    const isHeading = item.startsWith('<span class="ah">')
    const nextIsHeading = items[i + 1]?.startsWith('<span class="ah">') ?? true
    if (isHeading || nextIsHeading) return item
    return item + '<br>'
  }).join('')
}

export default function LidPage() {
  const { userId } = useParams<{ userId: string }>()
  const [data, setData] = useState<LidData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [agendaLoading, setAgendaLoading] = useState(false)
  const [agenda, setAgenda] = useState('')
  const [aandachtspunt, setAandachtspunt] = useState('')
  const [agendaError, setAgendaError] = useState('')

  const [saveLoading, setSaveLoading] = useState(false)
  const [saved, setSaved] = useState(false)

  const [expandedAnalyse, setExpandedAnalyse] = useState<string | null>(null)
  const [verwijderBevestig, setVerwijderBevestig] = useState(false)
  const [verwijderLoading, setVerwijderLoading] = useState(false)

  // Note editing for history cards
  const [noteOpenId, setNoteOpenId] = useState<string | null>(null)
  const [noteInputs, setNoteInputs] = useState<Record<string, string>>({})
  const [noteSavingId, setNoteSavingId] = useState<string | null>(null)
  const [noteSavedId, setNoteSavedId] = useState<string | null>(null)

  function loadData() {
    return fetch(`/api/bot/team/lid?userId=${userId}`)
      .then(r => r.json())
      .then(d => { if (!d.error) setData(d) })
  }

  useEffect(() => {
    fetch(`/api/bot/team/lid?userId=${userId}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error)
        else setData(d)
      })
      .catch(() => setError('Er ging iets mis'))
      .finally(() => setLoading(false))
  }, [userId])

  async function genereerAgenda() {
    if (!data) return
    setAgendaLoading(true)
    setAgendaError('')
    setAgenda('')
    setAandachtspunt('')
    setSaved(false)
    try {
      const res = await fetch('/api/bot/team/1on1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: userId, name: data.name }),
      })
      const d = await res.json()
      if (!res.ok) setAgendaError(d.error || 'Er ging iets mis')
      else { setAgenda(d.agenda); setAandachtspunt(d.aandachtspunt || '') }
    } catch {
      setAgendaError('Er ging iets mis')
    } finally {
      setAgendaLoading(false)
    }
  }

  async function verwijderLid() {
    setVerwijderLoading(true)
    try {
      const res = await fetch(`/api/bot/team/lid?userId=${userId}`, { method: 'DELETE' })
      if (res.ok) {
        window.location.href = '/bot/team'
      } else {
        const d = await res.json()
        setAgendaError(d.error || 'Verwijderen mislukt')
        setVerwijderBevestig(false)
      }
    } catch {
      setAgendaError('Er ging iets mis')
      setVerwijderBevestig(false)
    } finally {
      setVerwijderLoading(false)
    }
  }

  async function bewaar1on1() {
    if (!agenda) return
    setSaveLoading(true)
    try {
      const res = await fetch('/api/bot/team/1on1/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: userId, aandachtspunt, notitie: '' }),
      })
      const d = await res.json()
      if (!res.ok) setAgendaError(d.error || 'Opslaan mislukt')
      else {
        setSaved(true)
        loadData()
      }
    } catch {
      setAgendaError('Opslaan mislukt')
    } finally {
      setSaveLoading(false)
    }
  }

  async function slaNotitieOp(logId: string) {
    setNoteSavingId(logId)
    const notitie = noteInputs[logId] ?? ''
    try {
      const res = await fetch('/api/bot/team/1on1/note', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logId, notitie }),
      })
      if (res.ok) {
        setNoteSavedId(logId)
        setNoteOpenId(null)
        loadData()
      }
    } catch {}
    setNoteSavingId(null)
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Space+Mono:wght@400;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #111827; color: #f1f5f9; font-family: 'Space Mono', monospace; font-weight: 400; }
        .back-link { font-family: 'Bebas Neue', sans-serif; font-size: 16px; letter-spacing: 3px; color: #9ca3af; text-decoration: none; display: inline-flex; align-items: center; gap: 8px; margin-bottom: 48px; transition: color 0.15s; }
        .back-link:hover { color: #f1f5f9; }
        .ah { font-family:'Space Mono',monospace; font-weight:400; font-size:13px; letter-spacing:4px; color:#f1f5f9; display:block; margin:24px 0 8px; }
        .ah:first-child { margin-top:0; }
        .analyse-item-full { color:#9ca3af; font-size:15px; line-height:1.9; font-family:'Space Mono',monospace; background:#1f2937; border-left:3px solid #f59e0b; padding:20px 24px; margin-bottom:8px; }
        .btn-1on1 { font-family:'Bebas Neue',sans-serif; font-size:18px; letter-spacing:3px; padding:12px 36px; min-width:260px; white-space:nowrap; background:#f59e0b; color:#111827; border:none; border-radius:999px; cursor:pointer; transition:background 0.2s; }
        .btn-1on1:hover { background:#d97706; }
        .btn-1on1:disabled { background:#374151; color:#6b7280; cursor:not-allowed; }
        .btn-save { font-family:'Bebas Neue',sans-serif; font-size:18px; letter-spacing:3px; padding:12px 32px; background:none; border:1px solid #374151; color:#9ca3af; border-radius:999px; cursor:pointer; transition:all 0.2s; }
        .btn-save:hover { border-color:#f59e0b; color:#f59e0b; }
        .btn-save:disabled { opacity:0.4; cursor:not-allowed; }
        .notitie-input { background:#1f2937; color:#f1f5f9; border:1.5px solid #374151; border-radius:4px; font-family:'Space Mono',monospace; font-size:15px; font-weight:400; padding:12px 16px; width:100%; outline:none; resize:vertical; min-height:80px; line-height:1.7; transition:border-color 0.15s; }
        .notitie-input:focus { border-color:#f59e0b; }
        .notitie-input::placeholder { color:#4b5563; }
        .btn-note { font-family:'Bebas Neue',sans-serif; font-size:13px; letter-spacing:3px; padding:6px 16px; background:none; border:1px solid #374151; color:#6b7280; border-radius:999px; cursor:pointer; transition:all 0.15s; }
        .btn-note:hover { border-color:#9ca3af; color:#9ca3af; }
      `}</style>

      <BotNav active="team" />

      <div style={{ minHeight: '100vh', background: '#111827' }}>
        <div style={{ maxWidth: 812, margin: '0 auto', padding: 'clamp(80px,12vw,120px) clamp(16px,4vw,20px) 80px' }}>

          <a href="/bot/team" className="back-link">← TEAM</a>

          {loading && <p style={{ ...body, color: '#6b7280', letterSpacing: 2 }}>LADEN...</p>}
          {error && <p style={{ ...body, color: '#cc4444' }}>{error}</p>}

          {data && (
            <>
              <p style={{ ...label, marginBottom: 8 }}>
                {data.profiel_rol?.toUpperCase() ?? (data.role === 'manager' ? 'MANAGER' : 'TEAMLID')}
              </p>
              <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 64, letterSpacing: 3, color: '#f1f5f9', lineHeight: 1, margin: '0 0 48px 0', borderBottom: '3px solid #f59e0b', paddingBottom: 32 }}>
                {data.name.toUpperCase()}
              </h1>

              {/* Coachingprofiel */}
              <div style={section}>
                <span style={label}>COACHINGPROFIEL</span>

                {!data.coaching ? (
                  <p style={body}>
                    Nog geen coachingprofiel beschikbaar. {data.name.split(' ')[0]} heeft minimaal 5 gesprekken nodig voordat ArnoBot een profiel kan opstellen.
                  </p>
                ) : (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 24, marginBottom: 32 }}>
                      {([
                        { key: 'mindset', label: 'MINDSET', score: data.coaching.mindset_score, diagnose: data.coaching.mindset_diagnose },
                        { key: 'systeem', label: 'SYSTEEM', score: data.coaching.systeem_score, diagnose: data.coaching.systeem_diagnose },
                        { key: 'actie', label: 'ACTIE', score: data.coaching.actie_score, diagnose: data.coaching.actie_diagnose },
                      ] as const).map(({ key, label: l, score, diagnose }) => (
                        <div key={key} style={{ background: '#1f2937', padding: '20px 24px', borderRadius: 4 }}>
                          <p style={{ fontFamily: "'Space Mono', monospace", fontWeight: 400, fontSize: 13, letterSpacing: 4, color: '#f1f5f9', marginBottom: 12 }}>{l}</p>
                          <ScoreBar score={score} />
                          {diagnose && <p style={{ ...body, fontSize: 13, color: '#9ca3af', marginTop: 8, lineHeight: 1.7 }}>{diagnose}</p>}
                        </div>
                      ))}
                    </div>

                    {data.history && data.history.some(h => h.mindset_score != null || h.systeem_score != null || h.actie_score != null) && (
                      <div style={{ marginBottom: 32 }}>
                        <p style={{ ...label, marginBottom: 16 }}>PROGRESSIE</p>
                        <ProgressieChart history={data.history} />
                      </div>
                    )}

                    {data.coaching.voortgang && (
                      <div style={{ background: '#1f2937', borderLeft: '4px solid #f59e0b', padding: '20px 24px', marginBottom: 32 }}>
                        <p style={{ fontFamily: "'Space Mono', monospace", fontWeight: 400, fontSize: 13, letterSpacing: 4, color: '#f59e0b', marginBottom: 12 }}>VOORTGANG</p>
                        <p style={body}>{data.coaching.voortgang}</p>
                      </div>
                    )}

                    <p style={{ ...body, fontSize: 13, color: '#6b7280', marginTop: 16, marginBottom: 32 }}>
                      Bijgewerkt op {formatDate(data.coaching.updated_at)}
                    </p>

                    {/* 1:1 voorbereiding */}
                    <button className="btn-1on1" onClick={genereerAgenda} disabled={agendaLoading}>
                      {agendaLoading ? 'ARNO BEREIDT VOOR...' : 'BEREID 1:1 VOOR'}
                    </button>

                    {agendaError && <p style={{ ...body, color: '#cc4444', marginTop: 16 }}>{agendaError}</p>}

                    {agenda && (
                      <div style={{ marginTop: 32 }}>
                        <div style={{ background: '#1f2937', borderLeft: '3px solid #f59e0b', padding: '20px 24px', marginBottom: 24 }}>
                          <p style={{ fontFamily: "'Space Mono', monospace", fontWeight: 700, fontSize: 13, letterSpacing: 4, color: '#f59e0b', marginBottom: 24 }}>1:1 AGENDA</p>
                          <div style={{ ...body }} dangerouslySetInnerHTML={{ __html: renderAnalyse(agenda) }} />
                        </div>

                        {!saved ? (
                          <button className="btn-save" onClick={bewaar1on1} disabled={saveLoading}>
                            {saveLoading ? 'OPSLAAN...' : 'BEWAAR DEZE 1:1'}
                          </button>
                        ) : (
                          <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, letterSpacing: 3, color: '#44cc88' }}>
                            ✓ OPGESLAGEN — voeg na het gesprek een notitie toe via de geschiedenis hieronder
                          </p>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* 1:1 geschiedenis */}
              {data.history && data.history.length > 0 && (
                <div style={section}>
                  <span style={label}>1:1 GESCHIEDENIS</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {data.history.map(h => {
                      const scores = [h.mindset_score, h.systeem_score, h.actie_score]
                      const scoreStr = scores.every(s => s === null) ? null : scores.map(s => s ?? '?').join(' / ')
                      const isNoteOpen = noteOpenId === h.id
                      const noteInput = noteInputs[h.id] ?? h.notitie ?? ''
                      return (
                        <div key={h.id} style={{ background: '#1f2937', padding: '20px 24px', borderLeft: '3px solid #374151' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: h.aandachtspunt ? 8 : 0, flexWrap: 'wrap', gap: 8 }}>
                            <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 12, letterSpacing: 3, color: '#6b7280' }}>
                              {wekenGeleden(h.created_at)}
                            </span>
                            {scoreStr && (
                              <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, letterSpacing: 2, color: '#6b7280' }}>
                                M {h.mindset_score ?? 0} · S {h.systeem_score ?? 0} · A {h.actie_score ?? 0}
                              </span>
                            )}
                          </div>
                          {h.aandachtspunt && (
                            <p style={{ ...body, marginBottom: 12 }}>{h.aandachtspunt}</p>
                          )}
                          {h.notitie && !isNoteOpen && (
                            <p style={{ ...body, fontSize: 13, color: '#6b7280', fontStyle: 'italic', marginBottom: 12 }}>{h.notitie}</p>
                          )}
                          {isNoteOpen ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                              <textarea
                                className="notitie-input"
                                placeholder="Notitie na het gesprek..."
                                value={noteInput}
                                onChange={e => setNoteInputs(prev => ({ ...prev, [h.id]: e.target.value }))}
                              />
                              <div style={{ display: 'flex', gap: 8 }}>
                                <button
                                  className="btn-note"
                                  onClick={() => slaNotitieOp(h.id)}
                                  disabled={noteSavingId === h.id}
                                  style={{ color: '#f59e0b', borderColor: '#f59e0b' }}
                                >
                                  {noteSavingId === h.id ? 'OPSLAAN...' : 'OPSLAAN'}
                                </button>
                                <button
                                  className="btn-note"
                                  onClick={() => { setNoteOpenId(null); setNoteInputs(prev => ({ ...prev, [h.id]: h.notitie ?? '' })) }}
                                >
                                  ANNULEER
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              className="btn-note"
                              onClick={() => {
                                setNoteOpenId(h.id)
                                setNoteInputs(prev => ({ ...prev, [h.id]: h.notitie ?? '' }))
                                setNoteSavedId(null)
                              }}
                            >
                              {h.notitie ? 'BEWERK NOTITIE' : 'VOEG NOTITIE TOE'}
                            </button>
                          )}
                          {noteSavedId === h.id && !isNoteOpen && (
                            <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, letterSpacing: 2, color: '#44cc88', marginLeft: 8 }}>✓</span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Gedeeld door lid */}
              {data.sharedAnalyses && data.sharedAnalyses.length > 0 && (
                <div style={section}>
                  <span style={label}>GEDEELD DOOR LID</span>
                  <p style={{ ...body, color: '#6b7280', marginBottom: 24 }}>
                    {data.name.split(' ')[0]} heeft onderstaande {data.sharedAnalyses.length === 1 ? 'analyse' : 'analyses'} zelf gedeeld.
                  </p>
                  <div>
                    {data.sharedAnalyses.map(a => (
                      <div key={a.id} style={{ borderTop: '1px solid #374151' }}>
                        <button
                          onClick={() => setExpandedAnalyse(expandedAnalyse === a.id ? null : a.id)}
                          style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: '20px 0' }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                            <span style={{ color: '#9ca3af', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', whiteSpace: 'nowrap', minWidth: 120, fontFamily: "'Space Mono', monospace" }}>
                              {formatDate(a.analyse_created_at)}{a.session_count ? ` · ${a.session_count} gespr.` : ''}
                            </span>
                            <div style={{ flex: 1 }}>
                              <p style={{ color: '#f1f5f9', fontSize: 20, fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 1, lineHeight: 1.4 }}>
                                {getAnalyseTitle(a.analyse_text)}
                              </p>
                            </div>
                            <span style={{ color: expandedAnalyse === a.id ? '#f59e0b' : '#9ca3af', fontSize: 18, fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 2, flexShrink: 0 }}>
                              {expandedAnalyse === a.id ? '↑ SLUITEN' : '↓ OPEN'}
                            </span>
                          </div>
                        </button>
                        {expandedAnalyse === a.id && (
                          <div style={{ paddingBottom: 32 }}>
                            <div className="analyse-item-full" dangerouslySetInnerHTML={{ __html: renderAnalyse(a.analyse_text) }} />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Verwijderen */}
              <div style={{ borderTop: '1px solid #1f2937', paddingTop: 32, marginTop: 48 }}>
                {!verwijderBevestig ? (
                  <button
                    onClick={() => setVerwijderBevestig(true)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'Space Mono', monospace", fontSize: 13, letterSpacing: 3, color: '#4b5563', padding: 0, textDecoration: 'underline', textDecorationColor: '#374151' }}
                  >
                    verwijder uit team
                  </button>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <p style={{ fontFamily: "'Space Mono', monospace", fontWeight: 400, fontSize: 15, color: '#9ca3af', lineHeight: 1.9 }}>
                      {data?.name.split(' ')[0]} wordt verwijderd uit het team. Dit kan niet ongedaan worden gemaakt.
                    </p>
                    <div style={{ display: 'flex', gap: 12 }}>
                      <button
                        onClick={verwijderLid}
                        disabled={verwijderLoading}
                        style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 3, padding: '12px 32px', minWidth: 180, whiteSpace: 'nowrap', background: 'none', border: '1px solid #cc2200', color: '#cc2200', borderRadius: 999, cursor: verwijderLoading ? 'not-allowed' : 'pointer', opacity: verwijderLoading ? 0.6 : 1 }}
                      >
                        {verwijderLoading ? 'VERWIJDEREN...' : 'JA, VERWIJDER'}
                      </button>
                      <button
                        onClick={() => setVerwijderBevestig(false)}
                        style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 3, padding: '12px 32px', minWidth: 180, whiteSpace: 'nowrap', background: 'none', border: '1px solid #374151', color: '#9ca3af', borderRadius: 999, cursor: 'pointer' }}
                      >
                        ANNULEER
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

        </div>
      </div>
    </>
  )
}
