import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

type LogRow = {
  id: string
  created_at: string
  question: string
  answer: string
  ip: string
  session_id: string
  user_id?: string
}

export async function GET(request: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get('arnobot_admin')?.value
  if (!token || token !== process.env.ARNOBOT_ADMIN_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = request.nextUrl
  const from = searchParams.get('from') || ''
  const to = searchParams.get('to') || ''
  const userFilter = searchParams.get('user') || ''
  const sort = searchParams.get('sort') || 'date_desc'

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
      .order('created_at', { ascending: true })
      .limit(2000),
    supabase
      .from('approved_users')
      .select('user_id, voornaam, achternaam'),
  ])

  const naamMap: Record<string, string> = {}
  for (const u of alleGebruikers ?? []) {
    naamMap[u.user_id] = [u.voornaam, u.achternaam].filter(Boolean).join(' ')
  }

  const rows: LogRow[] = data || []
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

  return NextResponse.json({ sessions: sessionList, naamMap })
}
