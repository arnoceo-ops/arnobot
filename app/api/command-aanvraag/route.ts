import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { emailHtml } from '@/lib/email-templates'
import { berekenCommandPrijs, type Cyclus, type CommandNiveau } from '@/lib/commandPricing'

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
    aanvragerNaam, functie, email, telefoon, bestelnummer, aantalSeats, niveau, cyclus,
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
  if (!Number.isFinite(seats) || seats < 2) {
    return NextResponse.json({ error: 'Ongeldig aantal seats' }, { status: 400 })
  }
  if (niveau !== 'premium' && niveau !== 'elite') {
    return NextResponse.json({ error: 'Ongeldig niveau' }, { status: 400 })
  }
  if (cyclus !== 'maandelijks' && cyclus !== 'jaarlijks') {
    return NextResponse.json({ error: 'Ongeldige facturatiecyclus' }, { status: 400 })
  }
  if (niveau === 'elite' && cyclus !== 'maandelijks') {
    return NextResponse.json({ error: 'Elite-niveau is alleen maandelijks beschikbaar' }, { status: 400 })
  }

  const prijs = berekenCommandPrijs(seats, cyclus as Cyclus, niveau as CommandNiveau)

  const { error } = await supabase.from('arnobot_command_requests').insert({
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
    niveau,
    cyclus,
    berekende_prijs_per_maand: cyclus === 'jaarlijks' && prijs !== null ? prijs / 8 : prijs,
  })

  if (error) {
    console.error('Command-aanvraag opslaan mislukt:', error.message)
    return NextResponse.json({ error: 'Opslaan mislukt' }, { status: 500 })
  }

  const prijsTekst = prijs === null
    ? 'meer dan 20 seats, geen automatische staffelprijs, maatwerk'
    : `€${prijs} ${cyclus === 'jaarlijks' ? 'per jaar' : 'per maand'} (excl. btw)`

  await resend.emails.send({
    from: 'ArnoBot <noreply@arno.bot>',
    to: 'arno@arno.bot',
    subject: `Nieuwe Command-aanvraag: ${bedrijfsnaam}`,
    html: emailHtml(
      `<strong style="color:#f1f5f9;">${aanvragerNaam}</strong>${functie ? ` (${functie})` : ''} van <strong style="color:#f1f5f9;">${bedrijfsnaam}</strong> heeft een Command-abonnement aangevraagd.<br><br>` +
      `E-mail: ${email}<br>Telefoon: ${telefoon || 'niet opgegeven'}<br>Niveau: ${niveau === 'elite' ? 'Elite' : 'Premium'}<br>Aantal seats: ${seats}<br>Berekende prijs: ${prijsTekst}<br>${bestelnummer ? `Bestelnummer: ${bestelnummer}<br>` : ''}` +
      `${kvkNummer ? `KvK: ${kvkNummer}<br>` : ''}${btwNummer ? `Btw-nummer: ${btwNummer}<br>` : ''}${factuuradres ? `Factuuradres: ${factuuradres}, ${postcode} ${plaats}<br>` : ''}`,
      'BEKIJK IN SUPABASE →', 'https://supabase.com/dashboard/project/wxrsmmzqbmoeackirsxc/editor'
    ),
  }).catch(() => {})

  return NextResponse.json({ ok: true })
}
