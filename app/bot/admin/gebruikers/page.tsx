import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
import { clerkClient } from '@clerk/nextjs/server'
import { E2E_TEST_USER_EMAIL, MANUAL_TEST_USER_EMAIL, APP_REVIEWER_EMAIL, INTERNAL_TEST_USERS_IN, FAKE_DEMO_USER_LIKE } from '@/lib/internalTestAccounts'
import { computeHealthScore, HEALTH_BUCKET_META, type HealthBucket } from '@/lib/healthScore'
import SearchLinkedIn from './SearchLinkedIn'
import PlanToggle from './PlanToggle'
import CommandManagerToggle from './CommandManagerToggle'
import PaidButton from './PaidButton'
import SdAgentSelect from './SdAgentSelect'
import AdminNav from '../AdminNav'
import { haalAlleRijen } from '@/lib/haalAlleRijen'
import { huidigePersona } from '@/lib/testPersona'
import TestPersonaButtons from '../test-persona/TestPersonaButtons'
import TestPlanButtons from '../test-persona/TestPlanButtons'
import { ACTIE_LABEL, beschrijfDetails, type AdminActie, type AdminLogDetails } from '@/lib/adminLog'

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
    // expires_at zonder trial_start = een handmatig gezette comp (GRATIS +), geen echte trial
    const isComp = !row.trial_start
    if (left <= 0) return { label: isComp ? 'GRATIS VERLOPEN' : 'VERLOPEN', color: '#cc4444' }
    return { label: isComp ? `GRATIS ${left}d` : `TRIAL ${left}d`, color: '#f59e0b' }
  }
  if (row.trial_start) {
    const end = new Date(new Date(row.trial_start).getTime() + 30 * 24 * 60 * 60 * 1000)
    const left = Math.ceil((end.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    if (left <= 0) return { label: 'TRIAL VERLOPEN', color: '#cc4444' }
    return { label: `TRIAL ${left}d`, color: '#f59e0b' }
  }
  return { label: 'ONBEKEND', color: '#6b7280' }
}

// Resterende dagen van de proef of comp van een actieve gebruiker die nog niet betaalt, zelfde
// regels als trialStatus() hierboven. null = betaald, inactief of geen einddatum bekend.
function proefDagenOver(row: { paid_at?: string | null; expires_at?: string | null; trial_start?: string | null; is_active?: boolean }): number | null {
  if (!row.is_active || row.paid_at) return null
  let end: number | null = null
  if (row.expires_at) end = new Date(row.expires_at).getTime()
  else if (row.trial_start) end = new Date(row.trial_start).getTime() + 30 * 24 * 60 * 60 * 1000
  if (end === null) return null
  return Math.ceil((end - Date.now()) / (1000 * 60 * 60 * 24))
}

const euro = (cent: number) => `€${(cent / 100).toFixed(2).replace('.', ',')}`

// Sorteersleutel voor de STATUS-badge, spiegelt trialStatus() hierboven:
// INACTIEF < VERLOPEN < loopt af (op resterende dagen, minst eerst) < BETAALD < onbekend.
function statusSortKey(row: { is_active?: boolean; paid_at?: string | null; expires_at?: string | null; trial_start?: string | null }): string {
  if (!row.is_active) return '0'
  if (row.paid_at) return '3'
  let end: number | null = null
  if (row.expires_at) end = new Date(row.expires_at).getTime()
  else if (row.trial_start) end = new Date(row.trial_start).getTime() + 30 * 24 * 60 * 60 * 1000
  if (end === null) return '4'
  const daysLeft = Math.ceil((end - Date.now()) / (1000 * 60 * 60 * 24))
  if (daysLeft <= 0) return '1'
  return `2_${String(daysLeft).padStart(6, '0')}`
}

// Sorteersleutel voor de BETALING-kolom die de zichtbare volgorde volgt:
// UIT < TOEGANG + < GRATIS (op einddatum) < BETAALD met einddatum < BETAALD onbeperkt.
// Rang als prefix, datum als tiebreaker, alles als string zodat één vergelijking volstaat.
function betalingSortKey(row: { is_active?: boolean; paid_at?: string | null; expires_at?: string | null; created_at?: string | null }): string {
  if (!row.is_active) return '0'
  if (row.paid_at && !row.expires_at) return '4'
  if (row.paid_at) return `3_${row.expires_at ?? ''}`
  if (row.expires_at) return `2_${row.expires_at}`
  return `1_${row.created_at ?? ''}`
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

  const [usersRes, logsRes, coachingRes, analysesRes, referralsRes, blogSessiesRes, sparringRes, teamMembersRes, betalingRijen, abonnementRijen, adminLogRes] = await Promise.all([
    supabase
      .from('approved_users')
      .select('user_id, email, full_name, voornaam, achternaam, linkedin, trial_start, expires_at, paid_at, is_active, created_at, plan, command_manager, trial_reactivated_at, nudge_opt_out, sd_agent, sd_attribution_method')
      .neq('email', E2E_TEST_USER_EMAIL)
      .neq('email', MANUAL_TEST_USER_EMAIL)
      .neq('email', APP_REVIEWER_EMAIL),
    // De vier groeitabellen in blokken (lib/haalAlleRijen.ts): een kale select kapt op 1000 rijen
    // af, waarna GESPREKKEN, VRAGEN, LAATSTE GESPREK en de gezondheidsscore stilletjes onjuist
    // werden. `{ data }` houdt de vorm van een gewone query, zodat de rest van de pagina gelijk blijft.
    haalAlleRijen<{ user_id: string; session_id: string; created_at: string }>((van, tot) =>
      supabase
        .from('arnobot_rds_logs')
        .select('user_id, session_id, created_at')
        .not('user_id', 'is', null)
        .order('id', { ascending: true }).range(van, tot)).then(data => ({ data })),
    supabase
      .from('arnobot_coaching')
      .select('user_id, updated_at, mindset_richting, systeem_richting, actie_richting, weinig_voortgang, stagnatie'),
    haalAlleRijen<{ user_id: string }>((van, tot) =>
      supabase
        .from('arnobot_analyses')
        .select('user_id')
        .order('id', { ascending: true }).range(van, tot)).then(data => ({ data })),
    supabase
      .from('arnobot_referrals')
      .select('referrer_user_id, status'),
    haalAlleRijen<{ user_id: string; created_at: string; actie_status: string | null }>((van, tot) =>
      supabase
        .from('arnobot_blog_sessions')
        .select('user_id, created_at, actie_status')
        .order('id', { ascending: true }).range(van, tot)).then(data => ({ data })),
    haalAlleRijen<{ user_id: string; created_at: string }>((van, tot) =>
      supabase
        .from('arnobot_sparring_sessions')
        .select('user_id, created_at')
        .order('id', { ascending: true }).range(van, tot)).then(data => ({ data })),
    supabase
      .from('arnobot_team_members')
      .select('user_id, role'),
    // Betaalgeschiedenis en abonnement per gebruiker (voor het paneel achter BETALING) en het
    // logboek van adminacties (onderaan de pagina).
    haalAlleRijen<{ user_id: string; soort: string | null; status: string; bedrag_cent: number; terugbetaald_cent: number | null; betaald_at: string | null; created_at: string }>((van, tot) =>
      supabase
        .from('arnobot_payments')
        .select('user_id, soort, status, bedrag_cent, terugbetaald_cent, betaald_at, created_at')
        .not('user_id', 'in', INTERNAL_TEST_USERS_IN).not('user_id', 'like', FAKE_DEMO_USER_LIKE)
        .order('id', { ascending: true }).range(van, tot)),
    haalAlleRijen<{ user_id: string; plan: string; cyclus: string; status: string; opzegging_aangevraagd_at: string | null; created_at: string }>((van, tot) =>
      supabase
        .from('arnobot_subscriptions')
        .select('user_id, plan, cyclus, status, opzegging_aangevraagd_at, created_at')
        .not('user_id', 'in', INTERNAL_TEST_USERS_IN).not('user_id', 'like', FAKE_DEMO_USER_LIKE)
        .order('id', { ascending: true }).range(van, tot)),
    supabase
      .from('arnobot_admin_log')
      .select('id, created_at, actie, doel_user_id, doel_team_id, details')
      .order('created_at', { ascending: false })
      .limit(30),
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

  const sorted = [...enriched].sort((a, b) => {
    let av: number | string = 0
    let bv: number | string = 0
    if (sort === 'naam') {
      av = (a.clerkName || a.full_name || [a.voornaam, a.achternaam].filter(Boolean).join(' ')).toLowerCase()
      bv = (b.clerkName || b.full_name || [b.voornaam, b.achternaam].filter(Boolean).join(' ')).toLowerCase()
    }
    if (sort === 'aangemeld') { av = a.created_at; bv = b.created_at }
    if (sort === 'status') { av = statusSortKey(a); bv = statusSortKey(b) }
    if (sort === 'gesprekken') { av = a.count; bv = b.count }
    if (sort === 'vragen') { av = a.questions; bv = b.questions }
    if (sort === 'laatste') { av = a.lastSession || ''; bv = b.lastSession || '' }
    if (sort === 'coaching') { av = a.coachingCount; bv = b.coachingCount }
    if (sort === 'analyses') { av = a.analysesCount; bv = b.analysesCount }
    if (sort === 'actief') { av = a.recentCount; bv = b.recentCount }
    if (sort === 'plan') { av = a.plan || ''; bv = b.plan || '' }
    if (sort === 'command_manager') {
      const teamRank = (u: typeof a) => u.command_manager ? 2 : (teamRoleMap.get(u.user_id) === 'member' ? 1 : 0)
      av = teamRank(a); bv = teamRank(b)
    }
    if (sort === 'sd_agent') { av = (a as { sd_agent?: string | null }).sd_agent || ''; bv = (b as { sd_agent?: string | null }).sd_agent || '' }
    if (sort === 'linkedin') { av = a.linkedin ? 1 : 0; bv = b.linkedin ? 1 : 0 }
    if (sort === 'betaling') { av = betalingSortKey(a); bv = betalingSortKey(b) }
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

  const cols = '44px minmax(140px,1fr) 120px 80px 70px 100px 75px 75px 75px 85px 80px 140px 60px 60px 90px 50px 80px'

  // BELLIJST: wie loopt de proef binnen 7 dagen af en heeft minder dan 3 vragen gesteld. Dat zijn
  // de mensen om zelf te bellen of te mailen voor het te laat is.
  const bellijst = enriched
    .map(u => ({ u, dagen: proefDagenOver(u) }))
    .filter((x): x is { u: typeof x.u; dagen: number } => x.dagen !== null && x.dagen > 0 && x.dagen <= 7 && x.u.questions < 3)
    .sort((a, b) => a.dagen - b.dagen)

  // Betalingen (laatste 5, nieuwste eerst) en het laatste abonnement per gebruiker, voor het paneel achter BETALING.
  const BETAAL_STATUS: Record<string, string> = { paid: 'betaald', open: 'open', pending: 'open', authorized: 'open', failed: 'mislukt', expired: 'verlopen', canceled: 'geannuleerd', refunded: 'terug' }
  const ABO_STATUS: Record<string, string> = { active: 'actief', ended: 'beëindigd', refunded: 'terugbetaald', abandoned: 'niet afgerond', pending: 'wacht op betaling', cancelled: 'opgezegd', suspended: 'geschorst' }
  const betalingenPerUser = new Map<string, { datum: string; bedrag: string; status: string }[]>()
  for (const b of [...betalingRijen].sort((x, y) => (y.betaald_at ?? y.created_at).localeCompare(x.betaald_at ?? x.created_at))) {
    const lijst = betalingenPerUser.get(b.user_id) ?? []
    if (lijst.length >= 5) continue
    const terug = (b.terugbetaald_cent ?? 0) > 0
    lijst.push({
      datum: new Date(b.betaald_at ?? b.created_at).toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: '2-digit', timeZone: 'Europe/Amsterdam' }),
      bedrag: euro(b.bedrag_cent),
      status: terug ? 'terug' : (BETAAL_STATUS[b.status] ?? b.status),
    })
    betalingenPerUser.set(b.user_id, lijst)
  }
  const abonnementPerUser = new Map<string, string>()
  for (const s of [...abonnementRijen].sort((x, y) => y.created_at.localeCompare(x.created_at))) {
    if (abonnementPerUser.has(s.user_id)) continue
    abonnementPerUser.set(s.user_id, `${s.plan === 'premium' ? 'Pro' : 'Basic'} ${s.cyclus === 'jaarlijks' ? 'jaarlijks' : 'maandelijks'}, ${ABO_STATUS[s.status] ?? s.status}${s.status === 'active' && s.opzegging_aangevraagd_at ? ' (opgezegd)' : ''}`)
  }

  const testPersona = await huidigePersona()

  // Logboek van adminacties (arnobot_admin_log), nieuwste eerst.
  const naamVoorId = new Map(enriched.map(u => [u.user_id, u.clerkName || u.full_name || [u.voornaam, u.achternaam].filter(Boolean).join(' ') || u.email || u.user_id]))
  const adminLog = (adminLogRes.data ?? []) as { id: string; created_at: string; actie: AdminActie; doel_user_id: string | null; doel_team_id: string | null; details: AdminLogDetails | null }[]

  return (
    <main style={{ background: '#111827', minHeight: '100vh', color: '#f1f5f9', fontFamily: 'sans-serif' }}>
      <AdminNav active="/bot/admin/gebruikers" />

      <div className="admin-content" style={{ maxWidth: '1750px', margin: '0 auto', padding: '48px 24px' }}>

        <p style={{ color: '#f59e0b', fontSize: '12px', letterSpacing: '4px', marginBottom: '8px' }}>ARNOBOT ADMIN</p>
        <h1 style={{ fontSize: '48px', fontWeight: 700, margin: '0 0 8px 0', letterSpacing: '-1px' }}>Gebruikers</h1>
        <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '48px' }}>
          {sorted.length} gebruiker{sorted.length !== 1 ? 's' : ''}
        </p>

        {bellijst.length > 0 && (
          <div style={{ background: '#1f2937', borderRadius: 4, padding: '16px 20px', marginBottom: 40, borderLeft: '3px solid #f59e0b' }}>
            <p style={{ fontSize: '12px', letterSpacing: '3px', color: '#f59e0b', marginBottom: 12 }}>BELLIJST: PROEF LOOPT AF, WEINIG GEBRUIKT</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {bellijst.map(({ u, dagen }) => {
                const naam = u.clerkName || u.full_name || [u.voornaam, u.achternaam].filter(Boolean).join(' ') || 'n.v.t.'
                return (
                  <div key={u.user_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '14px' }}>
                      <a href={`/bot/admin/analyse?userId=${u.user_id}`} style={{ color: '#f1f5f9', fontWeight: 700, textDecoration: 'none' }}>{naam}</a>
                      <span style={{ color: '#6b7280' }}> · {u.email || 'geen e-mail'}</span>
                    </span>
                    <span style={{ fontSize: '12px', color: '#9ca3af', letterSpacing: '1px' }}>
                      nog {dagen} dag{dagen !== 1 ? 'en' : ''} · {u.questions} vra{u.questions === 1 ? 'ag' : 'gen'} · laatste gesprek {u.lastSession ? new Date(u.lastSession).toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', timeZone: 'Europe/Amsterdam' }) : 'nooit'}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <div className="admin-table-wrap" style={{ overflowX: 'auto' }}>
        <div style={{ minWidth: 'max-content' }}>
        {/* Tabel header */}
        <div className="admin-user-row" style={{ display: 'grid', gridTemplateColumns: cols, gap: '0 8px', padding: '0 12px 12px', borderBottom: '1px solid #222', alignItems: 'end', borderLeft: '3px solid transparent' }}>
          <div />
          <SortHeader label="NAAM" field="naam" sort={sort} dir={dir} leftAlign />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
            <SortHeader label="STATUS" field="status" sort={sort} dir={dir} />
            <SortHeader label="AANGEMELD" field="aangemeld" sort={sort} dir={dir} />
          </div>
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
          <SortHeader label="BETALING" field="betaling" sort={sort} dir={dir} vertical />
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
                  <p style={{ fontSize: '14px', fontWeight: 700, color: u.coachingCount > 0 ? '#44cc88' : '#374151' }}>{u.coachingCount}</p>
                </div>
                {/* Analyses */}
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: '14px', fontWeight: 700, color: u.analysesCount > 0 ? '#44cc88' : '#374151' }}>{u.analysesCount}</p>
                </div>
                {/* Gezondheid */}
                <div style={{ textAlign: 'center' }}>
                  {u.healthBucket
                    ? <p style={{ fontSize: '12px', letterSpacing: '1px', fontWeight: 700, color: HEALTH_BUCKET_META[u.healthBucket].color }}>{HEALTH_BUCKET_META[u.healthBucket].label}</p>
                    : <p style={{ fontSize: '12px', color: '#6b7280' }}>GEEN RAPPORT</p>
                  }
                </div>
                {/* Plan */}
                <div style={{ textAlign: 'center' }}>
                  <PlanToggle userId={u.user_id} currentPlan={(u.plan as 'basis' | 'premium' | 'team') ?? 'basis'} />
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
                  <p style={{ fontSize: '14px', fontWeight: 700, color: u.refSignups > 0 ? '#f59e0b' : '#374151' }}>{u.refSignups}</p>
                </div>
                {/* Referral betaald */}
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: '14px', fontWeight: 700, color: u.refConverted > 0 ? '#44cc88' : '#374151' }}>{u.refConverted}</p>
                </div>
                {/* Betaling / toegang: PaidButton toont BETAALD, GRATIS t/m, of TOEGANG +,
                    en het paneel erachter regelt comp, betaling en aan/uit */}
                <div style={{ textAlign: 'center' }}>
                  <PaidButton userId={u.user_id} paidAt={u.paid_at ?? null} expiresAt={u.expires_at ?? null} isActive={u.is_active ?? false}
                    betalingen={betalingenPerUser.get(u.user_id) ?? []} abonnement={abonnementPerUser.get(u.user_id) ?? null} />
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

        <div style={{ marginTop: 56 }}>
          <p style={{ fontSize: '12px', letterSpacing: '3px', color: '#f59e0b', marginBottom: 8 }}>TESTACCOUNT (test@arno.bot): ROL</p>
          <p style={{ fontSize: '14px', color: '#6b7280', lineHeight: 1.6, margin: '0 0 16px 0' }}>
            Zet het handmatige testaccount in één klik om naar een andere rol, door de echte onderliggende data te wijzigen (teamlidmaatschap, command_manager, profiel.rol).
          </p>
          <TestPersonaButtons initial={testPersona.persona} />
          <p style={{ fontSize: '12px', letterSpacing: '3px', color: '#f59e0b', margin: '32px 0 8px' }}>TESTACCOUNT: PLAN</p>
          <p style={{ fontSize: '14px', color: '#6b7280', lineHeight: 1.6, margin: '0 0 16px 0' }}>
            Los van de rol: zet hetzelfde testaccount op Basic, Pro of Team om te zien hoe de app er met dat abonnement uitziet.
          </p>
          <TestPlanButtons initial={testPersona.plan} />
        </div>

        <div style={{ marginTop: 56 }}>
          <p style={{ fontSize: '12px', letterSpacing: '3px', color: '#f59e0b', marginBottom: 12 }}>LAATSTE ADMINACTIES</p>
          {adminLog.length === 0 ? (
            <p style={{ fontSize: '14px', color: '#6b7280' }}>Nog geen adminacties vastgelegd.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {adminLog.map(r => (
                <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '120px 190px minmax(120px,220px) 1fr', gap: 12, alignItems: 'baseline', background: '#1f2937', padding: '10px 12px' }}>
                  <span style={{ fontSize: '12px', color: '#6b7280' }}>
                    {new Date(r.created_at).toLocaleString('nl-NL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' })}
                  </span>
                  <span style={{ fontSize: '12px', letterSpacing: '2px', fontWeight: 700, color: '#f1f5f9' }}>{ACTIE_LABEL[r.actie] ?? r.actie}</span>
                  <span style={{ fontSize: '14px', color: '#9ca3af' }}>{r.doel_user_id ? (naamVoorId.get(r.doel_user_id) ?? r.doel_user_id) : r.doel_team_id ? 'team' : ''}</span>
                  <span style={{ fontSize: '12px', color: '#6b7280', lineHeight: 1.6 }}>{beschrijfDetails(r.details)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
