import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import Anthropic from '@anthropic-ai/sdk'
import { isValidEmail, getEmailTemplate } from '@/lib/email-templates'
import { E2E_TEST_USER_EMAIL, MANUAL_TEST_USER_EMAIL, APP_REVIEWER_EMAIL } from '@/lib/internalTestAccounts'
import { notifyCronFailure } from '@/lib/cron-notify'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const resend = new Resend(process.env.RESEND_API_KEY)
const anthropic = new Anthropic()

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {

  const now = Date.now()
  const sevenDaysAgo    = new Date(now - 7  * 24 * 60 * 60 * 1000).toISOString()
  const eightDaysAgo    = new Date(now - 8  * 24 * 60 * 60 * 1000).toISOString()
  const twentyOneDaysAgo = new Date(now - 21 * 24 * 60 * 60 * 1000).toISOString()
  const fortyFiveDaysAgo = new Date(now - 45 * 24 * 60 * 60 * 1000).toISOString()
  const sixtyDaysAgo     = new Date(now - 60 * 24 * 60 * 60 * 1000).toISOString()

  const { data: usersRaw } = await supabase
    .from('approved_users')
    .select('user_id, email, voornaam, trial_start, command_manager')
    .eq('is_active', true)
    .eq('nudge_opt_out', false)
    .not('email', 'is', null)
    .neq('email', E2E_TEST_USER_EMAIL)
    .neq('email', MANUAL_TEST_USER_EMAIL)
    .neq('email', APP_REVIEWER_EMAIL)

  // inactivity_dag45/dag60 dreigen expliciet met "abonnement wordt opgezegd", feitelijk
  // onjuist voor een teamlid/-manager die niet zelf betaalt (2026-08-24-fix, zie
  // docs/TEAM_PLAN.md). Alleen die twee typen worden overgeslagen hieronder, de gewone
  // activiteits-nudges (weekly_nudge/geen_gesprek_nudge/dag21) blijven wel gewoon gelden:
  // een teamlid mag best aangespoord worden om ArnoBot te gebruiken, alleen niet met een
  // valse opzeg-dreiging.
  const { data: teamMemberRows } = await supabase
    .from('arnobot_team_members')
    .select('user_id')
  const teamMemberIds = new Set((teamMemberRows ?? []).map(r => r.user_id))

  const users = usersRaw ?? []

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

    let type: 'weekly_nudge' | 'geen_gesprek_nudge' | 'inactivity_dag21' | 'inactivity_dag45' | 'inactivity_dag60' | null = null

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

    // Dag 21/45/60: check op basis van eerste activiteit en log
    if (!type && (totalCount ?? 0) > 0) {
      const { data: sentNudges } = await supabase
        .from('inactivity_nudge_log')
        .select('type')
        .eq('user_id', user.user_id)

      const sent60 = sentNudges?.some(r => r.type === 'dag60')
      const sent45 = sentNudges?.some(r => r.type === 'dag45')
      const sent21 = sentNudges?.some(r => r.type === 'dag21')

      const { count: activeSince60 } = await supabase
        .from('arnobot_rds_logs')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.user_id)
        .gte('created_at', sixtyDaysAgo)

      const { count: activeSince45 } = await supabase
        .from('arnobot_rds_logs')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.user_id)
        .gte('created_at', fortyFiveDaysAgo)

      const { count: activeSince21 } = await supabase
        .from('arnobot_rds_logs')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.user_id)
        .gte('created_at', twentyOneDaysAgo)

      const isTeamAccount = !!user.command_manager || teamMemberIds.has(user.user_id)

      if (!isTeamAccount && !sent60 && (activeSince60 ?? 0) === 0) {
        type = 'inactivity_dag60'
      } else if (!isTeamAccount && !sent45 && (activeSince45 ?? 0) === 0) {
        type = 'inactivity_dag45'
      } else if (!sent21 && (activeSince21 ?? 0) === 0) {
        type = 'inactivity_dag21'
      }
    }

    if (!type) continue

    let nudgeQuestion: string | undefined

    if (type === 'weekly_nudge') {
      const { data: lastSession } = await supabase
        .from('arnobot_blog_sessions')
        .select('uitdaging')
        .eq('user_id', user.user_id)
        .not('uitdaging', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (lastSession?.uitdaging?.trim()) {
        try {
          const msg = await anthropic.messages.create({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 100,
            messages: [{
              role: 'user',
              content: `De actie uit het laatste gesprek: "${lastSession.uitdaging}"\n\nSchrijf één toekomstgerichte vraag (max 1 zin) die vraagt hoe het daarmee staat. Toon: nieuwsgierig, direct, zonder oordeel. Geen begroeting, geen afsluiting. Alleen de vraag. Gebruik NOOIT een streepje als leesteken (—, –, of een losstaand koppelteken). Herschrijf zinnen zonder streepjes.`,
            }],
          })
          nudgeQuestion = msg.content
            .filter(b => b.type === 'text')
            .map(b => b.text)
            .join('')
            .trim()
        } catch {
          // val terug op generieke template
        }
      }
    }

    const template = getEmailTemplate(type, naam, false, { userId: user.user_id, nudgeQuestion })

    try {
      await resend.emails.send({
        from: 'ArnoBot <info@arno.bot>',
        to: user.email,
        subject: template.subject,
        html: template.html,
      })
      sent++

      if (type === 'inactivity_dag21' || type === 'inactivity_dag45' || type === 'inactivity_dag60') {
        const logType = type === 'inactivity_dag21' ? 'dag21' : type === 'inactivity_dag45' ? 'dag45' : 'dag60'
        await supabase.from('inactivity_nudge_log').insert({ user_id: user.user_id, type: logType })
      }
    } catch (e) {
      console.error(`Email naar ${user.email} mislukt:`, e)
    }
  }

  return NextResponse.json({ ok: true, sent })
  } catch (err) {
    await notifyCronFailure('inactivity-nudge', err)
    return NextResponse.json({ error: 'cron_error' }, { status: 500 })
  }
}
