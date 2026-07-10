import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { notifyCronFailure } from '@/lib/cron-notify'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function sendTelegram(text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!token || !chatId) return
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  })
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [logsRes, analysesRes, coachingRes] = await Promise.all([
    supabase.from('arnobot_rds_logs').select('user_id, session_id').gte('created_at', sevenDaysAgo),
    supabase.from('arnobot_analyses').select('user_id').gte('created_at', sevenDaysAgo),
    supabase.from('arnobot_coaching_scores').select('user_id').gte('created_at', sevenDaysAgo),
  ])

  const logs = logsRes.data || []
  const analyses = analysesRes.data || []
  const coaching = coachingRes.data || []

  if (!logs.length) {
    return NextResponse.json({ ok: true, skipped: true, message: 'Geen activiteit deze week' })
  }

  const vragen: Record<string, number> = {}
  const gesprekken: Record<string, Set<string>> = {}
  for (const log of logs) {
    vragen[log.user_id] = (vragen[log.user_id] || 0) + 1
    if (!gesprekken[log.user_id]) gesprekken[log.user_id] = new Set()
    gesprekken[log.user_id].add(log.session_id)
  }

  const analysesTel: Record<string, number> = {}
  for (const a of analyses) {
    analysesTel[a.user_id] = (analysesTel[a.user_id] || 0) + 1
  }

  const coachingTel: Record<string, number> = {}
  for (const c of coaching) {
    coachingTel[c.user_id] = (coachingTel[c.user_id] || 0) + 1
  }

  const top10 = Object.entries(vragen)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)

  const { data: users } = await supabase
    .from('approved_users')
    .select('user_id, voornaam, achternaam')
    .in('user_id', top10.map(([id]) => id))

  const userMap = Object.fromEntries((users || []).map(u => [u.user_id, u]))

  const weekOf = new Date().toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })

  const lines = top10.map(([userId, vragenCount], i) => {
    const u = userMap[userId]
    const naam = u ? [u.voornaam, u.achternaam].filter(Boolean).join(' ') : userId
    const sess = gesprekken[userId]?.size || 0
    const anal = analysesTel[userId] || 0
    const coach = coachingTel[userId] || 0
    return `${i + 1}. ${naam} — ${vragenCount}v · ${sess}g · ${anal}a · ${coach}c`
  })

  const text = `📈 ARNOBOT WEEK · ${weekOf}\n\n${lines.join('\n')}\n\nv=vragen  g=gesprekken  a=analyses  c=coaching`

  await sendTelegram(text)

  return NextResponse.json({ ok: true, sent: top10.length })
  } catch (err) {
    await notifyCronFailure('weekly-top-users', err)
    return NextResponse.json({ error: 'cron_error' }, { status: 500 })
  }
}
