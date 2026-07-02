import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { isValidEmail, emailHtml } from '@/lib/email-templates'

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
    const body = `Nieuw kwartaal, nieuw momentum.<br><br>Je hebt in je profiel dit als doel neergezet:<br><br><em style="color:#f1f5f9;">"${jaardoel.trim()}"</em><br><br>Klopt dit nog? Of heeft het afgelopen kwartaal je perspectief verschoven? Pas je doel aan in je profiel als dat zo is. Of gebruik het als startpunt voor een gesprek vandaag.`

    const html = emailHtml(
      body,
      'OPEN ARNOBOT →',
      'https://arno.bot/bot',
      false,
      undefined,
      naam
    )

    await resend.emails.send({
      from: 'ArnoBot <info@arno.bot>',
      to: user.email,
      subject: `${naam}, klopt je doel voor dit jaar nog?`,
      html,
    })

    sent++
  }

  return NextResponse.json({ ok: true, sent })
}
