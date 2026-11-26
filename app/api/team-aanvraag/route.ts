import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { limietVeilig } from '@/lib/limietVeilig'
import { verstuurMailZacht } from '@/lib/mail'
import { emailHtml } from '@/lib/email-templates'
import { berekenTeamPrijsPerMaand, teamPrijsWeergave, TEAM_MIN_GEBRUIKERS, TEAM_ELITE_SURPLUS_PER_MAAND, type Cyclus } from '@/lib/teamPricing'
import { gaatAutomatisch } from '@/lib/billing/referralAutomatisch'
import { NIET_MET_DE_HAND, VEILIG_TERUGSTORTEN } from '@/lib/billing/referralSignalen'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

// Publiek formulier zonder login: elke inzending stuurt een mail en een Telegram-melding. Zonder
// limiet kon een bot je Telegram vullen en de gedeelde Resend-daglimiet opmaken, waardoor betaal-
// en welkomstmails niet aankomen (gevonden 2026-11-04). Zelfde patroon als de blog-aanmelding.
const aanvraagIpLimit = new Ratelimit({
  redis: new Redis({ url: process.env.UPSTASH_REDIS_REST_URL!, token: process.env.UPSTASH_REDIS_REST_TOKEN! }),
  limiter: Ratelimit.slidingWindow(5, '1 h'),
  prefix: 'arnobot:team-aanvraag:ip',
})

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'onbekend'
  const { success: ipOk } = await limietVeilig(aanvraagIpLimit, ip)
  if (!ipOk) return NextResponse.json({ error: 'Te veel aanvragen vanaf dit netwerk, probeer het later opnieuw of mail naar admin@arno.bot' }, { status: 429 })

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

  // Via een referral binnengekomen? Dan staat erbij of de teammaand (spelregels artikel 2) automatisch gaat of door Arno
  // gedaan moet worden. Alleen op te zoeken als de aanvrager ingelogd is; anders blijft de regel weg.
  let referralRegel = ''
  if (userId) {
    const { data: verw } = await supabase
      .from('arnobot_referrals')
      .select('referrer_user_id, code_used')
      .eq('referred_user_id', userId)
      .maybeSingle()
    if (verw) {
      const { data: referrer } = await supabase
        .from('approved_users')
        .select('voornaam, full_name, email')
        .eq('user_id', verw.referrer_user_id)
        .maybeSingle()
      const naam = referrer?.voornaam || (referrer?.full_name ?? '').split(' ')[0] || referrer?.email || 'onbekend'
      referralRegel = `Via referral van ${naam} (code ${verw.code_used}): het team krijgt eenmalig een maand voor het hele team, hooguit de maandprijs bij de start. ${(await gaatAutomatisch('voordeel_maand').catch(() => false)) ? NIET_MET_DE_HAND : `Dit gaat niet automatisch. ${VEILIG_TERUGSTORTEN}`} Het tegoed voor de aanbrenger volgt de spelregels.`
    }
  }

  await verstuurMailZacht({
    from: 'ArnoBot <noreply@arno.bot>',
    to: 'arno@arno.bot',
    subject: `Nieuwe Team-aanvraag: ${bedrijfsnaam}`,
    html: emailHtml(
      `<strong style="color:#f1f5f9;">${aanvragerNaam}</strong>${functie ? ` (${functie})` : ''} van <strong style="color:#f1f5f9;">${bedrijfsnaam}</strong> heeft een Team-abonnement aangevraagd.<br><br>` +
      `E-mail: ${email}<br>Telefoon: ${telefoon || 'niet opgegeven'}<br>Aantal gebruikers: ${seats}<br>Berekende prijs: ${prijsTekst}<br>${eliteCount > 0 ? `Elite-teamleden: ${eliteCount} (+€${eliteSurplusTotaal}/maand surplus, €${TEAM_ELITE_SURPLUS_PER_MAAND}/lid)<br>` : ''}${bestelnummer ? `Bestelnummer: ${bestelnummer}<br>` : ''}${referralRegel ? `<strong style="color:#f59e0b;">${referralRegel}</strong><br>` : ''}` +
      `${kvkNummer ? `KvK: ${kvkNummer}<br>` : ''}${btwNummer ? `BTW-nummer: ${btwNummer}<br>` : ''}${factuuradres ? `Factuuradres: ${factuuradres}, ${postcode} ${plaats}<br>` : ''}`,
      'BEKIJK TEAMS →', 'https://www.arno.bot/bot/admin/teams'
    ),
  }).catch(() => {})

  const tgToken = process.env.TELEGRAM_BOT_TOKEN
  const tgChat = process.env.TELEGRAM_CHAT_ID
  if (tgToken && tgChat) {
    await fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: tgChat,
        text: `Nieuwe Team-aanvraag op arno.bot\n\n${bedrijfsnaam} (${aanvragerNaam})\nE-mail: ${email}\nTelefoon: ${telefoon || 'niet opgegeven'}\nAantal gebruikers: ${seats}\nPrijs: ${prijsTekst}${referralRegel ? `\n\n${referralRegel}` : ''}`,
      }),
    }).catch(() => {})
  }

  return NextResponse.json({ ok: true })
}
