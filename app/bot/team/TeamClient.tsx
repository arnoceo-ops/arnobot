'use client'

import { useState, useEffect, useRef, useLayoutEffect } from 'react'
import { useRouter } from 'next/navigation'
import BotNav from '@/app/bot/BotNav'
import DownloadTeamPdfButton from './DownloadTeamPdfButton'
import { ProgressieChart, type ScorePoint } from '@/app/bot/components/ProgressieChart'
import { useIsMobile } from '@/hooks/useBreakpoint'
import { computeMsaScore } from '@/lib/msa'

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
  return computeMsaScore(m.mindset_score, m.systeem_score, m.actie_score)
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
  // Sla een leidende sectiekop (bijv. "PER PIJLER") over, anders begint het voorbeeld in de
  // ingeklapte lijst met de kop zelf i.p.v. met de eerste inhoudelijke zin.
  const zonderKop = text.replace(/^[A-Z][A-Z\s]{2,58}\n+/, '')
  const clean = (zonderKop || text)
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
  const [spotlightError, setSpotlightError] = useState('')
  const [teamAnalyses, setTeamAnalyses] = useState<TeamAnalyse[]>([])
  const [expandedAnalyse, setExpandedAnalyse] = useState<string | null>(null)
  const [minIntervalDagen, setMinIntervalDagen] = useState<number | null>(null)
  const [ritmeSaved, setRitmeSaved] = useState(false)
  const [teamScores, setTeamScores] = useState<ScorePoint[]>([])
  const [oneOnOneRitme, setOneOnOneRitme] = useState<{ laatste30Dagen: number; followThroughPct: number | null; openstaandOuderDan14Dagen: number; totaalActies: number; dekkingAantal: number; dekkingTotaal: number; perLid: { user_id: string; naam: string; laatste30Dagen: number; perWeek: number }[] } | null>(null)
  const [sortBy, setSortBy] = useState<'naam' | 'msa' | 'sessies' | 'analyses' | 'datum' | 'eenopeen' | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const isMobile = useIsMobile()
  const inviteBtnRef = useRef<HTMLButtonElement>(null)
  const [inviteBtnWidth, setInviteBtnWidth] = useState<number | undefined>(undefined)

  // TEAM-RAPPORT-knop moet exact even breed zijn als UITNODIGINGSLINK (Arno's stijleis). Geen
  // vaste pixelwaarde gokken (lettertype-metrics zijn browserafhankelijk), maar de daadwerkelijk
  // gerenderde breedte van de eerste knop meten en op de tweede toepassen. Gemeten vóór de
  // gebruiker ooit op "kopieer" klikt, dus altijd de "UITNODIGINGSLINK"-breedte, niet de kortere
  // "GEKOPIEERD!"-tekst.
  useLayoutEffect(() => {
    if (inviteBtnRef.current) setInviteBtnWidth(inviteBtnRef.current.offsetWidth)
  }, [team])

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
        setOneOnOneRitme(data.oneOnOneRitme ?? null)
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
        setSpotlightError(data.error || 'Niet genoeg data beschikbaar.')
      } else {
        const updated = await fetch('/api/bot/team/spotlight').then(r => r.json())
        setTeamAnalyses(updated.analyses ?? [])
      }
    } catch {
      setSpotlightError('Er ging iets mis.')
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

  function toggleSort(col: 'naam' | 'msa' | 'sessies' | 'analyses' | 'datum' | 'eenopeen') {
    if (sortBy === col) {
      if (sortDir === 'asc') setSortDir('desc')
      else { setSortBy(null); setSortDir('asc') }
    } else {
      setSortBy(col); setSortDir('asc')
    }
  }

  const laatsteTeamScore = teamScores.length > 0 ? teamScores[teamScores.length - 1] : null
  const teamMsaValue = laatsteTeamScore && laatsteTeamScore.mindset_score != null && laatsteTeamScore.systeem_score != null && laatsteTeamScore.actie_score != null
    ? computeMsaScore(laatsteTeamScore.mindset_score, laatsteTeamScore.systeem_score, laatsteTeamScore.actie_score)
    : null

  const eenOpEenMap: Record<string, number> = {}
  for (const p of oneOnOneRitme?.perLid ?? []) eenOpEenMap[p.user_id] = p.laatste30Dagen

  const sortedMembers = sortBy === null ? members : [...members].sort((a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1
    if (sortBy === 'naam') return dir * a.name.localeCompare(b.name, 'nl')
    if (sortBy === 'msa') return dir * ((msaTotal(a) ?? -1) - (msaTotal(b) ?? -1))
    if (sortBy === 'sessies') return dir * (a.sessions - b.sessions)
    if (sortBy === 'analyses') return dir * (a.analyses - b.analyses)
    if (sortBy === 'eenopeen') return dir * ((eenOpEenMap[a.user_id] ?? 0) - (eenOpEenMap[b.user_id] ?? 0))
    if (sortBy === 'datum') {
      const da = a.last_activity ? new Date(a.last_activity).getTime() : 0
      const db = b.last_activity ? new Date(b.last_activity).getTime() : 0
      return dir * (da - db)
    }
    return 0
  })

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
        .pdf-btn { background: none; border: 1px solid #374151; cursor: pointer; font-family: 'Bebas Neue', sans-serif; font-size: 18px; letter-spacing: 3px; color: #9ca3af; padding: 11px 32px; transition: all 0.2s; border-radius: 999px; min-width: 220px; }
        .pdf-btn:hover { border-color: #6b7280; color: #f1f5f9; }
        .pdf-btn:disabled { opacity:0.4; cursor:not-allowed; }
        .loading-dots { display:flex; gap:6px; }
        .loading-dot { width:7px; height:7px; border-radius:50%; background:#f59e0b; animation:dot-pulse 1.2s infinite; }
        .loading-dot:nth-child(2) { animation-delay:0.2s; }
        .loading-dot:nth-child(3) { animation-delay:0.4s; }
        @keyframes dot-pulse { 0%,80%,100%{opacity:0.2;transform:scale(0.85)} 40%{opacity:1;transform:scale(1)} }
        .ah { font-family:'Space Mono',monospace; font-weight:400; font-size:13px; letter-spacing:4px; color:#f1f5f9; display:block; margin:24px 0 8px; }
        .ah:first-child { margin-top:0; }
        .analyse-item-full { color:#9ca3af; font-size:15px; line-height:1.9; font-family:'Space Mono',monospace; background:#1f2937; border-left:3px solid #f59e0b; padding:20px 24px; margin-bottom:8px; }
      `}</style>

      <BotNav active="team" />

      <div style={{ minHeight: '100vh', background: '#111827' }}>
        <div style={{ maxWidth: 812, margin: '0 auto', padding: 'clamp(80px,12vw,120px) clamp(16px,4vw,20px) 80px' }}>

          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div className="loading-dots">
                <div className="loading-dot" />
                <div className="loading-dot" />
                <div className="loading-dot" />
              </div>
              <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, letterSpacing: 4, color: '#9ca3af' }}>LADEN</span>
            </div>
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
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 48, borderBottom: '2px solid #f59e0b', paddingBottom: 32 }}>
                <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 64, letterSpacing: 3, color: '#f1f5f9', lineHeight: 1, margin: 0 }}>
                  {team.name.toUpperCase()}
                </h1>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                  <button ref={inviteBtnRef} className="btn-outline" onClick={copyInviteLink} style={{ ...btnOutline, width: inviteBtnWidth, color: copied ? '#f59e0b' : '#9ca3af', borderColor: copied ? '#f59e0b' : '#374151' }}>
                    {copied ? 'GEKOPIEERD!' : 'UITNODIGINGSLINK'}
                  </button>
                  {members.length > 0 && (
                    <DownloadTeamPdfButton
                      width={inviteBtnWidth}
                      teamNaam={team.name}
                      teamMsa={teamMsaValue}
                      mindsetScore={laatsteTeamScore?.mindset_score ?? null}
                      systeemScore={laatsteTeamScore?.systeem_score ?? null}
                      actieScore={laatsteTeamScore?.actie_score ?? null}
                      scoreGeschiedenis={teamScores}
                      members={sortedMembers.map(m => ({ naam: m.name, msa: msaTotal(m), sessies: m.sessions, analyses: m.analyses, laatsteActiviteit: m.last_activity }))}
                      spotlightText={teamAnalyses[0]?.analyse_text ?? null}
                      spotlightDatum={teamAnalyses[0]?.created_at ?? null}
                    />
                  )}
                </div>
              </div>

              {teamScores.length > 0 && (
                <div style={{ ...section, borderTop: 'none', paddingTop: 0 }}>
                  <span style={label}>TEAMSCORES</span>
                  <ProgressieChart history={teamScores} />
                  {(() => {
                    const last = teamScores[teamScores.length - 1]
                    if (!last.mindset_score || !last.systeem_score || !last.actie_score) return null
                    const score = computeMsaScore(last.mindset_score, last.systeem_score, last.actie_score)
                    const pct = score
                    return (
                      <div style={{ marginTop: 24 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                          <span style={{ fontFamily: "'Space Mono', monospace", fontWeight: 400, fontSize: 13, letterSpacing: 4, color: '#6b7280' }}>TEAM MSA</span>
                          <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, letterSpacing: 2, color: '#f59e0b', lineHeight: 1 }}>{score}<span style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, color: '#6b7280', marginLeft: 6 }}>/ 100</span></span>
                        </div>
                        <div style={{ width: '100%', height: 4, background: '#374151', borderRadius: 999, overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: '#f59e0b', borderRadius: 999, transition: 'width 0.6s ease' }} />
                        </div>

                      </div>
                    )
                  })()}
                </div>
              )}

              <div style={section}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
                  <span style={label}>TEAMLEDEN ({members.length})</span>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: isMobile ? 'flex-start' : 'flex-end', gap: 6 }}>
                    <span style={{ fontFamily: "'Space Mono', monospace", fontWeight: 400, fontSize: 13, letterSpacing: 4, color: '#f59e0b' }}>MINIMUMFREQUENTIE</span>
                    <select
                      value={minIntervalDagen ?? ''}
                      onChange={e => handleRitmeChange(e.target.value)}
                      className="team-input"
                      style={{ width: isMobile ? '100%' : 160, padding: '8px 12px', fontSize: 13 }}
                    >
                      <option value="">Geen drempel</option>
                      <option value="7">1x per week</option>
                      <option value="14">1x per 2 weken</option>
                      <option value="30">1x per maand</option>
                    </select>
                  </div>
                </div>

                {oneOnOneRitme && (oneOnOneRitme.laatste30Dagen > 0 || oneOnOneRitme.totaalActies > 0 || oneOnOneRitme.openstaandOuderDan14Dagen > 0) && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 24, marginBottom: 32, paddingBottom: 32, borderBottom: '1px solid #374151' }}>
                    <div>
                      <span style={{ fontFamily: "'Space Mono', monospace", fontWeight: 400, fontSize: 13, letterSpacing: 4, color: '#6b7280' }}>LAATSTE 30 DAGEN</span>
                      <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, letterSpacing: 2, color: '#f1f5f9', lineHeight: 1, marginTop: 8 }}>
                        {oneOnOneRitme.laatste30Dagen} <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, color: '#6b7280' }}>1:1{oneOnOneRitme.laatste30Dagen === 1 ? '' : "'S"}</span>
                      </p>
                    </div>
                    {oneOnOneRitme.followThroughPct !== null && (
                      <div>
                        <span style={{ fontFamily: "'Space Mono', monospace", fontWeight: 400, fontSize: 13, letterSpacing: 4, color: '#6b7280' }}>FOLLOW-THROUGH</span>
                        <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, letterSpacing: 2, color: oneOnOneRitme.followThroughPct >= 70 ? '#44cc88' : oneOnOneRitme.followThroughPct >= 40 ? '#f59e0b' : '#cc4444', lineHeight: 1, marginTop: 8 }}>
                          {oneOnOneRitme.followThroughPct}<span style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, color: '#6b7280', marginLeft: 4 }}>%</span>
                        </p>
                      </div>
                    )}
                    {oneOnOneRitme.dekkingTotaal > 0 && (
                      <div>
                        <span style={{ fontFamily: "'Space Mono', monospace", fontWeight: 400, fontSize: 13, letterSpacing: 4, color: '#6b7280' }}>DEKKING DEZE WEEK</span>
                        <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, letterSpacing: 2, color: oneOnOneRitme.dekkingAantal === oneOnOneRitme.dekkingTotaal ? '#44cc88' : oneOnOneRitme.dekkingAantal === 0 ? '#cc4444' : '#f59e0b', lineHeight: 1, marginTop: 8 }}>
                          {oneOnOneRitme.dekkingAantal}<span style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, color: '#6b7280' }}>/{oneOnOneRitme.dekkingTotaal} TEAMLEDEN</span>
                        </p>
                      </div>
                    )}
                    {oneOnOneRitme.openstaandOuderDan14Dagen > 0 && (
                      <div>
                        <span style={{ fontFamily: "'Space Mono', monospace", fontWeight: 400, fontSize: 13, letterSpacing: 4, color: '#6b7280' }}>OPENSTAANDE ACTIES</span>
                        <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, letterSpacing: 2, color: '#f59e0b', lineHeight: 1, marginTop: 8 }}>
                          {oneOnOneRitme.openstaandOuderDan14Dagen} <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, color: '#6b7280' }}>OUDER DAN 2 WEKEN</span>
                        </p>
                      </div>
                    )}
                  </div>
                )}
                {members.length === 0 ? (
                  <p style={body}>Nog geen teamleden. Stuur de uitnodigingslink naar je team.</p>
                ) : isMobile ? (
                  sortedMembers.map(m => {
                    const signaal = activiteitsSignaal(m.sessions, m.last_activity, minIntervalDagen)
                    return (
                      <div
                        key={m.user_id}
                        onClick={() => router.push(`/bot/team/lid/${m.user_id}`)}
                        style={{ borderTop: '1px solid #374151', padding: '16px 0', cursor: 'pointer' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                          <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 15, color: '#f1f5f9', fontWeight: 400 }}>
                            {minIntervalDagen && <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: signaal.dot, marginRight: 10, verticalAlign: 'middle' }} />}
                            {m.name}
                          </span>
                          {msaTotal(m) != null && (
                            <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, letterSpacing: 1, color: '#f1f5f9' }}>{msaTotal(m)}</span>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                          <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, letterSpacing: 2, color: '#6b7280' }}>{m.sessions} GESPR.</span>
                          <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, letterSpacing: 2, color: '#6b7280' }}>{m.analyses} ANAL.</span>
                          <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, letterSpacing: 2, color: '#6b7280' }}>{eenOpEenMap[m.user_id] ?? 0} 1:1&apos;S</span>
                          {m.last_activity && (
                            <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, letterSpacing: 2, color: isOnderRitme(m.last_activity) ? '#f59e0b' : '#6b7280' }}>
                              {formatLast(m.last_activity)}
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: "'Space Mono', monospace", fontWeight: 400, tableLayout: 'fixed' }}>
                      <colgroup>
                        <col style={{ width: minIntervalDagen ? 24 : 0 }} />
                        <col />
                        <col style={{ width: 75 }} />
                        <col style={{ width: 100 }} />
                        <col style={{ width: 100 }} />
                        <col style={{ width: 100 }} />
                        <col style={{ width: 100 }} />
                      </colgroup>
                      <thead>
                        <tr style={{ borderBottom: '1px solid #374151' }}>
                          <th style={{ padding: '8px 16px 12px 0' }} />
                          {([
                            { label: 'NAAM', col: 'naam', align: 'left' },
                            { label: 'MSA', col: 'msa', align: 'center' },
                            { label: 'GESPR.', col: 'sessies', align: 'center' },
                            { label: 'ANALYSES', col: 'analyses', align: 'center' },
                            { label: "1:1'S", col: 'eenopeen', align: 'center' },
                            { label: 'DATUM', col: 'datum', align: 'right' },
                          ] as const).map(({ label, col, align }) => (
                            <th key={col} onClick={() => toggleSort(col)} style={{ textAlign: align as 'left'|'center'|'right', fontFamily: "'Space Mono', monospace", fontWeight: 400, fontSize: 13, letterSpacing: 4, color: sortBy === col ? '#f59e0b' : '#6b7280', padding: col === 'datum' ? '8px 0 12px 16px' : '8px 16px 12px 0', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                              {label}{sortBy === col ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {sortedMembers.map(m => {
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
                              <td style={{ padding: '16px 16px 16px 0', fontWeight: 400, fontSize: 15, color: '#f1f5f9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 0 }}>{m.name}</td>
                              <td style={{ padding: '16px 16px 16px 0', fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 1, color: msaTotal(m) != null ? '#f1f5f9' : '#374151', textAlign: 'center' }}>
                                {msaTotal(m) ?? '·'}
                              </td>
                              <td style={{ padding: '16px 16px 16px 0', fontWeight: 400, fontSize: 15, color: m.sessions > 0 ? '#f1f5f9' : '#6b7280', textAlign: 'center' }}>{m.sessions}</td>
                              <td style={{ padding: '16px 16px 16px 0', fontWeight: 400, fontSize: 15, color: m.analyses > 0 ? '#f1f5f9' : '#6b7280', textAlign: 'center' }}>{m.analyses}</td>
                              <td style={{ padding: '16px 16px 16px 0', fontWeight: 400, fontSize: 15, color: (eenOpEenMap[m.user_id] ?? 0) > 0 ? '#f1f5f9' : '#6b7280', textAlign: 'center' }}>{eenOpEenMap[m.user_id] ?? 0}</td>
                              <td style={{ padding: '16px 0 16px 16px', fontWeight: 400, fontSize: 15, color: onderRitme ? '#f59e0b' : '#9ca3af', textAlign: 'right' }}>{formatLast(m.last_activity)}</td>
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
                  ArnoBot analyseert de collectieve gesprekken van je team: gemeenschappelijke patronen, sterktes en groeikansen.
                </p>
                {(() => {
                  // Nieuwe analyse mogelijk vanaf maandag 5:00 lokale tijd
                  const now = new Date()
                  const dayOfWeek = now.getDay() // 0=zo, 1=ma
                  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
                  const weekStart = new Date(now)
                  weekStart.setDate(now.getDate() - daysFromMonday)
                  weekStart.setHours(0, 0, 0, 0)
                  if (now < weekStart) weekStart.setDate(weekStart.getDate() - 7)

                  const blokkeerd = teamAnalyses.length > 0 &&
                    new Date(teamAnalyses[0].created_at) >= weekStart


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
                        <div className="loading-dots" style={{ marginBottom: 32 }}>
                          <div className="loading-dot" />
                          <div className="loading-dot" />
                          <div className="loading-dot" />
                        </div>
                      )}
                      {spotlightError && (
                        <p style={{ ...body, color: '#cc4444', marginBottom: 32 }}>
                          {spotlightError} Lukt het niet? <a href="https://wa.me/31650695999?text=Hoi%20Arno%2C%20ik%20loop%20vast%20in%20ArnoBot." style={{ color: '#f59e0b' }} target="_blank" rel="noopener noreferrer">Stuur een WhatsApp</a>.
                        </p>
                      )}
                      {members.length < 2 && (
                        <p style={{ ...body, fontSize: 13, color: '#6b7280', marginBottom: 40 }}>Minimaal 2 teamleden nodig voor een team-analyse.</p>
                      )}
                      {blokkeerd && (
                        <p style={{ ...body, fontSize: 13, color: '#6b7280', marginBottom: 40 }}>
                          Er is al een analyse van deze week. Nieuwe analyse op maandagochtend beschikbaar.
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
                          {isMobile ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              <span style={{ color: '#9ca3af', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', fontFamily: "'Space Mono', monospace" }}>
                                {formatAnalyseDate(a.created_at)}
                              </span>
                              <p style={{ color: '#f1f5f9', fontSize: 20, fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 1, lineHeight: 1.4, margin: 0 }}>
                                {getAnalyseTitle(a.analyse_text)}
                              </p>
                              <span style={{ color: expandedAnalyse === a.id ? '#f59e0b' : '#9ca3af', fontSize: 18, fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 2 }}>
                                {expandedAnalyse === a.id ? '↑ SLUITEN' : '↓ OPEN'}
                              </span>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                              <span style={{ color: '#9ca3af', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', whiteSpace: 'nowrap', width: 165, flexShrink: 0, fontFamily: "'Space Mono', monospace" }}>
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
                )}
              </div>
            </>
          )}

        </div>
      </div>
    </>
  )
}
