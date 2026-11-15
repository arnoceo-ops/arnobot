import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verstuurMailZacht } from '@/lib/mail'
import { emailHtml, getEmailTemplate, isValidEmail } from '@/lib/email-templates'
import { meldOpzegging } from '@/lib/billing/opzeggen'
import { soloStoptVoorTeam } from '@/lib/billing/soloNaarTeam'
import { heeftEigenAbonnement } from '@/lib/teamLid'
import { zegTeamOp } from '@/lib/teamOpzegging'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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

  // Een lid dat zelf een abonnement heeft afgenomen (bijvoorbeeld omdat zijn team geblokkeerd was) mag dat wel opzeggen.
  if (teamMember && teamMember.role !== 'manager' && !(await heeftEigenAbonnement(userId))) {
    return NextResponse.json({ error: 'Teamleden hebben geen eigen abonnement om op te zeggen' }, { status: 400 })
  }

  // Een solo-abonnement dat al stopt omdat de klant Team wordt: opzeggen zou `cancelled_at` op het hele account zetten
  // en de toegang via het Team na de einddatum afsluiten. Dat kan pas nadat het Team is ingegaan.
  const stoptVoorTeam = await soloStoptVoorTeam(userId)
  if (stoptVoorTeam) {
    const tot = new Date(stoptVoorTeam).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })
    return NextResponse.json({ error: `Je solo-abonnement stopt op ${tot} omdat je naar Team gaat. Opzeggen van het Team kan daarna.` }, { status: 409 })
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

  // Een manager van een team met facturatie: de einddatum van het team volgt artikel 7 (lib/teamOpzegging.ts). Vóór het
  // vastleggen van de opzegging, zodat een weigering (bijvoorbeeld al opgezegd) niets half laat staan.
  let teamStopt: string | null = null
  if (isManager) {
    const uitkomst = await zegTeamOp(userId)
    if (!uitkomst.ok) return NextResponse.json({ error: uitkomst.fout }, { status: uitkomst.status })
    teamStopt = uitkomst.stoptOp
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
    const { subject, html } = getEmailTemplate('opzegging_bevestiging', user.voornaam || 'daar', false, {
      userId,
      // Bij een team: de einddatum noemen (12:00 UTC, zodat de datum in elke tijdzone dezelfde dag blijft).
      ...(teamStopt ? { team: { teamNaam: '', bedragCent: 0, seats: 0, einde: `${teamStopt}T12:00:00.000Z` } } : {}),
    })
    await verstuurMailZacht({ from: 'ArnoBot <info@arno.bot>', to: user.email, subject, html }).catch(() => {})
  }

  const datum = new Date(now).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })
  const ledenTekst = teamMemberCount === null ? 'een onbekend aantal leden' : `${teamMemberCount} ${teamMemberCount === 1 ? 'lid' : 'leden'}`
  // Een team met facturatie wordt automatisch verwerkt (einddatum, blokkade en stop facturatie op die dag), een team zonder
  // facturatie niet: alleen dan moet Arno zelf de toegang van de leden beëindigen.
  const teamWaarschuwing = isManager
    ? (teamStopt
      ? `<br><br>Team met ${ledenTekst}.`
      : `<br><br><strong style="color:#cc2200;">Dit is een teamabonnement met ${ledenTekst}. Bij het verwerken van deze opzegging moet je ook hun toegang zelf beëindigen, niet alleen die van de manager.</strong>`)
    : ''
  await verstuurMailZacht({
    from: 'ArnoBot <noreply@arno.bot>',
    to: 'arno@arno.bot',
    subject: `Opzegging${isManager ? ' (TEAM)' : ''}: ${user.voornaam || user.email || userId}`,
    html: emailHtml(
      `<strong style="color:#f1f5f9;">${user.voornaam || 'Gebruiker'}</strong> (${user.email || userId}) heeft het ${isManager ? 'team' : ''}abonnement opgezegd op ${datum}.${teamWaarschuwing}<br><br>${teamStopt ? `Automatisch verwerkt: het team stopt op ${new Date(`${teamStopt}T00:00:00.000Z`).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })}. Tot die dag houden manager en leden toegang, op die dag blokkeert het team en stopt de facturatie. Geen actie nodig.` : automatisch ? `Automatisch verwerkt: het abonnement eindigt op ${automatisch.ingaatOp.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })}, geen actie nodig.` : 'Actie vereist: zet <code style="color:#f59e0b;background:#1f2937;padding:2px 6px;border-radius:3px;">is_active = false</code> op het moment dat de lopende periode afloopt.'}`,
      'BEKIJK IN ADMIN →', 'https://arno.bot/bot/admin/gebruikers'
    ),
  }).catch(() => {})

  return NextResponse.json({
    ok: true, cancelled_at: now, isManager, teamMemberCount,
    eindigt_op: teamStopt ? new Date(`${teamStopt}T00:00:00.000Z`).toISOString() : automatisch?.ingaatOp.toISOString() ?? null,
    team_stopt_op: teamStopt,
  })
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

  // De einddatum van een opgezegd team (alleen voor de manager), zie lib/teamOpzegging.ts.
  const { data: lid } = await supabase.from('arnobot_team_members').select('team_id').eq('user_id', userId).eq('role', 'manager').maybeSingle()
  const { data: team } = lid ? await supabase.from('arnobot_teams').select('stopt_op').eq('id', lid.team_id).maybeSingle() : { data: null }
  const teamStoptOp = (team?.stopt_op as string | null | undefined) ?? null

  // Gestopt omdat de klant Team wordt: de pagina toont dan een uitleg in plaats van de opzegknop.
  const soloNaarTeamOp = await soloStoptVoorTeam(userId)
  return NextResponse.json({
    cancelled_at: data?.cancelled_at ?? null,
    eindigt_op: sub?.opzegging_ingaat_at ?? (teamStoptOp ? new Date(`${teamStoptOp}T00:00:00.000Z`).toISOString() : null),
    team_stopt_op: teamStoptOp,
    solo_naar_team_op: soloNaarTeamOp,
  })
}
