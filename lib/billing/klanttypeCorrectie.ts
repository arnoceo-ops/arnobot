import * as Sentry from '@sentry/nextjs'
import { billingDb, type PayRow, type SubRow } from './db'
import { haalBetaling, maakBetaalLink, maakKlant, SITE_URL } from './mollie'
import {
  btwTariefId,
  maakConceptFactuur,
  maakCreditnota,
  moneybirdIngeschakeld,
  verstuurFactuur,
  zoekOfMaakContact,
} from './moneybird'
import { verstuurBillingMail } from './mails'
import { berekenBedrag } from './prijzen'
import { notifyTelegram } from '@/lib/cron-notify'

// Zelf-bediening: een particulier die eigenlijk zakelijk had moeten afrekenen, corrigeert dit
// zelf (app/bot/account/zakelijk-corrigeren). Geen nieuwe schakelaar voor testmodus: deze flow
// loopt altijd via Mollie (ook test_), Moneybird-facturering blijft wel achter dezelfde
// bestaande testmodus-check staan, zelfde reden als overal elders (geen nepfacturen).
function factureringToegestaan(): boolean {
  if (!moneybirdIngeschakeld()) return false
  const testmodus = process.env.MOLLIE_API_KEY?.startsWith('test_')
  return !testmodus || process.env.MONEYBIRD_OOK_IN_TESTMODUS === 'true'
}

export interface KlanttypeCorrectieRow {
  id: string
  user_id: string
  subscription_id: string
  verschil_cent: number
  btw_cent: number
  mollie_payment_id: string | null
  status: 'open' | 'paid'
  bedrijfsnaam: string
  kvk_nummer: string
  btw_nummer: string
  straat: string
  postcode: string
  plaats: string
  moneybird_factuur_id: string | null
}

/** De meest recente betaalde particuliere factuur van de gebruiker, met het te crediteren Moneybird-id. */
export async function vindTeCorrigerenAbonnement(userId: string): Promise<{ sub: SubRow; payment: PayRow } | null> {
  const { data: subs } = await billingDb
    .from('arnobot_subscriptions')
    .select('*')
    .eq('user_id', userId)
    .eq('klant_type', 'particulier')
    .in('status', ['active', 'cancelled'])
    .order('created_at', { ascending: false })
    .returns<SubRow[]>()
  for (const sub of subs ?? []) {
    const { data: payment } = await billingDb
      .from('arnobot_payments')
      .select('*')
      .eq('subscription_id', sub.id)
      .eq('status', 'paid')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle<PayRow>()
    if (payment) return { sub, payment }
  }
  return null
}

