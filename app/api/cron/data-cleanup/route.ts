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

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  // Accounts die 30+ dagen geleden beëindigd zijn en waarvan data nog aanwezig is
  const { data: users } = await supabase
    .from('approved_users')
    .select('user_id, voornaam, achternaam, email, deactivated_at')
    .eq('is_active', false)
    .not('voornaam', 'is', null)
    .lte('deactivated_at', thirtyDaysAgo)
    .order('deactivated_at', { ascending: true })

  if (!users || users.length === 0) {
    return NextResponse.json({ ok: true, skipped: true, message: 'Geen gebruikers te verwerken.' })
  }

  const rows = users.map(u => {
    const naam = [u.voornaam, u.achternaam].filter(Boolean).join(' ')
    const dagen = Math.floor((Date.now() - new Date(u.deactivated_at).getTime()) / (1000 * 60 * 60 * 24))
    return `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #eee">${naam}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee">${u.email || 'onbekend'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee">${new Date(u.deactivated_at).toLocaleDateString('nl-NL')}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee">${dagen} dagen</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;font-family:monospace;font-size:12px">${u.user_id}</td>
    </tr>`
  }).join('')

  const html = `
    <p style="font-family:sans-serif">Hallo Arno,</p>
    <p style="font-family:sans-serif">De volgende gebruikers hebben hun account meer dan 30 dagen geleden beëindigd. Persoonsgegevens moeten worden verwijderd en gesprekslogs geanonimiseerd.</p>
    <table style="border-collapse:collapse;width:100%;font-family:sans-serif;font-size:14px">
      <thead>
        <tr style="background:#f5f5f5">
          <th style="padding:8px 12px;text-align:left">Naam</th>
          <th style="padding:8px 12px;text-align:left">E-mail</th>
          <th style="padding:8px 12px;text-align:left">Beëindigd op</th>
          <th style="padding:8px 12px;text-align:left">Geleden</th>
          <th style="padding:8px 12px;text-align:left">Clerk ID</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <p style="font-family:sans-serif;margin-top:24px">Per gebruiker te doen:</p>
    <ol style="font-family:sans-serif">
      <li>Supabase: voornaam, achternaam, email, linkedin → null in <code>approved_users</code></li>
      <li>Supabase: <code>arnobot_rds_logs</code> → user_id ontkoppelen (user_id → null)</li>
      <li>Clerk: gebruiker verwijderen via het Clerk dashboard</li>
    </ol>
  `

  await resend.emails.send({
    from: 'ArnoBot <noreply@arno.bot>',
    to: 'hq@arno.bot',
    subject: `Data-opruiming: ${users.length} gebruiker${users.length !== 1 ? 's' : ''} te verwerken`,
    html,
  })

  return NextResponse.json({ ok: true, sent: users.length })
  } catch (err) {
    await notifyCronFailure('data-cleanup', err)
    return NextResponse.json({ error: 'cron_error' }, { status: 500 })
  }
}
