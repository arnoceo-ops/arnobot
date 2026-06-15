import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

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

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data: logs } = await supabase
    .from('arnobot_rds_logs')
    .select('user_id')
    .gte('created_at', sevenDaysAgo)

  if (!logs?.length) {
    return NextResponse.json({ ok: true, message: 'Geen activiteit deze week' })
  }

  const counts: Record<string, number> = {}
  for (const log of logs) {
    counts[log.user_id] = (counts[log.user_id] || 0) + 1
  }

  const top10 = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)

  const { data: users } = await supabase
    .from('approved_users')
    .select('user_id, voornaam, achternaam, email')
    .in('user_id', top10.map(([id]) => id))

  const userMap = Object.fromEntries((users || []).map(u => [u.user_id, u]))

  const rows = top10.map(([userId, count], i) => {
    const u = userMap[userId]
    const naam = u ? [u.voornaam, u.achternaam].filter(Boolean).join(' ') : userId
    const email = u?.email || ''
    return `
      <tr style="border-bottom:1px solid #1f2937;">
        <td style="padding:12px 16px;color:#6b7280;font-size:13px;">${i + 1}</td>
        <td style="padding:12px 16px;color:#f1f5f9;font-size:14px;">${naam}</td>
        <td style="padding:12px 16px;color:#9ca3af;font-size:13px;">${email}</td>
        <td style="padding:12px 16px;color:#f59e0b;font-size:14px;font-weight:700;text-align:right;">${count}</td>
      </tr>`
  }).join('')

  const weekOf = new Date().toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })

  await resend.emails.send({
    from: 'ArnoBot <info@arno.bot>',
    to: 'arnodiepeveen@gmail.com',
    subject: `ArnoBot top 10 actieve gebruikers — week van ${weekOf}`,
    html: `
      <div style="font-family:'Courier New',monospace;background:#111827;color:#f1f5f9;padding:40px;max-width:600px;margin:0 auto;">
        <p style="color:#f59e0b;font-size:12px;letter-spacing:4px;margin-bottom:8px;">ARNOBOT</p>
        <h1 style="font-size:22px;font-weight:700;margin-bottom:4px;">Top 10 actieve gebruikers</h1>
        <p style="font-size:13px;color:#6b7280;margin-bottom:32px;">Week van ${weekOf}</p>
        <table style="width:100%;border-collapse:collapse;background:#1f2937;">
          <thead>
            <tr style="border-bottom:2px solid #374151;">
              <th style="padding:10px 16px;text-align:left;font-size:11px;letter-spacing:2px;color:#6b7280;font-weight:400;">#</th>
              <th style="padding:10px 16px;text-align:left;font-size:11px;letter-spacing:2px;color:#6b7280;font-weight:400;">NAAM</th>
              <th style="padding:10px 16px;text-align:left;font-size:11px;letter-spacing:2px;color:#6b7280;font-weight:400;">EMAIL</th>
              <th style="padding:10px 16px;text-align:right;font-size:11px;letter-spacing:2px;color:#6b7280;font-weight:400;">GESPREKKEN</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <p style="font-size:11px;color:#374151;margin-top:32px;letter-spacing:1px;">© ARNOBOT</p>
      </div>
    `,
  })

  return NextResponse.json({ ok: true, sent: top10.length })
}
