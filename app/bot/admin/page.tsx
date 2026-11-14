import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { INTERNAL_TEST_USERS_IN, FAKE_DEMO_USER_LIKE } from '@/lib/internalTestAccounts'
import DownloadPdfButton from './DownloadPdfButton'
import AdminNav from './AdminNav'
import MarkReviewedButton from './MarkReviewedButton'
import CopyButton from './CopyButton'
import {
  fetchAnalyses, fetchCoachingVersies, analyseAsText, coachingAsText,
  type AnalyseRij, type CoachingVersie,
} from '@/lib/adminGesprekkenTabs'
import { ontwikkelpuntTekst } from '@/lib/coachingTekst'
import { haalAlleRijen } from '@/lib/haalAlleRijen'
import { nlDagStartIso, nlDagEindeIso, nlVandaag, nlGisteren, nlDatumTekst, nlTijdTekst } from '@/lib/nlTijd'

export const dynamic = 'force-dynamic'

type LogRow = {
  id: string
  created_at: string
  question: string
  answer: string
  ip: string
  session_id: string
  user_id?: string
  feedback?: string | null
}

function fmtDate(iso: string): string {
  return iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4)
}

function renderAnswer(text: string | null | undefined) {
  if (!text) return ''
  const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return escaped
    .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>')
}

function messageAsText(msg: LogRow): string {
  return `VRAAG: ${msg.question ?? ''}\nANTWOORD: ${msg.answer ?? ''}`
}

function sessionAsText(idx: number, messages: LogRow[], naam?: string): string {
  const header = `SESSIE ${idx + 1} · ${messages[0].ip}${naam ? ' · ' + naam : ''}`
  const sessionDate = nlDatumTekst(messages[0].created_at)
  const tijden = `${sessionDate} · ${nlTijdTekst(messages[0].created_at)} tot ${nlTijdTekst(messages[messages.length - 1].created_at)}`
  const body = messages.map(messageAsText).join('\n\n')
  return `${header}\n${tijden}\n\n${body}`
}

function parseDate(input: string): string {
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(input)) {
    const [d, m, y] = input.split('/')
    return `${y}-${m}-${d}`
  }
  return input
}

