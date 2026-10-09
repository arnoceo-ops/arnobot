import * as Sentry from '@sentry/nextjs'
import { billingDb, type PayRow, type SubRow } from './db'
import {
  haalBetaling,
  maakAbonnement,
  stopAbonnement,
  type MolliePayment,
} from './mollie'
import { mollieNaarCenten } from './geld'
import { planNaam } from './prijzen'
import {
  abonnementNaEerstebetaling,
  contractEinde,
  eersteperiodeEinde,
  moetMollieAbonnementNuStoppen,
  periodeMaanden,
  toegangTot,
  voegMaandenToe,
} from './perioden'
import { verstuurBillingMail } from './mails'
import { notifyTelegram } from '@/lib/cron-notify'

// Kern van de betaalverwerking. Wordt aangeroepen door de Mollie-webhook en is volledig
// idempotent: dezelfde betaling twee keer verwerken heeft geen dubbele gevolgen, omdat
// elke bijwerking pas gebeurt nadat deze functie `verwerkt_at` als eerste heeft gezet.

const iso = (d: Date) => d.toISOString()

export async function verwerkMolliebetaling(mollieId: string): Promise<void> {
  // Mollie stuurt alleen een id. De betaling zelf halen we altijd bij Mollie op, zo kan
  // niemand via een nagemaakte webhook-aanroep een betaling "betaald" laten lijken.
  const mp = await haalBetaling(mollieId)

  let { data: rij } = await billingDb
    .from('arnobot_payments')
    .select('*')
    .eq('mollie_payment_id', mp.id)
    .maybeSingle<PayRow>()

  let sub: SubRow | null = null

  if (!rij) {
    // Herhaalbetaling uit een Mollie-abonnement: koppelen via subscriptionId.
    if (!mp.subscriptionId && !mp.metadata?.subscriptionRowId) {
      console.warn('[billing] onbekende betaling zonder abonnement', mp.id)
      return
    }
    let s: SubRow | null = null
    if (mp.subscriptionId) {
      const res = await billingDb
        .from('arnobot_subscriptions')
        .select('*')
        .eq('mollie_subscription_id', mp.subscriptionId)
        .maybeSingle<SubRow>()
      s = res.data
    }
    if (!s) {
      // Een eerder, door verlenging vervangen Mollie-abonnement heeft nog betalingen
      // openstaan: terugvallen op de rij-id die we zelf in de metadata hebben gezet.
      const rijId = typeof mp.metadata?.subscriptionRowId === 'string' ? mp.metadata.subscriptionRowId : null
      if (rijId) {
        const res = await billingDb.from('arnobot_subscriptions').select('*').eq('id', rijId).maybeSingle<SubRow>()
        s = res.data
      }
    }
    if (!s) {
      console.warn('[billing] betaling voor onbekend abonnement', mp.id, mp.subscriptionId)
      return
    }
    sub = s
    await billingDb.from('arnobot_payments').upsert(
      {
        user_id: s.user_id,
        subscription_id: s.id,
        mollie_payment_id: mp.id,
        soort: 'herhaling',
        status: mp.status,
        bedrag_cent: mollieNaarCenten(mp.amount.value),
        btw_cent: s.btw_cent,
      },
      { onConflict: 'mollie_payment_id', ignoreDuplicates: true },
    )
    const { data: nieuw } = await billingDb
      .from('arnobot_payments')
      .select('*')
      .eq('mollie_payment_id', mp.id)
      .maybeSingle<PayRow>()
    rij = nieuw
  } else if (rij.subscription_id) {
    const { data: s } = await billingDb
      .from('arnobot_subscriptions')
      .select('*')
      .eq('id', rij.subscription_id)
      .maybeSingle<SubRow>()
    sub = s
  }

  if (!rij || !sub) return

  const terugbetaald = mp.amountRefunded ? mollieNaarCenten(mp.amountRefunded.value) : 0
  const teruggeboekt = mp.amountChargedBack ? mollieNaarCenten(mp.amountChargedBack.value) : 0

  await billingDb
    .from('arnobot_payments')
    .update({
      status: mp.status,
      betaald_at: mp.paidAt ?? null,
      terugbetaald_cent: terugbetaald,
      teruggeboekt_cent: teruggeboekt,
      updated_at: iso(new Date()),
    })
    .eq('id', rij.id)

  if (mp.status === 'paid') {
    if (await claim(rij.id, 'verwerkt_at')) await rondBetalingAf(sub, rij, mp)
  } else if (mp.status === 'failed' || mp.status === 'canceled' || mp.status === 'expired') {
    if (await claim(rij.id, 'verwerkt_at')) await verwerkMislukteBetaling(sub, rij)
  }

  const volledig = terugbetaald >= rij.bedrag_cent || teruggeboekt > 0
  if (volledig && (await claim(rij.id, 'terugbetaling_verwerkt_at'))) {
    await verwerkVolledigeTerugbetaling(sub, rij, terugbetaald, teruggeboekt > 0)
  }
}

