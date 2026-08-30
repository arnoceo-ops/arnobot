import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { notifyCronFailure } from '@/lib/cron-notify'
import { isInternalTestUser } from '@/lib/internalTestAccounts'

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

  const now = new Date()
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()

  const { data: logs } = await supabase
    .from('arnobot_rds_logs')
    .select('user_id, created_at')
    .gte('created_at', twentyFourHoursAgo)
    .order('created_at', { ascending: false })

  const userMap: Record<string, { count: number; lastActive: string }> = {}
  for (const log of logs ?? []) {
    if (isInternalTestUser(log.user_id)) continue
    if (!userMap[log.user_id]) {
      userMap[log.user_id] = { count: 0, lastActive: log.created_at }
    }
    userMap[log.user_id].count++
  }

  const userIds = Object.keys(userMap)

  const dateLabel = now.toLocaleDateString('nl-NL', {
    timeZone: 'Europe/Amsterdam',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  if (userIds.length === 0) {
    await sendTelegram(`📊 ARNOBOT DAGELIJKS · ${dateLabel}\n\nGeen gesprekken in de afgelopen 24 uur.`)
    return NextResponse.json({ ok: true, activeUsers: 0 })
  }

  const { data: users } = await supabase
    .from('approved_users')
    .select('user_id, voornaam, achternaam, email')
    .in('user_id', userIds)

  const rows = (users ?? [])
    .map(u => ({
      name: [u.voornaam, u.achternaam].filter(Boolean).join(' ') || u.email || u.user_id,
      email: u.email || '',
      count: userMap[u.user_id]?.count ?? 0,
      lastActive: userMap[u.user_id]?.lastActive ?? '',
    }))
    .sort((a, b) => b.count - a.count)

  // Het venster is een rollend etmaal (laatste 24 uur), geen kalenderdag. Bij activiteit
  // van "gisteren" die nog net binnen dat venster valt, staat er anders alleen een tijd bij
  // zonder datum, wat het laat lijken alsof het vandaag was terwijl dateLabel hierboven
  // altijd de datum van dit cron-moment toont, niet van de activiteit zelf.
  const vandaag = now.toLocaleDateString('nl-NL', { timeZone: 'Europe/Amsterdam' })
  const lines = rows.map((r, i) => {
    const activiteitDatum = new Date(r.lastActive).toLocaleDateString('nl-NL', { timeZone: 'Europe/Amsterdam' })
    const tijd = new Date(r.lastActive).toLocaleTimeString('nl-NL', {
      timeZone: 'Europe/Amsterdam',
      hour: '2-digit',
      minute: '2-digit',
    })
    const wanneer = activiteitDatum === vandaag
      ? tijd
      : `${new Date(r.lastActive).toLocaleDateString('nl-NL', { timeZone: 'Europe/Amsterdam', day: 'numeric', month: 'short' })}, ${tijd}`
    return `${i + 1}. ${r.name} · ${r.count} berichten · ${wanneer}`
  })

  const text = `📊 ARNOBOT DAGELIJKS · ${dateLabel}\n\n${userIds.length} gebruiker${userIds.length !== 1 ? 's' : ''} actief:\n\n${lines.join('\n')}`

  await sendTelegram(text)

  return NextResponse.json({ ok: true, activeUsers: userIds.length })
  } catch (err) {
    await notifyCronFailure('daily-activity', err)
    return NextResponse.json({ error: 'cron_error' }, { status: 500 })
  }
}
