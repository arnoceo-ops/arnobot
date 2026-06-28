import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { clerkClient } from '@clerk/nextjs/server'
import SearchLinkedIn from './SearchLinkedIn'
import TierToggle from './TierToggle'
import PaidButton from './PaidButton'

const navLinkStyle = (active: boolean): React.CSSProperties => ({
  color: active ? '#f59e0b' : '#9ca3af',
  textDecoration: 'none',
  fontSize: '15px',
  letterSpacing: '3px',
  fontWeight: 700,
  padding: '6px 20px',
  borderRadius: 4,
  background: active ? '#1e293b' : 'none',
})

function trialStatus(row: { paid_at?: string | null; expires_at?: string | null; trial_start?: string | null; is_active?: boolean }) {
  if (!row.is_active) return { label: 'INACTIEF', color: '#6b7280' }
  if (row.paid_at) return { label: 'BETAALD', color: '#44cc88' }
  if (row.expires_at) {
    const exp = new Date(row.expires_at)
    const left = Math.ceil((exp.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    if (left <= 0) return { label: 'VERLOPEN', color: '#cc4444' }
    return { label: `TRIAL — ${left}d`, color: '#f59e0b' }
  }
  if (row.trial_start) {
    const end = new Date(new Date(row.trial_start).getTime() + 30 * 24 * 60 * 60 * 1000)
    const left = Math.ceil((end.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    if (left <= 0) return { label: 'TRIAL VERLOPEN', color: '#cc4444' }
    return { label: `TRIAL — ${left}d`, color: '#f59e0b' }
  }
  return { label: 'ONBEKEND', color: '#6b7280' }
}

function SortHeader({ label, field, sort, dir, vertical = false, leftAlign = false }: {
  label: string; field: string; sort: string; dir: string; vertical?: boolean; leftAlign?: boolean
}) {
  const isActive = sort === field
  const nextDir = isActive && dir === 'desc' ? 'asc' : 'desc'

  if (vertical) {
    return (
      <a href={`?sort=${field}&dir=${nextDir}`}
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'flex-end',
          textDecoration: 'none', cursor: 'pointer', gap: 4 }}>
        <span style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)',
          fontSize: '10px', letterSpacing: '2px', color: isActive ? '#f59e0b' : '#4b5563',
          whiteSpace: 'nowrap' }}>{label}</span>
        <span style={{ opacity: isActive ? 1 : 0, fontSize: '10px', color: '#f59e0b' }}>
          {dir === 'desc' ? '↓' : '↑'}
        </span>
      </a>
    )
  }

  return (
    <a href={`?sort=${field}&dir=${nextDir}`}
      style={{ fontSize: '11px', letterSpacing: '3px', color: isActive ? '#f59e0b' : '#4b5563',
        textDecoration: 'none', display: 'flex', flexDirection: 'column',
        alignItems: leftAlign ? 'flex-start' : 'flex-end', cursor: 'pointer', gap: 2 }}>
      <span>{label}</span>
      <span style={{ opacity: isActive ? 1 : 0, fontSize: '10px', lineHeight: 1 }}>
        {dir === 'desc' ? '↓' : '↑'}
      </span>
    </a>
  )
}

