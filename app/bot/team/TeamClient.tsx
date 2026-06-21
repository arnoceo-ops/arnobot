'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import BotNav from '@/app/bot/BotNav'

function formatLast(iso: string | null) {
  if (!iso) return 'Nog niet actief'
  const d = new Date(iso)
  const diff = Math.round((Date.now() - d.getTime()) / 86400000)
  if (diff === 0) return 'Vandaag'
  if (diff === 1) return 'Gisteren'
  if (diff < 7) return `${diff} dagen geleden`
  return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
}

function activiteitsSignaal(sessions: number, last_activity: string | null): { label: string; color: string; dot: string } {
  if (sessions === 0 || !last_activity) return { label: 'GEEN', color: '#374151', dot: '#374151' }
  const dagen = Math.round((Date.now() - new Date(last_activity).getTime()) / 86400000)
  if (dagen <= 7)  return { label: 'ACTIEF',    color: '#44cc88', dot: '#44cc88' }
  if (dagen <= 14) return { label: 'INACTIEF',  color: '#f59e0b', dot: '#f59e0b' }
  return               { label: 'STAGNATIE', color: '#cc4444', dot: '#cc4444' }
}

interface Member {
  user_id: string
  name: string
  role: string
  profiel_rol: string | null
  sessions: number
  last_activity: string | null
  analyses: number
}

interface TeamAnalyse {
  id: string
  analyse_text: string
  created_at: string
}

function formatAnalyseDate(iso: string) {
  return new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase()
}

interface Team {
  id: string
  name: string
  invite_code: string
}

function renderAnalyse(text: string): string {
  const safe = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  const items = safe.split('\n').map(line => {
    const t = line.trim()
    if (!t) return ''
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
  color: disabled ? '#374151' : '#111827',
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
        if (data.team) setTeam(data.team)
        setMembers(data.members ?? [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
    fetch('/api/bot/team/spotlight')
      .then(r => r.json())
      .then(data => setTeamAnalyses(data.analyses ?? []))
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

              <div style={section}>
                <span style={label}>TEAMLEDEN ({members.length})</span>
                {members.length === 0 ? (
                  <p style={body}>Nog geen teamleden. Stuur de uitnodigingslink naar je team.</p>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: "'Space Mono', monospace", fontWeight: 400 }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid #374151' }}>
                          {['', 'NAAM', 'ROL', 'GESPREKKEN', 'LAATSTE ACTIVITEIT', 'ANALYSES'].map(h => (
                            <th key={h} style={{ textAlign: 'left', fontFamily: "'Space Mono', monospace", fontWeight: 400, fontSize: 13, letterSpacing: 2, color: '#6b7280', padding: '8px 16px 12px 0' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {members.map(m => {
                          const signaal = activiteitsSignaal(m.sessions, m.last_activity)
                          return (
                          <tr
                            key={m.user_id}
                            onClick={() => router.push(`/bot/team/lid/${m.user_id}`)}
                            style={{ borderBottom: '1px solid #374151', cursor: 'pointer', transition: 'background 0.15s' }}
                            onMouseEnter={e => (e.currentTarget.style.background = '#1e293b')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                          >
                            <td style={{ padding: '16px 16px 16px 0', whiteSpace: 'nowrap' }}>
                              <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: signaal.dot, marginRight: 8, verticalAlign: 'middle' }} />
                              <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, letterSpacing: 2, color: signaal.color, verticalAlign: 'middle' }}>{signaal.label}</span>
                            </td>
                            <td style={{ padding: '16px 16px 16px 0', fontWeight: 400, fontSize: 15, color: '#f1f5f9' }}>{m.name}</td>
                            <td style={{ padding: '16px 16px 16px 0', fontFamily: "'Space Mono', monospace", fontWeight: 400, fontSize: 13, letterSpacing: 2, color: m.role === 'manager' ? '#f59e0b' : '#6b7280' }}>
                              {m.role === 'manager' ? 'MANAGER' : (m.profiel_rol?.toUpperCase() ?? 'LID')}
                            </td>
                            <td style={{ padding: '16px 16px 16px 0', fontWeight: 400, fontSize: 15, color: m.sessions > 0 ? '#f1f5f9' : '#6b7280' }}>{m.sessions}</td>
                            <td style={{ padding: '16px 16px 16px 0', fontWeight: 400, fontSize: 15, color: '#9ca3af' }}>{formatLast(m.last_activity)}</td>
                            <td style={{ padding: '16px 0', fontWeight: 400, fontSize: 15, color: m.analyses > 0 ? '#f1f5f9' : '#6b7280' }}>{m.analyses}</td>
                          </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div style={section}>
                <span style={label}>COLLECTIEVE ANALYSE</span>
                <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, letterSpacing: 2, color: '#f1f5f9', lineHeight: 1, margin: '0 0 16px 0' }}>TEAM SPOTLIGHT</h2>
                <p style={{ ...body, marginBottom: 32 }}>
                  Arno analyseert de collectieve gesprekken van je team: gemeenschappelijke patronen, sterktes en groeikansen.
                </p>
                <button
                  onClick={generateSpotlight}
                  disabled={spotlightLoading || members.length < 2}
                  style={{ ...btnPrimary(members.length < 2), opacity: spotlightLoading ? 0.6 : 1, marginBottom: 32 }}
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
                {teamAnalyses.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                    {teamAnalyses.map(a => (
                      <div key={a.id}>
                        <span style={{ ...label, marginBottom: 16 }}>{formatAnalyseDate(a.created_at)}</span>
                        <div style={{ background: '#1f2937', borderLeft: '4px solid #f59e0b', padding: '24px 28px' }}>
                          <div style={{ ...body, marginBottom: 0 }} dangerouslySetInnerHTML={{ __html: renderAnalyse(a.analyse_text) }} />
                        </div>
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
