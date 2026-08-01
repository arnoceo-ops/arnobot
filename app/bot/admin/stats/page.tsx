import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { E2E_TEST_USER_ID, E2E_TEST_USER_EMAIL, MANUAL_TEST_USER_ID, MANUAL_TEST_USER_EMAIL } from '@/lib/internalTestAccounts'
import { computeHealthScore, HEALTH_BUCKET_META } from '@/lib/healthScore'
import AdminNav from '../AdminNav'
import StatsTabs from './StatsTabs'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Universele tegel: elk blok op de pagina (statlijst, splitbar, ratiobars, trend) krijgt
// dezelfde kaart-vormgeving, zodat het als één samenhangend dashboard oogt i.p.v. een
// mengelmoes van losse doosjes. `span` laat een tegel 2 kolommen innemen in de grid
// hieronder, voor content die meer breedte nodig heeft (trends, meerdere ratiobalken).
function StatCard({ label, span, stats = [], footnote, children }: {
  label: string
  span?: number
  stats?: { sublabel: string; value: string; warn?: boolean; note?: string }[]
  footnote?: string
  children?: React.ReactNode
}) {
  return (
    <div style={{ background: '#1f2937', borderRadius: 4, padding: 20, gridColumn: span ? `span ${span}` : undefined }}>
      <p style={{ fontFamily: 'sans-serif', fontSize: 12, letterSpacing: 3, color: '#f59e0b', marginBottom: 16 }}>{label}</p>
      {stats.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: children ? 16 : 0 }}>
          {stats.map(s => (
            <div key={s.sublabel}>
              <p style={{ fontFamily: 'sans-serif', fontSize: 12, letterSpacing: 2, color: '#6b7280', marginBottom: 2 }}>{s.sublabel}</p>
              <p style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 24, color: s.warn ? '#f59e0b' : '#f1f5f9', lineHeight: 1 }}>{s.value}</p>
              {s.note && <p style={{ fontFamily: 'sans-serif', fontSize: 12, color: '#6b7280', marginTop: 2 }}>{s.note}</p>}
            </div>
          ))}
        </div>
      )}
      {children}
      {footnote && <p style={{ fontFamily: 'sans-serif', fontSize: 12, color: '#6b7280', marginTop: 16 }}>{footnote}</p>}
    </div>
  )
}

function TileGrid({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, alignItems: 'start' }}>
      {children}
    </div>
  )
}

function HeroStat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div style={{ flex: 1, minWidth: 140 }}>
      <p style={{ fontFamily: 'sans-serif', fontSize: 12, letterSpacing: 3, color: '#6b7280', marginBottom: 8 }}>{label}</p>
      <p style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 44, color: '#f1f5f9', lineHeight: 1 }}>{value}</p>
      {note && <p style={{ fontFamily: 'sans-serif', fontSize: 12, color: '#6b7280', marginTop: 4 }}>{note}</p>}
    </div>
  )
}