export default async function ArnoBotAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; sort?: string; user?: string; naam?: string; tab?: string; fb?: string }>
}) {
  const cookieStore = await cookies()
  const token = cookieStore.get('arnobot_admin')?.value
  if (!token || token !== process.env.ARNOBOT_ADMIN_KEY) redirect('/bot/admin/login')

  const params = await searchParams
  const tab: 'gesprekken' | 'analyses' | 'coaching' =
    params.tab === 'analyses' || params.tab === 'coaching' ? params.tab : 'gesprekken'
  // Dagen lopen van middernacht tot middernacht Nederlandse tijd (lib/nlTijd.ts), niet UTC.
  const today = nlVandaag()
  const yesterday = nlGisteren()
  // Gesprekken: standaard gisteren t/m vandaag. Analyses en Coaching komen traag binnen, dus
  // daar is leeg = geen datumbegrenzing (een rapportage van vorige maand blijft zichtbaar).
  // Met het duimpje-filter aan is leeg ook "alle data": de negatief beoordeelde antwoorden van
  // alle tijd zijn wat je wilt zien, niet alleen die van gisteren (zo werkt ook de oude FEEDBACK-link).
  const fbActief = tab === 'gesprekken' && (params.fb === 'alle' || params.fb === 'neg')
  const from = parseDate(params.from || '') || (tab === 'gesprekken' && !fbActief ? yesterday : '')
  const to = parseDate(params.to || '') || (tab === 'gesprekken' && !fbActief ? today : '')
  // Sorteren op aantal vragen kan alleen bij gesprekken.
  const sort = tab !== 'gesprekken' && (params.sort === 'count_desc' || params.sort === 'count_asc') ? 'date_desc' : (params.sort || 'date_desc')
  // Duimpje-filter, alleen bij Gesprekken: alle berichten met een beoordeling, of alleen de negatieve.
  const fb: '' | 'alle' | 'neg' = tab === 'gesprekken' && (params.fb === 'alle' || params.fb === 'neg') ? params.fb : ''
  const naamParam = params.naam || ''
  let userFilter = params.user || ''

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: alleGebruikers } = await supabase
    .from('approved_users')
    .select('user_id, voornaam, achternaam')
    .not('user_id', 'in', INTERNAL_TEST_USERS_IN).not('user_id', 'like', FAKE_DEMO_USER_LIKE)

  const alleNamen: { userId: string; naam: string }[] = (alleGebruikers ?? [])
    .map(u => ({ userId: u.user_id, naam: [u.voornaam, u.achternaam].filter(Boolean).join(' ') }))
    .filter(u => u.naam)

  if (naamParam && naamParam.toUpperCase() !== 'ALLE') {
    const match = alleNamen.find(u => u.naam.toLowerCase() === naamParam.toLowerCase())
    if (match) userFilter = match.userId
  }

  // Alle rijen in de periode, in blokken (de database kapt anders stil af op 1000, waarbij de
  // nieuwste gesprekken als eerste wegvielen). Bij een gekozen gebruiker filtert de database zelf.
  const rows: LogRow[] = tab === 'gesprekken'
    ? await haalAlleRijen<LogRow>((van, tot) => {
        let q = supabase
          .from('arnobot_rds_logs')
          .select('*')
          .not('user_id', 'in', INTERNAL_TEST_USERS_IN).not('user_id', 'like', FAKE_DEMO_USER_LIKE)
        if (from) q = q.gte('created_at', nlDagStartIso(from))
        if (to) q = q.lt('created_at', nlDagEindeIso(to))
        if (userFilter) q = q.eq('user_id', userFilter)
        if (fb === 'alle') q = q.not('feedback', 'is', null)
        if (fb === 'neg') q = q.eq('feedback', 'neg')
        return q.order('created_at', { ascending: true }).order('id', { ascending: true }).range(van, tot)
      })
    : []

  const tabFilter = { from: from || undefined, to: to || undefined, userFilter: userFilter || undefined }
  const analyses: AnalyseRij[] = tab === 'analyses' ? await fetchAnalyses(tabFilter) : []
  const coachingVersies: CoachingVersie[] = tab === 'coaching' ? await fetchCoachingVersies(tabFilter) : []
  if (sort === 'date_asc') { analyses.reverse(); coachingVersies.reverse() }

  // alleGebruikers is already fetched above — build naamMap from it directly
  // (avoids a large .in() query that breaks PostgREST URL limits with many users)
  const naamMap: Record<string, string> = {}
  for (const u of alleGebruikers ?? []) {
    naamMap[u.user_id] = [u.voornaam, u.achternaam].filter(Boolean).join(' ')
  }

  // Gemarkeerde off-topic/ongepaste berichten — .catch(() => ({ data: null })) zodat de
  // pagina niet crasht als de tabel nog niet bestaat (migratie nog niet uitgevoerd)
  const { data: flaggedData } = await supabase
    .from('arnobot_offtopic_flags')
    .select('id, user_id, category, message, created_at')
    .eq('reviewed', false)
    .order('created_at', { ascending: false })
    .limit(50)
    .then(res => res, () => ({ data: null }))

  const flagged = (flaggedData ?? []) as { id: number; user_id: string; category: string; message: string; created_at: string }[]

  // Volgnummer per gebruiker sinds de laatste uitlog-cyclus (zelfde telling als de server
  // gebruikt voor de uitlog-drempel), niet levenslang: na een uitlog begint de teller weer
  // bij 1.
  const flaggedCounts = await Promise.all(
    flagged.map(async f => {
      const { data: lastLogoutRow } = await supabase
        .from('arnobot_offtopic_flags')
        .select('created_at')
        .eq('user_id', f.user_id)
        .eq('caused_logout', true)
        .lt('created_at', f.created_at)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      let countQuery = supabase
        .from('arnobot_offtopic_flags')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', f.user_id)
        .lte('created_at', f.created_at)
      if (lastLogoutRow) countQuery = countQuery.gt('created_at', lastLogoutRow.created_at)
      return countQuery.then(res => res.count ?? 1, () => 1)
    })
  )

  const sessions: Record<string, LogRow[]> = {}
  for (const row of rows) {
    const key = row.session_id || row.ip || 'onbekend'
    if (!sessions[key]) sessions[key] = []
    sessions[key].push(row)
  }

  let sessionList = Object.entries(sessions)
  if (userFilter) sessionList = sessionList.filter(([, msgs]) => msgs[0].user_id === userFilter)
  if (sort === 'date_desc') sessionList.sort((a, b) => b[1][0].created_at.localeCompare(a[1][0].created_at))
  if (sort === 'date_asc')  sessionList.sort((a, b) => a[1][0].created_at.localeCompare(b[1][0].created_at))
  if (sort === 'count_desc') sessionList.sort((a, b) => b[1].length - a[1].length)
  if (sort === 'count_asc')  sessionList.sort((a, b) => a[1].length - b[1].length)

  const filterNaam = userFilter ? (naamMap[userFilter] || alleNamen.find(u => u.userId === userFilter)?.naam || '') : ''
  const dateRange = !from && !to ? 'alle data'
    : from && to ? (from === to ? fmtDate(from) : `${fmtDate(from)} t/m ${fmtDate(to)}`)
    : from ? `vanaf ${fmtDate(from)}` : `t/m ${fmtDate(to)}`
  const aantalResultaten = tab === 'analyses' ? analyses.length : tab === 'coaching' ? coachingVersies.length : sessionList.length
  const tabHref = (t: string) => `/bot/admin?tab=${t}${userFilter ? `&user=${userFilter}` : ''}`

  return (
    <main style={{ background: '#111827', minHeight: '100vh', color: '#f1f5f9', fontFamily: 'sans-serif' }}>
      <AdminNav active="/bot/admin" />
    <div className="admin-content" style={{ maxWidth: '800px', margin: '0 auto', padding: '48px 40px' }}>

      <div style={{ marginBottom: '40px' }}>
        <p style={{ color: '#f59e0b', fontSize: '12px', letterSpacing: '4px', marginBottom: '8px' }}>ARNOBOT ADMIN</p>
        <h1 style={{ fontSize: '48px', fontWeight: 700, margin: '0 0 24px 0', letterSpacing: '-1px' }}>Gesprekken</h1>

        <div style={{ display: 'flex', gap: '28px', marginBottom: '32px', borderBottom: '1px solid #374151' }}>
          {([['gesprekken', 'GESPREKKEN'], ['analyses', 'ANALYSES'], ['coaching', 'COACHING']] as const).map(([t, label]) => (
            <a key={t} href={tabHref(t)}
              style={{
                fontSize: '12px', letterSpacing: '3px', fontWeight: 700, textDecoration: 'none', paddingBottom: '12px',
                color: tab === t ? '#f59e0b' : '#6b7280',
                borderBottom: tab === t ? '2px solid #f59e0b' : '2px solid transparent',
                marginBottom: '-1px',
              }}>
              {label}
            </a>
          ))}
        </div>

        {tab === 'gesprekken' && flagged.length > 0 && (
          <div style={{ background: '#1f2937', borderRadius: 4, padding: '16px 20px', marginBottom: 32 }}>
            <p style={{ fontSize: '12px', letterSpacing: '3px', color: '#f59e0b', marginBottom: 12 }}>GEMARKEERD: OFF-TOPIC</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {flagged.map((f, i) => (
                <div key={f.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <span style={{ fontSize: '14px', color: '#f1f5f9' }}>
                    {naamMap[f.user_id] || f.user_id}
                    <span style={{ color: '#6b7280' }}> · {flaggedCounts[i]}e keer</span>
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <a href={`/bot/admin?from=${from}&to=${to}&sort=${sort}&user=${f.user_id}`}
                      style={{ fontSize: '12px', letterSpacing: '1px', color: '#f59e0b', textDecoration: 'none', whiteSpace: 'nowrap' }}>
                      BEKIJK GESPREK →
                    </a>
                    <MarkReviewedButton flagId={f.id} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <form method="GET" style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <input type="hidden" name="tab" value={tab} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexGrow: 1, minWidth: 200 }}>
            <label style={{ fontSize: '12px', letterSpacing: '2px', color: '#f59e0b' }}>GEBRUIKER</label>
            <input
              type="text" name="naam" list="gebruikers-list" className="admin-input"
              defaultValue={filterNaam || naamParam}
              placeholder="Zoek op naam..."
              style={{ background: '#1f2937', border: '1.5px solid #374151', color: '#f1f5f9', padding: '10px 14px', fontSize: '14px' }}
            />
            <datalist id="gebruikers-list">
              <option value="ALLE" />
              {alleNamen.map(u => <option key={u.userId} value={u.naam} />)}
            </datalist>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '12px', letterSpacing: '2px', color: '#f59e0b' }}>VAN</label>
            <input type="date" name="from" defaultValue={from} lang="nl" className="admin-input"
              style={{ background: '#1f2937', border: '1.5px solid #374151', color: '#f1f5f9', padding: '10px 14px', fontSize: '14px' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '12px', letterSpacing: '2px', color: '#f59e0b' }}>TOT EN MET</label>
            <input type="date" name="to" defaultValue={to} lang="nl" className="admin-input"
              style={{ background: '#1f2937', border: '1.5px solid #374151', color: '#f1f5f9', padding: '10px 14px', fontSize: '14px' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '12px', letterSpacing: '2px', color: '#f59e0b' }}>SORTERING</label>
            <select name="sort" defaultValue={sort} className="admin-input"
              style={{ background: '#1f2937', border: '1.5px solid #374151', color: '#f1f5f9', padding: '10px 14px', fontSize: '14px' }}>
              <option value="date_desc">Nieuwste eerst</option>
              <option value="date_asc">Oudste eerst</option>
              {tab === 'gesprekken' && <option value="count_desc">Meeste vragen eerst</option>}
              {tab === 'gesprekken' && <option value="count_asc">Minste vragen eerst</option>}
            </select>
          </div>
          {tab === 'gesprekken' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '12px', letterSpacing: '2px', color: '#f59e0b' }}>DUIMPJE</label>
              <select name="fb" defaultValue={fb} className="admin-input"
                style={{ background: '#1f2937', border: '1.5px solid #374151', color: '#f1f5f9', padding: '10px 14px', fontSize: '14px' }}>
                <option value="">Alle berichten</option>
                <option value="alle">Met beoordeling</option>
                <option value="neg">Alleen negatief</option>
              </select>
            </div>
          )}
          <div className="admin-form-actions" style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
            <button type="submit"
              style={{ background: '#f59e0b', color: '#111827', border: 'none', borderRadius: 999, padding: '10px 24px', fontWeight: 700, cursor: 'pointer', fontSize: '12px', letterSpacing: '1px' }}>
              LAAD
            </button>
            {aantalResultaten > 0 && (
              <div className="admin-download-hidden" style={{ display: 'flex', gap: 8 }}>
                <a
                  href={`/api/admin/export-csv?tab=${tab}&from=${from}&to=${to}&user=${userFilter}&sort=${sort}&fb=${fb}`}
                  style={{ background: '#f59e0b', color: '#111827', border: 'none', borderRadius: 999, padding: '10px 20px', fontWeight: 700, fontSize: '12px', letterSpacing: '1px', textDecoration: 'none', whiteSpace: 'nowrap', cursor: 'pointer' }}
                >
                  ↓ DOWNLOAD CSV
                </a>
                {tab === 'gesprekken' && <DownloadPdfButton from={from} to={to} userFilter={userFilter} sort={sort} dateRange={dateRange} />}
              </div>
            )}
          </div>
        </form>
      </div>

      {tab === 'analyses' ? (
        analyses.length === 0 ? (
          <p style={{ color: '#6b7280', fontSize: '14px' }}>Geen analyses gevonden ({dateRange}).</p>
        ) : (
          <div>
            <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '32px' }}>
              {analyses.length} analyse{analyses.length !== 1 ? 's' : ''}
            </p>
            {analyses.map(a => {
              const naam = naamMap[a.user_id]
              return (
                <div key={a.id} style={{ marginBottom: '56px', borderTop: '2px solid #f59e0b', paddingTop: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
                    <p style={{ fontSize: '12px', letterSpacing: '2px', color: '#f59e0b', margin: 0 }}>
                      ANALYSE{a.session_count ? ` · ${a.session_count} GESPREKKEN` : ''}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      {naam && (
                        <a href={`/bot/admin?tab=analyses&from=${from}&to=${to}&sort=${sort}&user=${a.user_id}`}
                          style={{ fontSize: '14px', color: '#f1f5f9', margin: 0, fontWeight: 700, textDecoration: 'none', cursor: 'pointer' }}>{naam}</a>
                      )}
                      <CopyButton text={analyseAsText(a, naam)} label="ANALYSE" />
                    </div>
                  </div>
                  <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '28px' }}>
                    {nlDatumTekst(a.created_at)} · {nlTijdTekst(a.created_at)}
                  </p>
                  <p style={{ fontSize: '14px', lineHeight: 1.8, color: '#9ca3af' }}
                    dangerouslySetInnerHTML={{ __html: renderAnswer(a.analyse_text) }} />
                </div>
              )
            })}
          </div>
        )
      ) : tab === 'coaching' ? (
        coachingVersies.length === 0 ? (
          <p style={{ color: '#6b7280', fontSize: '14px' }}>Geen coachingrapportages gevonden ({dateRange}).</p>
        ) : (
          <div>
            <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '32px' }}>
              {coachingVersies.length} rapportage{coachingVersies.length !== 1 ? 's' : ''}
            </p>
            {coachingVersies.map(v => {
              const naam = naamMap[v.user_id]
              const pijlers: [string, number | null, string | null, string | null][] = [
                ['MINDSET', v.mindset_score, v.mindset_richting, v.mindset_diagnose],
                ['SYSTEEM', v.systeem_score, v.systeem_richting, v.systeem_diagnose],
                ['ACTIE', v.actie_score, v.actie_richting, v.actie_diagnose],
              ]
              return (
                <div key={v.id} style={{ marginBottom: '56px', borderTop: '2px solid #f59e0b', paddingTop: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
                    <p style={{ fontSize: '12px', letterSpacing: '2px', color: '#f59e0b', margin: 0 }}>
                      COACHING{v.conversation_count ? ` · ${v.conversation_count} GESPREKKEN` : ''}
                      {v.stagnatie ? ' · STAGNATIE' : v.weinig_voortgang ? ' · WEINIG VOORTGANG' : ''}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      {naam && (
                        <a href={`/bot/admin?tab=coaching&from=${from}&to=${to}&sort=${sort}&user=${v.user_id}`}
                          style={{ fontSize: '14px', color: '#f1f5f9', margin: 0, fontWeight: 700, textDecoration: 'none', cursor: 'pointer' }}>{naam}</a>
                      )}
                      <CopyButton text={coachingAsText(v, naam)} label="COACHING" />
                    </div>
                  </div>
                  <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '28px' }}>
                    {nlDatumTekst(v.created_at)} · {nlTijdTekst(v.created_at)}
                  </p>

                  {pijlers.map(([label, score, richting, diagnose]) => (
                    <div key={label} style={{ marginBottom: '20px' }}>
                      <p style={{ fontWeight: 700, fontSize: '14px', marginBottom: '6px', color: '#f1f5f9' }}>
                        {label} <span style={{ color: '#f59e0b' }}>{score ?? '-'}</span>
                        {richting && <span style={{ color: '#6b7280', fontWeight: 400 }}> · {richting}</span>}
                      </p>
                      {diagnose && (
                        <p style={{ fontSize: '14px', lineHeight: 1.8, color: '#9ca3af' }}
                          dangerouslySetInnerHTML={{ __html: renderAnswer(diagnose) }} />
                      )}
                    </div>
                  ))}

                  {v.voortgang && (
                    <div style={{ marginBottom: '20px' }}>
                      <p style={{ fontWeight: 700, fontSize: '14px', marginBottom: '6px', color: '#f1f5f9' }}>VOORTGANG</p>
                      <p style={{ fontSize: '14px', lineHeight: 1.8, color: '#9ca3af' }}
                        dangerouslySetInnerHTML={{ __html: renderAnswer(v.voortgang) }} />
                    </div>
                  )}

                  {v.ontwikkelpunten && v.ontwikkelpunten.length > 0 && (
                    <div style={{ marginBottom: '20px' }}>
                      <p style={{ fontWeight: 700, fontSize: '14px', marginBottom: '6px', color: '#f1f5f9' }}>ONTWIKKELPUNTEN</p>
                      {v.ontwikkelpunten.map((p, i) => {
                        const { tekst, pijlar } = ontwikkelpuntTekst(p)
                        return (
                          <p key={i} style={{ fontSize: '14px', lineHeight: 1.8, color: '#9ca3af', marginBottom: '8px' }}>
                            {i + 1}. {pijlar && <span style={{ color: '#6b7280' }}>[{pijlar}] </span>}
                            <span dangerouslySetInnerHTML={{ __html: renderAnswer(tekst) }} />
                          </p>
                        )
                      })}
                    </div>
                  )}

                  {v.signalen && v.signalen.length > 0 && (
                    <div style={{ marginBottom: '20px' }}>
                      <p style={{ fontWeight: 700, fontSize: '14px', marginBottom: '6px', color: '#f1f5f9' }}>SIGNALEN</p>
                      {v.signalen.map((s, i) => (
                        <p key={i} style={{ fontSize: '14px', lineHeight: 1.8, color: '#9ca3af', marginBottom: '4px' }}>{s}</p>
                      ))}
                    </div>
                  )}

                  {v.blogs && v.blogs.length > 0 && (
                    <div style={{ marginBottom: '20px' }}>
                      <p style={{ fontWeight: 700, fontSize: '14px', marginBottom: '6px', color: '#f1f5f9' }}>BLOGTIPS</p>
                      {v.blogs.map((b, i) => (
                        <p key={i} style={{ fontSize: '14px', lineHeight: 1.8, color: '#9ca3af', marginBottom: '4px' }}>
                          {b.title}{b.reden ? ` : ${b.reden}` : ''}
                        </p>
                      ))}
                    </div>
                  )}

                  {!v.volledig && (
                    <p style={{ fontSize: '12px', color: '#6b7280' }}>
                      Van deze rapportage zijn alleen scores, diagnoses en voortgang bewaard.
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        )
      ) : sessionList.length === 0 ? (
        <p style={{ color: '#6b7280', fontSize: '14px' }}>Geen gesprekken gevonden voor {dateRange}.</p>
      ) : (
        <div>
          <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '32px' }}>
            {sessionList.length} sessie{sessionList.length !== 1 ? 's' : ''}, {sessionList.reduce((sum, [, msgs]) => sum + msgs.length, 0)} berichten
          </p>
          {sessionList.map(([sessionId, messages], idx) => {
            const userId = messages[0].user_id
            const naam = userId ? naamMap[userId] : undefined
            const sessionDate = nlDatumTekst(messages[0].created_at)
            return (
              <div key={sessionId} style={{ marginBottom: '56px', borderTop: '2px solid #f59e0b', paddingTop: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
                  <p style={{ fontSize: '12px', letterSpacing: '2px', color: '#f59e0b', margin: 0 }}>
                    SESSIE {idx + 1} · {messages[0].ip}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    {naam && userId && (
                      <a
                        href={`/bot/admin?from=${from}&to=${to}&sort=${sort}&user=${userId}`}
                        style={{ fontSize: '14px', color: '#f1f5f9', margin: 0, fontWeight: 700, textDecoration: 'none', cursor: 'pointer' }}
                      >{naam}</a>
                    )}
                    <CopyButton text={sessionAsText(idx, messages, naam)} label="GESPREK" />
                  </div>
                </div>
                <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '28px' }}>
                  {sessionDate} · {nlTijdTekst(messages[0].created_at)} tot {nlTijdTekst(messages[messages.length - 1].created_at)}
                </p>
                {messages.map((msg) => (
                  <div key={msg.id} style={{ marginBottom: '28px' }}>
                    <p style={{ fontWeight: 700, fontSize: '14px', marginBottom: '8px', color: '#f1f5f9' }}>
                      {msg.question ?? ''}
                    </p>
                    <p style={{ fontSize: '14px', lineHeight: 1.8, color: '#9ca3af' }}
                      dangerouslySetInnerHTML={{ __html: renderAnswer(msg.answer) }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                      <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>
                        {nlTijdTekst(msg.created_at)}
                      </p>
                      {msg.feedback && (
                        <p style={{ fontSize: '12px', letterSpacing: '2px', margin: 0, color: msg.feedback === 'neg' ? '#cc4444' : '#44cc88' }}>
                          {msg.feedback === 'neg' ? '▼ NEGATIEF' : '▲ POSITIEF'}
                        </p>
                      )}
                      <CopyButton text={messageAsText(msg)} label="BERICHT" />
                    </div>
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      )}
    </div>
    </main>
  )
}
