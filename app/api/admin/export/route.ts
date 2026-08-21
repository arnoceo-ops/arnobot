import { NextRequest, NextResponse } from 'next/server'
import { isAdminAuthorized, fetchLogsInRange, type AdminLogRow } from '@/lib/adminExport'

export async function GET(request: NextRequest) {
  if (!(await isAdminAuthorized())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = request.nextUrl
  const from = searchParams.get('from') || ''
  const to = searchParams.get('to') || ''
  const userFilter = searchParams.get('user') || ''
  const sort = searchParams.get('sort') || 'date_desc'

  const { rows, naamMap } = await fetchLogsInRange(from, to, 2000)

  const sessions: Record<string, AdminLogRow[]> = {}
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