function SplitBar({ segments }: { segments: { label: string; value: number; color: string }[] }) {
  const total = segments.reduce((sum, s) => sum + s.value, 0)
  return (
    <div>
      <div style={{ display: 'flex', height: 16, borderRadius: 2, overflow: 'hidden', background: '#111827' }}>
        {segments.map(s => (
          <div key={s.label} style={{ width: total > 0 ? `${(s.value / total) * 100}%` : '0%', background: s.color }} />
        ))}
      </div>
      <div style={{ display: 'flex', gap: 16, marginTop: 8, flexWrap: 'wrap' }}>
        {segments.map(s => (
          <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, flexShrink: 0, display: 'inline-block' }} />
            <span style={{ fontFamily: 'sans-serif', fontSize: 12, letterSpacing: 1, color: '#9ca3af' }}>{s.label} {s.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function RatioBar({ label, ratio, note }: { label: string; ratio: number; note?: string }) {
  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
      <span style={{ fontFamily: 'sans-serif', fontSize: 12, color: '#6b7280', letterSpacing: 1, minWidth: 80, flexShrink: 0 }}>{label}</span>
      <div style={{ flex: 1, background: '#111827', borderRadius: 2, height: 16, position: 'relative' }}>
        <div style={{ width: `${Math.max(0, Math.min(100, ratio))}%`, background: '#f59e0b', borderRadius: 2, height: '100%' }} />
      </div>
      <span style={{ fontFamily: 'sans-serif', fontSize: 14, fontWeight: 700, color: '#f1f5f9', minWidth: 90, textAlign: 'right' }}>
        {ratio}%{note && <span style={{ fontSize: 12, fontWeight: 400, color: '#6b7280' }}> ({note})</span>}
      </span>
    </div>
  )
}

function TrendChart({ data }: { data: Record<string, number> }) {
  const maanden = Object.keys(data).sort().slice(-6).reverse()
  if (maanden.length === 0) {
    return <p style={{ fontFamily: 'sans-serif', fontSize: 14, color: '#6b7280' }}>Nog geen data.</p>
  }
  const max = Math.max(...maanden.map(m => data[m]))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {maanden.map(m => (
        <div key={m} style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <span style={{ fontFamily: 'sans-serif', fontSize: 12, color: '#6b7280', letterSpacing: 1, minWidth: 60, flexShrink: 0 }}>{m}</span>
          <div style={{ flex: 1, background: '#111827', borderRadius: 2, height: 16, position: 'relative' }}>
            <div style={{
              width: `${Math.max(4, (data[m] / max) * 100)}%`,
              background: '#f59e0b', borderRadius: 2, height: '100%',
            }} />
          </div>
          <span style={{ fontFamily: 'sans-serif', fontSize: 14, fontWeight: 700, color: '#f1f5f9', minWidth: 24, textAlign: 'right' }}>{data[m]}</span>
        </div>
      ))}
    </div>
  )
}

export default async function AdminStatsPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('arnobot_admin')?.value
  if (!token || token !== process.env.ARNOBOT_ADMIN_KEY) redirect('/bot/admin/login')

  const now = Date.now()
  const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString()
  const veertienDaysAgo = new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString()
  const dertigDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString()

  const [
    { count: coachingGesprekken },
    { data: sparringSessies },
    { count: qaViews },
    { count: coachingViews },
    { count: gesprekClicks },
    { data: users },
    { data: logs },
    { data: referrals },
    { data: coachingDocs },
    { data: blogSessies },
    { data: pageviews30d },
    { data: eerstePageview },
  ] = await Promise.all([
    supabase.from('arnobot_blog_sessions').select('*', { count: 'exact', head: true }).neq('user_id', E2E_TEST_USER_ID).neq('user_id', MANUAL_TEST_USER_ID),
    supabase.from('arnobot_sparring_sessions').select('user_id, created_at, message_count').neq('user_id', E2E_TEST_USER_ID).neq('user_id', MANUAL_TEST_USER_ID),
    supabase.from('arnobot_events').select('*', { count: 'exact', head: true }).eq('event_name', 'qa_page_view').neq('user_id', E2E_TEST_USER_ID).neq('user_id', MANUAL_TEST_USER_ID),
    supabase.from('arnobot_events').select('*', { count: 'exact', head: true }).eq('event_name', 'coaching_page_view').neq('user_id', E2E_TEST_USER_ID).neq('user_id', MANUAL_TEST_USER_ID),
    // Telt zowel het oude event (vóór 2026-07-20, toen deze knop nog "BEKIJK ARNOLIVE" was
    // en naar /upgrade linkte) als het nieuwe (sindsdien "PLAN GESPREK", linkt naar
    // /bot/gesprek), zodat de teller niet stil terugvalt naar 0 door de omzetting.
    supabase.from('arnobot_events').select('*', { count: 'exact', head: true }).in('event_name', ['coaching_arnolive_click', 'coaching_gesprek_click']).neq('user_id', E2E_TEST_USER_ID).neq('user_id', MANUAL_TEST_USER_ID),
    supabase.from('approved_users').select('user_id, created_at, paid_at, is_active, cancelled_at, bedrag, interval').neq('email', E2E_TEST_USER_EMAIL).neq('email', MANUAL_TEST_USER_EMAIL),
    supabase.from('arnobot_rds_logs').select('user_id, session_id, created_at').not('user_id', 'is', null).neq('user_id', E2E_TEST_USER_ID).neq('user_id', MANUAL_TEST_USER_ID),
    supabase.from('arnobot_referrals').select('status, referred_user_id').neq('referrer_user_id', E2E_TEST_USER_ID).neq('referrer_user_id', MANUAL_TEST_USER_ID),
    supabase.from('arnobot_coaching').select('user_id, mindset_richting, systeem_richting, actie_richting, weinig_voortgang, stagnatie').neq('user_id', E2E_TEST_USER_ID).neq('user_id', MANUAL_TEST_USER_ID),
    supabase.from('arnobot_blog_sessions').select('user_id, created_at, actie_status').neq('user_id', E2E_TEST_USER_ID).neq('user_id', MANUAL_TEST_USER_ID),
    supabase.from('arnobot_pageviews').select('anon_id, created_at').gte('created_at', dertigDaysAgo),
    supabase.from('arnobot_pageviews').select('created_at').order('created_at', { ascending: true }).limit(1),
  ])

  const sparringGesprekken = sparringSessies?.length ?? 0
  const sparringVragen = sparringSessies?.reduce((sum, s) => sum + (s.message_count ?? 0), 0) ?? 0
  const totaalGesprekken = (coachingGesprekken ?? 0) + sparringGesprekken
  const sparringRatio = totaalGesprekken > 0 ? Math.round((sparringGesprekken / totaalGesprekken) * 100) : 0
  const coachingRatio = totaalGesprekken > 0 ? 100 - sparringRatio : 0
  const coachingVragen = (logs ?? []).length

  // Gesprekken per maand (unieke sessies uit de coaching-logs)
  const gesprekkenPerMaandSessies: Record<string, Set<string>> = {}
  for (const l of logs ?? []) {
    const maand = (l.created_at as string).slice(0, 7)
    if (!gesprekkenPerMaandSessies[maand]) gesprekkenPerMaandSessies[maand] = new Set()
    gesprekkenPerMaandSessies[maand].add(l.session_id)
  }
  const gesprekkenPerMaand: Record<string, number> = {}
  for (const m in gesprekkenPerMaandSessies) gesprekkenPerMaand[m] = gesprekkenPerMaandSessies[m].size

  // Groei & activiteit op sum-niveau
  const totaalGebruikers = users?.length ?? 0
  const betaaldCount = users?.filter(u => u.paid_at).length ?? 0
  const trialCount = totaalGebruikers - betaaldCount
  const actiefCount = users?.filter(u => u.is_active).length ?? 0
  const inactiefCount = totaalGebruikers - actiefCount
  const opgezegdCount = users?.filter(u => u.cancelled_at).length ?? 0
  const conversieratio = totaalGebruikers > 0 ? Math.round((betaaldCount / totaalGebruikers) * 100) : 0

  const logsLaatste7Dagen = (logs ?? []).filter(l => l.created_at >= sevenDaysAgo)
  const actieveGebruikers = new Set(logsLaatste7Dagen.map(l => l.user_id))
  const gesprekkenLaatste7Dagen = new Set(logsLaatste7Dagen.map(l => l.session_id)).size
  const vragenLaatste7Dagen = logsLaatste7Dagen.length
  const vragenPerGesprekLaatste7Dagen = gesprekkenLaatste7Dagen > 0 ? (vragenLaatste7Dagen / gesprekkenLaatste7Dagen).toFixed(1) : '0'
  const actiefPercentage = actiefCount > 0 ? Math.min(100, Math.round((actieveGebruikers.size / actiefCount) * 100)) : 0

  const referralAanmeldingen = referrals?.length ?? 0
  const referralConversies = referrals?.filter(r => r.status === 'converted').length ?? 0

  // Kanaalanalyse: conversie van referral-gebruikers vs overige (organisch/LinkedIn/direct)
  const referredUserIds = new Set((referrals ?? []).map(r => r.referred_user_id).filter(Boolean))
  const referralGebruikers = users?.filter(u => referredUserIds.has(u.user_id)) ?? []
  const overigGebruikers = users?.filter(u => !referredUserIds.has(u.user_id)) ?? []
  const referralKanaalConversie = referralGebruikers.length > 0
    ? Math.round((referralGebruikers.filter(u => u.paid_at).length / referralGebruikers.length) * 100) : 0
  const overigKanaalConversie = overigGebruikers.length > 0
    ? Math.round((overigGebruikers.filter(u => u.paid_at).length / overigGebruikers.length) * 100) : 0

  // Bezoeker -> Trial: unieke anonieme bezoekers (arnobot_pageviews, geen
  // Clerk-koppeling) tegenover nieuwe trials in dezelfde laatste-30-dagen
  // periode. Pas betrouwbaar zodra de teller minstens 30 dagen heeft gedraaid,
  // anders vertekent een gedeeltelijke periode het beeld. Tegel wordt hieronder
  // helemaal niet getoond zolang dat niet het geval is, i.p.v. een maand lang
  // een kaart met alleen een "onvoldoende data"-waarschuwing te tonen.
  const bezoekersLaatste30Dagen = new Set((pageviews30d ?? []).map(p => p.anon_id)).size
  const trialsLaatste30Dagen = users?.filter(u => u.created_at >= dertigDaysAgo).length ?? 0
  const bezoekerTrialRatio = bezoekersLaatste30Dagen > 0 ? Math.round((trialsLaatste30Dagen / bezoekersLaatste30Dagen) * 100) : 0
  const trackingSinds = eerstePageview?.[0]?.created_at as string | undefined
  const trackingDagen = trackingSinds ? Math.floor((now - new Date(trackingSinds).getTime()) / (24 * 60 * 60 * 1000)) : 0
  const voldoendeTrackingData = !!trackingSinds && trackingDagen >= 30

  // Cohortdenken: conversie per aanmeldmaand i.p.v. één blended cijfer over alle gebruikers ooit
  const cohortMap: Record<string, { totaal: number; betaald: number }> = {}
  for (const u of users ?? []) {
    const maand = (u.created_at as string).slice(0, 7)
    if (!cohortMap[maand]) cohortMap[maand] = { totaal: 0, betaald: 0 }
    cohortMap[maand].totaal++
    if (u.paid_at) cohortMap[maand].betaald++
  }
  const cohorten = Object.keys(cohortMap).sort().slice(-6).map(maand => ({
    maand,
    ratio: cohortMap[maand].totaal > 0 ? Math.round((cohortMap[maand].betaald / cohortMap[maand].totaal) * 100) : 0,
    n: cohortMap[maand].totaal,
  }))

  // Churn: opgezegd als percentage van iedereen die ooit betaald heeft (niet van het totaal
  // aantal gebruikers, dat verwatert het cijfer met trials die nooit betaald hebben), plus
  // een trend per opzegmaand zodat zichtbaar is of het stijgt of daalt, niet alleen een kaal
  // totaal zonder richting.
  const churnRatio = betaaldCount > 0 ? Math.round((opgezegdCount / betaaldCount) * 100) : 0
  const opgezegdPerMaand: Record<string, number> = {}
  for (const u of users ?? []) {
    const cancelledAt = (u as { cancelled_at?: string | null }).cancelled_at
    if (!cancelledAt) continue
    const maand = cancelledAt.slice(0, 7)
    opgezegdPerMaand[maand] = (opgezegdPerMaand[maand] ?? 0) + 1
  }

  // Periode-vergelijking: nieuwe gebruikers en gesprekken deze week vs de week ervoor
  const nieuwLaatste7Dagen = users?.filter(u => u.created_at >= sevenDaysAgo).length ?? 0
  const nieuwDaarvoor7Dagen = users?.filter(u => u.created_at >= veertienDaysAgo && u.created_at < sevenDaysAgo).length ?? 0
  const gebruikersDeltaValue = nieuwDaarvoor7Dagen > 0
    ? `${nieuwLaatste7Dagen >= nieuwDaarvoor7Dagen ? '+' : ''}${Math.round(((nieuwLaatste7Dagen - nieuwDaarvoor7Dagen) / nieuwDaarvoor7Dagen) * 100)}%`
    : `${nieuwLaatste7Dagen} nieuw`
  const gebruikersDeltaNote = nieuwDaarvoor7Dagen > 0 ? `${nieuwDaarvoor7Dagen} nieuw vorige week` : 'deze week'

  const logsDaarvoor7Dagen = (logs ?? []).filter(l => l.created_at >= veertienDaysAgo && l.created_at < sevenDaysAgo)
  const gesprekkenDaarvoor7Dagen = new Set(logsDaarvoor7Dagen.map(l => l.session_id)).size
  const gesprekkenDeltaNote = gesprekkenDaarvoor7Dagen > 0
    ? `${gesprekkenLaatste7Dagen >= gesprekkenDaarvoor7Dagen ? '+' : ''}${Math.round(((gesprekkenLaatste7Dagen - gesprekkenDaarvoor7Dagen) / gesprekkenDaarvoor7Dagen) * 100)}% vs vorige week (${gesprekkenDaarvoor7Dagen})`
    : undefined

  // MRR: alleen betrouwbaar zodra bedrag + interval bekend zijn (handmatig of via betaalprovider).
  // Geen fallback op planprijs: MRR wordt pas echt gevuld zodra er een betaalprovider actief is
  // die bedrag/interval automatisch zet, dat is de eigenlijke fix, niet een schatting hier.
  const betaaldeGebruikers = users?.filter(u => u.paid_at) ?? []
  const betaaldeGebruikersMetBedrag = betaaldeGebruikers.filter(u => u.bedrag != null && u.interval)
  const mrr = betaaldeGebruikersMetBedrag.reduce((sum, u) => {
    const maandBedrag = u.interval === 'jaar' ? (u.bedrag as number) / 12 : (u.bedrag as number)
    return sum + maandBedrag
  }, 0)
  const mrrNote = betaaldeGebruikersMetBedrag.length === 0 && betaaldCount > 0
    ? 'wordt betrouwbaar zodra betaalprovider actief is'
    : undefined

  // Gezondheidsscore per gebruiker: gedragssignalen uit coaching, actieopvolging en sparring
  const coachingByUser = new Map((coachingDocs ?? []).map(c => [c.user_id, c]))

  const laatsteCoachingPerUser = new Map<string, string>()
  const actieStatussenPerUser = new Map<string, { created_at: string; actie_status: string }[]>()
  for (const s of blogSessies ?? []) {
    const huidig = laatsteCoachingPerUser.get(s.user_id)
    if (!huidig || s.created_at > huidig) laatsteCoachingPerUser.set(s.user_id, s.created_at)
    if (s.actie_status && s.actie_status !== 'skip') {
      if (!actieStatussenPerUser.has(s.user_id)) actieStatussenPerUser.set(s.user_id, [])
      actieStatussenPerUser.get(s.user_id)!.push({ created_at: s.created_at, actie_status: s.actie_status })
    }
  }

  const laatsteSparringPerUser = new Map<string, string>()
  for (const s of sparringSessies ?? []) {
    const huidig = laatsteSparringPerUser.get(s.user_id)
    if (!huidig || s.created_at > huidig) laatsteSparringPerUser.set(s.user_id, s.created_at)
  }

  const coachingGesprekkenLaatste7DagenPerUser = new Map<string, Set<string>>()
  for (const l of logsLaatste7Dagen) {
    if (!coachingGesprekkenLaatste7DagenPerUser.has(l.user_id)) coachingGesprekkenLaatste7DagenPerUser.set(l.user_id, new Set())
    coachingGesprekkenLaatste7DagenPerUser.get(l.user_id)!.add(l.session_id)
  }

  let risicoCount = 0
  let neutraalCount = 0
  let gezondCount = 0
  let onbekendCount = 0
  for (const u of users ?? []) {
    const coaching = coachingByUser.get(u.user_id)
    if (!coaching) { onbekendCount++; continue }
    const { bucket } = computeHealthScore({
      mindset_richting: coaching.mindset_richting,
      systeem_richting: coaching.systeem_richting,
      actie_richting: coaching.actie_richting,
      weinig_voortgang: coaching.weinig_voortgang,
      stagnatie: coaching.stagnatie,
      laatsteCoachingGesprek: laatsteCoachingPerUser.get(u.user_id) ?? null,
      actieStatussenRecent: (actieStatussenPerUser.get(u.user_id) ?? [])
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(0, 5)
        .map(x => x.actie_status),
      laatsteSparring: laatsteSparringPerUser.get(u.user_id) ?? null,
      coachingGesprekkenLaatste7Dagen: coachingGesprekkenLaatste7DagenPerUser.get(u.user_id)?.size ?? 0,
    }, now)
    if (bucket === 'risico') risicoCount++
    else if (bucket === 'gezond') gezondCount++
    else neutraalCount++
  }

  const gezondheidTiles = (
    <TileGrid>
      <StatCard label="GEZONDHEIDSSCORE" span={2}>
        <SplitBar segments={[
          { label: HEALTH_BUCKET_META.gezond.label, value: gezondCount, color: HEALTH_BUCKET_META.gezond.color },
          { label: HEALTH_BUCKET_META.neutraal.label, value: neutraalCount, color: HEALTH_BUCKET_META.neutraal.color },
          { label: HEALTH_BUCKET_META.risico.label, value: risicoCount, color: HEALTH_BUCKET_META.risico.color },
        ]} />
        {risicoCount > 0 && (
          <p style={{ fontFamily: 'sans-serif', fontSize: 14, fontWeight: 700, color: '#cc4444', marginTop: 16 }}>
            {risicoCount} {risicoCount === 1 ? 'gebruiker vertoont' : 'gebruikers vertonen'} risicosignalen, bekijk de gebruikerspagina voor wie dit betreft.
          </p>
        )}
        {onbekendCount > 0 && (
          <p style={{ fontFamily: 'sans-serif', fontSize: 12, color: '#6b7280', marginTop: 12 }}>
            {onbekendCount} {onbekendCount === 1 ? 'gebruiker heeft' : 'gebruikers hebben'} nog geen coachingsdocument, niet meegenomen in de score.
          </p>
        )}
      </StatCard>
      <StatCard label="ACTIVITEIT (LAATSTE 7 DAGEN)" stats={[
        { sublabel: 'AANDEEL ACTIEF', value: `${actiefPercentage}%`, warn: actiefPercentage < 50, note: `${actieveGebruikers.size} van ${actiefCount} actieve gebruikers` },
        { sublabel: 'GESPREKKEN', value: String(gesprekkenLaatste7Dagen), note: gesprekkenDeltaNote },
        { sublabel: 'VRAGEN P/GESPREK', value: vragenPerGesprekLaatste7Dagen },
      ]} />
    </TileGrid>
  )

  const groeiTiles = [
    <StatCard key="groei" label="GROEI" stats={[
      { sublabel: 'VS VORIGE WEEK', value: gebruikersDeltaValue, note: gebruikersDeltaNote },
    ]}>
      <SplitBar segments={[
        { label: 'BETAALD', value: betaaldCount, color: '#44cc88' },
        { label: 'TRIAL', value: trialCount, color: '#f59e0b' },
      ]} />
    </StatCard>,
    <StatCard key="status" label="STATUS">
      <SplitBar segments={[
        { label: 'ACTIEF', value: actiefCount, color: '#44cc88' },
        { label: 'INACTIEF', value: inactiefCount, color: '#6b7280' },
      ]} />
    </StatCard>,
    <StatCard key="referrals" label="REFERRALS" stats={[
      { sublabel: 'AANMELDINGEN', value: String(referralAanmeldingen) },
      { sublabel: 'CONVERSIES', value: String(referralConversies) },
    ]} />,
    voldoendeTrackingData ? (
      <StatCard key="bezoeker-trial" label="BEZOEKER → TRIAL (30D)" span={2}
        footnote="Bezoekers = unieke anonieme sessies op de publieke marketingpagina's, niet gekoppeld aan een account.">
        <RatioBar label="CONVERSIE" ratio={bezoekerTrialRatio} note={`${trialsLaatste30Dagen} trials / ${bezoekersLaatste30Dagen} bezoekers`} />
      </StatCard>
    ) : null,
    <StatCard key="kanaal" label="CONVERSIE PER KANAAL"
      footnote="OVERIG = organisch, LinkedIn en direct verkeer, niet los te herleiden zonder aparte trackinglink per kanaal.">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <RatioBar label="REFERRAL" ratio={referralKanaalConversie} note={`n=${referralGebruikers.length}`} />
        <RatioBar label="OVERIG" ratio={overigKanaalConversie} note={`n=${overigGebruikers.length}`} />
      </div>
    </StatCard>,
    <StatCard key="cohorten" label="CONVERSIE PER AANMELDMAAND" span={2}
      footnote="Cohorten binnen de proefperiode (30 dagen) zijn nog niet compleet, hun conversieratio kan nog stijgen.">
      {cohorten.length === 0 ? (
        <p style={{ fontFamily: 'sans-serif', fontSize: 14, color: '#6b7280' }}>Nog geen data.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {cohorten.map(c => (
            <RatioBar key={c.maand} label={c.maand} ratio={c.ratio} note={`n=${c.n}`} />
          ))}
        </div>
      )}
    </StatCard>,
    <StatCard key="churn" label="CHURN" span={2}
      footnote="Percentage van gebruikers die ooit betaald hebben (paid_at gezet), niet van het totaal aantal aanmeldingen.">
      <RatioBar label="OPGEZEGD" ratio={churnRatio} note={`${opgezegdCount} van ${betaaldCount} ooit betaald`} />
      {Object.keys(opgezegdPerMaand).length > 0 && (
        <div style={{ marginTop: 20 }}>
          <TrendChart data={opgezegdPerMaand} />
        </div>
      )}
    </StatCard>,
  ].filter(Boolean)

  const gebruikTiles = (
    <TileGrid>
      <StatCard label="COACHING VS SPARREN" span={2}>
        <SplitBar segments={[
          { label: 'COACHING', value: coachingGesprekken ?? 0, color: '#f59e0b' },
          { label: 'SPARREN', value: sparringGesprekken, color: '#f1f5f9' },
        ]} />
      </StatCard>
      <StatCard label="COACHING" stats={[
        { sublabel: 'GESPREKKEN', value: String(coachingGesprekken ?? 0) },
        { sublabel: 'VRAGEN', value: String(coachingVragen) },
        { sublabel: 'AANDEEL', value: `${coachingRatio}%` },
      ]} />
      <StatCard label="SPARREN" stats={[
        { sublabel: 'GESPREKKEN', value: String(sparringGesprekken), warn: sparringGesprekken === 0 },
        { sublabel: 'VRAGEN', value: String(sparringVragen), warn: sparringVragen === 0 },
        { sublabel: 'AANDEEL', value: `${sparringRatio}%`, warn: sparringRatio === 0 },
      ]} />
      <StatCard label="BEZOEKEN & ENGAGEMENT" stats={[
        { sublabel: 'Q&A BEZOEKEN', value: String(qaViews ?? 0) },
        { sublabel: 'COACHING BEZOEKEN', value: String(coachingViews ?? 0) },
        { sublabel: 'GESPREK MET ARNO CLICKS', value: String(gesprekClicks ?? 0) },
      ]} />
      <StatCard label="GESPREKKEN OVER TIJD" span={2}>
        <TrendChart data={gesprekkenPerMaand} />
      </StatCard>
    </TileGrid>
  )

  return (
    <main style={{ background: '#111827', minHeight: '100vh', color: '#f1f5f9', fontFamily: 'sans-serif' }}>
      <AdminNav active="/bot/admin/stats" />

      <div className="admin-content" style={{ maxWidth: '1400px', margin: '0 auto', padding: '48px 40px' }}>
        <p style={{ color: '#f59e0b', fontSize: '12px', letterSpacing: '4px', marginBottom: '8px' }}>ARNOBOT ADMIN</p>
        <h1 style={{ fontSize: '48px', fontWeight: 700, margin: '0 0 32px 0', letterSpacing: '-1px' }}>Stats</h1>

        <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap', paddingBottom: 24, marginBottom: 40, borderBottom: '2px solid #f59e0b' }}>
          <HeroStat label="GEBRUIKERS" value={String(totaalGebruikers)} />
          <HeroStat label="CONVERSIE" value={`${conversieratio}%`} note={`n=${totaalGebruikers}`} />
          <HeroStat label="ACTIEF 7D" value={String(actieveGebruikers.size)} />
          <HeroStat label="MRR" value={mrr > 0 ? `€${Math.round(mrr)}` : '€0'} note={mrrNote} />
        </div>

        <StatsTabs tabs={[
          { key: 'gezondheid', label: 'GEZONDHEID & RETENTIE', content: gezondheidTiles },
          { key: 'groei', label: 'GROEI & FUNNEL', content: <TileGrid>{groeiTiles}</TileGrid> },
          { key: 'gebruik', label: 'GEBRUIK', content: gebruikTiles },
        ]} />
      </div>
    </main>
  )
}
