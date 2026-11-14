import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { INTERNAL_TEST_USERS_IN, FAKE_DEMO_USER_LIKE } from '@/lib/internalTestAccounts'
import { haalAlleRijen } from '@/lib/haalAlleRijen'
import { nlDagStartIso, nlDagEindeIso } from '@/lib/nlTijd'

export type AdminLogRow = {
  id: string
  created_at: string
  question: string
  answer: string
  ip: string
  session_id: string
  user_id?: string
  feedback?: string | null
}

export async function isAdminAuthorized(): Promise<boolean> {
  const cookieStore = await cookies()
  const token = cookieStore.get('arnobot_admin')?.value
  return !!token && token === process.env.ARNOBOT_ADMIN_KEY
}

// Alle gesprekken van de periode (in blokken, zie lib/haalAlleRijen.ts), op Nederlandse dagen
// (lib/nlTijd.ts). `maxRijen` is een veiligheidsgrens: een periode met meer rijen geeft een
// foutmelding in plaats van een stilzwijgend afgekapte export.
export async function fetchLogsInRange(from: string, to: string, maxRijen: number) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const [rows, { data: alleGebruikers }] = await Promise.all([
    haalAlleRijen<AdminLogRow>((van, tot) =>
      supabase
        .from('arnobot_rds_logs')
        .select('*')
        // Leeg van of tot = onbegrensd (het duimpje-filter op Gesprekken werkt zonder datum).
        .gte('created_at', from ? nlDagStartIso(from) : '1970-01-01T00:00:00.000Z')
        .lt('created_at', to ? nlDagEindeIso(to) : '9999-12-31T00:00:00.000Z')
        // Zelfde uitsluiting als het scherm op /bot/admin: interne testaccounts en demo-gebruikers
        // horen niet in CSV of PDF (check-testaccount-filter.mjs ving dit niet).
        .not('user_id', 'in', INTERNAL_TEST_USERS_IN)
        .not('user_id', 'like', FAKE_DEMO_USER_LIKE)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
        .range(van, tot),
      { max: maxRijen }),
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

  return { rows, naamMap }
}

// Zoeken in gespreksinhoud (vraag en antwoord) en het duimpje-filter, gedeeld door het scherm op
// /bot/admin, de CSV en de PDF zodat ze precies hetzelfde filteren.

/**
 * Maakt van invoer een veilige zoekterm. Tekens met een betekenis in een PostgREST-filter
 * (komma, haakjes, aanhalingstekens, backslash) en de wildcards (% en *) worden spaties, zodat een
 * zoekterm de filtersyntax nooit kan breken of verbreden. Maximaal 100 tekens.
 */
export function schoneZoekterm(invoer: string | null | undefined): string {
  return (invoer ?? '').replace(/[%*,()"\\]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100)
}

/** Filtert gesprekken in het geheugen op zoekterm (hoofdletterongevoelig, in vraag of antwoord) en duimpje. */
export function filterLogs<T extends { question?: string | null; answer?: string | null; feedback?: string | null }>(
  rows: T[],
  { fb, q }: { fb?: string; q?: string },
): T[] {
  const zoek = schoneZoekterm(q).toLowerCase()
  return rows.filter(r => {
    if (fb === 'neg' && r.feedback !== 'neg') return false
    if (fb === 'alle' && !r.feedback) return false
    if (zoek && !`${r.question ?? ''}\n${r.answer ?? ''}`.toLowerCase().includes(zoek)) return false
    return true
  })
}
