import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { INTERNAL_TEST_USERS_IN, FAKE_DEMO_USER_LIKE } from '@/lib/internalTestAccounts'

export type AdminLogRow = {
  id: string
  created_at: string
  question: string
  answer: string
  ip: string
  session_id: string
  user_id?: string
}

export async function isAdminAuthorized(): Promise<boolean> {
  const cookieStore = await cookies()
  const token = cookieStore.get('arnobot_admin')?.value
  return !!token && token === process.env.ARNOBOT_ADMIN_KEY
}

export async function fetchLogsInRange(from: string, to: string, limit: number) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const [{ data }, { data: alleGebruikers }] = await Promise.all([
    supabase
      .from('arnobot_rds_logs')
      .select('*')
      .gte('created_at', `${from}T00:00:00`)
      .lte('created_at', `${to}T23:59:59`)
      // Zelfde uitsluiting als het scherm op /bot/admin: interne testaccounts en demo-gebruikers
      // horen niet in CSV of PDF (check-testaccount-filter.mjs ving dit niet).
      .not('user_id', 'in', INTERNAL_TEST_USERS_IN)
      .not('user_id', 'like', FAKE_DEMO_USER_LIKE)
      .order('created_at', { ascending: true })
      .limit(limit),
    supabase
      .from('approved_users')
      .select('user_id, voornaam, achternaam')
      .not('user_id', 'in', INTERNAL_TEST_USERS_IN)
      .not('user_id', 'like', FAKE_DEMO_USER_LIKE),
  ])

  const naamMap: Record<string, string> = {}
  for (const u of alleGebruikers ?? []) {
    naamMap[u.user_id] = [u.voornaam, u.achternaam].filter(Boolean).join(' ')
  }

  return { rows: (data ?? []) as AdminLogRow[], naamMap }
}
