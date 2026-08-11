import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { emailHtml } from '@/lib/email-templates'
import { berekenTeamPrijsPerMaand, teamPrijsWeergave, TEAM_MIN_GEBRUIKERS, TEAM_ELITE_SURPLUS_PER_MAAND, type Cyclus } from '@/lib/teamPricing'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const resend = new Resend(process.env.RESEND_API_KEY)

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export async function POST(req: Request) {
  const { userId } = await auth().catch(() => ({ userId: null }))
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Ongeldig verzoek' }, { status: 400 })

  const {
    bedrijfsnaam, kvkNummer, btwNummer, factuuradres, postcode, plaats,
    aanvragerNaam, functie, email, telefoon, bestelnummer, aantalSeats, cyclus, eliteAantal,
  } = body

  if (
    !bedrijfsnaam?.trim() || !kvkNummer?.trim() || !btwNummer?.trim() ||
    !factuuradres?.trim() || !postcode?.trim() || !plaats?.trim() ||
    !aanvragerNaam?.trim() || !functie?.trim() || !telefoon?.trim() ||
    !email?.trim() || !isValidEmail(email)
  ) {
    return NextResponse.json({ error: 'Vul de verplichte velden in' }, { status: 400 })
  }
  const seats = Number(aantalSeats)
  if (!Number.isFinite(seats) || seats < TEAM_MIN_GEBRUIKERS) {
    return NextResponse.json({ error: `Minimaal ${TEAM_MIN_GEBRUIKERS} gebruikers` }, { status: 400 })
  }
  if (cyclus !== 'maandelijks' && cyclus !== 'jaarlijks') {
    return NextResponse.json({ error: 'Ongeldige facturatiecyclus' }, { status: 400 })
  }
  const eliteCount = Number(eliteAantal) || 0
  if (eliteCount < 0 || eliteCount > seats) {
    return NextResponse.json({ error: 'Ongeldig aantal Elite-teamleden' }, { status: 400 })
  }

  const prijs = berekenTeamPrijsPerMaand(seats, cyclus as Cyclus)
  const eliteSurplusTotaal = eliteCount * TEAM_ELITE_SURPLUS_PER_MAAND

  // niveau: kolom uit de oude Command-staffelflow (Premium/Elite-keuze), blijft bestaan
  // in Supabase (geen migratie om dit te vermijden), krijgt nu een vaste waarde. Team
  // heeft geen niveau-keuze meer, zie docs/PRICING_DECISIONS.md. cyclus is wel weer
  // betekenisvol sinds de jaaroptie (2026-08-10).
  const { data: inserted, error } = await supabase.from('arnobot_command_requests').insert({
    user_id: userId,
    bedrijfsnaam: bedrijfsnaam.trim(),
    kvk_nummer: kvkNummer?.trim() || null,
    btw_nummer: btwNummer?.trim() || null,
    factuuradres: factuuradres?.trim() || null,
    postcode: postcode?.trim() || null,
    plaats: plaats?.trim() || null,
    aanvrager_naam: aanvragerNaam.trim(),
    functie: functie?.trim() || null,
    email: email.trim(),
    telefoon: telefoon?.trim() || null,
    bestelnummer: bestelnummer?.trim() || null,
    aantal_seats: seats,
    niveau: 'premium',
    cyclus,
    berekende_prijs_per_maand: prijs,
    elite_aantal: eliteCount || null,
  }).select('id').single()

  if (error || !inserted) {
    console.error('Team-aanvraag opslaan mislukt:', error?.message)
    return NextResponse.json({ error: 'Opslaan mislukt' }, { status: 500 })
  }

  const prijsTekst = teamPrijsWeergave(seats, cyclus as Cyclus)

  await resend.emails.send({
    from: 'ArnoBot <noreply@arno.bot>',
    to: 'arno@arno.bot',
    subject: `Nieuwe Team-aanvraag: ${bedrijfsnaam}`,
    html: emailHtml(
      `<strong style="color:#f1f5f9;">${aanvragerNaam}</strong>${functie ? ` (${functie})` : ''} van <strong style="color:#f1f5f9;">${bedrijfsnaam}</strong> heeft een Team-abonnement aangevraagd.<br><br>` +
      `E-mail: ${email}<br>Telefoon: ${telefoon || 'niet opgegeven'}<br>Aantal gebruikers: ${seats}<br>Berekende prijs: ${prijsTekst}<br>${eliteCount > 0 ? `Elite-teamleden: ${eliteCount} (+€${eliteSurplusTotaal}/maand surplus, €${TEAM_ELITE_SURPLUS_PER_MAAND}/lid)<br>` : ''}${bestelnummer ? `Bestelnummer: ${bestelnummer}<br>` : ''}` +
      `${kvkNummer ? `KvK: ${kvkNummer}<br>` : ''}${btwNummer ? `Btw-nummer: ${btwNummer}<br>` : ''}${factuuradres ? `Factuuradres: ${factuuradres}, ${postcode} ${plaats}<br>` : ''}`,
      'BEKIJK IN SUPABASE →', 'https://supabase.com/dashboard/project/wxrsmmzqbmoeackirsxc/editor'
    ),
  }).catch(() => {})

  return NextResponse.json({ ok: true })
}
