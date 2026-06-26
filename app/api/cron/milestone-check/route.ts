import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

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

  const { count } = await supabase
    .from('approved_users')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true)

  const total = count ?? 0

  if (total < MILESTONE) {
    return NextResponse.json({ ok: true, active_users: total, milestone: MILESTONE, reached: false })
  }

  await resend.emails.send({
    from: 'ArnoBot <noreply@arno.bot>',
    to: 'hq@arno.bot',
    subject: `ArnoBot heeft ${total} actieve gebruikers — tijd voor Pro-upgrades`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;padding:40px">
        <p style="color:#f59e0b;font-size:13px;letter-spacing:4px;margin:0 0 8px">ARNOBOT MILESTONE</p>
        <h1 style="font-size:28px;margin:0 0 24px">Je hebt ${total} actieve gebruikers.</h1>
        <p style="color:#555;font-size:15px;line-height:1.8;margin:0 0 32px">
          Je hebt de grens van ${MILESTONE} gebruikers bereikt. Dit is het moment om drie platform-upgrades door te voeren voor betere beveiliging en databescherming.
        </p>

        <h2 style="font-size:18px;margin:0 0 16px">Wat je nu moet doen:</h2>

        <div style="background:#f9f9f9;border-left:4px solid #f59e0b;padding:20px 24px;margin-bottom:16px">
          <p style="font-weight:700;margin:0 0 8px">1. Vercel Firewall + Bot Filter</p>
          <p style="color:#555;font-size:14px;margin:0">
            Ga naar vercel.com → jouw project (arnobot) → Settings → Security<br>
            Zet <strong>Firewall</strong> aan + <strong>Bot Filter</strong> aan.<br>
            Optioneel: voeg een rate limiting rule toe voor /api/* (100 req/min per IP).
          </p>
        </div>

        <div style="background:#f9f9f9;border-left:4px solid #f59e0b;padding:20px 24px;margin-bottom:16px">
          <p style="font-weight:700;margin:0 0 8px">2. Supabase Point-in-Time Recovery</p>
          <p style="color:#555;font-size:14px;margin:0">
            Ga naar supabase.com → jouw project → Settings → Addons<br>
            Zet <strong>Point-in-Time Recovery</strong> aan (7 dagen, $100/maand).<br>
            Vereist Supabase Pro-plan.
          </p>
        </div>

        <div style="background:#f9f9f9;border-left:4px solid #f59e0b;padding:20px 24px;margin-bottom:32px">
          <p style="font-weight:700;margin:0 0 8px">3. Clerk session token lifetime</p>
          <p style="color:#555;font-size:14px;margin:0">
            Ga naar dashboard.clerk.com → jouw applicatie → Configure → Sessions<br>
            Stel <strong>Maximum lifetime</strong> in op 1 dag.<br>
            Stel <strong>Inactivity timeout</strong> in op 2 uur.<br>
            Vereist Clerk Pro-plan.
          </p>
        </div>

        <p style="color:#999;font-size:13px">
          Deze mail wordt maandelijks gestuurd zolang je ${MILESTONE}+ actieve gebruikers hebt en de upgrades nog niet zijn doorgevoerd.
        </p>
      </div>
    `,
  })

  return NextResponse.json({ ok: true, active_users: total, milestone: MILESTONE, reached: true })
}
