import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const resend = new Resend(process.env.RESEND_API_KEY)

const CTA = `display:inline-block;background:#f59e0b;color:#111827;font-family:'Courier New',monospace;font-size:16px;font-weight:700;letter-spacing:3px;padding:16px 40px;text-decoration:none;border-radius:999px;`

function emailHtml(body: string, ctaText: string, ctaUrl: string) {
  return `
    <div style="font-family:'Courier New',monospace;background:#111827;color:#f1f5f9;padding:40px;max-width:560px;margin:0 auto;">
      <p style="color:#f59e0b;font-size:12px;letter-spacing:4px;margin-bottom:32px;">ARNOBOT</p>
      <div style="font-size:15px;color:#9ca3af;line-height:1.8;margin-bottom:32px;">${body}</div>
      <a href="${ctaUrl}" style="${CTA}">${ctaText}</a>
      <p style="font-size:11px;color:#374151;margin-top:40px;">© ARNOBOT</p>
    </div>
  `
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()

  const { data: users } = await supabase
    .from('approved_users')
    .select('user_id, email, voornaam, trial_start, paid_at')
    .not('trial_start', 'is', null)
    .is('paid_at', null)
    .eq('is_active', true)
    .not('email', 'is', null)

  if (!users?.length) return NextResponse.json({ ok: true, sent: 0 })

  let sent = 0

  for (const user of users) {
    if (!user.email || !user.trial_start) continue

    const trialStart = new Date(user.trial_start)
    const trialEnd = new Date(trialStart.getTime() + 30 * 24 * 60 * 60 * 1000)
    if (now > trialEnd) continue

    const days = Math.floor((now.getTime() - trialStart.getTime()) / (1000 * 60 * 60 * 24))
    const naam = user.voornaam || 'daar'

    const { data: log } = await supabase
      .from('arnobot_email_log')
      .select('email_type')
      .eq('user_id', user.user_id)

    const sentTypes = new Set((log || []).map((r: { email_type: string }) => r.email_type))

    let email: { type: string; subject: string; html: string } | null = null

    // Dag 1 — altijd
    if (days >= 1 && !sentTypes.has('dag1')) {
      email = {
        type: 'dag1',
        subject: `${naam}, waar wil je mee beginnen?`,
        html: emailHtml(
          `ArnoBot staat voor je klaar. 24/7, zonder limiet. Maar waar begin je?<br /><br />Drie vragen die andere salesprofessionals als eerste stellen: "Hoe reageer ik op een prospect die zegt dat hij er nog over nadenkt?" of "Wat doe ik als mijn pipeline er goed uitziet maar de deals niet sluiten?" of "Hoe verhoog ik mijn gemiddelde dealgrootte?"<br /><br />Gewoon typen wat jou bezighoudt. Bedenk samen met ArnoBot hoe jij gaat winnen.`,
          'START EEN GESPREK →',
          'https://arno.bot/bot'
        ),
      }
    }

    // Trigger: eerste gesprek (alleen nadat dag1 is verzonden)
    if (!email && sentTypes.has('dag1') && !sentTypes.has('first_conversation')) {
      const { count } = await supabase
        .from('arnobot_rds_logs')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.user_id)
      if ((count ?? 0) >= 1) {
        email = {
          type: 'first_conversation',
          subject: `Goed begin, ${naam}.`,
          html: emailHtml(
            `Je eerste gesprek met ArnoBot zit erop. Wat nu?<br /><br />ArnoBot heeft het onthouden. Elk volgend gesprek bouwt voort op wat hij al weet. Hoe meer je gebruikt, hoe scherper het wordt.`,
            'VERDER SPARREN →',
            'https://arno.bot/bot'
          ),
        }
      }
    }

    // Dag 4 — alleen als 0 gesprekken
    if (!email && days >= 4 && !sentTypes.has('dag4')) {
      const { count } = await supabase
        .from('arnobot_rds_logs')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.user_id)
      if ((count ?? 0) === 0) {
        email = {
          type: 'dag4',
          subject: `${naam}, heb je al gespart?`,
          html: emailHtml(
            `Ingeschreven maar ArnoBot nog niet gebruikt? Geen probleem, maar je laat wel iets liggen.<br /><br />Eén goeie hint kan je de winst opleveren. Gewoon beginnen.`,
            'OPEN ARNOBOT →',
            'https://arno.bot/bot'
          ),
        }
      }
    }

    // Dag 14 — altijd
    if (!email && days >= 14 && !sentTypes.has('dag14')) {
      email = {
        type: 'dag14',
        subject: `${naam}, je zit halverwege je trial.`,
        html: emailHtml(
          `Twee weken ArnoBot. Time flies maar nog ruim twee weken te gaan.<br /><br />ArnoBot wordt scherper en beter naarmate je meer gesprekken voert. Elke sessie voegt iets toe aan wat hij van jou weet. Gebruik de tweede helft om dieper te gaan.`,
          'OPEN ARNOBOT →',
          'https://arno.bot/bot'
        ),
      }
    }

    // Dag 25 — altijd
    if (!email && days >= 25 && !sentTypes.has('dag25')) {
      email = {
        type: 'dag25',
        subject: `${naam}, je trial loopt over 5 dagen af.`,
        html: emailHtml(
          `Over vijf dagen stopt je gratis toegang. Wat heeft het je opgeleverd?<br /><br />Als het antwoord is: niet genoeg, dan is dat precies de reden om door te gaan. ArnoBot wordt beter naarmate hij je langer kent.`,
          'DOORGAAN MET ARNOBOT →',
          'https://arno.bot/bot'
        ),
      }
    }

    if (!email) continue

    try {
      await resend.emails.send({
        from: 'ArnoBot <info@arno.bot>',
        to: user.email,
        subject: email.subject,
        html: email.html,
      })

      await supabase.from('arnobot_email_log').insert({
        user_id: user.user_id,
        email_type: email.type,
      })

      sent++
    } catch (e) {
      console.error(`Trial email naar ${user.email} mislukt:`, e)
    }
  }

  return NextResponse.json({ ok: true, sent })
}
