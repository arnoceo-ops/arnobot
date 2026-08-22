'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import BotNav from '@/app/bot/BotNav'
import { ProgressieChart } from '@/app/bot/components/ProgressieChart'
import { useIsMobile } from '@/hooks/useBreakpoint'
import DownloadOneOnOneButton from '@/app/bot/team/DownloadOneOnOneButton'

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
  agenda: string | null
  notitie: string | null
  actie: string | null
  actie_status: 'ja' | 'nee' | 'skip' | null
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
  const [actieInput, setActieInput] = useState('')

  const [actieAnswering, setActieAnswering] = useState(false)

  const isMobile = useIsMobile()
  const [expandedAnalyse, setExpandedAnalyse] = useState<string | null>(null)
  const [expandedHistory, setExpandedHistory] = useState<string | null>(null)
  const [showAllHistory, setShowAllHistory] = useState(false)
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

  // Automatisch opslaan, geen aparte BEWAAR-knop en geen bevestiging: een gegenereerde agenda
  // mag nooit verloren gaan doordat iemand vergeet op een knop te klikken. Werkt altijd op de
  // rij van vandaag (save-route upsert't per dag), dus dit overschrijft steeds dezelfde rij.
  async function slaOp(overrideActie?: string) {
    try {
      await fetch('/api/bot/team/1on1/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: userId, aandachtspunt, agenda, notitie: '', actie: (overrideActie ?? actieInput).trim() }),
      })
      await loadData()
    } catch {}
  }

  async function genereerAgenda() {
    if (!data) return
    setAgendaLoading(true)
    setAgendaError('')
    setAgenda('')
    setAandachtspunt('')
    setActieInput('')
    try {
      const res = await fetch('/api/bot/team/1on1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: userId, name: data.name }),
      })
      const d = await res.json()
      if (!res.ok) { setAgendaError(d.error || 'Er ging iets mis'); return }
      setAgenda(d.agenda)
      setAandachtspunt(d.aandachtspunt || '')
      await fetch('/api/bot/team/1on1/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: userId, aandachtspunt: d.aandachtspunt || '', agenda: d.agenda, notitie: '', actie: '' }),
      })
      await loadData()
    } catch {
      setAgendaError('Er ging iets mis')
    } finally {
      setAgendaLoading(false)
    }
  }

  // Debounced auto-save zodra de manager een actie typt, zodat ook dat nooit verloren gaat
  // als hij wegnavigeert zonder iets aan te klikken.
  useEffect(() => {
    if (!agenda) return
    const timer = setTimeout(() => { slaOp() }, 800)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actieInput])

  // Laatste vangnet: als de pagina verlaten wordt binnen de 800ms-debounce (bv. razendsnel
  // typen en meteen wegnavigeren), kan een lopende fetch worden afgebroken. sendBeacon is
  // het browser-mechanisme dat specifiek gegarandeerd verstuurt tijdens het verlaten van een
  // pagina, in tegenstelling tot een gewone fetch. pagehide i.p.v. beforeunload: blokkeert de
  // terug/vooruit-cache van de browser niet.
  useEffect(() => {
    if (!agenda) return
    const handler = () => {
      const payload = JSON.stringify({ targetUserId: userId, aandachtspunt, agenda, notitie: '', actie: actieInput.trim() })
      navigator.sendBeacon('/api/bot/team/1on1/save', new Blob([payload], { type: 'application/json' }))
    }
    window.addEventListener('pagehide', handler)
    return () => window.removeEventListener('pagehide', handler)
  }, [agenda, aandachtspunt, actieInput, userId])

  async function beantwoordActie(logId: string, status: 'ja' | 'nee' | 'skip') {
    setActieAnswering(true)
    try {
      const res = await fetch('/api/bot/team/1on1/note', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logId, actie_status: status }),
      })
      if (res.ok) await loadData()
    } catch {}
    setActieAnswering(false)
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
        .pdf-btn { background: none; border: 1px solid #374151; cursor: pointer; font-family: 'Bebas Neue', sans-serif; font-size: 18px; letter-spacing: 3px; color: #9ca3af; padding: 11px 32px; transition: all 0.2s; border-radius: 999px; min-width: 220px; }
        .pdf-btn:hover { border-color: #6b7280; color: #f1f5f9; }
        .pdf-btn:disabled { opacity:0.4; cursor:not-allowed; }
        .notitie-input { background:#1f2937; color:#f1f5f9; border:1.5px solid #374151; border-radius:4px; font-family:'Space Mono',monospace; font-size:15px; font-weight:400; padding:12px 16px; width:100%; outline:none; resize:none; overflow:hidden; min-height:80px; line-height:1.7; transition:border-color 0.15s; field-sizing: content; }
        .notitie-input:focus { border-color:#f59e0b; }
        .notitie-input::placeholder { color:#4b5563; }
        .btn-note { font-family:'Bebas Neue',sans-serif; font-size:13px; letter-spacing:3px; padding:6px 16px; background:none; border:1px solid #374151; color:#6b7280; border-radius:999px; cursor:pointer; transition:all 0.15s; }
        .btn-note:hover { border-color:#9ca3af; color:#9ca3af; }
        .agenda-loading { display:flex; align-items:center; gap:16px; margin-top:20px; }
        .loading-dots { display:flex; gap:6px; }
        .loading-dots span { width:7px; height:7px; border-radius:50%; background:#f59e0b; animation:dot-pulse 1.2s infinite; }
        .loading-dots span:nth-child(2) { animation-delay:0.2s; }
        .loading-dots span:nth-child(3) { animation-delay:0.4s; }
        @keyframes dot-pulse { 0%,80%,100%{opacity:0.2;transform:scale(0.85)} 40%{opacity:1;transform:scale(1)} }
        .loading-text { font-family:'Space Mono',monospace; font-size:13px; letter-spacing:4px; color:#9ca3af; }
      `}</style>

      <BotNav active="team" />

      <div style={{ minHeight: '100vh', background: '#111827' }}>
        <div style={{ maxWidth: 812, margin: '0 auto', padding: 'clamp(80px,12vw,120px) clamp(16px,4vw,20px) 80px' }}>

          <a href="/bot/team" className="back-link">← TEAM</a>

          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div className="loading-dots">
                <span /><span /><span />
              </div>
              <span className="loading-text">LADEN</span>
            </div>
          )}
          {error && (
            <p style={{ ...body, color: '#cc4444' }}>
              {error} Lukt het niet? <a href="https://wa.me/31650695999?text=Hoi%20Arno%2C%20ik%20loop%20vast%20in%20ArnoBot." style={{ color: '#f59e0b' }} target="_blank" rel="noopener noreferrer">Stuur een WhatsApp</a>.
            </p>
          )}

          {data && (
            <>
              <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 64, letterSpacing: 3, color: '#f1f5f9', lineHeight: 1, margin: '0 0 48px 0', borderBottom: '2px solid #f59e0b', paddingBottom: 32 }}>
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
                        <p style={{ fontFamily: "'Space Mono', monospace", fontWeight: 400, fontSize: 13, letterSpacing: 4, color: '#f59e0b', marginBottom: 12 }}>SYNTHESE</p>
                        <p style={body}>{data.coaching.voortgang}</p>
                      </div>
                    )}

                    <p style={{ ...body, fontSize: 13, color: '#6b7280', marginTop: 16, marginBottom: 32 }}>
                      Bijgewerkt op {formatDate(data.coaching.updated_at)}
                    </p>

                    {/* 1:1 voorbereiding */}
                    {(() => {
                      const today = new Date().toISOString().slice(0, 10)
                      const alGedaanVandaag = data.history.some(h => h.created_at.slice(0, 10) === today)
                      return alGedaanVandaag ? (
                        <button className="btn-save" onClick={genereerAgenda} disabled={agendaLoading}>
                          {agendaLoading ? 'ARNO BEREIDT VOOR...' : 'GENEREER OPNIEUW'}
                        </button>
                      ) : (
                        <button className="btn-1on1" onClick={genereerAgenda} disabled={agendaLoading}>
                          {agendaLoading ? 'ARNO BEREIDT VOOR...' : 'BEREID 1:1 VOOR'}
                        </button>
                      )
                    })()}

                    {agendaLoading && (
                      <div className="agenda-loading">
                        <div className="loading-dots">
                          <span /><span /><span />
                        </div>
                      </div>
                    )}

                    {agendaError && (
                      <p style={{ ...body, color: '#cc4444', marginTop: 16 }}>
                        {agendaError} Lukt het niet? <a href="https://wa.me/31650695999?text=Hoi%20Arno%2C%20ik%20loop%20vast%20in%20ArnoBot." style={{ color: '#f59e0b' }} target="_blank" rel="noopener noreferrer">Stuur een WhatsApp</a>.
                      </p>
                    )}

                    {agenda && (
                      <div style={{ marginTop: 32 }}>
                        <div style={{ background: '#1f2937', borderLeft: '3px solid #f59e0b', padding: '20px 24px', marginBottom: 24 }}>
                          <p style={{ fontFamily: "'Space Mono', monospace", fontWeight: 400, fontSize: 13, letterSpacing: 4, color: '#f59e0b', marginBottom: 24 }}>1:1 AGENDA</p>
                          <div style={{ ...body }} dangerouslySetInnerHTML={{ __html: renderAnalyse(agenda) }} />
                        </div>

                        <div style={{ marginBottom: 24 }}>
                          <span style={{ ...label, marginBottom: 8 }}>NIEUWE ACTIE (OPTIONEEL)</span>
                          <textarea
                            className="notitie-input"
                            placeholder="Concrete afspraak uit dit gesprek..."
                            value={actieInput}
                            rows={1}
                            onChange={e => {
                              setActieInput(e.target.value)
                              e.target.style.height = '0px'
                              e.target.style.height = e.target.scrollHeight + 'px'
                            }}
                            onBlur={() => slaOp()}
                          />
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                          <button
                            onClick={() => { slaOp(); setAgenda(''); setActieInput('') }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'Space Mono', monospace", fontSize: 13, letterSpacing: 2, color: '#6b7280', padding: 0 }}
                          >
                            SLUITEN
                          </button>
                          <DownloadOneOnOneButton
                            size="large"
                            naam={data.name}
                            datum={new Date().toISOString()}
                            agenda={agenda}
                            notitie={null}
                            actie={actieInput.trim() || null}
                            actieStatus={null}
                            mindsetScore={data.coaching?.mindset_score ?? null}
                            systeemScore={data.coaching?.systeem_score ?? null}
                            actieScore={data.coaching?.actie_score ?? null}
                          />
                        </div>
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
                    {data.history.slice(0, showAllHistory ? undefined : 5).map(h => {
                      const scores = [h.mindset_score, h.systeem_score, h.actie_score]
                      const scoreStr = scores.every(s => s === null) ? null : scores.map(s => s ?? '?').join(' / ')
                      const isNoteOpen = noteOpenId === h.id
                      const noteInput = noteInputs[h.id] ?? h.notitie ?? ''
                      const isOpen = expandedHistory === h.id
                      const heeftOpenstaandeActie = !!h.actie && !h.actie_status
                      return (
                        <div key={h.id} style={{ background: '#1f2937', borderLeft: '3px solid #374151' }}>
                          <button
                            onClick={() => setExpandedHistory(isOpen ? null : h.id)}
                            style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: '20px 24px' }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8, marginBottom: h.aandachtspunt ? 8 : 0 }}>
                              <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 12, letterSpacing: 3, color: '#6b7280' }}>
                                {wekenGeleden(h.created_at)}
                              </span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                {heeftOpenstaandeActie && (
                                  <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, letterSpacing: 2, color: '#f59e0b' }}>OPENSTAANDE ACTIE</span>
                                )}
                                {scoreStr && (
                                  <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, letterSpacing: 2, color: '#6b7280' }}>
                                    M {h.mindset_score ?? 0} · S {h.systeem_score ?? 0} · A {h.actie_score ?? 0}
                                  </span>
                                )}
                              </div>
                            </div>
                            {h.aandachtspunt && (
                              <p style={{ color: '#f1f5f9', fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, letterSpacing: 1, lineHeight: 1.4, marginBottom: 8 }}>
                                {getAnalyseTitle(h.aandachtspunt)}
                              </p>
                            )}
                            <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 13, letterSpacing: 2, color: isOpen ? '#f59e0b' : '#6b7280' }}>
                              {isOpen ? '↑ SLUITEN' : '↓ OPEN'}
                            </span>
                          </button>
                          {isOpen && (
                            <div style={{ padding: '0 24px 20px' }}>
                              {h.actie && (
                                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                                  <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 12, letterSpacing: 3, color: '#6b7280' }}>
                                    {h.actie_status ? 'Actie:' : 'Openstaande actie(s):'}
                                  </span>
                                  <span style={{ ...body, marginBottom: 0 }}>{h.actie}</span>
                                  {h.actie_status && (
                                    <span style={{
                                      fontFamily: "'Space Mono', monospace", fontSize: 11, letterSpacing: 2,
                                      color: h.actie_status === 'ja' ? '#44cc88' : h.actie_status === 'nee' ? '#cc4444' : '#6b7280',
                                    }}>
                                      {h.actie_status === 'ja' ? '✓ GEDAAN' : h.actie_status === 'nee' ? '✗ NIET GEDAAN' : '— OVERGESLAGEN'}
                                    </span>
                                  )}
                                </div>
                              )}
                              {/* h.aandachtspunt hierboven in de kop is al een AI-extract uit h.agenda
                                  (zie extractAandachtspunt() in de 1on1-route), dus hieronder alleen
                                  de volledige agenda tonen, niet het aandachtspunt nogmaals los
                                  eronder herhalen. Zelfde duplicatie als eerder in de 1:1-PDF gefixt. */}
                              {h.agenda && (
                                <div style={{ marginBottom: 12, borderLeft: '3px solid #374151', paddingLeft: 16 }}>
                                  <div style={{ ...body }} dangerouslySetInnerHTML={{ __html: renderAnalyse(h.agenda) }} />
                                </div>
                              )}
                              {h.notitie && !isNoteOpen && (
                                <p style={{ ...body, fontSize: 13, color: '#6b7280', fontStyle: 'italic', marginBottom: 12 }}>{h.notitie}</p>
                              )}
                              {isNoteOpen ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                                  <textarea
                                    className="notitie-input"
                                    placeholder="Notitie over het gesprek..."
                                    value={noteInput}
                                    rows={1}
                                    onChange={e => {
                                      setNoteInputs(prev => ({ ...prev, [h.id]: e.target.value }))
                                      e.target.style.height = '0px'
                                      e.target.style.height = e.target.scrollHeight + 'px'
                                    }}
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
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
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
                                  {h.agenda && data && (
                                    <DownloadOneOnOneButton
                                      naam={data.name}
                                      datum={h.created_at}
                                      agenda={h.agenda}
                                      notitie={h.notitie}
                                      actie={h.actie}
                                      actieStatus={h.actie_status}
                                      mindsetScore={h.mindset_score}
                                      systeemScore={h.systeem_score}
                                      actieScore={h.actie_score}
                                    />
                                  )}
                                </div>
                              )}
                              {noteSavedId === h.id && !isNoteOpen && (
                                <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, letterSpacing: 2, color: '#44cc88', marginLeft: 8 }}>✓</span>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {data.history.length > 5 && (
                    <div style={{ borderTop: '1px solid #374151', padding: '28px 0', textAlign: 'center' }}>
                      <button
                        onClick={() => setShowAllHistory(v => !v)}
                        style={{ background: 'none', border: '1px solid #374151', cursor: 'pointer', fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 3, color: '#9ca3af', padding: '12px 32px', borderRadius: 999, transition: 'all 0.15s' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#f59e0b'; (e.currentTarget as HTMLButtonElement).style.color = '#f59e0b' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#374151'; (e.currentTarget as HTMLButtonElement).style.color = '#9ca3af' }}
                      >
                        {showAllHistory ? 'TOON MINDER ↑' : `TOON ALLE ${data.history.length} 1:1'S ↓`}
                      </button>
                    </div>
                  )}

                  {(() => {
                    // Alle openstaande acties, niet alleen de meest recente: zonder dit gat had
                    // een actie die niet de allerlaatste 1:1 was nergens meer een knop om 'm op
                    // GEDAAN/NIET GEDAAN/OVERSLAAN te zetten, en bleef die voor altijd hangen.
                    const openstaand = data.history.filter(h => h.actie && !h.actie_status)
                    if (openstaand.length === 0) return null
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
                        {openstaand.map(h => (
                          <div key={h.id} style={{ background: '#1f2937', borderLeft: '3px solid #f59e0b', padding: '20px 24px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                              <p style={{ fontFamily: "'Space Mono', monospace", fontWeight: 400, fontSize: 13, letterSpacing: 4, color: '#f59e0b' }}>OPENSTAANDE ACTIE</p>
                              <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 12, letterSpacing: 3, color: '#6b7280' }}>{wekenGeleden(h.created_at)}</span>
                            </div>
                            <p style={{ ...body, marginBottom: 20 }}>{h.actie}</p>
                            <div style={{ display: 'flex', gap: 8, maxWidth: 480, flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
                              {([
                                { label: 'GEDAAN', status: 'ja' as const, primary: true },
                                { label: 'NIET GEDAAN', status: 'nee' as const, primary: false },
                                { label: 'OVERSLAAN', status: 'skip' as const, primary: false },
                              ] as const).map(({ label, status, primary }) => (
                                <button
                                  key={status}
                                  onClick={() => beantwoordActie(h.id, status)}
                                  disabled={actieAnswering}
                                  style={{
                                    flex: 1,
                                    fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, letterSpacing: 2,
                                    padding: '10px 4px', borderRadius: 999, cursor: actieAnswering ? 'not-allowed' : 'pointer',
                                    background: primary ? '#f59e0b' : 'none',
                                    color: primary ? '#111827' : '#9ca3af',
                                    border: primary ? 'none' : '1px solid #374151',
                                    opacity: actieAnswering ? 0.6 : 1,
                                    transition: 'all 0.15s',
                                  }}
                                >{label}</button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                  })()}
                </div>
              )}

              {/* Gedeeld door lid */}
              {data.sharedAnalyses && data.sharedAnalyses.length > 0 && (
                <div style={section}>
                  <span style={label}>GEDEELD DOOR TEAMLID</span>
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
                          {isMobile ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              <span style={{ color: '#9ca3af', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', fontFamily: "'Space Mono', monospace" }}>
                                {formatDate(a.analyse_created_at)}
                              </span>
                              <p style={{ color: '#f1f5f9', fontSize: 20, fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 1, lineHeight: 1.4, margin: 0 }}>
                                {getAnalyseTitle(a.analyse_text)}
                              </p>
                              <span style={{ color: expandedAnalyse === a.id ? '#f59e0b' : '#9ca3af', fontSize: 18, fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 2 }}>
                                {expandedAnalyse === a.id ? '↑ SLUITEN' : '↓ OPEN'}
                              </span>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 24 }}>
                              <span style={{ color: '#9ca3af', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', whiteSpace: 'nowrap', width: 195, flexShrink: 0, paddingTop: 2, fontFamily: "'Space Mono', monospace" }}>
                                {formatDate(a.analyse_created_at)}
                              </span>
                              <div style={{ flex: 1 }}>
                                <p style={{ color: '#f1f5f9', fontSize: 20, fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 1, lineHeight: 1.4 }}>
                                  {getAnalyseTitle(a.analyse_text)}
                                </p>
                              </div>
                              <span style={{ color: expandedAnalyse === a.id ? '#f59e0b' : '#9ca3af', fontSize: 18, fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 2, flexShrink: 0, paddingTop: 2 }}>
                                {expandedAnalyse === a.id ? '↑ SLUITEN' : '↓ OPEN'}
                              </span>
                            </div>
                          )}
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
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'Space Mono', monospace", fontSize: 13, letterSpacing: 4, color: '#6b7280', padding: 0, textDecoration: 'none' }}
                  >
                    VERWIJDER UIT TEAM
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
