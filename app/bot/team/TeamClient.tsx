'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import BotNav from '@/app/bot/BotNav'
import { ProgressieChart, type ScorePoint } from '@/app/bot/components/ProgressieChart'

function formatLast(iso: string | null) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
}

function activiteitsSignaal(sessions: number, last_activity: string | null, minIntervalDagen: number | null): { label: string; color: string; dot: string } {
  if (sessions === 0 || !last_activity) return { label: 'GEEN', color: '#374151', dot: '#374151' }
  if (!minIntervalDagen) return { label: '', color: 'transparent', dot: 'transparent' }
  const dagen = Math.round((Date.now() - new Date(last_activity).getTime()) / 86400000)
  if (dagen <= minIntervalDagen)        return { label: 'ACTIEF',    color: '#44cc88', dot: '#44cc88' }
  if (dagen <= minIntervalDagen * 1.5)  return { label: 'INACTIEF',  color: '#f59e0b', dot: '#f59e0b' }
  return                                       { label: 'STAGNATIE', color: '#cc4444', dot: '#cc4444' }
}

interface Member {
  user_id: string
  name: string
  role: string
  profiel_rol: string | null
  sessions: number
  last_activity: string | null
  analyses: number
  mindset_score: number | null
  systeem_score: number | null
  actie_score: number | null
}

function msaTotal(m: Member): number | null {
  if (m.mindset_score == null || m.systeem_score == null || m.actie_score == null) return null
  return Math.max(1, Math.ceil((m.mindset_score * m.systeem_score * m.actie_score) / 1.25))
}

interface TeamAnalyse {
  id: string
  analyse_text: string
  created_at: string
}

function formatAnalyseDate(iso: string) {
  return new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })
}

function getAnalyseTitle(text: string): string {
  const clean = text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/[—–]/g, '')
    .replace(/\n/g, ' ')
    .trim()
  if (clean.length <= 80) return clean
  const cut = clean.slice(0, 77)
  const lastSpace = cut.lastIndexOf(' ')
  return (lastSpace > 40 ? cut.slice(0, lastSpace) : cut) + '...'
}

interface Team {
  id: string
  name: string
  invite_code: string
  min_interval_dagen: number | null
}

function renderAnalyse(text: string): string {
  const safe = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

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

  // Strip documenttitel als AI die toch genereert (bijv. "TEAM X – TEAMANALYSE")
  if (items[0]?.startsWith('<span class="ah">') && items[0].toUpperCase().includes('ANALYSE')) {
    items.shift()
  }

  // Koppen zijn display:block met eigen margins — geen <br> voor of na een kop
  return items.map((item, i) => {
    const isHeading = item.startsWith('<span class="ah">')
    const nextIsHeading = items[i + 1]?.startsWith('<span class="ah">') ?? true
    if (isHeading || nextIsHeading) return item
    return item + '<br>'
  }).join('')
}

const label: React.CSSProperties = {
  fontFamily: "'Space Mono', monospace", fontWeight: 400,
  fontSize: 13, letterSpacing: 4, color: '#f59e0b',
  display: 'block', marginBottom: 16,
}

const body: React.CSSProperties = {
  fontFamily: "'Space Mono', monospace", fontWeight: 400,
  fontSize: 15, color: '#9ca3af', lineHeight: '1.9', marginBottom: 24,
}

const section: React.CSSProperties = {
  borderTop: '1px solid #374151', paddingTop: 32, marginBottom: 48,
}

const btnPrimary = (disabled: boolean): React.CSSProperties => ({
  fontFamily: "'Bebas Neue', sans-serif",
  fontSize: 18, letterSpacing: 3,
  padding: '12px 36px',
  background: disabled ? '#374151' : '#f59e0b',
  color: disabled ? '#6b7280' : '#111827',
  border: 'none', borderRadius: 999,
  cursor: disabled ? 'not-allowed' : 'pointer',
  transition: 'background 0.2s',
})

const btnOutline: React.CSSProperties = {
  fontFamily: "'Bebas Neue', sans-serif",
  fontSize: 18, letterSpacing: 3,
  padding: '12px 32px',
  background: 'none', border: '1px solid #374151',
  color: '#9ca3af', borderRadius: 999,
  cursor: 'pointer', transition: 'all 0.2s',
}

