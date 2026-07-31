import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { getEmailTemplate, isValidEmail, type EmailType } from '@/lib/email-templates'
import { E2E_TEST_USER_EMAIL, MANUAL_TEST_USER_EMAIL } from '@/lib/internalTestAccounts'
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

  const { data: users } = await supabase
    .from('approved_users')
    .select('user_id, email, voornaam, trial_start, paid_at, renewal_requested_at, renewal_warning_sent_at, arno_call_booked_at')
    .not('trial_start', 'is', null)
    .is('paid_at', null)
    .eq('is_active', true)
    .not('email', 'is', null)
    .neq('email', E2E_TEST_USER_EMAIL)
    .neq('email', MANUAL_TEST_USER_EMAIL)

  if (!users?.length) return NextResponse.json({ ok: true, sent: 0 })

  let sent = 0
  let cancelled = 0
  let blocked = 0

  for (const user of users) {
    if (!isValidEmail(user.email) || !user.trial_start) continue

    const trialStart = new Date(user.trial_start)
    const trialEnd = new Date(trialStart.getTime() + 30 * 24 * 60 * 60 * 1000)
    const naam = user.voornaam || 'daar'

    async function send(type: EmailType, options?: { sessionCount?: number }) {
      const { subject, html } = getEmailTemplate(type, naam, false, options)
      await resend.emails.send({ from: 'ArnoBot <info@arno.bot>', to: user.email, subject, html })
    }

    // --- Blokkering 24u na betaalwaarschuwing ---
    if (user.renewal_warning_sent_at && !user.paid_at) {
      const warnedAt = new Date(user.renewal_warning_sent_at)
      const hoursSinceWarning = (now.getTime() - warnedAt.getTime()) / (1000 * 60 * 60)
      if (hoursSinceWarning >= 24) {
        await supabase.from('approved_users').update({ is_active: false }).eq('user_id', user.user_id)
        await send('geblokkeerd').catch(() => {})
        blocked++
        continue
      }
    }

    // --- Betaalwaarschuwing 7 dagen na opt-in ---
    if (user.renewal_requested_at && !user.renewal_warning_sent_at && !user.paid_at) {
      const requestedAt = new Date(user.renewal_requested_at)
      const daysSinceRequest = (now.getTime() - requestedAt.getTime()) / (1000 * 60 * 60 * 24)
      if (daysSinceRequest >= 7) {
        await supabase.from('approved_users').update({ renewal_warning_sent_at: now.toISOString() }).eq('user_id', user.user_id)
        await send('betaalwaarschuwing').catch(() => {})
        sent++
        continue
      }
    }

    // --- Auto-cancel na 30 dagen zonder opt-in ---
    if (now > trialEnd && !user.renewal_requested_at) {
      await supabase.from('approved_users')
        .update({ is_active: false, deactivated_at: now.toISOString() })
        .eq('user_id', user.user_id)
      await send('trial_afgelopen').catch(() => {})
      cancelled++
      continue
    }

    // Geen trial-emails meer sturen als user al heeft geopteerd voor verlenging
    if (user.renewal_requested_at) continue
    if (now > trialEnd) continue

    const days = Math.floor((now.getTime() - trialStart.getTime()) / (1000 * 60 * 60 * 24))

    const { data: log } = await supabase
      .from('arnobot_email_log')
      .select('email_type')
      .eq('user_id', user.user_id)

    const sentTypes = new Set((log || []).map((r: { email_type: string }) => r.email_type))

    let emailType: EmailType | null = null
    let emailOptions: { sessionCount?: number } | undefined

    // Dag 1 — altijd
    if (days >= 1 && !sentTypes.has('dag1')) {
      emailType = 'dag1'
    }

    // Trigger: eerste gesprek (alleen nadat dag1 is verzonden)
    if (!emailType && sentTypes.has('dag1') && !sentTypes.has('first_conversation')) {
      const { count } = await supabase
        .from('arnobot_rds_logs')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.user_id)
      if ((count ?? 0) >= 1) {
        emailType = 'first_conversation'
      }
    }

    // Dag 4 — alleen als 0 gesprekken
    if (!emailType && days >= 4 && !sentTypes.has('dag4')) {
      const { count } = await supabase
        .from('arnobot_rds_logs')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.user_id)
      if ((count ?? 0) === 0) {
        emailType = 'dag4'
      }
    }

    // Trigger: eerste coaching (5+ gesprekken, nog geen coachingsrapport aangevraagd)
    if (!emailType && !sentTypes.has('first_coaching')) {
      const { count: sessionCount } = await supabase
        .from('arnobot_blog_sessions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.user_id)
      if ((sessionCount ?? 0) >= 5) {
        const { count: coachingCount } = await supabase
          .from('arnobot_coaching_scores')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.user_id)
        if ((coachingCount ?? 0) === 0) {
          emailType = 'first_coaching'
          emailOptions = { sessionCount: sessionCount ?? 5 }
        }
      }
    }

    // Dag 14 — altijd
    if (!emailType && days >= 14 && !sentTypes.has('dag14')) {
      emailType = 'dag14'
    }

    // Dag 21 — alleen als nog geen gesprek met Arno geboekt is
    if (!emailType && days >= 21 && !sentTypes.has('dag21_gesprek') && !user.arno_call_booked_at) {
      emailType = 'dag21_gesprek'
    }

    // Dag 25 — altijd, met echte opt-in CTA
    if (!emailType && days >= 25 && !sentTypes.has('dag25')) {
      emailType = 'dag25'
    }

    if (!emailType) continue

    try {
      await send(emailType, emailOptions)
      await supabase.from('arnobot_email_log').insert({
        user_id: user.user_id,
        email_type: emailType,
      })
      sent++
    } catch (e) {
      console.error(`Trial email naar ${user.email} mislukt:`, e)
    }
  }

  // --- Loop 2: auto-block betaalde gebruikers na opzegging + verstreken expires_at ---
  const { data: cancelledPaid } = await supabase
    .from('approved_users')
    .select('user_id, email, voornaam, expires_at')
    .not('paid_at', 'is', null)
    .not('cancelled_at', 'is', null)
    .not('expires_at', 'is', null)
    .eq('is_active', true)

  for (const user of cancelledPaid ?? []) {
    if (!user.email || !user.expires_at) continue
    if (new Date(user.expires_at) > now) continue
    const naam = user.voornaam || 'daar'
    await supabase.from('approved_users')
      .update({ is_active: false, deactivated_at: now.toISOString() })
      .eq('user_id', user.user_id)
    const { subject, html } = getEmailTemplate('geblokkeerd', naam)
    await resend.emails.send({ from: 'ArnoBot <info@arno.bot>', to: user.email, subject, html }).catch(() => {})
    blocked++
  }

  // --- Loop 3: winback email 15 dagen na einde trial ---
  const fifteenDaysAgo = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000).toISOString()
  const { data: deactivated } = await supabase
    .from('approved_users')
    .select('user_id, email, voornaam, deactivated_at')
    .eq('is_active', false)
    .not('deactivated_at', 'is', null)
    .is('winback_sent_at', null)
    .is('trial_reactivated_at', null)
    .lte('deactivated_at', fifteenDaysAgo)

  for (const user of deactivated ?? []) {
    if (!user.email) continue
    const naam = user.voornaam || 'daar'
    const { subject, html } = getEmailTemplate('winback', naam)
    const { error } = await resend.emails.send({ from: 'ArnoBot <info@arno.bot>', to: user.email, subject, html })
    if (!error) {
      await supabase.from('approved_users').update({ winback_sent_at: now.toISOString() }).eq('user_id', user.user_id)
      sent++
    }
  }

  // --- Loop 4: referral notificaties naar referrers ---
  const { data: pendingReferrals } = await supabase
    .from('arnobot_referrals')
    .select('id, referrer_user_id, referred_naam')
    .is('notif_sent_at', null)
    .eq('status', 'signed_up')

  for (const ref of pendingReferrals ?? []) {
    const { data: referrer } = await supabase
      .from('approved_users')
      .select('email, voornaam')
      .eq('user_id', ref.referrer_user_id)
      .single()

    if (!referrer?.email || !isValidEmail(referrer.email)) continue

    const referrerNaam = referrer.voornaam || 'daar'
    const { subject, html } = getEmailTemplate('referral_aanmelding', referrerNaam, false, {
      newUserName: ref.referred_naam || 'Iemand',
    })

    const { error } = await resend.emails.send({
      from: 'ArnoBot <noreply@arno.bot>',
      to: referrer.email,
      subject,
      html,
    })

    if (!error) {
      await supabase
        .from('arnobot_referrals')
        .update({ notif_sent_at: now.toISOString() })
        .eq('id', ref.id)
      sent++
    }
  }

  return NextResponse.json({ ok: true, sent, cancelled, blocked })
  } catch (err) {
    await notifyCronFailure('trial-emails', err)
    return NextResponse.json({ error: 'cron_error' }, { status: 500 })
  }
}
