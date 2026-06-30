import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { emailHtml } from '@/lib/email-templates'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

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
    .update({ renewal_requested_at: now })
    .eq('user_id', userId)

  await resend.emails.send({
    from: 'ArnoBot <noreply@arno.bot>',
    to: 'arno@arno.bot',
    subject: `Doorgaan: ${user.voornaam || user.email || userId}`,
    html: emailHtml(
      `<strong style="color:#f1f5f9;">${user.voornaam || 'Gebruiker'}</strong> (${user.email || userId}) heeft bevestigd dat hij wil doorgaan met ArnoBot.<br><br><strong style="color:#f59e0b;">Actie: stuur een factuur naar ${user.email || userId}.</strong><br><br>Na betaling: registreer via de admin pagina onder Gebruikers.`,
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
    .select('renewal_requested_at, paid_at')
    .eq('user_id', userId)
    .maybeSingle()

  return NextResponse.json({
    renewal_requested_at: data?.renewal_requested_at ?? null,
    paid_at: data?.paid_at ?? null,
  })
}
