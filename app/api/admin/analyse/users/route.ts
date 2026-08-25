import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { E2E_TEST_USER_EMAIL, MANUAL_TEST_USER_EMAIL, APP_REVIEWER_EMAIL } from '@/lib/internalTestAccounts'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function checkAuth() {
  const cookieStore = await cookies()
  const token = cookieStore.get('arnobot_admin')?.value
  return token === process.env.ARNOBOT_ADMIN_KEY
}

// Lichte lijst voor het zoekveld op de ANALYSE-tab, los van de volle gebruikerslijst-query
// in app/bot/admin/gebruikers/page.tsx (die haalt ook activiteit/gezondheidsscore op, hier
// is alleen naam/e-mail/analysecount nodig om iemand te kunnen opzoeken). Alleen gebruikers
// met minstens één geregistreerd gesprek: een approved_users-rij kan al bestaan vóórdat
// iemand ooit heeft ingelogd (uitnodiging, referral, Sales Development-link), en die horen
// hier niet tussen te staan. Testaccounts (E2E/handmatig/reviewer) altijd uitgesloten, zelfde
// als de gebruikerslijst.
export async function GET() {
  if (!(await checkAuth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [usersRes, logsRes, analysesRes] = await Promise.all([
    supabase
      .from('approved_users')
      .select('user_id, email, full_name, voornaam, achternaam')
      .neq('email', E2E_TEST_USER_EMAIL)
      .neq('email', MANUAL_TEST_USER_EMAIL)
      .neq('email', APP_REVIEWER_EMAIL)
      .order('full_name', { ascending: true }),
    supabase.from('arnobot_rds_logs').select('user_id').not('user_id', 'is', null),
    supabase.from('arnobot_admin_analyses').select('target_user_id, generated_count'),
  ])

  const actieveGebruikers = new Set((logsRes.data ?? []).map(l => l.user_id))
  const countPerUser: Record<string, number> = {}
  for (const a of analysesRes.data ?? []) {
    countPerUser[a.target_user_id] = a.generated_count ?? 0
  }

  const users = (usersRes.data ?? [])
    .filter(u => actieveGebruikers.has(u.user_id))
    .map(u => ({
      userId: u.user_id,
      naam: u.full_name || [u.voornaam, u.achternaam].filter(Boolean).join(' ') || u.email || 'Onbekend',
      email: u.email as string | null,
      analyseCount: countPerUser[u.user_id] ?? 0,
    }))

  return NextResponse.json({ users })
}
