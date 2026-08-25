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

export async function POST() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

  const { data: user } = await supabase
    .from('approved_users')
    .select('voornaam, email, cancelled_at')
    .eq('user_id', userId)
    .maybeSingle()

  if (!user) return NextResponse.json({ error: 'Gebruiker niet gevonden' }, { status: 404 })
  if (user.cancelled_at) return NextResponse.json({ error: 'Al opgezegd' }, { status: 400 })

  // Server-side vangnet naast de client-side verborgen knop (app/bot/account/page.tsx):
  // een teamlid/-manager heeft geen eigen abonnement om op te zeggen, dat loopt via het
  // team. Nooit alleen op UI vertrouwen om deze actie te voorkomen.
  if (await isTeamCovered(userId)) {
    return NextResponse.json({ error: 'Teamleden hebben geen eigen abonnement om op te zeggen' }, { status: 400 })
  }

  const now = new Date().toISOString()

  await supabase
    .from('approved_users')
    .update({ cancelled_at: now })
    .eq('user_id', userId)

  const datum = new Date(now).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })
  await resend.emails.send({
    from: 'ArnoBot <noreply@arno.bot>',
    to: 'arno@arno.bot',
    subject: `Opzegging: ${user.voornaam || user.email || userId}`,
    html: emailHtml(
      `<strong style="color:#f1f5f9;">${user.voornaam || 'Gebruiker'}</strong> (${user.email || userId}) heeft het abonnement opgezegd op ${datum}.<br><br>Actie vereist: zet <code style="color:#f59e0b;background:#1f2937;padding:2px 6px;border-radius:3px;">is_active = false</code> op het moment dat de lopende periode afloopt.`,
      'BEKIJK IN ADMIN →', 'https://arno.bot/bot/admin/gebruikers'
    ),
  }).catch(() => {})

  return NextResponse.json({ ok: true, cancelled_at: now })
}

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

  const { data } = await supabase
    .from('approved_users')
    .select('cancelled_at')
    .eq('user_id', userId)
    .maybeSingle()

  return NextResponse.json({ cancelled_at: data?.cancelled_at ?? null })
}
