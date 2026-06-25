import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { getEmailTemplate, type EmailType } from '@/lib/email-templates'

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

  const now = new Date()

  const { data: users } = await supabase
    .from('approved_users')
    .select('user_id, email, voornaam, trial_start, paid_at, renewal_requested_at, renewal_warning_sent_at')
    .not('trial_start', 'is', null)
    .is('paid_at', null)
    .eq('is_active', true)
    .not('email', 'is', null)

  if (!users?.length) return NextResponse.json({ ok: true, sent: 0 })

  let sent = 0
  let cancelled = 0
  let blocked = 0

  for (const user of users) {
    if (!user.email || !user.trial_start) continue

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
      await supabase.from('approved_users').update({ is_active: false }).eq('user_id', user.user_id)
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

  // --- Loop 3: winback email 30 dagen na deactivatie ---
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { data: deactivated } = await supabase
    .from('approved_users')
    .select('user_id, email, voornaam, deactivated_at')
    .eq('is_active', false)
    .not('deactivated_at', 'is', null)
    .is('winback_sent_at', null)
    .lte('deactivated_at', thirtyDaysAgo)

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

  return NextResponse.json({ ok: true, sent, cancelled, blocked })
}
