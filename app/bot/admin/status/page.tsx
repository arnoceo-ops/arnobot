import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import AdminNav from '../AdminNav'

export const dynamic = 'force-dynamic'

function Gauge({ value, color }: { value: number; color: string }) {
  const r = 36
  const circ = 2 * Math.PI * r
  const offset = circ - (Math.min(100, Math.max(0, value)) / 100) * circ
  return (
    <svg width="90" height="90" viewBox="0 0 90 90" style={{ flexShrink: 0 }}>
      <circle cx="45" cy="45" r={r} fill="none" stroke="#1e293b" strokeWidth="7" />
      <circle cx="45" cy="45" r={r} fill="none" stroke={color} strokeWidth="7"
        strokeDasharray={`${circ}`} strokeDashoffset={`${offset}`}
        strokeLinecap="round"
        style={{ transform: 'rotate(-90deg)', transformOrigin: '45px 45px' }} />
      <text x="45" y="45" textAnchor="middle" dominantBaseline="central"
        fill="#f1f5f9" fontSize="18" fontFamily="'Bebas Neue', Impact, sans-serif">
        {value}
      </text>
    </svg>
  )
}

function indicatorColor(ind: string) {
  if (ind === 'none' || ind === 'UP') return '#22c55e'
  if (ind === 'minor' || ind === 'DEGRADED') return '#f59e0b'
  return '#cc2200'
}

function componentColor(s: string) {
  if (s === 'operational') return '#22c55e'
  if (s === 'degraded_performance' || s === 'partial_outage' || s === 'under_maintenance') return '#f59e0b'
  return '#cc2200'
}

function componentLabel(s: string) {
  if (s === 'operational') return 'operationeel'
  if (s === 'degraded_performance') return 'verminderd'
  if (s === 'partial_outage') return 'gedeeltelijk down'
  if (s === 'major_outage') return 'down'
  if (s === 'under_maintenance') return 'onderhoud'
  return s
}

type ServiceStatus = {
  name: string
  link: string
  indicator: string
  description: string
  components: { name: string; status: string }[]
  lastIncident: { name: string; status: string; updatedAt: string } | null
}

const SERVICES = [
  { name: 'Anthropic', link: 'https://status.claude.com', url: 'https://status.claude.com/api/v2/summary.json' },
  { name: 'Vercel', link: 'https://www.vercel-status.com', url: 'https://www.vercel-status.com/api/v2/summary.json' },
  { name: 'Supabase', link: 'https://status.supabase.com', url: 'https://status.supabase.com/api/v2/summary.json' },
  { name: 'Clerk', link: 'https://status.clerk.com', url: 'https://status.clerk.com/api/v2/summary.json' },
  { name: 'Resend', link: 'https://resend-status.com', url: 'https://resend-status.com/api/v2/summary.json' },
]

