import * as Sentry from '@sentry/nextjs'
import { billingDb, type PayRow, type SubRow } from './db'
import {
  btwTariefId,
  maakCreditnota,
  maakEnVerstuurFactuur,
  moneybirdIngeschakeld,
  registreerBetaling,
  zoekOfMaakContact,
} from './moneybird'
import { planNaam } from './prijzen'
import { notifyTelegram } from '@/lib/cron-notify'

// Koppelt een verwerkte Mollie-betaling aan een Moneybird-factuur. Een mislukte factuur mag
// nooit een betaalverwerking breken: fouten worden gemeld en de dagelijkse billing-cron
// probeert het opnieuw (zie factureerOpenstaandeBetalingen).
//
// VOORBEREIDING (fase 2): staat uit zolang Moneybird niet is geconfigureerd.

const BEZIG = 'bezig'

/** Maakt voor een betaling een factuur, als die er nog niet is. Idempotent via moneybird_factuur_id. */
/**
 * Testbetalingen (Mollie test_-sleutel) maken standaard GEEN factuur: anders belanden nepfacturen
 * in je echte Moneybird-administratie. Wil je de koppeling in de proefperiode juist met
 * testbetalingen uitproberen, zet dan MONEYBIRD_OOK_IN_TESTMODUS=true.
 */
function factureringToegestaan(): boolean {
  if (!moneybirdIngeschakeld()) return false
  const testmodus = process.env.MOLLIE_API_KEY?.startsWith('test_')
  return !testmodus || process.env.MONEYBIRD_OOK_IN_TESTMODUS === 'true'
}

export async function factureerBetaling(payRowId: string): Promise<void> {
  if (!factureringToegestaan()) return

  // Atomair claimen: alleen wie de lege kolom als eerste op 'bezig' zet, maakt de factuur.
  const { data: geclaimd } = await billingDb
    .from('arnobot_payments')
    .update({ moneybird_factuur_id: BEZIG })
    .eq('id', payRowId)
    .is('moneybird_factuur_id', null)
    .select('*')
    .returns<PayRow[]>()
  const rij = geclaimd?.[0]
  if (!rij || !rij.subscription_id) return

  try {
    const { data: sub } = await billingDb
      .from('arnobot_subscriptions')
      .select('*')
      .eq('id', rij.subscription_id)
      .maybeSingle<SubRow>()
    const { data: user } = await billingDb
      .from('approved_users')
      .select('voornaam, email')
      .eq('user_id', rij.user_id)
      .maybeSingle<{ voornaam: string | null; email: string | null }>()
    const { data: klant } = await billingDb
      .from('arnobot_billing_customers')
      .select('bedrijfsnaam, kvk_nummer, btw_nummer')
      .eq('user_id', rij.user_id)
      .maybeSingle<{ bedrijfsnaam: string | null; kvk_nummer: string | null; btw_nummer: string | null }>()
    if (!sub || !user?.email) throw new Error('Abonnement of e-mailadres ontbreekt voor de factuur')

    const contactId = await zoekOfMaakContact({
      userId: rij.user_id,
      email: user.email,
      naam: user.voornaam || user.email,
      bedrijfsnaam: klant?.bedrijfsnaam,
      kvk: klant?.kvk_nummer,
      btw: klant?.btw_nummer,
    })

    const betaaldOp = rij.betaald_at ? new Date(rij.betaald_at) : new Date()
    const periodeEinde = sub.periode_einde ? new Date(sub.periode_einde) : betaaldOp
    const factuur = await maakEnVerstuurFactuur({
      contactId,
      referentie: rij.mollie_payment_id,
      omschrijving: `ArnoBot ${planNaam(sub.plan)} ${sub.cyclus}`,
      periodeStart: betaaldOp,
      periodeEinde,
      factuurDatum: betaaldOp,
      brutoCent: rij.bedrag_cent,
      nettoCent: rij.bedrag_cent - rij.btw_cent,
      inclusiefBtw: sub.klant_type === 'particulier',
      taxRateId: await btwTariefId(),
      ledgerAccountId: process.env.MONEYBIRD_LEDGER_ACCOUNT_ID,
      workflowId: process.env.MONEYBIRD_WORKFLOW_ID,
    })

    // Betaling afletteren staat bewust achter een eigen schakelaar: de boekhoudkundige
    // afhandeling (betaling zonder bewijs of via een Mollie-rekening) moet eerst met het
    // echte account worden vastgesteld.
    if (process.env.MONEYBIRD_BETALING_REGISTREREN === 'true') {
      await registreerBetaling({ factuurId: factuur.id, betaaldOp, brutoCent: rij.bedrag_cent, mollieId: rij.mollie_payment_id })
    }

    await billingDb.from('arnobot_payments').update({ moneybird_factuur_id: factuur.id }).eq('id', rij.id)
  } catch (e) {
    // Claim vrijgeven zodat de cron het opnieuw kan proberen.
    await billingDb.from('arnobot_payments').update({ moneybird_factuur_id: null }).eq('id', rij.id).eq('moneybird_factuur_id', BEZIG)
    Sentry.captureException(e, { tags: { onderdeel: 'moneybird-factuur' } })
    await notifyTelegram(`Factuur maken in Moneybird mislukt op arno.bot\n\nBetaling: ${rij.mollie_payment_id}\nUser: ${rij.user_id}\nDe billing-cron probeert het opnieuw.`)
  }
}

/** Creditnota bij een volledige terugbetaling, als er een factuur was. */
export async function creditnotaVoorBetaling(payRowId: string): Promise<void> {
  if (!factureringToegestaan()) return
  const { data: rij } = await billingDb
    .from('arnobot_payments')
    .select('moneybird_factuur_id, mollie_payment_id, user_id')
    .eq('id', payRowId)
    .maybeSingle<Pick<PayRow, 'moneybird_factuur_id' | 'mollie_payment_id' | 'user_id'>>()
  if (!rij?.moneybird_factuur_id || rij.moneybird_factuur_id === BEZIG) return
  try {
    await maakCreditnota(rij.moneybird_factuur_id)
  } catch (e) {
    Sentry.captureException(e, { tags: { onderdeel: 'moneybird-creditnota' } })
    await notifyTelegram(`Creditnota maken in Moneybird mislukt op arno.bot\n\nBetaling: ${rij.mollie_payment_id}\nMaak de creditnota handmatig aan.`)
  }
}

/** Voor de cron: betalingen die verwerkt zijn maar nog geen factuur hebben. */
export async function factureerOpenstaandeBetalingen(): Promise<number> {
  if (!factureringToegestaan()) return 0
  // Alleen betalingen vanaf de ingestelde startdatum: zo worden oude (test)betalingen nooit
  // met terugwerkende kracht gefactureerd op het moment dat Moneybird wordt ingeschakeld.
  const vanaf = process.env.MONEYBIRD_FACTUREREN_VANAF
  if (!vanaf) return 0
  const { data } = await billingDb
    .from('arnobot_payments')
    .select('id')
    .eq('status', 'paid')
    .not('verwerkt_at', 'is', null)
    .is('moneybird_factuur_id', null)
    .is('terugbetaling_verwerkt_at', null)
    .gte('betaald_at', vanaf)
    .limit(50)
    .returns<{ id: string }[]>()
  for (const r of data ?? []) await factureerBetaling(r.id)
  return data?.length ?? 0
}