/**
 * Beëindigt toegang en abonnement na een volledige terugbetaling die Mollie heeft
 * aangenomen, ook als die nog 'pending' is (kaart en iDEAL kunnen uren tot dagen duren, de
 * klant mag in die tijd geen toegang meer hebben). Idempotent via terugbetaling_verwerkt_at.
 */
export async function markeerTerugbetaald(payRowId: string): Promise<boolean> {
  const { data: rij } = await billingDb.from('arnobot_payments').select('*').eq('id', payRowId).maybeSingle<PayRow>()
  if (!rij || !rij.subscription_id) return false
  const { data: sub } = await billingDb.from('arnobot_subscriptions').select('*').eq('id', rij.subscription_id).maybeSingle<SubRow>()
  if (!sub) return false
  if (!(await claim(rij.id, 'terugbetaling_verwerkt_at'))) return false
  await verwerkVolledigeTerugbetaling(sub, rij, rij.bedrag_cent, false)
  return true
}

/** Zet `kolom` atomair; true als deze aanroep de eerste was. */
async function claim(payId: string, kolom: 'verwerkt_at' | 'terugbetaling_verwerkt_at'): Promise<boolean> {
  const { data } = await billingDb
    .from('arnobot_payments')
    .update({ [kolom]: iso(new Date()) })
    .eq('id', payId)
    .is(kolom, null)
    .select('id')
  return (data?.length ?? 0) === 1
}

async function rondBetalingAf(sub: SubRow, rij: PayRow, mp: MolliePayment): Promise<void> {
  const betaaldOp = mp.paidAt ? new Date(mp.paidAt) : new Date()
  const naam = planNaam(sub.plan)

  if (rij.soort === 'eerste') {
    await beeindigAndereAbonnementen(sub)

    const einde = eersteperiodeEinde(betaaldOp, sub.cyclus)
    const contract = contractEinde(betaaldOp, sub.klant_type)
    await billingDb
      .from('arnobot_subscriptions')
      .update({
        status: 'active',
        periode_start: iso(betaaldOp),
        periode_einde: iso(einde),
        contract_einde: contract ? iso(contract) : null,
        updated_at: iso(new Date()),
      })
      .eq('id', sub.id)

    await maakMollieAbonnementVoor({ ...sub, periode_einde: iso(einde) }, betaaldOp)

    await zetToegang(sub.user_id, sub.plan, einde, { eerste: true, betaaldOp })
    await zetReferralConversie(sub.user_id, sub.plan)

    await verstuurBillingMail(sub.user_id, 'betaling_bevestiging', {
      planNaam: naam,
      bedragCent: rij.bedrag_cent,
      btwCent: rij.btw_cent,
      datum: iso(einde),
      eerste: true,
      betaalId: mp.id,
    })
    await notifyTelegram(`Nieuw betaald abonnement op arno.bot\n\n${naam} ${sub.cyclus}, ${sub.klant_type}\nBedrag: €${(rij.bedrag_cent / 100).toFixed(2)}\nUser: ${sub.user_id}`)
    return
  }

  // Herhaalbetaling: de periode schuift door vanaf het vorige einde, niet vanaf het
  // betaalmoment, zodat een iets late betaling de cyclus niet laat verschuiven.
  if (sub.status === 'refunded' || sub.status === 'ended' || sub.status === 'abandoned') {
    console.warn('[billing] herhaalbetaling op beëindigd abonnement genegeerd', sub.id, mp.id)
    await notifyTelegram(`Betaling op beëindigd abonnement (${sub.status}) ontvangen op arno.bot\nBetaling: ${mp.id}\nUser: ${sub.user_id}\nBeoordeel handmatig of terugbetalen nodig is.`)
    return
  }
  const huidigEinde = sub.periode_einde ? new Date(sub.periode_einde) : betaaldOp
  const nieuwEinde = voegMaandenToe(huidigEinde, periodeMaanden(sub.cyclus))
  await billingDb
    .from('arnobot_subscriptions')
    .update({ periode_start: iso(huidigEinde), periode_einde: iso(nieuwEinde), updated_at: iso(new Date()) })
    .eq('id', sub.id)

  await zetToegang(sub.user_id, sub.plan, nieuwEinde, { eerste: false, betaaldOp })

  // Opgezegd, en dit was de laatste betaling die nog verschuldigd was: abonnement stoppen.
  if (
    sub.opzegging_ingaat_at &&
    sub.mollie_subscription_id &&
    !sub.mollie_sub_geannuleerd_at &&
    moetMollieAbonnementNuStoppen(nieuwEinde, new Date(sub.opzegging_ingaat_at))
  ) {
    await stopMollieAbonnement(sub)
  }

  await verstuurBillingMail(sub.user_id, 'betaling_bevestiging', {
    planNaam: naam,
    bedragCent: rij.bedrag_cent,
    btwCent: rij.btw_cent,
    datum: iso(nieuwEinde),
    eerste: false,
    betaalId: mp.id,
  })
}

