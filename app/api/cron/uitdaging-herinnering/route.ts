import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { isValidEmail, getEmailTemplate } from '@/lib/email-templates'
import { E2E_TEST_USER_ID, MANUAL_TEST_USER_ID } from '@/lib/internalTestAccounts'
import { notifyCronFailure } from '@/lib/cron-notify'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const resend = new Resend(process.env.RESEND_API_KEY)

// Oplopende tussenpozen (Ebbinghaus-vergeetcurve, zie docs/SALES_BIJBEL.md), niet één
// willekeurig moment. Stuurt alleen als actie_status nog nooit is ingevuld: heeft de
// gebruiker al ja/deels/nee gegeven (via de bestaande in-app actieopvolging-check), dan is
// de terugkoppeling al gebeurd via dat kanaal, geen dubbele herinnering per e-mail nodig.
const INTERVALLEN_DAGEN = [1, 3, 7]
const VENSTER_UUR = 3 // marge rond elk interval, voorkomt dat de cron een dag mist door timing

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    let sent = 0

    for (const dagen of INTERVALLEN_DAGEN) {
      const doelMoment = Date.now() - dagen * 24 * 60 * 60 * 1000
      const vanaf = new Date(doelMoment - VENSTER_UUR * 60 * 60 * 1000).toISOString()
      const tot = new Date(doelMoment + VENSTER_UUR * 60 * 60 * 1000).toISOString()

      const { data: sessies } = await supabase
        .from('arnobot_blog_sessions')
        .select('session_id, user_id, uitdaging, created_at')
        .not('uitdaging', 'is', null)
        .is('actie_status', null)
        .is('deleted_at', null)
        .gte('created_at', vanaf)
        .lte('created_at', tot)

      if (!sessies?.length) continue

      for (const sessie of sessies) {
        if (sessie.user_id === E2E_TEST_USER_ID || sessie.user_id === MANUAL_TEST_USER_ID) continue

        // Al gestuurd voor dit interval? Overslaan (UNIQUE(session_id, interval_dagen) is
        // het echte vangnet, deze check voorkomt alleen onnodige e-mailverzendpogingen).
        const { data: alGestuurd } = await supabase
          .from('arnobot_uitdaging_reminders_log')
          .select('id')
          .eq('session_id', sessie.session_id)
          .eq('interval_dagen', dagen)
          .maybeSingle()
        if (alGestuurd) continue

        const { data: user } = await supabase
          .from('approved_users')
          .select('email, voornaam')
          .eq('user_id', sessie.user_id)
          .eq('is_active', true)
          .eq('nudge_opt_out', false)
          .maybeSingle()

        if (!user || !isValidEmail(user.email)) continue

        const naam = user.voornaam || 'hey'
        const template = getEmailTemplate('uitdaging_herinnering', naam, false, {
          userId: sessie.user_id,
          uitdaging: sessie.uitdaging,
        })

        try {
          await resend.emails.send({
            from: 'ArnoBot <info@arno.bot>',
            to: user.email,
            subject: template.subject,
            html: template.html,
          })
          sent++
        } catch (e) {
          console.error(`[uitdaging-herinnering] e-mail naar ${user.email} mislukt:`, e)
          continue
        }

        try {
          await supabase.from('arnobot_uitdaging_reminders_log').insert({
            user_id: sessie.user_id,
            session_id: sessie.session_id,
            interval_dagen: dagen,
          })
        } catch (e) {
          console.error(`[uitdaging-herinnering] log-insert voor sessie ${sessie.session_id} mislukt (e-mail is wel verstuurd):`, e)
        }
      }
    }

    return NextResponse.json({ ok: true, sent })
  } catch (err) {
    await notifyCronFailure('uitdaging-herinnering', err)
    return NextResponse.json({ error: 'cron_error' }, { status: 500 })
  }
}
