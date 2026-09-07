export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { runMetaAnalyse } from '@/lib/metaAnalyse'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function checkAuth() {
  const cookieStore = await cookies()
  const token = cookieStore.get('arnobot_admin')?.value
  return token === process.env.ARNOBOT_ADMIN_KEY
}

export async function GET() {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('arnobot_meta_analyses')
    .select('id, created_at, session_count, period_days, zelfbeoordeling_text, expertpanel_text, jouw_analyse_text')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[admin/meta-analyse]', error.message)
    return NextResponse.json({ error: 'Ophalen mislukt' }, { status: 500 })
  }
  return NextResponse.json(data ?? [])
}

export async function DELETE(req: NextRequest) {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Geen id opgegeven' }, { status: 400 })

  const { error } = await supabase.from('arnobot_meta_analyses').delete().eq('id', id)
  if (error) {
    console.error('[admin/meta-analyse] verwijderen mislukt:', error.message)
    return NextResponse.json({ error: 'Verwijderen mislukt' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

export async function POST(req: NextRequest) {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { days = 30 } = await req.json().catch(() => ({}))
  const resultaat = await runMetaAnalyse(supabase, { days })

  if (resultaat.status === 'geen_gesprekken') {
    return NextResponse.json({ zelfbeoordeling: null, expertpanel: null, count: 0, id: null })
  }
  if (resultaat.status === 'genereren_mislukt') {
    return NextResponse.json({ error: 'genereren_mislukt' }, { status: 500 })
  }

  return NextResponse.json({
    zelfbeoordeling: resultaat.zelfbeoordeling,
    expertpanel: resultaat.expertpanel,
    jouwAnalyse: resultaat.jouwAnalyse,
    jouwAnalyseFailed: resultaat.jouwAnalyseFailed,
    count: resultaat.sessieCount,
    id: resultaat.id,
  })
}