async function verwerkMislukteBetaling(sub: SubRow, rij: PayRow): Promise<void> {
  if (rij.soort === 'eerste') {
    // Eerste betaling niet gelukt of afgebroken: niets activeren, rij opruimen zodat een
    // nieuwe poging een nieuw abonnement-record maakt.
    if (sub.status === 'pending') {
      await billingDb
        .from('arnobot_subscriptions')
        .update({ status: 'abandoned', updated_at: iso(new Date()) })
        .eq('id', sub.id)
    }
    return
  }
  const einde = sub.periode_einde ?? iso(new Date())
  await verstuurBillingMail(sub.user_id, 'betaling_mislukt', { planNaam: planNaam(sub.plan), datum: einde })
  await notifyTelegram(`Herhaalbetaling mislukt op arno.bot\n\nUser: ${sub.user_id}\nPlan: ${planNaam(sub.plan)} ${sub.cyclus}\nToegang loopt tot ${einde.slice(0, 10)}`)
}

async function verwerkVolledigeTerugbetaling(
  sub: SubRow,
  rij: PayRow,
  terugbetaaldCent: number,
  isChargeback: boolean,
): Promise<void> {
  await stopMollieAbonnement(sub)
  await billingDb
    .from('arnobot_subscriptions')
    .update({ status: 'refunded', updated_at: iso(new Date()) })
    .eq('id', sub.id)
  // Toegang direct beëindigen: expires_at in het verleden, proxy.ts doet de rest.
  await billingDb
    .from('approved_users')
    .update({ expires_at: iso(new Date(Date.now() - 1000)) })
    .eq('user_id', sub.user_id)

  if (isChargeback) {
    await notifyTelegram(`CHARGEBACK op arno.bot\n\nUser: ${sub.user_id}\nBetaling: ${rij.mollie_payment_id}\nToegang is beëindigd.`)
    return
  }
  await verstuurBillingMail(sub.user_id, 'terugbetaling_bevestiging', { bedragCent: terugbetaaldCent || rij.bedrag_cent })
  await notifyTelegram(`Terugbetaling verwerkt op arno.bot\n\nUser: ${sub.user_id}\nBetaling: ${rij.mollie_payment_id}`)
}

