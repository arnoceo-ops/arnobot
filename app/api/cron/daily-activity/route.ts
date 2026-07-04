import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { notifyCronFailure } from '@/lib/cron-notify'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const resend = new Resend(process.env.RESEND_API_KEY)

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
    if (!userMap[log.user_id]) {
      userMap[log.user_id] = { count: 0, lastActive: log.created_at }
    }
    userMap[log.user_id].count++
  }

  const userIds = Object.keys(userMap)

  let rows: { name: string; email: string; count: number; lastActive: string }[] = []

  if (userIds.length > 0) {
    const { data: users } = await supabase
      .from('approved_users')
      .select('user_id, voornaam, achternaam, email')
      .in('user_id', userIds)

    rows = (users ?? []).map((u) => ({
      name: [u.voornaam, u.achternaam].filter(Boolean).join(' ') || u.email || u.user_id,
      email: u.email || '',
      count: userMap[u.user_id]?.count ?? 0,
      lastActive: userMap[u.user_id]?.lastActive ?? '',
    }))

    rows.sort((a, b) => b.count - a.count)
  }

  const dateLabel = now.toLocaleDateString('nl-NL', {
    timeZone: 'Europe/Amsterdam',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  const subject = userIds.length === 0
    ? `ArnoBot activiteit: geen gesprekken gisteren`
    : `ArnoBot activiteit: ${userIds.length} gebruiker${userIds.length !== 1 ? 's' : ''} actief`

  const rowsHtml = rows.length === 0
    ? `<p style="font-family:Arial,sans-serif;font-size:15px;color:#9ca3af;">Geen gesprekken in de afgelopen 24 uur.</p>`
    : `<table style="width:100%;border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px;color:#f1f5f9;">
        <thead>
          <tr style="border-bottom:1px solid #374151;">
            <th style="text-align:left;padding:8px 0;color:#f59e0b;font-weight:400;letter-spacing:2px;font-size:11px;">NAAM</th>
            <th style="text-align:left;padding:8px 0;color:#f59e0b;font-weight:400;letter-spacing:2px;font-size:11px;">EMAIL</th>
            <th style="text-align:right;padding:8px 0;color:#f59e0b;font-weight:400;letter-spacing:2px;font-size:11px;">BERICHTEN</th>
            <th style="text-align:right;padding:8px 0;color:#f59e0b;font-weight:400;letter-spacing:2px;font-size:11px;">LAATSTE ACTIVITEIT</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(r => `
            <tr style="border-bottom:1px solid #1f2937;">
              <td style="padding:10px 0;color:#f1f5f9;">${r.name}</td>
              <td style="padding:10px 0;color:#9ca3af;">${r.email}</td>
              <td style="padding:10px 0;text-align:right;color:#f1f5f9;">${r.count}</td>
              <td style="padding:10px 0;text-align:right;color:#9ca3af;">${new Date(r.lastActive).toLocaleTimeString('nl-NL', { timeZone: 'Europe/Amsterdam', hour: '2-digit', minute: '2-digit' })}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>`

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="background:#111827;margin:0;padding:0;">
  <div style="max-width:560px;margin:0 auto;padding:48px 40px 40px 40px;">
    <p style="font-family:'Arial Black',Arial,sans-serif;font-size:26px;letter-spacing:6px;margin:0 0 32px 0;">
      <span style="color:#f1f5f9;">ARNO</span><span style="color:#f59e0b;">BOT</span>
    </p>
    <p style="font-family:Arial,sans-serif;font-size:11px;letter-spacing:2px;color:#6b7280;margin:0 0 24px 0;">DAGELIJKSE ACTIVITEIT &middot; ${dateLabel.toUpperCase()}</p>
    ${rowsHtml}
    <p style="font-family:Arial,sans-serif;font-size:11px;color:#374151;margin-top:48px;">© ARNOBOT</p>
  </div>
</body>
</html>`

  await resend.emails.send({
    from: 'ArnoBot <info@arno.bot>',
    to: 'arno@royaldutchsales.com',
    subject,
    html,
  })

  return NextResponse.json({ ok: true, activeUsers: userIds.length })
  } catch (err) {
    await notifyCronFailure('daily-activity', err)
    return NextResponse.json({ error: 'cron_error' }, { status: 500 })
  }
}
