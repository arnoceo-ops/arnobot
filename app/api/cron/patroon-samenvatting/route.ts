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

// Minimaal 3x genoemd voordat het als "patroon" de moeite waard is om te mailen, 2x is nog
// gewoon een terugkerend onderwerp in normale gesprekken. Maandelijks, geen "wat is nieuw
// sinds vorige keer"-tracking in v1: bewust simpel, toont gewoon de huidige top-5. Draait
// bewust op basis van arnobot_memory_entities, het patroongeheugen van 12 augustus 2026.
const MIN_MENTION_COUNT = 3
const TOP_N = 5

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const { data: entiteiten } = await supabase
      .from('arnobot_memory_entities')
      .select('user_id, entity_name, mention_count')
      .gte('mention_count', MIN_MENTION_COUNT)
      .order('mention_count', { ascending: false })

    if (!entiteiten?.length) return NextResponse.json({ ok: true, sent: 0 })

    const perUser = new Map<string, { naam: string; aantal: number }[]>()
    for (const e of entiteiten) {
      if (e.user_id === E2E_TEST_USER_ID || e.user_id === MANUAL_TEST_USER_ID) continue
      const lijst = perUser.get(e.user_id) ?? []
      if (lijst.length < TOP_N) lijst.push({ naam: e.entity_name, aantal: e.mention_count })
      perUser.set(e.user_id, lijst)
    }

    let sent = 0

    for (const [userId, patronen] of perUser) {
      const { data: user } = await supabase
        .from('approved_users')
        .select('email, voornaam')
        .eq('user_id', userId)
        .eq('is_active', true)
        .eq('nudge_opt_out', false)
        .maybeSingle()

      if (!user || !isValidEmail(user.email)) continue

      const naam = user.voornaam || 'hey'
      const template = getEmailTemplate('patroon_samenvatting', naam, false, {
        userId,
        patronen,
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
        console.error(`[patroon-samenvatting] e-mail naar ${user.email} mislukt:`, e)
      }
    }

    return NextResponse.json({ ok: true, sent })
  } catch (err) {
    await notifyCronFailure('patroon-samenvatting', err)
    return NextResponse.json({ error: 'cron_error' }, { status: 500 })
  }
}
