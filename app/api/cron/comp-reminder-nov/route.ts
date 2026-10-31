import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { getEmailTemplate } from '@/lib/email-templates'
import { notifyCronFailure, notifyTelegram } from '@/lib/cron-notify'

// Eenmalige reminder (2026-10-31): Robel heeft gratis toegang tot 1 december (comp via
// expires_at). Deze cron stuurt hem op 25 november de mail om een abonnement te kiezen,
// maar ALLEEN als Mollie live staat (MOLLIE_API_KEY begint met live_), anders komt hij
// op een betaalpagina die voor hem niet werkt. Schema in vercel.json: "0 8 25-29 11 *",
// dus staat de sleutel pas later live, dan gaat de mail de eerste dag erna alsnog uit.
//
// Wegwerpcode: na 1 december mag dit bestand + de vercel.json-regel eruit. Idempotent via
// de arnobot_meta-vlag, dus een tweede run (of een run in 2027) doet niets.

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const resend = new Resend(process.env.RESEND_API_KEY)

const META_FLAG = 'comp_reminder_nov_sent'
const DOEL_EMAIL = 'rtesfahuny@hotmail.com'

export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const now = new Date()
    // Alleen van 25 november 2026 tot 1 december 2026, en nooit in een later jaar.
    if (now < new Date('2026-11-25T00:00:00Z') || now >= new Date('2026-12-01T00:00:00Z')) {
      return NextResponse.json({ ok: true, skipped: 'buiten venster' })
    }

    const { data: flag } = await supabase
      .from('arnobot_meta')
      .select('value')
      .eq('key', META_FLAG)
      .maybeSingle()
    if (flag) return NextResponse.json({ ok: true, skipped: 'al verstuurd' })

    if (!process.env.MOLLIE_API_KEY?.startsWith('live_')) {
      // Alleen op de eerste en de laatste dag melden, niet elke dag.
      const dag = now.getUTCDate()
      if (dag === 25 || dag === 29) {
        await notifyTelegram(
          `Reminder voor Robel (toegang tot 1 december) NIET verstuurd: Mollie staat nog op de testsleutel.${dag === 29 ? ' Laatste poging was vandaag, daarna verloopt zijn toegang zonder reminder.' : ' De cron probeert het elke dag tot en met 29 november opnieuw.'}`
        )
      }
      return NextResponse.json({ ok: true, skipped: 'mollie niet live' })
    }

    const { data: user, error } = await supabase
      .from('approved_users')
      .select('user_id, voornaam, is_active, expires_at')
      .eq('email', DOEL_EMAIL)
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!user || !user.is_active || (user.expires_at && new Date(user.expires_at) <= now)) {
      return NextResponse.json({ ok: true, skipped: 'gebruiker niet (meer) actief' })
    }

    // Heeft hij al zelf een abonnement afgesloten? Dan is de reminder overbodig.
    const { data: abo, error: aboError } = await supabase
      .from('arnobot_subscriptions')
      .select('id')
      .eq('user_id', user.user_id)
      .in('status', ['pending', 'active'])
      .limit(1)
    if (aboError) throw new Error(aboError.message)
    if (abo && abo.length > 0) {
      const ts = now.toISOString()
      await supabase.from('arnobot_meta').upsert([{ key: META_FLAG, value: `overgeslagen, heeft abonnement ${ts}`, updated_at: ts }])
      return NextResponse.json({ ok: true, skipped: 'heeft al een abonnement' })
    }

    const { subject, html } = getEmailTemplate('testtoegang_reminder', user.voornaam || 'daar')
    const { error: sendError } = await resend.emails.send({ from: 'ArnoBot <info@arno.bot>', to: DOEL_EMAIL, subject, html })
    if (sendError) throw new Error(sendError.message)

    const ts = now.toISOString()
    await supabase.from('arnobot_meta').upsert([{ key: META_FLAG, value: ts, updated_at: ts }])

    return NextResponse.json({ ok: true, sent: 1 })
  } catch (err) {
    await notifyCronFailure('comp-reminder-nov', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
