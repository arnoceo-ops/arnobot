import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { E2E_TEST_USER_ID, E2E_TEST_USER_EMAIL } from '@/lib/e2eTestAccount'
import AdminNav from '../AdminNav'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function StatCard({ label, stats }: { label: string; stats: { sublabel: string; value: string }[] }) {
  return (
    <div style={{ background: '#1f2937', borderRadius: 4, padding: 20 }}>
      <p style={{ fontFamily: 'sans-serif', fontSize: 12, letterSpacing: 3, color: '#f59e0b', marginBottom: 16 }}>{label}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {stats.map(s => (
          <div key={s.sublabel}>
            <p style={{ fontFamily: 'sans-serif', fontSize: 12, letterSpacing: 2, color: '#6b7280', marginBottom: 2 }}>{s.sublabel}</p>
            <p style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 24, color: '#f1f5f9', lineHeight: 1 }}>{s.value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

export default async function AdminStatsPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('arnobot_admin')?.value
  if (!token || token !== process.env.ARNOBOT_ADMIN_KEY) redirect('/bot/admin/login')

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [
    { count: coachingGesprekken },
    { data: sparringSessies },
    { count: qaViews },
    { count: coachingViews },
    { count: arnoliveClicks },
    { data: analyses },
    { data: users },
    { data: logs },
    { data: referrals },
  ] = await Promise.all([
    supabase.from('arnobot_blog_sessions').select('*', { count: 'exact', head: true }).neq('user_id', E2E_TEST_USER_ID),
    supabase.from('arnobot_sparring_sessions').select('message_count').neq('user_id', E2E_TEST_USER_ID),
    supabase.from('arnobot_events').select('*', { count: 'exact', head: true }).eq('event_name', 'qa_page_view').neq('user_id', E2E_TEST_USER_ID),
    supabase.from('arnobot_events').select('*', { count: 'exact', head: true }).eq('event_name', 'coaching_page_view').neq('user_id', E2E_TEST_USER_ID),
    supabase.from('arnobot_events').select('*', { count: 'exact', head: true }).eq('event_name', 'coaching_arnolive_click').neq('user_id', E2E_TEST_USER_ID),
    supabase.from('arnobot_analyses').select('created_at').order('created_at', { ascending: true }).neq('user_id', E2E_TEST_USER_ID),
    supabase.from('approved_users').select('user_id, paid_at').neq('email', E2E_TEST_USER_EMAIL),
    supabase.from('arnobot_rds_logs').select('user_id, session_id, created_at').not('user_id', 'is', null).neq('user_id', E2E_TEST_USER_ID),
    supabase.from('arnobot_referrals').select('status').neq('referrer_user_id', E2E_TEST_USER_ID),
  ])

  const sparringGesprekken = sparringSessies?.length ?? 0
  const sparringVragen = sparringSessies?.reduce((sum, s) => sum + (s.message_count ?? 0), 0) ?? 0
  const totaalGesprekken = (coachingGesprekken ?? 0) + sparringGesprekken
  const sparringRatio = totaalGesprekken > 0 ? Math.round((sparringGesprekken / totaalGesprekken) * 100) : 0
  const coachingRatio = totaalGesprekken > 0 ? 100 - sparringRatio : 0
  const coachingVragen = (logs ?? []).length

  // Analyses per maand, alleen de laatste 6 maanden met data
  const perMaand: Record<string, number> = {}
  for (const a of analyses ?? []) {
    const maand = (a.created_at as string).slice(0, 7)
    perMaand[maand] = (perMaand[maand] ?? 0) + 1
  }
  const maanden = Object.keys(perMaand).sort().slice(-6)

  // Groei & activiteit op sum-niveau
  const totaalGebruikers = users?.length ?? 0
  const betaaldCount = users?.filter(u => u.paid_at).length ?? 0
  const trialCount = totaalGebruikers - betaaldCount
  const conversieratio = totaalGebruikers > 0 ? Math.round((betaaldCount / totaalGebruikers) * 100) : 0

  const sessionsPerUser: Record<string, Set<string>> = {}
  const actieveGebruikers = new Set<string>()
  for (const l of logs ?? []) {
    if (!sessionsPerUser[l.user_id]) sessionsPerUser[l.user_id] = new Set()
    sessionsPerUser[l.user_id].add(l.session_id)
    if (l.created_at >= sevenDaysAgo) actieveGebruikers.add(l.user_id)
  }
  const totaalGesprekkenAlleGebruikers = Object.values(sessionsPerUser).reduce((sum, s) => sum + s.size, 0)
  const totaalVragenAlleGebruikers = (logs ?? []).length
  const gemGesprekken = totaalGebruikers > 0 ? (totaalGesprekkenAlleGebruikers / totaalGebruikers).toFixed(1) : '0'
  const gemVragen = totaalGebruikers > 0 ? (totaalVragenAlleGebruikers / totaalGebruikers).toFixed(1) : '0'

  const referralAanmeldingen = referrals?.length ?? 0
  const referralConversies = referrals?.filter(r => r.status === 'converted').length ?? 0

  return (
    <main style={{ background: '#111827', minHeight: '100vh', color: '#f1f5f9', fontFamily: 'sans-serif' }}>
      <AdminNav active="/bot/admin/stats" />

      <div className="admin-content" style={{ maxWidth: '800px', margin: '0 auto', padding: '48px 40px' }}>
        <p style={{ color: '#f59e0b', fontSize: '12px', letterSpacing: '4px', marginBottom: '8px' }}>ARNOBOT ADMIN</p>
        <h1 style={{ fontSize: '48px', fontWeight: 700, margin: '0 0 32px 0', letterSpacing: '-1px' }}>Stats</h1>

        <p style={{ fontFamily: 'sans-serif', fontSize: 12, letterSpacing: 3, color: '#6b7280', marginBottom: 12 }}>GEBRUIKERS & GROEI</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 40 }}>
          <StatCard label="GEBRUIKERS" stats={[{ sublabel: 'TOTAAL', value: String(totaalGebruikers) }]} />
          <StatCard label="STATUS" stats={[
            { sublabel: 'TRIAL', value: String(trialCount) },
            { sublabel: 'BETAALD', value: String(betaaldCount) },
            { sublabel: 'CONVERSIERATIO', value: `${conversieratio}%` },
          ]} />
          <StatCard label="ACTIVITEIT" stats={[
            { sublabel: 'ACTIEF LAATSTE 7 DAGEN', value: String(actieveGebruikers.size) },
            { sublabel: 'GEM. GESPREKKEN/GEBRUIKER', value: gemGesprekken },
            { sublabel: 'GEM. VRAGEN/GEBRUIKER', value: gemVragen },
          ]} />
          <StatCard label="REFERRALS" stats={[
            { sublabel: 'AANMELDINGEN', value: String(referralAanmeldingen) },
            { sublabel: 'CONVERSIES', value: String(referralConversies) },
          ]} />
        </div>

        <p style={{ fontFamily: 'sans-serif', fontSize: 12, letterSpacing: 3, color: '#6b7280', marginBottom: 12 }}>GESPREKKEN: COACHING VS SPARREN</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 40 }}>
          <StatCard label="COACHING" stats={[
            { sublabel: 'AFGESLOTEN GESPREKKEN', value: String(coachingGesprekken ?? 0) },
            { sublabel: 'VRAGEN', value: String(coachingVragen) },
            { sublabel: 'AANDEEL VAN TOTAAL', value: `${coachingRatio}%` },
          ]} />
          <StatCard label="SPARREN" stats={[
            { sublabel: 'AFGESLOTEN GESPREKKEN', value: String(sparringGesprekken) },
            { sublabel: 'VRAGEN', value: String(sparringVragen) },
            { sublabel: 'AANDEEL VAN TOTAAL', value: `${sparringRatio}%` },
          ]} />
        </div>

        <p style={{ fontFamily: 'sans-serif', fontSize: 12, letterSpacing: 3, color: '#6b7280', marginBottom: 12 }}>PAGINABEZOEK & ENGAGEMENT</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 40 }}>
          <StatCard label="Q&A" stats={[{ sublabel: 'PAGINABEZOEKEN', value: String(qaViews ?? 0) }]} />
          <StatCard label="COACHING" stats={[{ sublabel: 'PAGINABEZOEKEN', value: String(coachingViews ?? 0) }]} />
          <StatCard label="ARNOLIVE" stats={[{ sublabel: 'CLICKS', value: String(arnoliveClicks ?? 0) }]} />
        </div>

        <p style={{ fontFamily: 'sans-serif', fontSize: 12, letterSpacing: 3, color: '#6b7280', marginBottom: 12 }}>ANALYSES OVER TIJD</p>
        <div style={{ background: '#1f2937', borderRadius: 4, padding: 20, marginBottom: 40 }}>
          {maanden.length === 0 ? (
            <p style={{ fontFamily: 'sans-serif', fontSize: 14, color: '#6b7280' }}>Nog geen analyses.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {maanden.map(m => (
                <div key={m} style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                  <span style={{ fontFamily: 'sans-serif', fontSize: 12, color: '#6b7280', letterSpacing: 1, minWidth: 60, flexShrink: 0 }}>{m}</span>
                  <div style={{ flex: 1, background: '#111827', borderRadius: 2, height: 16, position: 'relative' }}>
                    <div style={{
                      width: `${Math.max(4, (perMaand[m] / Math.max(...maanden.map(mm => perMaand[mm]))) * 100)}%`,
                      background: '#f59e0b', borderRadius: 2, height: '100%',
                    }} />
                  </div>
                  <span style={{ fontFamily: 'sans-serif', fontSize: 14, fontWeight: 700, color: '#f1f5f9', minWidth: 24, textAlign: 'right' }}>{perMaand[m]}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
