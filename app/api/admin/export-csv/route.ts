import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

function escapeCSV(val: string | null | undefined): string {
  if (!val) return ''
  const s = String(val).replace(/"/g, '""')
  return s.includes(',') || s.includes('\n') || s.includes('"') ? `"${s}"` : s
}

export async function GET(request: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get('arnobot_admin')?.value
  if (!token || token !== process.env.ARNOBOT_ADMIN_KEY) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { searchParams } = request.nextUrl
  const from = searchParams.get('from') || ''
  const to = searchParams.get('to') || ''
  const userFilter = searchParams.get('user') || ''

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const [{ data }, { data: alleGebruikers }] = await Promise.all([
    supabase
      .from('arnobot_rds_logs')
      .select('id, created_at, session_id, user_id, ip, question, answer')
      .gte('created_at', `${from}T00:00:00`)
      .lte('created_at', `${to}T23:59:59`)
      .order('created_at', { ascending: true })
      .limit(100000),
    supabase
      .from('approved_users')
      .select('user_id, voornaam, achternaam'),
  ])

  const naamMap: Record<string, string> = {}
  for (const u of alleGebruikers ?? []) {
    naamMap[u.user_id] = [u.voornaam, u.achternaam].filter(Boolean).join(' ')
  }

  const rows = data || []
  const filtered = userFilter ? rows.filter((r: { user_id?: string }) => r.user_id === userFilter) : rows

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
