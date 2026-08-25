import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
import { clerkClient } from '@clerk/nextjs/server'
import { E2E_TEST_USER_EMAIL, MANUAL_TEST_USER_EMAIL, APP_REVIEWER_EMAIL } from '@/lib/internalTestAccounts'
import { computeHealthScore, HEALTH_BUCKET_META, type HealthBucket } from '@/lib/healthScore'
import SearchLinkedIn from './SearchLinkedIn'
import PlanToggle from './PlanToggle'
import CommandManagerToggle from './CommandManagerToggle'
import PaidButton from './PaidButton'
import SdAgentSelect from './SdAgentSelect'
import AdminNav from '../AdminNav'

const ELITE_CAP = 50
const BOUWER_EMAIL = 'linkedin@royaldutchsales.com'

// Losse helper i.p.v. Date.now() rechtstreeks in de paginacomponent: die laatste
// wordt door react-hooks/purity als impure aangemerkt, ook al is deze pagina
// force-dynamic en dus toch al per request opnieuw gerenderd.
function nu(): number {
  return Date.now()
}

function trialStatus(row: { paid_at?: string | null; expires_at?: string | null; trial_start?: string | null; is_active?: boolean }) {
  if (!row.is_active) return { label: 'INACTIEF', color: '#6b7280' }
  if (row.paid_at) return { label: 'BETAALD', color: '#44cc88' }
  if (row.expires_at) {
    const exp = new Date(row.expires_at)
    const left = Math.ceil((exp.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    if (left <= 0) return { label: 'VERLOPEN', color: '#cc4444' }
    return { label: `TRIAL ${left}d`, color: '#f59e0b' }
  }
  if (row.trial_start) {
    const end = new Date(new Date(row.trial_start).getTime() + 30 * 24 * 60 * 60 * 1000)
    const left = Math.ceil((end.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    if (left <= 0) return { label: 'TRIAL VERLOPEN', color: '#cc4444' }
    return { label: `TRIAL ${left}d`, color: '#f59e0b' }
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
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', height: '100%' }}>
        <a href={`?sort=${field}&dir=${nextDir}`}
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            textDecoration: 'none', cursor: 'pointer', gap: 4,
          }}>
          <span style={{
            writingMode: 'vertical-rl', transform: 'rotate(180deg)',
            fontSize: '12px', letterSpacing: '2px',
            color: isActive ? '#f59e0b' : '#6b7280',
            whiteSpace: 'nowrap',
          }}>{label}</span>
          <span style={{ opacity: isActive ? 1 : 0, fontSize: '12px', color: '#f59e0b' }}>
            {dir === 'desc' ? '↓' : '↑'}
          </span>
        </a>
      </div>
    )
  }

  return (
    <a href={`?sort=${field}&dir=${nextDir}`}
      style={{
        fontSize: '12px', letterSpacing: '3px', color: isActive ? '#f59e0b' : '#6b7280',
        textDecoration: 'none', display: 'flex', flexDirection: 'column', width: '100%',
        alignItems: leftAlign ? 'flex-start' : 'flex-end', cursor: 'pointer', gap: 2,
      }}>
      <span>{label}</span>
      <span style={{ opacity: isActive ? 1 : 0, fontSize: '12px', lineHeight: 1 }}>
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
  const sort = params.sort || 'laatste'
  const dir = params.dir || 'desc'

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const sevenDaysAgo = new Date(nu() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [usersRes, logsRes, coachingRes, analysesRes, referralsRes, blogSessiesRes, sparringRes, teamMembersRes] = await Promise.all([
    supabase
      .from('approved_users')
      .select('user_id, email, full_name, voornaam, achternaam, linkedin, trial_start, expires_at, paid_at, is_active, created_at, plan, command_manager, renewal_requested_at, trial_reactivated_at, nudge_opt_out, sd_agent, sd_attribution_method')
      .neq('email', E2E_TEST_USER_EMAIL)
      .neq('email', MANUAL_TEST_USER_EMAIL)
      .neq('email', APP_REVIEWER_EMAIL),
    supabase
      .from('arnobot_rds_logs')
      .select('user_id, session_id, created_at')
      .not('user_id', 'is', null),
    supabase
      .from('arnobot_coaching')
      .select('user_id, updated_at, mindset_richting, systeem_richting, actie_richting, weinig_voortgang, stagnatie'),
    supabase
      .from('arnobot_analyses')
      .select('user_id'),
    supabase
      .from('arnobot_referrals')
      .select('referrer_user_id, status'),
    supabase
      .from('arnobot_blog_sessions')
      .select('user_id, created_at, actie_status'),
    supabase
      .from('arnobot_sparring_sessions')
      .select('user_id, created_at'),
    supabase
      .from('arnobot_team_members')
      .select('user_id, role'),
  ])

  // TEAM-kolom (2026-08-24): tot nu toe toonde COMMAND alleen command_manager (de Team-
  // tier-entitlement, handmatig te togglen), een gewoon teamlid was hier onzichtbaar en
  // zag er identiek uit aan een individuele Pro/Elite-gebruiker. 'LID' vult dat gat aan,
  // puur informatief (geen toggle, lidmaatschap loopt via join/verwijder-uit-team elders).
  const teamRoleMap = new Map((teamMembersRes.data ?? []).map(t => [t.user_id, t.role as string]))

  const logs = logsRes.data ?? []
  const coachingRows = coachingRes.data ?? []

  const analysesMap: Record<string, number> = {}
  for (const a of analysesRes.data ?? []) {
    analysesMap[a.user_id] = (analysesMap[a.user_id] || 0) + 1
  }

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

  // Gezondheidsscore: gedragssignalen per gebruiker
  const now = nu()
  const coachingByUser = new Map(coachingRows.map(c => [c.user_id, c]))
  const actieStatussenPerUser = new Map<string, { created_at: string; actie_status: string }[]>()
  for (const s of blogSessiesRes.data ?? []) {
    if (s.actie_status && s.actie_status !== 'skip') {
      if (!actieStatussenPerUser.has(s.user_id)) actieStatussenPerUser.set(s.user_id, [])
      actieStatussenPerUser.get(s.user_id)!.push({ created_at: s.created_at, actie_status: s.actie_status })
    }
  }
  const laatsteSparringPerUser = new Map<string, string>()
  for (const s of sparringRes.data ?? []) {
    const huidig = laatsteSparringPerUser.get(s.user_id)
    if (!huidig || s.created_at > huidig) laatsteSparringPerUser.set(s.user_id, s.created_at)
  }
  const recentSessionsPerUser = new Map<string, Set<string>>()
  for (const l of logs) {
    if (l.created_at < sevenDaysAgo) continue
    if (!recentSessionsPerUser.has(l.user_id)) recentSessionsPerUser.set(l.user_id, new Set())
    recentSessionsPerUser.get(l.user_id)!.add(l.session_id)
  }

  function getHealthBucket(userId: string, lastSession: string | null): HealthBucket | null {
    const coaching = coachingByUser.get(userId)
    if (!coaching) return null
    const { bucket } = computeHealthScore({
      mindset_richting: coaching.mindset_richting,
      systeem_richting: coaching.systeem_richting,
      actie_richting: coaching.actie_richting,
      weinig_voortgang: coaching.weinig_voortgang,
      stagnatie: coaching.stagnatie,
      laatsteCoachingGesprek: lastSession,
      actieStatussenRecent: (actieStatussenPerUser.get(userId) ?? [])
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(0, 5)
        .map(x => x.actie_status),
      laatsteSparring: laatsteSparringPerUser.get(userId) ?? null,
      coachingGesprekkenLaatste7Dagen: recentSessionsPerUser.get(userId)?.size ?? 0,
    }, now)
    return bucket
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
      const healthBucket = getHealthBucket(u.user_id, activity.lastSession)
      return { ...u, imageUrl, clerkName, ...activity, coachingCount: coachingMap[u.user_id] ?? 0, analysesCount: analysesMap[u.user_id] ?? 0, refSignups: referralSignups[u.user_id] ?? 0, refConverted: referralConverted[u.user_id] ?? 0, healthBucket }
    })
  )

  const eliteCount = enriched.filter(u => u.plan === 'elite' && u.is_active !== false).length

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
    if (sort === 'plan') { av = a.plan || ''; bv = b.plan || '' }
    if (sort === 'command_manager') { av = a.command_manager ? 1 : 0; bv = b.command_manager ? 1 : 0 }
    if (sort === 'sd_agent') { av = (a as { sd_agent?: string | null }).sd_agent || ''; bv = (b as { sd_agent?: string | null }).sd_agent || '' }
    if (sort === 'linkedin') { av = a.linkedin ? 1 : 0; bv = b.linkedin ? 1 : 0 }
    if (sort === 'paid_at') { av = a.paid_at || ''; bv = b.paid_at || '' }
    if (sort === 'nudge_opt_out') { av = (a as { nudge_opt_out?: boolean }).nudge_opt_out ? 1 : 0; bv = (b as { nudge_opt_out?: boolean }).nudge_opt_out ? 1 : 0 }
    if (sort === 'refsignups') { av = a.refSignups; bv = b.refSignups }
    if (sort === 'refconverted') { av = a.refConverted; bv = b.refConverted }
    if (sort === 'gezondheid') {
      const rank: Record<string, number> = { risico: 0, neutraal: 1, gezond: 2 }
      av = a.healthBucket ? rank[a.healthBucket] : 3
      bv = b.healthBucket ? rank[b.healthBucket] : 3
    }
    if (av < bv) return dir === 'asc' ? -1 : 1
    if (av > bv) return dir === 'asc' ? 1 : -1
    return 0
  })

  // Bouwersaccount altijd bovenaan, ongeacht de gekozen sortering.
  const bouwerIndex = sorted.findIndex(u => u.email === BOUWER_EMAIL)
  if (bouwerIndex > 0) {
    const [bouwer] = sorted.splice(bouwerIndex, 1)
    sorted.unshift(bouwer)
  }

  const cols = '44px minmax(140px,1fr) 120px 80px 70px 100px 75px 75px 75px 85px 80px 140px 60px 60px 90px 50px 80px'

  return (
    <main style={{ background: '#111827', minHeight: '100vh', color: '#f1f5f9', fontFamily: 'sans-serif' }}>
      <AdminNav active="/bot/admin/gebruikers" />

      <div className="admin-content" style={{ maxWidth: '1750px', margin: '0 auto', padding: '48px 24px' }}>

        <p style={{ color: '#f59e0b', fontSize: '12px', letterSpacing: '4px', marginBottom: '8px' }}>ARNOBOT ADMIN</p>
        <h1 style={{ fontSize: '48px', fontWeight: 700, margin: '0 0 8px 0', letterSpacing: '-1px' }}>Gebruikers</h1>
        <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '8px' }}>
          {sorted.length} gebruiker{sorted.length !== 1 ? 's' : ''}
        </p>
        <p style={{
          color: eliteCount >= ELITE_CAP ? '#cc4444' : eliteCount >= ELITE_CAP - 5 ? '#f59e0b' : '#6b7280',
          fontSize: '14px', fontWeight: eliteCount >= ELITE_CAP - 5 ? 700 : 400, marginBottom: '48px',
        }}>
          Elite: {eliteCount} / {ELITE_CAP}{eliteCount >= ELITE_CAP ? ' (cap bereikt)' : ''}
        </p>

        <div className="admin-table-wrap" style={{ overflowX: 'auto' }}>
        <div style={{ minWidth: 'max-content' }}>
        {/* Tabel header */}
        <div className="admin-user-row" style={{ display: 'grid', gridTemplateColumns: cols, gap: '0 8px', padding: '0 12px 12px', borderBottom: '1px solid #222', alignItems: 'end', borderLeft: '3px solid transparent' }}>
          <div />
          <SortHeader label="NAAM" field="naam" sort={sort} dir={dir} leftAlign />
          <SortHeader label="STATUS" field="aangemeld" sort={sort} dir={dir} />
          <SortHeader label="GESPREKKEN" field="gesprekken" sort={sort} dir={dir} vertical />
          <SortHeader label="VRAGEN" field="vragen" sort={sort} dir={dir} vertical />
          <SortHeader label="LAATSTE GESPREK" field="laatste" sort={sort} dir={dir} vertical />
          <SortHeader label="COACHING" field="coaching" sort={sort} dir={dir} vertical />
          <SortHeader label="ANALYSES" field="analyses" sort={sort} dir={dir} vertical />
          <SortHeader label="GEZONDHEID" field="gezondheid" sort={sort} dir={dir} vertical />
          <SortHeader label="PLAN" field="plan" sort={sort} dir={dir} vertical />
          <SortHeader label="TEAM" field="command_manager" sort={sort} dir={dir} vertical />
          <SortHeader label="SD AGENT" field="sd_agent" sort={sort} dir={dir} vertical />
          <SortHeader label="REF IN" field="refsignups" sort={sort} dir={dir} vertical />
          <SortHeader label="REF €" field="refconverted" sort={sort} dir={dir} vertical />
          <SortHeader label="BETALING" field="paid_at" sort={sort} dir={dir} vertical />
          <SortHeader label="MAIL" field="nudge_opt_out" sort={sort} dir={dir} vertical />
          <SortHeader label="LINKEDIN" field="linkedin" sort={sort} dir={dir} vertical />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '2px' }}>
          {sorted.map((u) => {
            const name = u.clerkName || u.full_name || [u.voornaam, u.achternaam].filter(Boolean).join(' ') || 'n.v.t.'
            const status = trialStatus(u)
            const daysAgo = u.lastSession
              ? Math.round((nu() - new Date(u.lastSession).getTime()) / (1000 * 60 * 60 * 24))
              : null
            const lastSessionLabel = daysAgo === null ? 'nooit' : daysAgo === 0 ? 'vandaag' : daysAgo === 1 ? 'gisteren' : `${daysAgo}d geleden`
            const actief7d = u.recentCount > 0
            const borderColor = actief7d ? '#44cc88' : u.questions > 0 ? '#cc4444' : '#1e293b'
            return (
              <div key={u.user_id} className="admin-user-row" style={{
                display: 'grid',
                gridTemplateColumns: cols,
                gap: '0 8px',
                alignItems: 'center',
                background: '#1f2937',
                padding: '14px 12px',
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
                    <a href={`/bot/admin/analyse?userId=${u.user_id}`} style={{ fontWeight: 700, fontSize: '14px', color: '#f1f5f9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', margin: 0, textDecoration: 'none' }}>{name}</a>
                    {(() => {
                      const tr = (u as { trial_reactivated_at?: string | null }).trial_reactivated_at
                      const ts = u.trial_start
                      if (!tr) return null
                      const isThird = ts && ((new Date(ts).getTime() - new Date(tr).getTime()) / (1000 * 60 * 60 * 24)) >= 200
                      return (
                        <span style={{ fontSize: '12px', letterSpacing: '2px', fontWeight: 700, color: isThird ? '#cc2200' : '#f59e0b', background: isThird ? '#2a1010' : '#1e1a0a', padding: '2px 6px', borderRadius: 4, flexShrink: 0 }}>
                          {isThird ? '3e TRIAL' : '2e TRIAL'}
                        </span>
                      )
                    })()}
                  </div>
                  <p style={{ fontSize: '12px', color: '#6b7280' }}>{u.email || 'n.v.t.'}</p>
                </div>
                {/* Status */}
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: '12px', letterSpacing: '2px', color: status.color, fontWeight: 700 }}>{status.label}</p>
                  {u.paid_at && u.expires_at
                    ? <p style={{ fontSize: '12px', color: '#6b7280', marginTop: 2 }}>t/m {new Date(u.expires_at).toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: '2-digit' })}</p>
                    : u.created_at && <p style={{ fontSize: '12px', color: '#6b7280', marginTop: 2 }}>{new Date(u.created_at).toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: '2-digit' })}</p>
                  }
                </div>
                {/* Gesprekken */}
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: '14px', fontWeight: 700, color: u.count > 0 ? '#f1f5f9' : '#374151' }}>{u.count}</p>
                </div>
                {/* Vragen */}
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: '14px', fontWeight: 700, color: u.questions > 0 ? '#f1f5f9' : '#374151' }}>{u.questions}</p>
                </div>
                {/* Laatste gesprek */}
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: '12px', color: '#9ca3af' }}>{lastSessionLabel}</p>
                </div>
                {/* Coaching */}
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: '14px', fontWeight: 700, color: u.coachingCount > 0 ? '#44cc88' : '#374151' }}>{u.coachingCount || 'n.v.t.'}</p>
                </div>
                {/* Analyses */}
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: '14px', fontWeight: 700, color: u.analysesCount > 0 ? '#44cc88' : '#374151' }}>{u.analysesCount || 'n.v.t.'}</p>
                </div>
                {/* Gezondheid */}
                <div style={{ textAlign: 'center' }}>
                  {u.healthBucket
                    ? <p style={{ fontSize: '12px', letterSpacing: '1px', fontWeight: 700, color: HEALTH_BUCKET_META[u.healthBucket].color }}>{HEALTH_BUCKET_META[u.healthBucket].label}</p>
                    : <p style={{ fontSize: '12px', color: '#374151' }}>n.v.t.</p>
                  }
                </div>
                {/* Plan */}
                <div style={{ textAlign: 'center' }}>
                  <PlanToggle userId={u.user_id} currentPlan={(u.plan as 'basis' | 'premium' | 'elite' | 'team') ?? 'basis'} />
                </div>
                {/* Team-status: command_manager blijft togglebaar (Team-tier-entitlement,
                    vóór teamaanmaak); een gewoon teamlid (geen eigen entitlement, wél in
                    arnobot_team_members) toont puur informatief 'LID', geen toggle. */}
                <div style={{ textAlign: 'center' }}>
                  {!(u as { command_manager?: boolean }).command_manager && teamRoleMap.get(u.user_id) === 'member' ? (
                    <span style={{ fontSize: '12px', letterSpacing: '2px', fontWeight: 700, padding: '3px 8px', borderRadius: 999, background: '#374151', color: '#9ca3af', minWidth: 68, display: 'inline-block' }}>LID</span>
                  ) : (
                    <CommandManagerToggle userId={u.user_id} initial={!!(u as { command_manager?: boolean }).command_manager} />
                  )}
                </div>
                {/* Sales development attributie */}
                <div style={{ textAlign: 'center' }}>
                  <SdAgentSelect
                    userId={u.user_id}
                    initialAgent={(u as { sd_agent?: 'sales_agent_1' | 'sales_agent_2' | null }).sd_agent ?? null}
                    initialMethod={(u as { sd_attribution_method?: 'link' | 'manual' | null }).sd_attribution_method ?? null}
                  />
                </div>
                {/* Referral aanmeldingen */}
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: '14px', fontWeight: 700, color: u.refSignups > 0 ? '#f59e0b' : '#374151' }}>{u.refSignups || 'n.v.t.'}</p>
                </div>
                {/* Referral betaald */}
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: '14px', fontWeight: 700, color: u.refConverted > 0 ? '#44cc88' : '#374151' }}>{u.refConverted || 'n.v.t.'}</p>
                </div>
                {/* Betaling */}
                <div style={{ textAlign: 'center' }}>
                  {(u as { renewal_requested_at?: string | null }).renewal_requested_at && !u.paid_at
                    ? <PaidButton userId={u.user_id} paidAt={u.paid_at ?? null} expiresAt={u.expires_at ?? null} />
                    : u.paid_at
                    ? <PaidButton userId={u.user_id} paidAt={u.paid_at ?? null} expiresAt={u.expires_at ?? null} />
                    : <span style={{ fontSize: '12px', color: '#374151' }}>.</span>
                  }
                </div>
                {/* Mail opt-out */}
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: '12px', letterSpacing: '1px', fontWeight: 700, color: (u as { nudge_opt_out?: boolean }).nudge_opt_out ? '#cc2200' : '#44cc88' }}>
                    {(u as { nudge_opt_out?: boolean }).nudge_opt_out ? 'UIT' : 'AAN'}
                  </p>
                </div>
                {/* LinkedIn */}
                <div style={{ textAlign: 'center' }}>
                  {u.linkedin
                    ? <a href={u.linkedin} target="_blank" rel="noopener noreferrer" style={{ fontSize: '12px', letterSpacing: '2px', color: '#f59e0b', textDecoration: 'none', fontWeight: 700 }}>LI →</a>
                    : <SearchLinkedIn userId={u.user_id} name={name} email={u.email ?? ''} hasLinkedin={false} />
                  }
                </div>
              </div>
            )
          })}
        </div>
        </div>{/* /minWidth wrapper */}
        </div>{/* /admin-table-wrap */}
      </div>
    </main>
  )
}