export async function verwerkKlanttypeCorrectie(mollieId: string): Promise<void> {
  const mp = await haalBetaling(mollieId)
  const correctieId = typeof mp.metadata?.correctieId === 'string' ? mp.metadata.correctieId : null
  if (!correctieId) return

  const { data: rij } = await billingDb
    .from('arnobot_klanttype_correcties')
    .select('*')
    .eq('id', correctieId)
    .maybeSingle<KlanttypeCorrectieRow>()
  if (!rij || rij.status === 'paid' || mp.status !== 'paid') return

  const { data: geclaimd } = await billingDb
    .from('arnobot_klanttype_correcties')
    .update({ status: 'paid', betaald_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', rij.id)
    .eq('status', 'open')
    .select('id')
  if ((geclaimd?.length ?? 0) !== 1) return

  const { data: sub } = await billingDb
    .from('arnobot_subscriptions')
    .select('*')
    .eq('id', rij.subscription_id)
    .maybeSingle<SubRow>()
  if (!sub) return

  const nieuweBedrag = berekenBedrag(sub.plan, sub.cyclus, 'zakelijk')

  // Boekhouding en abonnement meteen bijwerken, ongeacht of de Moneybird-facturering lukt:
  // de betaling is binnen, de klant is nu zakelijk.
  await billingDb
    .from('arnobot_subscriptions')
    .update({ klant_type: 'zakelijk', bedrag_cent: nieuweBedrag.brutoCent, btw_cent: nieuweBedrag.btwCent, updated_at: new Date().toISOString() })
    .eq('id', sub.id)

  const { data: bestaandeKlant } = await billingDb
    .from('arnobot_billing_customers')
    .select('mollie_customer_id')
    .eq('user_id', rij.user_id)
    .maybeSingle<{ mollie_customer_id: string }>()
  const { data: gebruiker } = await billingDb
    .from('approved_users')
    .select('voornaam, email')
    .eq('user_id', rij.user_id)
    .maybeSingle<{ voornaam: string | null; email: string | null }>()

  const mollieKlantId = bestaandeKlant?.mollie_customer_id
    ?? (gebruiker?.email ? (await maakKlant({ naam: rij.bedrijfsnaam, email: gebruiker.email, userId: rij.user_id })).id : null)

  await billingDb.from('arnobot_billing_customers').upsert(
    {
      user_id: rij.user_id,
      ...(mollieKlantId ? { mollie_customer_id: mollieKlantId } : {}),
      klant_type: 'zakelijk',
      bedrijfsnaam: rij.bedrijfsnaam,
      kvk_nummer: rij.kvk_nummer,
      btw_nummer: rij.btw_nummer,
      straat: rij.straat,
      postcode: rij.postcode,
      plaats: rij.plaats,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  )

  await notifyTelegram(`Klanttype-correctie betaald op arno.bot\n\nUser: ${rij.user_id}\nBedrijf: ${rij.bedrijfsnaam}\nVerschil: €${(rij.verschil_cent / 100).toFixed(2)}`)

  if (!factureringToegestaan() || !gebruiker?.email) return

  try {
    const { data: oudeBetaling } = await billingDb
      .from('arnobot_payments')
      .select('moneybird_factuur_id')
      .eq('subscription_id', sub.id)
      .eq('status', 'paid')
      .not('moneybird_factuur_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle<{ moneybird_factuur_id: string }>()

    if (oudeBetaling?.moneybird_factuur_id) {
      await maakCreditnota(oudeBetaling.moneybird_factuur_id, {
        terugbetalingRegistreren: false,
        brutoCent: sub.bedrag_cent,
        betaaldOp: new Date(),
        mollieId: rij.mollie_payment_id ?? mp.id,
        voornaam: gebruiker.voornaam,
        mailen: true,
      })
    }

    const contactId = await zoekOfMaakContact({
      userId: rij.user_id,
      email: gebruiker.email,
      naam: gebruiker.voornaam || gebruiker.email,
      bedrijfsnaam: rij.bedrijfsnaam,
      kvk: rij.kvk_nummer,
      btw: rij.btw_nummer,
      adres: { straat: rij.straat, postcode: rij.postcode, plaats: rij.plaats },
    })

    const periodeStart = sub.periode_start ? new Date(sub.periode_start) : new Date()
    const periodeEinde = sub.periode_einde ? new Date(sub.periode_einde) : new Date()
    const factuur = await maakConceptFactuur({
      contactId,
      referentie: `correctie-${rij.id}`,
      omschrijving: `ArnoBot ${sub.plan === 'premium' ? 'Pro' : 'Basic'} ${sub.cyclus} (gecorrigeerd naar zakelijk)`,
      periodeStart,
      periodeEinde,
      factuurDatum: new Date(),
      brutoCent: nieuweBedrag.brutoCent,
      nettoCent: nieuweBedrag.nettoCent,
      inclusiefBtw: false,
      taxRateId: await btwTariefId(),
      ledgerAccountId: process.env.MONEYBIRD_LEDGER_ACCOUNT_ID,
      workflowId: process.env.MONEYBIRD_WORKFLOW_ID,
    })
    await billingDb.from('arnobot_klanttype_correcties').update({ moneybird_factuur_id: factuur.id }).eq('id', rij.id)
    await verstuurFactuur(factuur.id, 'Email')
  } catch (e) {
    Sentry.captureException(e, { tags: { onderdeel: 'klanttype-correctie-facturatie' } })
    await notifyTelegram(`Klanttype-correctie: Moneybird-afronding mislukt op arno.bot\n\nUser: ${rij.user_id}\nRond handmatig af in Moneybird.`)
  }

  await verstuurBillingMail(rij.user_id, 'betaling_bevestiging', {
    planNaam: `${sub.plan === 'premium' ? 'Pro' : 'Basic'} (zakelijk)`,
    bedragCent: nieuweBedrag.brutoCent,
    btwCent: nieuweBedrag.btwCent,
    datum: sub.periode_einde ?? new Date().toISOString(),
    eerste: false,
    betaalId: mp.id,
  })
}

/** Start de correctie: maakt de rij en de Mollie-betaallink voor het verschilbedrag. */
export async function startKlanttypeCorrectie(input: {
  userId: string
  sub: SubRow
  payment: PayRow
  bedrijfsnaam: string
  kvkNummer: string
  btwNummer: string
  straat: string
  postcode: string
  plaats: string
}): Promise<{ checkoutUrl: string } | { fout: string }> {
  const nieuweBedrag = berekenBedrag(input.sub.plan, input.sub.cyclus, 'zakelijk')
  const verschilCent = nieuweBedrag.brutoCent - input.sub.bedrag_cent
  if (verschilCent <= 0) return { fout: 'Er is geen verschil te corrigeren voor dit abonnement' }

  const { data: rij, error } = await billingDb
    .from('arnobot_klanttype_correcties')
    .insert({
      user_id: input.userId,
      subscription_id: input.sub.id,
      verschil_cent: verschilCent,
      btw_cent: nieuweBedrag.btwCent - input.payment.btw_cent,
      bedrijfsnaam: input.bedrijfsnaam,
      kvk_nummer: input.kvkNummer,
      btw_nummer: input.btwNummer,
      straat: input.straat,
      postcode: input.postcode,
      plaats: input.plaats,
    })
    .select('id')
    .single<{ id: string }>()
  if (error || !rij) return { fout: 'Aanmaken van de correctie is niet gelukt' }

  try {
    const link = await maakBetaalLink({
      brutoCent: verschilCent,
      omschrijving: 'ArnoBot, correctie particulier naar zakelijk',
      redirectUrl: `${SITE_URL}/bot/account/zakelijk-corrigeren?betaling=terug`,
      webhookUrl: `${SITE_URL}/api/webhooks/mollie-correctie`,
      metadata: { correctieId: rij.id, userId: input.userId },
      idempotencyKey: `correctie-${rij.id}`,
    })
    await billingDb.from('arnobot_klanttype_correcties').update({ mollie_payment_id: link.id }).eq('id', rij.id)
    return { checkoutUrl: link.url }
  } catch (e) {
    Sentry.captureException(e, { tags: { onderdeel: 'klanttype-correctie-start' } })
    return { fout: 'Betaling starten is niet gelukt, probeer het later opnieuw of mail admin@arno.bot' }
  }
}
