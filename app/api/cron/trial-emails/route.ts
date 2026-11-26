import { registreerCronRun } from '@/lib/cronRun'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { verstuurMail } from '@/lib/mail'
import { getEmailTemplate, isValidEmail, type EmailType } from '@/lib/email-templates'
import { E2E_TEST_USER_EMAIL, MANUAL_TEST_USER_EMAIL, APP_REVIEWER_EMAIL } from '@/lib/internalTestAccounts'
import { notifyCronFailure } from '@/lib/cron-notify'
import { isGratisAccount } from '@/lib/gratisAccount'
import { kiesTrialMail } from '@/lib/trialMailKeuze'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const resend = new Resend(process.env.RESEND_API_KEY)

async function cronHandler(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {

  const now = new Date()

  const { data: usersRaw } = await supabase
    .from('approved_users')
    .select('user_id, email, voornaam, trial_start, paid_at, arno_call_booked_at, command_manager, onboarding_done')
    .not('trial_start', 'is', null)
    .is('paid_at', null)
    .eq('is_active', true)
    .not('email', 'is', null)
    .neq('email', E2E_TEST_USER_EMAIL)
    .neq('email', MANUAL_TEST_USER_EMAIL)
    .neq('email', APP_REVIEWER_EMAIL)

  // Team-toegang is niet tijdgebonden aan de eigen trial_start: een teamlid/-manager
  // betaalt niet zelf, dus mag nooit door deze cron als "trial verlopen" behandeld
  // worden (2026-08-24-fix, zie docs/archief/TEAM_PLAN.md). Zelfde uitzondering als in proxy.ts.
  const { data: teamMemberRows } = await supabase
    .from('arnobot_team_members')
    .select('user_id')
  const teamMemberIds = new Set((teamMemberRows ?? []).map(r => r.user_id))

  const users = (usersRaw ?? []).filter(u => !u.command_manager && !teamMemberIds.has(u.user_id))

  if (!users?.length) return NextResponse.json({ ok: true, sent: 0 })

  let sent = 0
  let cancelled = 0
  let blocked = 0

  for (const user of users) {
    if (!isValidEmail(user.email) || !user.trial_start) continue

    const trialStart = new Date(user.trial_start)
    const trialEnd = new Date(trialStart.getTime() + 30 * 24 * 60 * 60 * 1000)
    const naam = user.voornaam || 'daar'

    async function send(type: EmailType, options?: { sessionCount?: number; viaReferral?: boolean }) {
      const { subject, html } = getEmailTemplate(type, naam, false, options)
      // verstuurMail gooit bij een weigering (limiet, ongeldig adres): dan schrijft de aanroeper hieronder
      // GEEN logregel en probeert de volgende run opnieuw. Met een kale resend.emails.send ging de mail
      // stil verloren terwijl hij als verzonden gelogd werd.
      await verstuurMail({ from: 'ArnoBot <info@arno.bot>', to: user.email, subject, html })
    }

    // --- Trial voorbij: toegang stopt (afrekenen kan via /bot/doorgaan) ---
    if (now > trialEnd) {
      await supabase.from('approved_users')
        .update({ is_active: false, deactivated_at: now.toISOString() })
        .eq('user_id', user.user_id)
      await send('trial_afgelopen').catch(() => {})
      cancelled++
      continue
    }

    const days = Math.floor((now.getTime() - trialStart.getTime()) / (1000 * 60 * 60 * 24))

    const { data: log } = await supabase
      .from('arnobot_email_log')
      .select('email_type')
      .eq('user_id', user.user_id)

    const sentTypes = new Set((log || []).map((r: { email_type: string }) => r.email_type))

    const [gesprekken, sessies, rapporten] = await Promise.all([
      supabase.from('arnobot_rds_logs').select('*', { count: 'exact', head: true }).eq('user_id', user.user_id),
      supabase.from('arnobot_blog_sessions').select('*', { count: 'exact', head: true }).eq('user_id', user.user_id),
      supabase.from('arnobot_coaching_scores').select('*', { count: 'exact', head: true }).eq('user_id', user.user_id),
    ])
    // Een mislukte telling is niet hetzelfde als nul: dan vandaag geen mail, morgen opnieuw.
    const telFout = gesprekken.error ?? sessies.error ?? rapporten.error
    if (telFout) {
      console.error(`Trial email: telling mislukt voor ${user.user_id}:`, telFout.message)
      continue
    }

    const emailType = kiesTrialMail({
      dagen: days,
      profielAf: !!user.onboarding_done,
      gesprekken: gesprekken.count ?? 0,
      sessies: sessies.count ?? 0,
      coachingRapporten: rapporten.count ?? 0,
      gesprekMetArnoGeboekt: !!user.arno_call_booked_at,
      verzonden: sentTypes,
    })
    const emailOptions = emailType === 'first_coaching' ? { sessionCount: sessies.count ?? 5 } : undefined

    if (!emailType) continue

    // Dag 25: wie via een referral binnenkwam hoort hier over zijn referral fee.
    let viaReferral = false
    if (emailType === 'dag25') {
      const { data: referral } = await supabase.from('arnobot_referrals').select('id').eq('referred_user_id', user.user_id).maybeSingle()
      viaReferral = !!referral
    }

    try {
      await send(emailType, viaReferral ? { viaReferral } : emailOptions)
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
  // Alleen blokkeren, geen mail: wie opzegt krijgt het juiste bericht ("abonnement afgelopen") van
  // cron/billing. De mail "je betaling is niet ontvangen" hoort alleen bij een uitgebleven betaling
  // en kwam hier ten onrechte bij mensen die bewust opzegden (besluit Arno, 2026-10-24).
  const { data: cancelledPaid } = await supabase
    .from('approved_users')
    .select('user_id, expires_at')
    .not('paid_at', 'is', null)
    .not('cancelled_at', 'is', null)
    .not('expires_at', 'is', null)
    .eq('is_active', true)

  for (const user of cancelledPaid ?? []) {
    if (!user.expires_at) continue
    if (new Date(user.expires_at) > now) continue
    await supabase.from('approved_users')
      .update({ is_active: false, deactivated_at: now.toISOString() })
      .eq('user_id', user.user_id)
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
      // Alle kolommen: isGratisAccount heeft gratis_sinds en lifetime_sinds nodig.
      .select('*')
      .eq('user_id', ref.referrer_user_id)
      .single()

    if (!referrer?.email || !isValidEmail(referrer.email)) continue
    // Een gratis account heeft geen referral en krijgt hier dus ook geen mail over.
    if (isGratisAccount(referrer)) continue

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

export const GET = registreerCronRun('/api/cron/trial-emails', cronHandler)
