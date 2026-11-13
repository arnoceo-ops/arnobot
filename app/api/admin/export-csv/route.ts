import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { INTERNAL_TEST_USERS_IN, FAKE_DEMO_USER_LIKE } from '@/lib/internalTestAccounts'
import { isAdminAuthorized, fetchLogsInRange } from '@/lib/adminExport'
import { fetchAnalyses, fetchCoachingVersies, analysesCsv, coachingCsv } from '@/lib/adminGesprekkenTabs'

function escapeCSV(val: string | null | undefined): string {
  if (!val) return ''
  const s = String(val).replace(/"/g, '""')
  return s.includes(',') || s.includes('\n') || s.includes('"') ? `"${s}"` : s
}

export async function GET(request: NextRequest) {
  if (!(await isAdminAuthorized())) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { searchParams } = request.nextUrl
  const from = searchParams.get('from') || ''
  const to = searchParams.get('to') || ''
  const userFilter = searchParams.get('user') || ''
  const tab = searchParams.get('tab') || 'gesprekken'

  // Tabs Analyses en Coaching van /bot/admin: zelfde filter, eigen export. Datum is hier
  // optioneel (leeg = geen begrenzing), bij Gesprekken blijft het verplicht.
  if (tab === 'analyses' || tab === 'coaching') {
    const filter = { from: from || undefined, to: to || undefined, userFilter: userFilter || undefined }
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    const { data: gebruikers } = await supabase
      .from('approved_users')
      .select('user_id, voornaam, achternaam')
      .not('user_id', 'in', INTERNAL_TEST_USERS_IN)
      .not('user_id', 'like', FAKE_DEMO_USER_LIKE)
    const naamMap: Record<string, string> = {}
    for (const u of gebruikers ?? []) naamMap[u.user_id] = [u.voornaam, u.achternaam].filter(Boolean).join(' ')
    const body = tab === 'analyses'
      ? analysesCsv(await fetchAnalyses(filter), naamMap)
      : coachingCsv(await fetchCoachingVersies(filter), naamMap)
    return new Response('﻿' + body, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="arnobot-${tab}${from ? '-' + from : ''}${to ? '-' + to : ''}.csv"`,
      },
    })
  }

  const { rows, naamMap } = await fetchLogsInRange(from, to, 100000)
  const filtered = userFilter ? rows.filter(r => r.user_id === userFilter) : rows

  const lines: string[] = [
    ['datum', 'tijd', 'sessie_id', 'gebruiker', 'vraag', 'antwoord'].join(','),
  ]

  for (const row of filtered) {
    const dt = new Date(row.created_at)
    lines.push([
      escapeCSV(dt.toLocaleDateString('nl-NL')),
      escapeCSV(dt.toLocaleTimeString('nl-NL')),
      escapeCSV(row.session_id),
      escapeCSV(row.user_id ? (naamMap[row.user_id] || row.user_id) : row.ip),
      escapeCSV(row.question),
      escapeCSV(row.answer),
    ].join(','))
  }

  // BOM zodat Excel UTF-8 correct leest
  const csv = '﻿' + lines.join('\n')

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="arnobot-gesprekken-${from}-${to}.csv"`,
    },
  })
}
