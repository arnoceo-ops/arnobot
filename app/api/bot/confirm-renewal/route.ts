import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { emailHtml } from '@/lib/email-templates'
import { isTeamCovered } from '@/lib/teamAccess'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

  // Server-side vangnet: deze pagina is bedoeld voor individuele Basic/Pro-trialgebruikers,
  // niet voor een teamgedekt account (lid of manager). Een teamlid heeft geen eigen
  // plankeuze om te bevestigen, en een klik zou anders zijn plan-veld overschrijven en een
  // "stuur een factuur"-mail naar Arno triggeren die voor een teamlid niet klopt.
  if (await isTeamCovered(userId)) {
    return NextResponse.json({ error: 'Teamgedekte accounts hebben geen eigen plankeuze om te bevestigen' }, { status: 400 })
  }

  const body = await req.json().catch(() => ({}))
  const gekozenPlan = body?.plan
  if (gekozenPlan !== 'basis' && gekozenPlan !== 'premium') {
    return NextResponse.json({ error: 'Ongeldige plankeuze' }, { status: 400 })
  }

  const { data: user } = await supabase
    .from('approved_users')
    .select('voornaam, email, renewal_requested_at, paid_at')
    .eq('user_id', userId)
    .maybeSingle()

  if (!user) return NextResponse.json({ error: 'Gebruiker niet gevonden' }, { status: 404 })
  if (user.paid_at) return NextResponse.json({ ok: true, already_paid: true })
  if (user.renewal_requested_at) return NextResponse.json({ ok: true, already_requested: true })

  const now = new Date().toISOString()

  await supabase
    .from('approved_users')
    .update({ renewal_requested_at: now, plan: gekozenPlan })
    .eq('user_id', userId)

  const planLabel = gekozenPlan === 'basis' ? 'Basic (€29/maand of €19/maand bij jaarbetaling)' : 'Pro (€59/maand of €39/maand bij jaarbetaling)'

  await resend.emails.send({
    from: 'ArnoBot <noreply@arno.bot>',
    to: 'arno@arno.bot',
    subject: `Doorgaan (${gekozenPlan === 'basis' ? 'Basic' : 'Pro'}): ${user.voornaam || user.email || userId}`,
    html: emailHtml(
      `<strong style="color:#f1f5f9;">${user.voornaam || 'Gebruiker'}</strong> (${user.email || userId}) heeft bevestigd dat hij wil doorgaan met ArnoBot, gekozen abonnement: <strong style="color:#f59e0b;">${planLabel}</strong>.<br><br><strong style="color:#f59e0b;">Actie: stuur een factuur naar ${user.email || userId}.</strong><br><br>Het plan staat al automatisch goed in Supabase, na betaling alleen nog \`paid_at\` registreren via de admin pagina onder Gebruikers.`,
      'BEKIJK IN ADMIN →', 'https://arno.bot/bot/admin/gebruikers'
    ),
  }).catch(() => {})

  return NextResponse.json({ ok: true })
}

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

  const { data } = await supabase
    .from('approved_users')
    .select('renewal_requested_at, paid_at, plan')
    .eq('user_id', userId)
    .maybeSingle()

  return NextResponse.json({
    renewal_requested_at: data?.renewal_requested_at ?? null,
    paid_at: data?.paid_at ?? null,
    plan: data?.plan ?? null,
  })
}
