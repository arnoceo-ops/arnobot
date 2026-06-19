'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import BotNav from '@/app/bot/BotNav'

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

interface Analyse {
  id: string
  analyse_text: string
  created_at: string
  session_count: number | null
}

interface LidData {
  name: string
  role: string
  profiel_rol: string | null
  coaching: Coaching | null
  analyses: Analyse[]
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
        {score ?? '—'}
      </span>
    </div>
  )
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })
}

function analysePreview(text: string): string {
  const clean = text.replace(/\*\*/g, '').replace(/\n+/g, ' ').trim()
  return clean.length > 220 ? clean.slice(0, 217) + '...' : clean
}

export default function LidPage() {
  const { userId } = useParams<{ userId: string }>()
  const router = useRouter()
  const [data, setData] = useState<LidData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Space+Mono:wght@400;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #111827; color: #f1f5f9; font-family: 'Space Mono', monospace; font-weight: 400; }
        .back-link { font-family: 'Bebas Neue', sans-serif; font-size: 16px; letter-spacing: 3px; color: #6b7280; text-decoration: none; display: inline-flex; align-items: center; gap: 8px; margin-bottom: 48px; transition: color 0.15s; }
        .back-link:hover { color: #9ca3af; }
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
                          <p style={{ fontFamily: "'Space Mono', monospace", fontWeight: 400, fontSize: 13, letterSpacing: 4, color: '#6b7280', marginBottom: 12 }}>{l}</p>
                          <ScoreBar score={score} />
                          {diagnose && <p style={{ ...body, fontSize: 13, color: '#9ca3af', marginTop: 8, lineHeight: 1.7 }}>{diagnose}</p>}
                        </div>
                      ))}
                    </div>

                    {data.coaching.voortgang && (
                      <div style={{ background: '#1f2937', borderLeft: '4px solid #f59e0b', padding: '20px 24px' }}>
                        <p style={{ fontFamily: "'Space Mono', monospace", fontWeight: 400, fontSize: 13, letterSpacing: 4, color: '#f59e0b', marginBottom: 12 }}>VOORTGANG</p>
                        <p style={body}>{data.coaching.voortgang}</p>
                      </div>
                    )}

                    <p style={{ ...body, fontSize: 12, color: '#4b5563', marginTop: 16 }}>
                      Bijgewerkt op {formatDate(data.coaching.updated_at)}
                    </p>
                  </>
                )}
              </div>

              {/* Analyses */}
              <div style={section}>
                <span style={label}>ANALYSES</span>

                {data.analyses.length === 0 ? (
                  <p style={body}>Nog geen analyses beschikbaar.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {data.analyses.map(a => (
                      <div key={a.id} style={{ background: '#1f2937', padding: '20px 24px', borderRadius: 4 }}>
                        <p style={{ fontFamily: "'Space Mono', monospace", fontWeight: 400, fontSize: 12, letterSpacing: 3, color: '#6b7280', marginBottom: 8 }}>
                          {formatDate(a.created_at)}{a.session_count ? ` · ${a.session_count} gesprekken` : ''}
                        </p>
                        <p style={{ ...body, fontSize: 14, color: '#9ca3af' }}>{analysePreview(a.analyse_text)}</p>
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
