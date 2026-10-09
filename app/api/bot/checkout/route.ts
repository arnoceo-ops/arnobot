import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import * as Sentry from '@sentry/nextjs'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { billingDb, type SubRow } from '@/lib/billing/db'
import { MollieError, SITE_URL, maakEersteBetaling, maakKlant, mollieBeschikbaarVoor } from '@/lib/billing/mollie'
import { berekenBedrag, isCyclus, isKlantType, isPlan, planNaam } from '@/lib/billing/prijzen'
import { controleerBtwBijVies, isKvkFormaat, isNlBtwFormaat, normaliseerBtwNummer, normaliseerPostcode } from '@/lib/billing/btwNummer'
import { isTeamCovered } from '@/lib/teamAccess'

const ratelimit = new Ratelimit({
  redis: new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  }),
  limiter: Ratelimit.slidingWindow(10, '1 h'),
  prefix: 'arnobot:checkout',
})

const fout = (status: number, error: string, extra?: Record<string, unknown>) =>
  NextResponse.json({ error, ...extra }, { status })

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return fout(401, 'Niet ingelogd')
  if (!mollieBeschikbaarVoor(userId)) return fout(503, 'Online betalen is nog niet beschikbaar')

  const { success } = await ratelimit.limit(userId)
  if (!success) return fout(429, 'Te veel pogingen, probeer het over een uur opnieuw')

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') return fout(400, 'Ongeldig verzoek')
  const { plan, cyclus, klantType, bedrijfsnaam, kvk, btwNummer, straat, postcode, plaats, akkoordVoorwaarden } = body as Record<string, unknown>

  if (!isPlan(plan) || !isCyclus(cyclus) || !isKlantType(klantType)) return fout(400, 'Ongeldige keuze')
  if (akkoordVoorwaarden !== true) return fout(400, 'Ga akkoord met de algemene voorwaarden om door te gaan')

  // Een teamlid of teammanager heeft geen eigen abonnement (zelfde vangnet als confirm-renewal).
  if (await isTeamCovered(userId)) return fout(400, 'Teamgedekte accounts hebben geen eigen abonnement')

  let zakelijk: { bedrijfsnaam: string; kvk: string; btw: string; btwGevalideerd: boolean; straat: string; postcode: string; plaats: string } | null = null
  if (klantType === 'zakelijk') {
    const naam = typeof bedrijfsnaam === 'string' ? bedrijfsnaam.trim() : ''
    const kvkNr = typeof kvk === 'string' ? kvk.replace(/\s/g, '') : ''
    const btwRaw = typeof btwNummer === 'string' ? btwNummer : ''
    if (naam.length < 2 || naam.length > 120) return fout(400, 'Vul de bedrijfsnaam in')
    if (!isKvkFormaat(kvkNr)) return fout(400, 'Een KvK-nummer heeft 8 cijfers')
    if (/^BE/i.test(normaliseerBtwNummer(btwRaw))) {
      return fout(400, 'Je hebt een Belgisch btw-nummer. Voor Belgische bedrijven regelen we het afrekenen persoonlijk, omdat de btw dan wordt verlegd. Mail naar hq@arno.bot, dan helpen we je snel verder.')
    }
    if (!isNlBtwFormaat(btwRaw)) {
      return fout(400, 'Vul een Nederlands btw-nummer in (NL123456789B01). Heb je een buitenlands nummer, mail dan hq@arno.bot')
    }
    // In testmodus (test_-sleutel, alleen eigenaar en testaccounts) slaan we de VIES-controle over,
    // zodat zakelijk afrekenen te testen is zonder een echt btw-nummer.
    const check = process.env.MOLLIE_API_KEY?.startsWith('test_') ? 'onbekend' : await controleerBtwBijVies(btwRaw)
    if (check === 'ongeldig') return fout(400, 'Dit btw-nummer is niet geldig')
    // Een factuur aan een bedrijf moet het adres van het bedrijf bevatten.
    const straatNaam = typeof straat === 'string' ? straat.trim() : ''
    const plaatsNaam = typeof plaats === 'string' ? plaats.trim() : ''
    const postcodeNorm = typeof postcode === 'string' ? normaliseerPostcode(postcode) : null
    if (straatNaam.length < 3 || straatNaam.length > 100) return fout(400, 'Vul de straat en het huisnummer in')
    if (!postcodeNorm) return fout(400, 'Vul een geldige postcode in (bijvoorbeeld 1234 AB)')
    if (plaatsNaam.length < 2 || plaatsNaam.length > 80) return fout(400, 'Vul de plaats in')
    zakelijk = { bedrijfsnaam: naam, kvk: kvkNr, btw: normaliseerBtwNummer(btwRaw), btwGevalideerd: check === 'geldig', straat: straatNaam, postcode: postcodeNorm, plaats: plaatsNaam }
  }

  const { data: user } = await billingDb
    .from('approved_users')
    .select('voornaam, email')
    .eq('user_id', userId)
    .maybeSingle()
  if (!user?.email) return fout(404, 'Account niet gevonden')

  // Al een lopend abonnement? Dan geen tweede. Uitzondering: de laatste herhaalbetaling is
  // mislukt, dan moet de gebruiker een nieuwe betaalmethode kunnen opgeven.
  const nu = new Date()
  const { data: lopend } = await billingDb
    .from('arnobot_subscriptions')
    .select('id, periode_einde, status')
    .eq('user_id', userId)
    .in('status', ['active', 'cancelled'])
    .gt('periode_einde', nu.toISOString())
    .returns<Pick<SubRow, 'id' | 'periode_einde' | 'status'>[]>()
  for (const s of lopend ?? []) {
    const { data: laatste } = await billingDb
      .from('arnobot_payments')
      .select('status')
      .eq('subscription_id', s.id)
      .eq('soort', 'herhaling')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle<{ status: string }>()
    const mislukt = laatste && ['failed', 'expired', 'canceled'].includes(laatste.status)
    if (!mislukt) {
      if (s.status === 'cancelled' && s.periode_einde) {
        const tot = new Date(s.periode_einde).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })
        return fout(409, `Je abonnement is opgezegd en loopt nog tot ${tot}. Daarna kun je opnieuw afrekenen.`)
      }
      return fout(409, 'Je hebt al een actief abonnement')
    }
  }

  try {
    // Mollie-klant hergebruiken of aanmaken.
    const { data: bestaand } = await billingDb
      .from('arnobot_billing_customers')
      .select('mollie_customer_id')
      .eq('user_id', userId)
      .maybeSingle<{ mollie_customer_id: string }>()
    const klantId = bestaand?.mollie_customer_id
      ?? (await maakKlant({ naam: zakelijk?.bedrijfsnaam ?? (user.voornaam || user.email), email: user.email, userId })).id

    await billingDb.from('arnobot_billing_customers').upsert(
      {
        user_id: userId,
        mollie_customer_id: klantId,
        klant_type: klantType,
        bedrijfsnaam: zakelijk?.bedrijfsnaam ?? null,
        kvk_nummer: zakelijk?.kvk ?? null,
        btw_nummer: zakelijk?.btw ?? null,
        btw_gevalideerd: zakelijk?.btwGevalideerd ?? false,
        updated_at: nu.toISOString(),
      },
      { onConflict: 'user_id' },
    )

    // Adres apart opslaan en tolerant: de kolommen komen uit een SQL-migratie. Ontbreken ze nog,
    // dan blijft afrekenen werken (de factuur krijgt dan geen adres) en loggen we een waarschuwing.
    if (zakelijk) {
      const { error: adresFout } = await billingDb
        .from('arnobot_billing_customers')
        .update({ straat: zakelijk.straat, postcode: zakelijk.postcode, plaats: zakelijk.plaats })
        .eq('user_id', userId)
      if (adresFout) console.warn('[checkout] adres niet opgeslagen, SQL-migratie uitgevoerd?', adresFout.message)
    }

    // Eerdere onafgeronde pogingen afsluiten, dan een verse aanmaken.
    await billingDb
      .from('arnobot_subscriptions')
      .update({ status: 'abandoned', updated_at: nu.toISOString() })
      .eq('user_id', userId)
      .eq('status', 'pending')

    const bedrag = berekenBedrag(plan, cyclus, klantType)
    const { data: sub, error: subError } = await billingDb
      .from('arnobot_subscriptions')
      .insert({
        user_id: userId,
        plan,
        cyclus,
        klant_type: klantType,
        status: 'pending',
        bedrag_cent: bedrag.brutoCent,
        btw_cent: bedrag.btwCent,
        mollie_customer_id: klantId,
      })
      .select('id')
      .single<{ id: string }>()
    if (subError || !sub) throw new Error(subError?.message ?? 'Abonnement aanmaken mislukt')

    const betaling = await maakEersteBetaling({
      klantId,
      brutoCent: bedrag.brutoCent,
      omschrijving: `ArnoBot ${planNaam(plan)} ${cyclus}`,
      redirectUrl: `${SITE_URL}/bot/doorgaan?betaling=terug`,
      metadata: { userId, subscriptionRowId: sub.id },
      idempotencyKey: `eerste-${sub.id}`,
    })

    await billingDb.from('arnobot_payments').insert({
      user_id: userId,
      subscription_id: sub.id,
      mollie_payment_id: betaling.id,
      soort: 'eerste',
      status: betaling.status,
      bedrag_cent: bedrag.brutoCent,
      btw_cent: bedrag.btwCent,
    })

    const checkoutUrl = betaling._links?.checkout?.href
    if (!checkoutUrl) throw new Error('Mollie gaf geen checkout-URL')
    return NextResponse.json({ checkoutUrl })
  } catch (e) {
    // Nooit Mollie-details naar de gebruiker; wel loggen en melden.
    Sentry.captureException(e, { tags: { onderdeel: 'billing-checkout' } })
    console.error('[checkout]', e instanceof MollieError ? e.message : e instanceof Error ? e.message : e)
    return fout(502, 'Betaling starten is niet gelukt, probeer het zo opnieuw of mail hq@arno.bot')
  }
}
