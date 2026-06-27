import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { isValidEmail, getEmailTemplate } from '@/lib/email-templates'

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

  const now = Date.now()
  const sevenDaysAgo  = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString()
  const eightDaysAgo  = new Date(now - 8 * 24 * 60 * 60 * 1000).toISOString()

  const { data: users } = await supabase
    .from('approved_users')
    .select('user_id, email, voornaam, trial_start')
    .eq('is_active', true)
    .eq('nudge_opt_out', false)
    .not('email', 'is', null)

  if (!users?.length) return NextResponse.json({ ok: true, sent: 0 })

  let sent = 0

  for (const user of users) {
    if (!isValidEmail(user.email)) continue

    const naam = user.voornaam || 'hey'

    // Sla over als gebruiker afgelopen 7 dagen actief was
    const { count: recentCount } = await supabase
      .from('arnobot_rds_logs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.user_id)
      .gte('created_at', sevenDaysAgo)

    if ((recentCount ?? 0) > 0) continue

    const { count: totalCount } = await supabase
      .from('arnobot_rds_logs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.user_id)

    let type: 'weekly_nudge' | 'geen_gesprek_nudge' | null = null

    if ((totalCount ?? 0) === 0) {
      // Nog nooit een gesprek: stuur nudge als trial precies 7-8 dagen geleden startte
      if (user.trial_start && user.trial_start >= eightDaysAgo && user.trial_start < sevenDaysAgo) {
        type = 'geen_gesprek_nudge'
      }
    } else {
      // Wel gesprekken gehad: stuur nudge als laatste activiteit precies 7-8 dagen geleden was
      const { count: windowCount } = await supabase
        .from('arnobot_rds_logs')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.user_id)
        .gte('created_at', eightDaysAgo)

      if ((windowCount ?? 0) > 0) {
        type = 'weekly_nudge'
      }
    }

    if (!type) continue

    const template = getEmailTemplate(type, naam)

    try {
      await resend.emails.send({
        from: 'ArnoBot <info@arno.bot>',
        to: user.email,
        subject: template.subject,
        html: template.html,
      })
      sent++
    } catch (e) {
      console.error(`Email naar ${user.email} mislukt:`, e)
    }
  }

  return NextResponse.json({ ok: true, sent })
}
