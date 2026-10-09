import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { emailHtml, getEmailTemplate, isValidEmail } from '@/lib/email-templates'
import { meldOpzegging } from '@/lib/billing/opzeggen'

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

  // Server-side vangnet naast de client-side knop (app/bot/account/page.tsx): een gewoon
  // teamlid heeft geen eigen abonnement om op te zeggen, dat loopt via de manager. De
  // manager zelf betaalt het teamabonnement wél, dus die mag hier doorheen, in tegenstelling
  // tot vroeger toen isTeamCovered() ook de manager blokkeerde. Nooit alleen op UI
  // vertrouwen om deze actie te voorkomen.
  const { data: teamMember } = await supabase
    .from('arnobot_team_members')
    .select('team_id, role')
    .eq('user_id', userId)
    .maybeSingle()

  if (teamMember && teamMember.role !== 'manager') {
    return NextResponse.json({ error: 'Teamleden hebben geen eigen abonnement om op te zeggen' }, { status: 400 })
  }

  const isManager = teamMember?.role === 'manager'
  let teamMemberCount: number | null = null
  if (isManager && teamMember?.team_id) {
    const { count } = await supabase
      .from('arnobot_team_members')
      .select('*', { count: 'exact', head: true })
      .eq('team_id', teamMember.team_id)
    teamMemberCount = count ?? null
  }

  const now = new Date().toISOString()

  await supabase
    .from('approved_users')
    .update({ cancelled_at: now })
    .eq('user_id', userId)

  // Online betaald abonnement (Mollie): opzegging volgens artikel 7 automatisch verwerkt,
  // incl. het stopzetten van het Mollie-abonnement. Zonder billing-record blijft de oude
  // handmatige afhandeling door Arno gelden.
  let automatisch: { ingaatOp: Date } | null = null
  try {
    automatisch = await meldOpzegging(userId)
  } catch (e) {
    console.error('[cancel-subscription] automatische opzegging mislukt', e instanceof Error ? e.message : e)
  }

  // Bevestiging aan de gebruiker, belofte uit de voorwaarden (artikel 7).
  if (isValidEmail(user.email)) {
    const { subject, html } = getEmailTemplate('opzegging_bevestiging', user.voornaam || 'daar', false, { userId })
    await resend.emails.send({ from: 'ArnoBot <info@arno.bot>', to: user.email, subject, html }).catch(() => {})
  }

  const datum = new Date(now).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })
  const teamWaarschuwing = isManager
    ? `<br><br><strong style="color:#cc2200;">Dit is een teamabonnement met ${teamMemberCount ?? 'onbekend aantal'} leden. Bij het verwerken van deze opzegging moet je ook hun toegang zelf beëindigen, niet alleen die van de manager.</strong>`
    : ''
  await resend.emails.send({
    from: 'ArnoBot <noreply@arno.bot>',
    to: 'arno@arno.bot',
    subject: `Opzegging${isManager ? ' (TEAM)' : ''}: ${user.voornaam || user.email || userId}`,
    html: emailHtml(
      `<strong style="color:#f1f5f9;">${user.voornaam || 'Gebruiker'}</strong> (${user.email || userId}) heeft het ${isManager ? 'team' : ''}abonnement opgezegd op ${datum}.${teamWaarschuwing}<br><br>${automatisch ? `Automatisch verwerkt: het abonnement eindigt op ${automatisch.ingaatOp.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })}, geen actie nodig.` : 'Actie vereist: zet <code style="color:#f59e0b;background:#1f2937;padding:2px 6px;border-radius:3px;">is_active = false</code> op het moment dat de lopende periode afloopt.'}`,
      'BEKIJK IN ADMIN →', 'https://arno.bot/bot/admin/gebruikers'
    ),
  }).catch(() => {})

  return NextResponse.json({ ok: true, cancelled_at: now, isManager, teamMemberCount, eindigt_op: automatisch?.ingaatOp.toISOString() ?? null })
}

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

  const { data } = await supabase
    .from('approved_users')
    .select('cancelled_at')
    .eq('user_id', userId)
    .maybeSingle()

  // Bij een online abonnement kennen we de exacte einddatum (artikel 7 van de voorwaarden).
  const { data: sub } = await supabase
    .from('arnobot_subscriptions')
    .select('opzegging_ingaat_at')
    .eq('user_id', userId)
    .eq('status', 'cancelled')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return NextResponse.json({ cancelled_at: data?.cancelled_at ?? null, eindigt_op: sub?.opzegging_ingaat_at ?? null })
}