/** Een nieuwe eerste betaling vervangt eventuele eerdere lopende abonnementen van dezelfde gebruiker. */
async function beeindigAndereAbonnementen(sub: SubRow): Promise<void> {
  const { data: anderen } = await billingDb
    .from('arnobot_subscriptions')
    .select('*')
    .eq('user_id', sub.user_id)
    .neq('id', sub.id)
    .in('status', ['active', 'pending', 'cancelled'])
    .returns<SubRow[]>()
  for (const a of anderen ?? []) {
    await stopMollieAbonnement(a)
    await billingDb
      .from('arnobot_subscriptions')
      .update({ status: 'ended', updated_at: iso(new Date()) })
      .eq('id', a.id)
  }
}

/** Maakt het Mollie-abonnement dat bij een afgeronde eerste betaling hoort (indien nodig). */
export async function maakMollieAbonnementVoor(sub: SubRow, startVan: Date): Promise<void> {
  const plan = abonnementNaEerstebetaling(startVan, sub.cyclus, sub.klant_type)
  if (!plan.interval || !plan.startDatum) return
  if (sub.mollie_subscription_id) return
  try {
    const ms = await maakAbonnement({
      klantId: sub.mollie_customer_id,
      brutoCent: sub.bedrag_cent,
      interval: plan.interval,
      times: plan.times,
      // Mollie eist een startdatum in de toekomst; bij herstel door de cron kan de geplande
      // datum al voorbij zijn.
      startDatum: plan.startDatum.getTime() > Date.now() ? plan.startDatum : new Date(Date.now() + 24 * 60 * 60 * 1000),
      omschrijving: `ArnoBot ${planNaam(sub.plan)} ${sub.cyclus}`,
      metadata: { userId: sub.user_id, subscriptionRowId: sub.id },
      idempotencyKey: `sub-${sub.id}`,
    })
    await billingDb
      .from('arnobot_subscriptions')
      .update({ mollie_subscription_id: ms.id, updated_at: iso(new Date()) })
      .eq('id', sub.id)
  } catch (e) {
    // De eerste betaling is binnen en de gebruiker heeft toegang. Het abonnement kan de
    // dagelijkse billing-cron alsnog aanmaken. Wel melden, anders merkt niemand het.
    Sentry.captureException(e, { tags: { onderdeel: 'billing-abonnement-aanmaken' } })
    await notifyTelegram(`Mollie-abonnement aanmaken mislukt op arno.bot\n\nUser: ${sub.user_id}\nDe billing-cron probeert het opnieuw.`)
  }
}

export async function stopMollieAbonnement(sub: SubRow): Promise<void> {
  if (!sub.mollie_subscription_id || sub.mollie_sub_geannuleerd_at) return
  try {
    await stopAbonnement(sub.mollie_customer_id, sub.mollie_subscription_id)
    await billingDb
      .from('arnobot_subscriptions')
      .update({ mollie_sub_geannuleerd_at: iso(new Date()), updated_at: iso(new Date()) })
      .eq('id', sub.id)
  } catch (e) {
    Sentry.captureException(e, { tags: { onderdeel: 'billing-abonnement-stoppen' } })
    await notifyTelegram(`Mollie-abonnement stoppen mislukt op arno.bot\n\nUser: ${sub.user_id}\nAbonnement: ${sub.mollie_subscription_id}\nStop het handmatig in het Mollie-dashboard.`)
  }
}

/** Toegang volgt de betaalde periode: approved_users.expires_at is het enige dat proxy.ts leest. */
async function zetToegang(
  userId: string,
  plan: SubRow['plan'],
  periodeEinde: Date,
  opties: { eerste: boolean; betaaldOp: Date },
): Promise<void> {
  const update: Record<string, unknown> = {
    plan,
    is_active: true,
    expires_at: iso(toegangTot(periodeEinde)),
  }
  if (opties.eerste) {
    update.paid_at = iso(opties.betaaldOp)
    update.cancelled_at = null
  }
  await billingDb.from('approved_users').update(update).eq('user_id', userId)
}

// Zelfde regel als /api/admin/payment: alleen Pro/Team-conversies tellen voor referrals.
async function zetReferralConversie(userId: string, plan: SubRow['plan']): Promise<void> {
  if (plan !== 'premium') return
  await billingDb
    .from('arnobot_referrals')
    .update({ status: 'converted' })
    .eq('referred_user_id', userId)
    .eq('status', 'signed_up')
}