export default async function GebruikersPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; dir?: string }>
}) {
  const cookieStore = await cookies()
  const token = cookieStore.get('arnobot_admin')?.value
  if (!token || token !== process.env.ARNOBOT_ADMIN_KEY) redirect('/bot/admin/login')

  const params = await searchParams
  const sort = params.sort || 'aangemeld'
  const dir = params.dir || 'desc'

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [usersRes, logsRes, coachingRes, analysesRes, referralsRes] = await Promise.all([
    supabase
      .from('approved_users')
      .select('user_id, email, full_name, voornaam, achternaam, linkedin, trial_start, expires_at, paid_at, is_active, created_at, tier, renewal_requested_at, trial_reactivated_at, nudge_opt_out'),
    supabase
      .from('arnobot_rds_logs')
      .select('user_id, session_id, created_at')
      .not('user_id', 'is', null),
    supabase
      .from('arnobot_coaching')
      .select('user_id, updated_at'),
    supabase
      .from('arnobot_analyses')
      .select('user_id'),
    supabase
      .from('arnobot_referrals')
      .select('referrer_user_id, status'),
  ])

  const logs = logsRes.data ?? []
  const coachingRows = coachingRes.data ?? []

  const analysesMap: Record<string, number> = {}
  for (const a of analysesRes.data ?? []) {
    analysesMap[a.user_id] = (analysesMap[a.user_id] || 0) + 1
  }

  // Aggregate per user from rds_logs (real-time source, not session-end dependent)
  const sessionMap: Record<string, { count: number; questions: number; lastSession: string | null; recentCount: number }> = {}
  for (const l of logs) {
    if (!sessionMap[l.user_id]) sessionMap[l.user_id] = { count: 0, questions: 0, lastSession: null, recentCount: 0, sessions: new Set<string>() } as never
    const m = sessionMap[l.user_id] as { count: number; questions: number; lastSession: string | null; recentCount: number; sessions: Set<string> }
    m.questions++
    m.sessions.add(l.session_id)
    m.count = m.sessions.size
    if (!m.lastSession || l.created_at > m.lastSession) m.lastSession = l.created_at
    if (l.created_at >= sevenDaysAgo) m.recentCount++
  }

  const coachingMap: Record<string, number> = {}
  for (const c of coachingRows) {
    coachingMap[c.user_id] = (coachingMap[c.user_id] || 0) + 1
  }

  const referralSignups: Record<string, number> = {}
  const referralConverted: Record<string, number> = {}
  for (const r of referralsRes.data ?? []) {
    referralSignups[r.referrer_user_id] = (referralSignups[r.referrer_user_id] || 0) + 1
    if (r.status === 'converted') {
      referralConverted[r.referrer_user_id] = (referralConverted[r.referrer_user_id] || 0) + 1
    }
  }

  const clerk = await clerkClient()

  const enriched = await Promise.all(
    (usersRes.data ?? []).map(async (u) => {
      let imageUrl: string | null = null
      let clerkName: string | null = null
      if (u.user_id && !u.user_id.startsWith('pending_')) {
        try {
          const cu = await clerk.users.getUser(u.user_id)
          imageUrl = cu.imageUrl ?? null
          const fn = cu.firstName || ''
          const ln = cu.lastName || ''
          if (fn || ln) clerkName = `${fn} ${ln}`.trim()
        } catch {}
      }
      const activity = sessionMap[u.user_id] ?? { count: 0, questions: 0, lastSession: null, recentCount: 0 }
      return { ...u, imageUrl, clerkName, ...activity, coachingCount: coachingMap[u.user_id] ?? 0, analysesCount: analysesMap[u.user_id] ?? 0, refSignups: referralSignups[u.user_id] ?? 0, refConverted: referralConverted[u.user_id] ?? 0 }
    })
  )

  // Sort
  const sorted = [...enriched].sort((a, b) => {
    let av: number | string = 0
    let bv: number | string = 0
    if (sort === 'naam') { av = (a.clerkName || a.full_name || '').toLowerCase(); bv = (b.clerkName || b.full_name || '').toLowerCase() }
    if (sort === 'aangemeld') { av = a.created_at; bv = b.created_at }
    if (sort === 'gesprekken') { av = a.count; bv = b.count }
    if (sort === 'vragen') { av = a.questions; bv = b.questions }
    if (sort === 'laatste') { av = a.lastSession || ''; bv = b.lastSession || '' }
    if (sort === 'coaching') { av = a.coachingCount; bv = b.coachingCount }
    if (sort === 'analyses') { av = a.analysesCount; bv = b.analysesCount }
    if (sort === 'actief') { av = a.recentCount; bv = b.recentCount }
    if (sort === 'tier') { av = a.tier || ''; bv = b.tier || '' }
    if (sort === 'linkedin') { av = a.linkedin ? 1 : 0; bv = b.linkedin ? 1 : 0 }
    if (sort === 'paid_at') { av = a.paid_at || ''; bv = b.paid_at || '' }
    if (sort === 'nudge_opt_out') { av = (a as { nudge_opt_out?: boolean }).nudge_opt_out ? 1 : 0; bv = (b as { nudge_opt_out?: boolean }).nudge_opt_out ? 1 : 0 }
    if (sort === 'refsignups') { av = a.refSignups; bv = b.refSignups }
    if (sort === 'refconverted') { av = a.refConverted; bv = b.refConverted }
    if (av < bv) return dir === 'asc' ? -1 : 1
    if (av > bv) return dir === 'asc' ? 1 : -1
    return 0
  })

  const cols = '44px minmax(140px,1fr) 120px 80px 70px 100px 75px 75px 75px 60px 60px 90px 50px 80px'

  return (
    <main style={{ background: '#111827', minHeight: '100vh', color: '#f1f5f9', fontFamily: 'sans-serif' }}>

      <nav style={{ background: '#0d0d0d', borderBottom: '1px solid #1e293b', height: 56, display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', padding: '0 40px' }}>
        <div />
        <div style={{ display: 'flex', gap: '4px' }}>
          <a href="/bot/admin/gebruikers" style={navLinkStyle(true)}>USERS</a>
          <a href="/bot/admin/emails" style={navLinkStyle(false)}>CRONS</a>
          <a href="/bot/admin" style={navLinkStyle(false)}>ARNOBOT</a>
          <a href="/bot/admin/idee" style={navLinkStyle(false)}>BLOGS</a>
          <a href="/bot/admin/evaluaties" style={navLinkStyle(false)}>FEEDBACK</a>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4, alignItems: 'center' }}>
          <a href="/bot/admin/widget" style={navLinkStyle(false)}>ARNO.BLOG</a>
          <a href="/api/admin/logout" style={{ color: '#4b5563', textDecoration: 'none', fontSize: 13, letterSpacing: 2, fontWeight: 700, padding: '6px 12px' }}>UITLOG</a>
        </div>
      </nav>

      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '48px 40px' }}>

        <p style={{ color: '#f59e0b', fontSize: '13px', letterSpacing: '4px', marginBottom: '8px' }}>ARNOBOT ADMIN</p>
        <h1 style={{ fontSize: '48px', fontWeight: 700, margin: '0 0 8px 0', letterSpacing: '-1px' }}>Gebruikers</h1>
        <p style={{ color: '#6b7280', fontSize: '14px', letterSpacing: '2px', marginBottom: '48px' }}>
          {sorted.length} gebruiker{sorted.length !== 1 ? 's' : ''}
        </p>

        {/* Tabel header */}
        <div style={{ display: 'grid', gridTemplateColumns: cols, gap: '0 12px', padding: '0 20px 12px', borderBottom: '1px solid #222', alignItems: 'end' }}>
          <div />
          <SortHeader label="NAAM" field="naam" sort={sort} dir={dir} leftAlign />
          <SortHeader label="STATUS" field="aangemeld" sort={sort} dir={dir} />
          <SortHeader label="GESPREKKEN" field="gesprekken" sort={sort} dir={dir} vertical />
          <SortHeader label="VRAGEN" field="vragen" sort={sort} dir={dir} vertical />
          <SortHeader label="LAATSTE GESPREK" field="laatste" sort={sort} dir={dir} vertical />
          <SortHeader label="COACHING" field="coaching" sort={sort} dir={dir} vertical />
          <SortHeader label="ANALYSES" field="analyses" sort={sort} dir={dir} vertical />
          <SortHeader label="TIER" field="tier" sort={sort} dir={dir} vertical />
          <SortHeader label="REF IN" field="refsignups" sort={sort} dir={dir} vertical />
          <SortHeader label="REF €" field="refconverted" sort={sort} dir={dir} vertical />
          <SortHeader label="BETALING" field="paid_at" sort={sort} dir={dir} vertical />
          <SortHeader label="MAIL" field="nudge_opt_out" sort={sort} dir={dir} vertical />
          <SortHeader label="LINKEDIN" field="linkedin" sort={sort} dir={dir} vertical />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '2px' }}>
          {sorted.map((u) => {
            const name = u.clerkName || u.full_name || [u.voornaam, u.achternaam].filter(Boolean).join(' ') || '—'
            const status = trialStatus(u)
            const daysAgo = u.lastSession
              ? Math.round((Date.now() - new Date(u.lastSession).getTime()) / (1000 * 60 * 60 * 24))
              : null
            const lastSessionLabel = daysAgo === null ? '—' : daysAgo === 0 ? 'vandaag' : daysAgo === 1 ? 'gisteren' : `${daysAgo}d geleden`
            const actief7d = u.recentCount > 0
            const borderColor = actief7d ? '#44cc88' : u.questions > 0 ? '#cc4444' : '#1e293b'
            return (
              <div key={u.user_id} style={{
                display: 'grid',
                gridTemplateColumns: cols,
                gap: '0 12px',
                alignItems: 'center',
                background: '#1f2937',
                padding: '14px 20px',
                borderLeft: `3px solid ${borderColor}`,
              }}>
                {/* Foto */}
                {u.imageUrl
                  ? <img src={u.imageUrl} alt={name} style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover' }} />
                  : <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, color: '#374151' }}>?</div>
                }
                {/* Naam + email */}
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                    <p style={{ fontWeight: 700, fontSize: '16px', color: '#f1f5f9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', margin: 0 }}>{name}</p>
                    {(() => {
                      const tr = (u as { trial_reactivated_at?: string | null }).trial_reactivated_at
                      const ts = u.trial_start
                      if (!tr) return null
                      const isThird = ts && ((new Date(ts).getTime() - new Date(tr).getTime()) / (1000 * 60 * 60 * 24)) >= 200
                      return (
                        <span style={{ fontSize: '10px', letterSpacing: '2px', fontWeight: 700, color: isThird ? '#cc2200' : '#f59e0b', background: isThird ? '#2a1010' : '#1e1a0a', padding: '2px 6px', borderRadius: 4, flexShrink: 0 }}>
                          {isThird ? '3e TRIAL' : '2e TRIAL'}
                        </span>
                      )
                    })()}
                  </div>
                  <p style={{ fontSize: '12px', color: '#6b7280' }}>{u.email || '—'}</p>
                </div>
                {/* Status */}
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: '12px', letterSpacing: '2px', color: status.color, fontWeight: 700 }}>{status.label}</p>
                  {u.paid_at && u.expires_at
                    ? <p style={{ fontSize: '11px', color: '#4b5563', marginTop: 2 }}>t/m {new Date(u.expires_at).toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: '2-digit' })}</p>
                    : u.created_at && <p style={{ fontSize: '11px', color: '#4b5563', marginTop: 2 }}>{new Date(u.created_at).toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: '2-digit' })}</p>
                  }
                </div>
                {/* Gesprekken */}
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: '16px', fontWeight: 700, color: u.count > 0 ? '#f1f5f9' : '#374151' }}>{u.count}</p>
                </div>
                {/* Vragen */}
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: '16px', fontWeight: 700, color: u.questions > 0 ? '#f1f5f9' : '#374151' }}>{u.questions}</p>
                </div>
                {/* Laatste gesprek */}
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: '13px', color: '#9ca3af' }}>{lastSessionLabel}</p>
                </div>
                {/* Coaching */}
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: '16px', fontWeight: 700, color: u.coachingCount > 0 ? '#44cc88' : '#374151' }}>{u.coachingCount || '—'}</p>
                </div>
                {/* Analyses */}
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: '16px', fontWeight: 700, color: u.analysesCount > 0 ? '#44cc88' : '#374151' }}>{u.analysesCount || '—'}</p>
                </div>
                {/* Tier */}
                <div style={{ textAlign: 'right' }}>
                  <TierToggle userId={u.user_id} currentTier={(u.tier as 'basis' | 'pro') ?? 'pro'} />
                </div>
                {/* Referral aanmeldingen */}
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: '16px', fontWeight: 700, color: u.refSignups > 0 ? '#f59e0b' : '#374151' }}>{u.refSignups || '—'}</p>
                </div>
                {/* Referral betaald */}
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: '16px', fontWeight: 700, color: u.refConverted > 0 ? '#44cc88' : '#374151' }}>{u.refConverted || '—'}</p>
                </div>
                {/* Betaling */}
                <div style={{ textAlign: 'right' }}>
                  {(u as { renewal_requested_at?: string | null }).renewal_requested_at && !u.paid_at
                    ? <PaidButton userId={u.user_id} paidAt={u.paid_at ?? null} expiresAt={u.expires_at ?? null} />
                    : u.paid_at
                    ? <PaidButton userId={u.user_id} paidAt={u.paid_at ?? null} expiresAt={u.expires_at ?? null} />
                    : <span style={{ fontSize: '11px', color: '#374151' }}>—</span>
                  }
                </div>
                {/* Mail opt-out */}
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: '11px', letterSpacing: '1px', fontWeight: 700, color: (u as { nudge_opt_out?: boolean }).nudge_opt_out ? '#cc2200' : '#44cc88' }}>
                    {(u as { nudge_opt_out?: boolean }).nudge_opt_out ? 'UIT' : 'AAN'}
                  </p>
                </div>
                {/* LinkedIn */}
                <div style={{ textAlign: 'right' }}>
                  {u.linkedin
                    ? <a href={u.linkedin} target="_blank" rel="noopener noreferrer" style={{ fontSize: '13px', letterSpacing: '2px', color: '#f59e0b', textDecoration: 'none', fontWeight: 700 }}>LI →</a>
                    : <SearchLinkedIn userId={u.user_id} name={name} email={u.email ?? ''} hasLinkedin={false} />
                  }
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </main>
  )
}
