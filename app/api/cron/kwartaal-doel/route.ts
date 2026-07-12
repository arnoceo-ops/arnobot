import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { isValidEmail, getEmailTemplate } from '@/lib/email-templates'
import { E2E_TEST_USER_EMAIL } from '@/lib/e2eTestAccount'
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

  const month = new Date().getMonth() + 1
  if (![1, 4, 7, 10].includes(month)) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'geen kwartaalstart' })
  }

  const { data: users } = await supabase
    .from('approved_users')
    .select('user_id, email, voornaam')
    .eq('is_active', true)
    .eq('nudge_opt_out', false)
    .not('email', 'is', null)
    .neq('email', E2E_TEST_USER_EMAIL)

  if (!users?.length) return NextResponse.json({ ok: true, sent: 0 })

  let sent = 0

  for (const user of users) {
    if (!isValidEmail(user.email)) continue

    const { data: profielRow } = await supabase
      .from('arnobot_blog_profiles')
      .select('profiel')
      .eq('user_id', user.user_id)
      .maybeSingle()

    const jaardoel = profielRow?.profiel?.jaardoel
    if (!jaardoel || typeof jaardoel !== 'string' || jaardoel.trim().length < 5) continue

    const naam = user.voornaam || 'hey'
    const { subject, html } = getEmailTemplate('kwartaal_doel', naam, false, {
      jaardoel: jaardoel.trim(),
      userId: user.user_id,
    })

    await resend.emails.send({
      from: 'ArnoBot <info@arno.bot>',
      to: user.email,
      subject,
      html,
    })

    sent++
  }

  return NextResponse.json({ ok: true, sent })
  } catch (err) {
    await notifyCronFailure('kwartaal-doel', err)
    return NextResponse.json({ error: 'cron_error' }, { status: 500 })
  }
}