export default function TeamClient() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [isManager, setIsManager] = useState(false)
  const [hasTeam, setHasTeam] = useState(false)
  const [team, setTeam] = useState<Team | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [teamName, setTeamName] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [copied, setCopied] = useState(false)
  const [spotlightLoading, setSpotlightLoading] = useState(false)
  const [teamAnalyses, setTeamAnalyses] = useState<TeamAnalyse[]>([])
  const [expandedAnalyse, setExpandedAnalyse] = useState<string | null>(null)
  const [minIntervalDagen, setMinIntervalDagen] = useState<number | null>(null)
  const [ritmeSaved, setRitmeSaved] = useState(false)
  const [teamScores, setTeamScores] = useState<ScorePoint[]>([])

  useEffect(() => {
    fetch('/api/bot/team/status')
      .then(r => r.json())
      .then(data => {
        setHasTeam(data.hasTeam)
        setIsManager(data.isManager)
        if (data.isManager && data.hasTeam) {
          setTeam(data.team)
          loadDashboard()
        } else if (data.hasTeam && !data.isManager) {
          router.replace('/bot')
        } else {
          setLoading(false)
        }
      })
      .catch(() => setLoading(false))
  }, [])

  function loadDashboard() {
    fetch('/api/bot/team/dashboard')
      .then(r => r.json())
      .then(data => {
        if (data.team) {
          setTeam(data.team)
          setMinIntervalDagen(data.team.min_interval_dagen ?? null)
        }
        setMembers(data.members ?? [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
    fetch('/api/bot/team/spotlight')
      .then(r => r.json())
      .then(data => setTeamAnalyses(data.analyses ?? []))
      .catch(() => {})
    fetch('/api/bot/team/scores')
      .then(r => r.json())
      .then(data => setTeamScores(data.scores ?? []))
      .catch(() => {})
  }

  async function createTeam() {
    if (!teamName.trim()) return
    setCreating(true)
    setCreateError('')
    try {
      const res = await fetch('/api/bot/team/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: teamName.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { setCreateError(data.error || 'Mislukt'); return }
      window.location.reload()
    } catch {
      setCreateError('Er ging iets mis')
    } finally {
      setCreating(false)
    }
  }

  async function generateSpotlight() {
    setSpotlightLoading(true)
    try {
      const res = await fetch('/api/bot/team/spotlight', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error || 'Niet genoeg data beschikbaar.')
      } else {
        const updated = await fetch('/api/bot/team/spotlight').then(r => r.json())
        setTeamAnalyses(updated.analyses ?? [])
      }
    } catch {
      alert('Er ging iets mis.')
    } finally {
      setSpotlightLoading(false)
    }
  }

  function isOnderRitme(last_activity: string | null): boolean {
    if (!minIntervalDagen || !last_activity) return false
    const dagen = Math.round((Date.now() - new Date(last_activity).getTime()) / 86400000)
    return dagen > minIntervalDagen
  }

  async function handleRitmeChange(value: string) {
    const val = value === '' ? null : Number(value)
    setMinIntervalDagen(val)
    setRitmeSaved(false)
    try {
      await fetch('/api/bot/team/ritme', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ min_interval_dagen: val }),
      })
      setRitmeSaved(true)
      setTimeout(() => setRitmeSaved(false), 2000)
    } catch {}
  }

  function copyInviteLink() {
    if (!team) return
    navigator.clipboard.writeText(`${window.location.origin}/bot/team/join?code=${team.invite_code}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Space+Mono:wght@400;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #111827; color: #f1f5f9; font-family: 'Space Mono', monospace; font-weight: 400; }
        .team-input {
          background: #1f2937; color: #f1f5f9; border: 1.5px solid #374151; border-radius: 4px;
          font-family: 'Space Mono', monospace; font-size: 15px; font-weight: 400;
          padding: 12px 16px; width: 100%; outline: none;
          box-sizing: border-box; transition: border-color 0.15s; line-height: 1.9;
        }
        .team-input:focus { border-color: #f59e0b; }
        .team-input::placeholder { color: #4b5563; }
        .btn-outline:hover { border-color: #f59e0b !important; color: #f59e0b !important; }
        .ah { font-family:'Space Mono',monospace; font-weight:400; font-size:13px; letter-spacing:4px; color:#f1f5f9; display:block; margin:24px 0 8px; }
        .ah:first-child { margin-top:0; }
        .analyse-item-full { color:#9ca3af; font-size:15px; line-height:1.9; font-family:'Space Mono',monospace; background:#1f2937; border-left:3px solid #f59e0b; padding:20px 24px; margin-bottom:8px; }
      `}</style>

      <BotNav active="team" />

      <div style={{ minHeight: '100vh', background: '#111827' }}>
        <div style={{ maxWidth: 812, margin: '0 auto', padding: 'clamp(80px,12vw,120px) clamp(16px,4vw,20px) 80px' }}>

          {loading && (
            <p style={{ ...body, color: '#6b7280', letterSpacing: 2 }}>LADEN...</p>
          )}

          {/* Team aanmaken */}
          {!loading && !hasTeam && (
            <>
              <p style={{ ...label, marginBottom: 8 }}>ARNOBOT</p>
              <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 64, letterSpacing: 3, color: '#f1f5f9', lineHeight: 1, margin: '0 0 48px 0' }}>
                START JE TEAM.
              </h1>

              <div style={{ background: '#1f2937', borderLeft: '4px solid #f59e0b', padding: '20px 24px', marginBottom: 48 }}>
                <p style={{ ...body, color: '#9ca3af', marginBottom: 0 }}>
                  Maak een team aan en nodig je salesteam uit via een persoonlijke link. Als manager zie je de voortgang en collectieve patronen van je hele team.
                </p>
              </div>

              <div style={{ maxWidth: 480 }}>
                <span style={label}>TEAMNAAM</span>
                <input
                  type="text"
                  className="team-input"
                  value={teamName}
                  onChange={e => setTeamName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && createTeam()}
                  placeholder="bijv. Sales Team Noord"
                  style={{ marginBottom: 16 }}
                />
                {createError && <p style={{ ...body, color: '#ff4444', marginBottom: 12 }}>{createError}</p>}
                <button onClick={createTeam} disabled={creating || !teamName.trim()} style={btnPrimary(creating || !teamName.trim())}>
                  {creating ? 'AANMAKEN...' : 'TEAM AANMAKEN'}
                </button>
              </div>
            </>
          )}

          {/* Dashboard */}
          {!loading && hasTeam && isManager && team && (
            <>
              <p style={{ ...label, marginBottom: 8 }}>TEAM</p>
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 48, borderBottom: '3px solid #f59e0b', paddingBottom: 32 }}>
                <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 64, letterSpacing: 3, color: '#f1f5f9', lineHeight: 1, margin: 0 }}>
                  {team.name.toUpperCase()}
                </h1>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <button className="btn-outline" onClick={copyInviteLink} style={{ ...btnOutline, color: copied ? '#f59e0b' : '#9ca3af', borderColor: copied ? '#f59e0b' : '#374151' }}>
                    {copied ? 'GEKOPIEERD!' : 'KOPIEER UITNODIGINGSLINK'}
                  </button>
                </div>
              </div>

              {teamScores.length > 0 && (
                <div style={section}>
                  <span style={label}>TEAMSCORES</span>
                  <ProgressieChart history={teamScores} />
                </div>
              )}

              <div style={section}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
                  <span style={label}>TEAMLEDEN ({members.length})</span>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                    <span style={{ fontFamily: "'Space Mono', monospace", fontWeight: 400, fontSize: 13, letterSpacing: 4, color: '#f59e0b' }}>MINIMUMFREQUENTIE</span>
                    <select
                      value={minIntervalDagen ?? ''}
                      onChange={e => handleRitmeChange(e.target.value)}
                      className="team-input"
                      style={{ maxWidth: 220, padding: '8px 12px', fontSize: 13 }}
                    >
                      <option value="">Geen drempel</option>
                      <option value="7">1x per week</option>
                      <option value="14">1x per 2 weken</option>
                      <option value="30">1x per maand</option>
                    </select>
                  </div>
                </div>
                {members.length === 0 ? (
                  <p style={body}>Nog geen teamleden. Stuur de uitnodigingslink naar je team.</p>
                ) : (
                  <>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: "'Space Mono', monospace", fontWeight: 400, tableLayout: 'fixed' }}>
                        <colgroup>
                          <col style={{ width: minIntervalDagen ? 24 : 0 }} />
                          <col />
                          <col style={{ width: 80 }} />
                          <col style={{ width: 80 }} />
                          <col style={{ width: 90 }} />
                          <col style={{ width: 100 }} />
                        </colgroup>
                        <thead>
                          <tr style={{ borderBottom: '1px solid #374151' }}>
                            {['', 'NAAM', 'MSA', 'GESPR.', 'ANALYSES', 'DATUM'].map(h => (
                              <th key={h} style={{ textAlign: 'left', fontFamily: "'Space Mono', monospace", fontWeight: 400, fontSize: 13, letterSpacing: 2, color: '#6b7280', padding: '8px 16px 12px 0' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {members.map(m => {
                            const signaal = activiteitsSignaal(m.sessions, m.last_activity, minIntervalDagen)
                            const onderRitme = isOnderRitme(m.last_activity)
                            return (
                            <tr
                              key={m.user_id}
                              onClick={() => router.push(`/bot/team/lid/${m.user_id}`)}
                              style={{ borderBottom: '1px solid #374151', cursor: 'pointer', transition: 'background 0.15s' }}
                              onMouseEnter={e => (e.currentTarget.style.background = '#1e293b')}
                              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                            >
                              <td style={{ padding: minIntervalDagen ? '16px 12px 16px 0' : 0, width: minIntervalDagen ? 16 : 0, overflow: 'hidden' }}>
                                <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: signaal.dot, verticalAlign: 'middle' }} />
                              </td>
                              <td style={{ padding: '16px 16px 16px 0', fontWeight: 400, fontSize: 15, color: '#f1f5f9' }}>{m.name}</td>
                              <td style={{ padding: '16px 16px 16px 0', fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 1, color: msaTotal(m) != null ? '#f1f5f9' : '#374151' }}>
                                {msaTotal(m) ?? '·'}
                              </td>
                              <td style={{ padding: '16px 16px 16px 0', fontWeight: 400, fontSize: 15, color: m.sessions > 0 ? '#f1f5f9' : '#6b7280' }}>{m.sessions}</td>
                              <td style={{ padding: '16px 16px 16px 0', fontWeight: 400, fontSize: 15, color: m.analyses > 0 ? '#f1f5f9' : '#6b7280' }}>{m.analyses}</td>
                              <td style={{ padding: '16px 0', fontWeight: 400, fontSize: 15, color: onderRitme ? '#f59e0b' : '#9ca3af' }}>{formatLast(m.last_activity)}</td>
                            </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>

              <div style={section}>
                <span style={label}>COLLECTIEVE ANALYSE</span>
                <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, letterSpacing: 2, color: '#f1f5f9', lineHeight: 1, margin: '0 0 16px 0' }}>TEAM SPOTLIGHT</h2>
                <p style={{ ...body, marginBottom: 32 }}>
                  ArnoBot analyseert de collectieve gesprekken van je team: gemeenschappelijke patronen, sterktes en groeikansen.
                </p>
                {(() => {
                  // Nieuwe analyse mogelijk vanaf maandag 5:00 lokale tijd
                  const now = new Date()
                  const dayOfWeek = now.getDay() // 0=zo, 1=ma
                  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
                  const weekStart = new Date(now)
                  weekStart.setDate(now.getDate() - daysFromMonday)
                  weekStart.setHours(5, 0, 0, 0)
                  if (now < weekStart) weekStart.setDate(weekStart.getDate() - 7)

                  const blokkeerd = teamAnalyses.length > 0 &&
                    new Date(teamAnalyses[0].created_at) >= weekStart

                  const nextMonday = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000)
                  const nextMondayLabel = nextMonday.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' })

                  const uitgeschakeld = members.length < 2 || blokkeerd
                  return (
                    <>
                      <button
                        onClick={generateSpotlight}
                        disabled={spotlightLoading || uitgeschakeld}
                        style={{ ...btnPrimary(uitgeschakeld), opacity: spotlightLoading || blokkeerd ? 0.6 : 1, marginBottom: 32 }}
                      >
                        {spotlightLoading ? 'ARNO ANALYSEERT...' : 'GENEREER TEAM-ANALYSE'}
                      </button>
                      {spotlightLoading && (
                        <p style={{ fontFamily: "'Space Mono', monospace", fontWeight: 400, fontSize: 13, color: '#6b7280', marginBottom: 32 }}>
                          Arno analyseert je team...
                        </p>
                      )}
                      {members.length < 2 && (
                        <p style={{ ...body, fontSize: 13, color: '#6b7280', marginBottom: 40 }}>Minimaal 2 teamleden nodig voor een team-analyse.</p>
                      )}
                      {blokkeerd && (
                        <p style={{ ...body, fontSize: 13, color: '#6b7280', marginBottom: 40 }}>
                          Er is al een analyse van deze week. Nieuwe analyse beschikbaar maandag {nextMondayLabel} vanaf 5:00.
                        </p>
                      )}
                    </>
                  )
                })()}
                {teamAnalyses.length > 0 && (
                  <div>
                    {teamAnalyses.map(a => (
                      <div key={a.id} style={{ borderTop: '1px solid #374151' }}>
                        <button
                          onClick={() => setExpandedAnalyse(expandedAnalyse === a.id ? null : a.id)}
                          style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: '20px 0' }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                            <span style={{ color: '#9ca3af', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', whiteSpace: 'nowrap', minWidth: 120, fontFamily: "'Space Mono', monospace" }}>
                              {formatAnalyseDate(a.created_at)}
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
                )}
              </div>
            </>
          )}

        </div>
      </div>
    </>
  )
}