export default async function AdminStatusPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('arnobot_admin')?.value
  if (!token || token !== process.env.ARNOBOT_ADMIN_KEY) redirect('/bot/admin/login')

  // Instatus: arno.bot monitor + metrics
  type InstatusMonitor = {
    id: string; status: string; name: string; url: string; type: string; httpMethod: string
    averageResponseTime: number | null; logCount: number
    durationBetweenChecksInSeconds: number; locations: string[]
    verifySSL: boolean; checkSSLExpiry: boolean; lastCreatedPeriodSSLExpiry: string | null
    active: boolean; muted: boolean
    degradedAfterSeconds: number; failedAfterSeconds: number; maxNumberOfRetries: number
    retryFromDifferentLocation: boolean; updatedAt: string; createdAt: string
  }

  let monitor: InstatusMonitor | null = null
  let avgMs: number | null = null
  let p95: number | null = null
  let availDay: number | null = null
  let availWeek: number | null = null
  let downSeconds = 0

  try {
    const apiKey = process.env.INSTATUS_API_KEY?.trim()
    if (apiKey) {
      const pages = await fetch('https://api.instatus.com/v1/pages', {
        headers: { Authorization: `Bearer ${apiKey}` }, cache: 'no-store'
      }).then(r => r.json())
      const pageId = Array.isArray(pages) ? pages[0]?.id : null
      if (pageId) {
        const md = await fetch(`https://api.instatus.com/${pageId}/monitors`, {
          headers: { Authorization: `Bearer ${apiKey}` }, cache: 'no-store'
        }).then(r => r.json())
        const m = md?.monitors?.[0]
        if (m) {
          monitor = m as InstatusMonitor
          avgMs = m.averageResponseTime ?? null
          try {
            const ld = await fetch(`https://api.instatus.com/monitors/${m.id}/logs?limit=1000`, {
              headers: { Authorization: `Bearer ${apiKey}` }, cache: 'no-store'
            }).then(r => r.json())
            if (Array.isArray(ld?.logs) && ld.logs.length > 0) {
              const logs = ld.logs
              const now = Date.now()
              const dayAgo = now - 86400000
              const weekAgo = now - 604800000
              const logsDay = logs.filter((l: { createdAt: string }) => new Date(l.createdAt).getTime() > dayAgo)
              const logsWeek = logs.filter((l: { createdAt: string }) => new Date(l.createdAt).getTime() > weekAgo)
              if (logsDay.length) availDay = Math.round(logsDay.filter((l: { status: string }) => l.status === 'UP').length / logsDay.length * 100)
              if (logsWeek.length) availWeek = Math.round(logsWeek.filter((l: { status: string }) => l.status === 'UP').length / logsWeek.length * 100)
              const times = logsWeek.map((l: { responseTime?: number }) => l.responseTime ?? 0).filter((t: number) => t > 0).sort((a: number, b: number) => a - b)
              if (times.length) {
                avgMs = Math.round(times.reduce((s: number, t: number) => s + t, 0) / times.length)
                p95 = times[Math.floor(times.length * 0.95)]
              }
              downSeconds = logsWeek.filter((l: { status: string }) => l.status !== 'UP').length * (m.durationBetweenChecksInSeconds ?? 600)
            }
          } catch { /* logs niet beschikbaar */ }
        }
      }
    }
  } catch { /* negeer */ }

  const perfGauge = availWeek ?? (monitor?.status === 'UP' ? 100 : 0)
  const availGauge = availDay ?? (monitor?.status === 'UP' ? 100 : 0)

  // Externe services ophalen (parallel)
  const serviceResults = await Promise.allSettled(
    SERVICES.map(s =>
      fetch(s.url, { cache: 'no-store', signal: AbortSignal.timeout(5000) })
        .then(r => r.json())
        .then((d): ServiceStatus => ({
          name: s.name,
          link: s.link,
          indicator: d?.status?.indicator ?? 'unknown',
          description: d?.status?.description ?? '',
          components: (d?.components ?? [])
            .filter((c: { group?: boolean }) => !c.group)
            .map((c: { name: string; status: string }) => ({ name: c.name, status: c.status })),
          lastIncident: d?.incidents?.length
            ? {
                name: d.incidents[0].name,
                status: d.incidents[0].status,
                updatedAt: d.incidents[0].updated_at ?? d.incidents[0].created_at,
              }
            : null,
        }))
        .catch((): ServiceStatus => ({
          name: s.name, link: s.link, indicator: 'unknown', description: 'Status niet beschikbaar',
          components: [], lastIncident: null,
        }))
    )
  )

  const services: ServiceStatus[] = serviceResults.map(r =>
    r.status === 'fulfilled' ? r.value : {
      name: '', link: '', indicator: 'unknown', description: 'Ophalen mislukt', components: [], lastIncident: null
    }
  )

  const mo = monitor

  return (
    <main style={{ background: '#111827', minHeight: '100vh', color: '#f1f5f9', fontFamily: 'sans-serif' }}>
      <AdminNav active="/bot/admin/status" />

      <div className="admin-content" style={{ maxWidth: '800px', margin: '0 auto', padding: '48px 40px' }}>
        <p style={{ color: '#f59e0b', fontSize: '12px', letterSpacing: '4px', marginBottom: '8px' }}>ARNOBOT ADMIN</p>
        <h1 style={{ fontSize: '48px', fontWeight: 700, margin: '0 0 32px 0', letterSpacing: '-1px' }}>Status</h1>

        {/* arno.bot metrics */}
        <p style={{ fontFamily: 'sans-serif', fontSize: 12, letterSpacing: 3, color: '#6b7280', marginBottom: 12 }}>ARNO.BOT</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 40 }}>
          <div style={{ background: '#1f2937', borderRadius: 4, padding: '20px', display: 'flex', gap: 20, alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <p style={{ fontFamily: 'sans-serif', fontSize: 12, letterSpacing: 3, color: '#f59e0b', marginBottom: 16 }}>PERFORMANCE</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div>
                  <p style={{ fontFamily: 'sans-serif', fontSize: 10, letterSpacing: 2, color: '#6b7280', marginBottom: 2 }}>GEMIDDELD</p>
                  <p style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 24, color: '#f1f5f9', lineHeight: 1 }}>{avgMs ? `${avgMs}ms` : '—'}</p>
                </div>
                <div>
                  <p style={{ fontFamily: 'sans-serif', fontSize: 10, letterSpacing: 2, color: '#6b7280', marginBottom: 2 }}>P95</p>
                  <p style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 24, color: '#f1f5f9', lineHeight: 1 }}>{p95 ? `${p95}ms` : '—'}</p>
                </div>
              </div>
            </div>
            <Gauge value={perfGauge} color="#22c55e" />
          </div>
          <div style={{ background: '#1f2937', borderRadius: 4, padding: '20px', display: 'flex', gap: 20, alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <p style={{ fontFamily: 'sans-serif', fontSize: 12, letterSpacing: 3, color: '#f59e0b', marginBottom: 16 }}>BESCHIKBAARHEID</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div>
                  <p style={{ fontFamily: 'sans-serif', fontSize: 10, letterSpacing: 2, color: '#6b7280', marginBottom: 2 }}>VANDAAG</p>
                  <p style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 24, color: '#f1f5f9', lineHeight: 1 }}>{availDay !== null ? `${availDay}%` : '—'}</p>
                </div>
                <div>
                  <p style={{ fontFamily: 'sans-serif', fontSize: 10, letterSpacing: 2, color: '#6b7280', marginBottom: 2 }}>DEZE WEEK</p>
                  <p style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 24, color: '#f1f5f9', lineHeight: 1 }}>{availWeek !== null ? `${availWeek}%` : '—'}</p>
                </div>
                <div>
                  <p style={{ fontFamily: 'sans-serif', fontSize: 10, letterSpacing: 2, color: '#6b7280', marginBottom: 2 }}>DOWN</p>
                  <p style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 24, color: '#f1f5f9', lineHeight: 1 }}>{downSeconds > 0 ? `${Math.round(downSeconds / 60)}min` : '0s'}</p>
                </div>
              </div>
            </div>
            <Gauge value={availGauge} color={availGauge >= 99 ? '#22c55e' : availGauge >= 90 ? '#f59e0b' : '#cc2200'} />
          </div>
        </div>

        {/* Monitor config — inklapbaar, direct onder ARNO.BOT */}
        {mo && (
          <details style={{ background: '#1f2937', borderRadius: 4, marginBottom: 40 }}>
            <summary style={{ fontFamily: 'sans-serif', fontSize: 12, letterSpacing: 3, color: '#6b7280', padding: '14px 20px', cursor: 'pointer', listStyle: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>MONITOR CONFIGURATIE</span>
              <span style={{ fontSize: 10 }}>▼</span>
            </summary>
            <div style={{ padding: '0 20px 16px' }}>
              {[
                ['URL', mo.url],
                ['TYPE', `${mo.type} ${mo.httpMethod}`],
                ['INTERVAL', `${Math.round(mo.durationBetweenChecksInSeconds / 60)} min`],
                ['LOCATIES', (mo.locations ?? []).map(l => l.replace('_', ' ')).join(', ')],
                ['DEGRADED NA', `${mo.degradedAfterSeconds}s`],
                ['DOWN NA', `${mo.failedAfterSeconds}s`],
                ['MAX RETRIES', String(mo.maxNumberOfRetries)],
                ['RETRY ANDERE LOCATIE', mo.retryFromDifferentLocation ? 'ja' : 'nee'],
                ['SSL VERIFICATIE', mo.verifySSL ? 'aan' : 'uit'],
                ['SSL CERTIFICAAT', mo.checkSSLExpiry ? (mo.lastCreatedPeriodSSLExpiry ? `geldig t/m ${mo.lastCreatedPeriodSSLExpiry.slice(0, 10)}` : 'geldig') : 'niet gecheckt'],
                ['ACTIEF', mo.active && !mo.muted ? 'ja' : mo.muted ? 'gedempt' : 'uit'],
                ['AANGEMAAKT', mo.createdAt.slice(0, 10)],
                ['LAATSTE UPDATE', mo.updatedAt.replace('T', ' ').slice(0, 16)],
              ].map(([label, value]) => (
                <div key={label} style={{ display: 'flex', gap: 16, padding: '7px 0', borderBottom: '1px solid #1e293b' }}>
                  <span style={{ fontFamily: 'sans-serif', fontSize: 11, color: '#6b7280', letterSpacing: 2, minWidth: 180, flexShrink: 0 }}>{label}</span>
                  <span style={{ fontFamily: 'sans-serif', fontSize: 11, color: '#9ca3af' }}>{value}</span>
                </div>
              ))}
            </div>
          </details>
        )}

        {/* Externe services */}
        <p style={{ fontFamily: 'sans-serif', fontSize: 12, letterSpacing: 3, color: '#6b7280', marginBottom: 12 }}>EXTERNE SERVICES</p>

        {/* Compact overzicht */}
        <div style={{ background: '#1f2937', borderRadius: 4, padding: '16px 20px', marginBottom: 2, display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center' }}>
          {services.map(s => (
            <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: indicatorColor(s.indicator), flexShrink: 0 }} />
              <span style={{ fontFamily: 'sans-serif', fontSize: 12, letterSpacing: 2, color: '#9ca3af' }}>{s.name}</span>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 40 }}>
          {services.map(s => (
            <div key={s.name} style={{ background: '#1f2937', borderRadius: 4, padding: '16px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: s.components.length > 0 ? 12 : 0 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: indicatorColor(s.indicator), flexShrink: 0 }} />
                <span style={{ fontFamily: 'sans-serif', fontSize: 13, color: '#f1f5f9', fontWeight: 700 }}>{s.name}</span>
                <span style={{ fontFamily: 'sans-serif', fontSize: 12, color: '#6b7280' }}>{s.description}</span>
                <a href={s.link} target="_blank" rel="noopener noreferrer"
                  style={{ marginLeft: 'auto', fontFamily: 'sans-serif', fontSize: 11, color: '#6b7280', textDecoration: 'none', letterSpacing: 2, flexShrink: 0 }}>
                  STATUS →
                </a>
              </div>
              {s.components.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingLeft: 18 }}>
                  {s.components.map(c => (
                    <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: componentColor(c.status), flexShrink: 0 }} />
                      <span style={{ fontFamily: 'sans-serif', fontSize: 11, color: '#9ca3af' }}>{c.name}</span>
                      {c.status !== 'operational' && (
                        <span style={{ fontFamily: 'sans-serif', fontSize: 11, color: componentColor(c.status) }}>{componentLabel(c.status)}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {s.lastIncident && (
                <p style={{ fontFamily: 'sans-serif', fontSize: 11, color: '#f59e0b', marginTop: 10, paddingLeft: 18 }}>
                  ↳ {s.lastIncident.name} · {s.lastIncident.status}
                </p>
              )}
            </div>
          ))}
        </div>

      </div>
    </main>
  )
}
