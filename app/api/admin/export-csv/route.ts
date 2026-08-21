import { NextRequest } from 'next/server'
import { isAdminAuthorized, fetchLogsInRange } from '@/lib/adminExport'

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
