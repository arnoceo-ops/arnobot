import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { emailHtml } from '@/lib/email-templates'
import { E2E_TEST_USER_EMAIL, MANUAL_TEST_USER_EMAIL } from '@/lib/internalTestAccounts'
import { notifyCronFailure } from '@/lib/cron-notify'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const resend = new Resend(process.env.RESEND_API_KEY)

const MILESTONE = 50

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {

  const { count } = await supabase
    .from('approved_users')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true)
    .neq('email', E2E_TEST_USER_EMAIL)
    .neq('email', MANUAL_TEST_USER_EMAIL)

  const total = count ?? 0

  if (total < MILESTONE) {
    return NextResponse.json({ ok: true, skipped: true, active_users: total, milestone: MILESTONE, reached: false })
  }

  const ab = (num: string, title: string, body: string) =>
    `<div style="background:#1f2937;border-left:4px solid #f59e0b;padding:20px 24px;margin-bottom:16px;">
      <p style="font-family:Arial,sans-serif;font-size:14px;font-weight:700;color:#f1f5f9;margin:0 0 8px;">${num}. ${title}</p>
      <p style="font-family:Arial,sans-serif;font-size:14px;color:#9ca3af;line-height:1.8;margin:0;">${body}</p>
    </div>`

  await resend.emails.send({
    from: 'ArnoBot <noreply@arno.bot>',
    to: 'hq@arno.bot',
    subject: `ArnoBot heeft ${total} actieve gebruikers: tijd voor Pro-upgrades`,
    html: emailHtml(
      `Je hebt de grens van ${MILESTONE} gebruikers bereikt. Tijd voor drie platform-upgrades voor betere beveiliging en databescherming.<br><br>
      ${ab('1', 'Vercel Firewall + Bot Filter', 'vercel.com → project → Settings → Security. Zet Firewall aan + Bot Filter aan. Optioneel: rate limiting rule voor /api/* (100 req/min per IP).')}
      ${ab('2', 'Supabase Point-in-Time Recovery', 'supabase.com → project → Settings → Addons. Zet Point-in-Time Recovery aan (7 dagen, $100/maand). Vereist Supabase Pro-plan.')}
      ${ab('3', 'Clerk session token lifetime', 'dashboard.clerk.com → applicatie → Configure → Sessions. Maximum lifetime: 1 dag. Inactivity timeout: 2 uur. Vereist Clerk Pro-plan.')}`,
      'BEKIJK IN ADMIN →', 'https://arno.bot/bot/admin/gebruikers', false,
      `Deze mail wordt maandelijks gestuurd zolang je ${MILESTONE}+ actieve gebruikers hebt en de upgrades nog niet zijn doorgevoerd.`
    ),
  })

  return NextResponse.json({ ok: true, active_users: total, milestone: MILESTONE, reached: true })
  } catch (err) {
    await notifyCronFailure('milestone-check', err)
    return NextResponse.json({ error: 'cron_error' }, { status: 500 })
  }
}
