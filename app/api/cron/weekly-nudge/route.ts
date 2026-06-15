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

  // Haal actieve gebruikers op die minstens 1 gesprek hebben gevoerd
  const { data: users } = await supabase
    .from('approved_users')
    .select('user_id, email, voornaam')
    .eq('is_active', true)
    .not('email', 'is', null)

  if (!users?.length) return NextResponse.json({ ok: true, sent: 0 })

  let sent = 0
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  for (const user of users) {
    if (!user.email) continue

    // Sla over als gebruiker nog nooit een gesprek heeft gevoerd
    const { count: totalCount } = await supabase
      .from('arnobot_rds_logs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.user_id)

    if ((totalCount ?? 0) === 0) continue

    // Sla over als gebruiker afgelopen 7 dagen actief was (geen nudge nodig)
    const { count: recentCount } = await supabase
      .from('arnobot_rds_logs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.user_id)
      .gte('created_at', sevenDaysAgo)

    if ((recentCount ?? 0) > 0) continue

    const naam = user.voornaam || 'hey'

    const subject = `${naam}, wat ga je deze week doen?`

    const bodyHtml = `
      <div style="font-family:'Courier New',monospace;background:#111827;color:#f1f5f9;padding:40px;max-width:560px;margin:0 auto;">
        <p style="color:#f59e0b;font-size:12px;letter-spacing:4px;margin-bottom:32px;">ARNOBOT</p>
        <p style="font-size:15px;color:#9ca3af;line-height:1.8;margin-bottom:32px;">Je hebt een week geen gebruik gemaakt van ArnoBot. Vakantie? Geen tijd? Even vergeten? Te confronterend? Wat dan ook, ArnoBot staat 24/7 voor je klaar. Gebruik 'm en wordt nog scherper dan je al bent. Het grootste risico is dat je meer gaat verkopen. Wie wil 't niet?</p>
        <a href="https://arno.bot/bot" style="display:inline-block;background:#f59e0b;color:#111827;font-family:'Courier New',monospace;font-size:16px;font-weight:700;letter-spacing:3px;padding:16px 40px;text-decoration:none;border-radius:999px;">SPAR MET ARNO →</a>
      </div>
    `

    try {
      await resend.emails.send({
        from: 'ArnoBot <info@arno.bot>',
        to: user.email,
        subject,
        html: bodyHtml,
      })
      sent++
    } catch (e) {
      console.error(`Email naar ${user.email} mislukt:`, e)
    }
  }

  return NextResponse.json({ ok: true, sent })
}
