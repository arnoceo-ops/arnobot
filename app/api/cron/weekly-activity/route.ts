import { registreerCronRun } from '@/lib/cronRun'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { notifyCronFailure, notifyTelegram } from '@/lib/cron-notify'
import { excludeInternalTestUsers } from '@/lib/internalTestAccounts'
import { haalAlleRijen } from '@/lib/haalAlleRijen'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const MAX_GEBRUIKERS = 10

async function cronHandler(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {

  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()

  // De hele week in blokken (lib/haalAlleRijen.ts): boven 1000 rijen vielen de nieuwste weg.
  const [logs, analyses, coaching] = await Promise.all([
    haalAlleRijen<{ user_id: string; session_id: string; created_at: string }>((van, tot) =>
      excludeInternalTestUsers(supabase.from('arnobot_rds_logs').select('user_id, session_id, created_at').gte('created_at', sevenDaysAgo))
        .order('created_at', { ascending: false }).order('id', { ascending: true }).range(van, tot)),
    haalAlleRijen<{ user_id: string }>((van, tot) =>
      excludeInternalTestUsers(supabase.from('arnobot_analyses').select('user_id').gte('created_at', sevenDaysAgo))
        .order('id', { ascending: true }).range(van, tot)),
    haalAlleRijen<{ user_id: string }>((van, tot) =>
      excludeInternalTestUsers(supabase.from('arnobot_coaching_scores').select('user_id').gte('created_at', sevenDaysAgo))
        .order('id', { ascending: true }).range(van, tot)),
  ])

  // De logs staan nieuwste eerst: de eerste regel per gebruiker is dus het laatst actieve moment.
  const userMap: Record<string, { vragen: number; gesprekken: Set<string>; lastActive: string }> = {}
  for (const log of logs) {
    userMap[log.user_id] ??= { vragen: 0, gesprekken: new Set(), lastActive: log.created_at }
    userMap[log.user_id].vragen++
    userMap[log.user_id].gesprekken.add(log.session_id)
  }

  const telPerGebruiker = (rijen: { user_id: string }[]) => {
    const tel: Record<string, number> = {}
    for (const r of rijen) tel[r.user_id] = (tel[r.user_id] || 0) + 1
    return tel
  }
  const analysesTel = telPerGebruiker(analyses)
  const coachingTel = telPerGebruiker(coaching)

  const weekOf = now.toLocaleDateString('nl-NL', {
    timeZone: 'Europe/Amsterdam',
    day: 'numeric',
    month: 'long',
  })
  const titel = `📊 ARNOBOT WEEK · ${weekOf}`
  const activeUsers = Object.keys(userMap).length

  if (activeUsers === 0) {
    if (!await notifyTelegram(`${titel}\n\nGeen gesprekken in de afgelopen 7 dagen.`)) throw new Error('telegram_niet_verzonden')
    return NextResponse.json({ ok: true, activeUsers })
  }

  const topIds = Object.keys(userMap)
    .sort((a, b) => userMap[b].vragen - userMap[a].vragen)
    .slice(0, MAX_GEBRUIKERS)

  const { data: users } = await supabase
    .from('approved_users')
    .select('user_id, voornaam, achternaam, email')
    .in('user_id', topIds)

  const naamMap = Object.fromEntries((users ?? []).map(u => [u.user_id, [u.voornaam, u.achternaam].filter(Boolean).join(' ') || u.email]))

  // Het venster is een rollende week (laatste 7 dagen), geen kalenderweek. Alleen activiteit
  // van exact de dag van dit cron-moment zelf (zaterdagochtend) toont alleen een tijd, al het
  // overige (verreweg de meeste rijen bij een weekvenster) krijgt datum+tijd.
  const vandaag = now.toLocaleDateString('nl-NL', { timeZone: 'Europe/Amsterdam' })
  const lines = topIds.map((userId, i) => {
    const { vragen, gesprekken, lastActive } = userMap[userId]
    const moment = new Date(lastActive)
    const tijd = moment.toLocaleTimeString('nl-NL', { timeZone: 'Europe/Amsterdam', hour: '2-digit', minute: '2-digit' })
    const wanneer = moment.toLocaleDateString('nl-NL', { timeZone: 'Europe/Amsterdam' }) === vandaag
      ? tijd
      : `${moment.toLocaleDateString('nl-NL', { timeZone: 'Europe/Amsterdam', day: 'numeric', month: 'short' })}, ${tijd}`
    return `${i + 1}. ${naamMap[userId] || userId}\n${vragen}v · ${gesprekken.size}g · ${analysesTel[userId] || 0}a · ${coachingTel[userId] || 0}c · ${wanneer}`
  })

  const aantal = `${activeUsers} gebruiker${activeUsers !== 1 ? 's' : ''} actief in de afgelopen 7 dagen${activeUsers > MAX_GEBRUIKERS ? `, de top ${MAX_GEBRUIKERS}` : ''}:`
  const text = `${titel}\n\n${aantal}\n\n${lines.join('\n')}\n\nv=vragen  g=gesprekken  a=analyses  c=coaching`

  if (!await notifyTelegram(text)) throw new Error('telegram_niet_verzonden')

  return NextResponse.json({ ok: true, activeUsers })
  } catch (err) {
    await notifyCronFailure('weekly-activity', err)
    return NextResponse.json({ error: 'cron_error' }, { status: 500 })
  }
}

export const GET = registreerCronRun('/api/cron/weekly-activity', cronHandler)
