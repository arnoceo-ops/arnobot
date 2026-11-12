import * as Sentry from '@sentry/nextjs'
import { billingDb, type PayRow, type SubRow } from './db'
import {
  haalAbonnement,
  haalBetaling,
  maakAbonnement,
  MollieError,
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
  eerstePeriodeStart,
  voegMaandenToe,
} from './perioden'
import { verstuurBillingMail } from './mails'
import { creditnotaVoorBetaling, factureerBetaling } from './facturatie'
import { notifyTelegram } from '@/lib/cron-notify'
import { trialEinde } from '@/lib/toegang'

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
      if (!s) {
        // Eerste betaling van een GEPLAND abonnement (overstap): het id staat nog in de gepland-kolom.
        const gepland = await billingDb
          .from('arnobot_subscriptions')
          .select('*')
          .eq('gepland_mollie_subscription_id', mp.subscriptionId)
          .maybeSingle<SubRow>()
        s = gepland.data
      }
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
    // Een betaling van het geplande abonnement moet exact het geplande bedrag zijn, en krijgt de
    // geplande btw (de rij heeft tot de omzetting nog de oude waarden). Klopt het bedrag niet, dan
    // verwerken we niets en melden het: een afwijking is een zaak voor Arno, niet voor een gok.
    const geplandeBetaling = isGeplandeBetaling(s, mp)
    if (geplandeBetaling && mollieNaarCenten(mp.amount.value) !== s.gepland_bedrag_cent) {
      Sentry.captureException(new Error('Betaling van geplande wijziging heeft een afwijkend bedrag'), { tags: { onderdeel: 'billing-gepland-bedrag' } })
      await notifyTelegram(`Betaling van een geplande abonnementswijziging heeft een afwijkend bedrag op arno.bot\n\nUser: ${s.user_id}\nBetaling: ${mp.id}\nVerwacht: €${((s.gepland_bedrag_cent ?? 0) / 100).toFixed(2)}, ontvangen: €${(mollieNaarCenten(mp.amount.value) / 100).toFixed(2)}\nEr is niets verwerkt. Beoordeel handmatig.`)
      return
    }
    await billingDb.from('arnobot_payments').upsert(
      {
        user_id: s.user_id,
        subscription_id: s.id,
        mollie_payment_id: mp.id,
        soort: 'herhaling',
        status: mp.status,
        bedrag_cent: mollieNaarCenten(mp.amount.value),
        btw_cent: geplandeBetaling ? (s.gepland_btw_cent ?? s.btw_cent) : s.btw_cent,
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

    // Betaalt iemand tijdens de proefperiode, dan gaat het abonnement pas in op het einde daarvan.
    const { data: gebruiker } = await billingDb
      .from('approved_users')
      .select('trial_start, paid_at, expires_at')
      .eq('user_id', sub.user_id)
      .maybeSingle()
    const start = eerstePeriodeStart(betaaldOp, gebruiker ? trialEinde(gebruiker, betaaldOp) : null)
    const einde = eersteperiodeEinde(start, sub.cyclus)
    const contract = contractEinde(start, sub.klant_type, sub.cyclus)
    await billingDb
      .from('arnobot_subscriptions')
      .update({
        status: 'active',
        periode_start: iso(start),
        periode_einde: iso(einde),
        contract_einde: contract ? iso(contract) : null,
        updated_at: iso(new Date()),
      })
      .eq('id', sub.id)

    await maakMollieAbonnementVoor({ ...sub, periode_einde: iso(einde) }, start)

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
    await factureerBetaling(rij.id)
    return
  }

  // Herhaalbetaling: de periode schuift door vanaf het vorige einde, niet vanaf het
  // betaalmoment, zodat een iets late betaling de cyclus niet laat verschuiven.
  if (sub.status === 'refunded' || sub.status === 'ended' || sub.status === 'abandoned') {
    console.warn('[billing] herhaalbetaling op beëindigd abonnement genegeerd', sub.id, mp.id)
    await notifyTelegram(`Betaling op beëindigd abonnement (${sub.status}) ontvangen op arno.bot\nBetaling: ${mp.id}\nUser: ${sub.user_id}\nBeoordeel handmatig of terugbetalen nodig is.`)
    return
  }
  // Een betaling van een gepland abonnement op een inmiddels OPGEZEGD abonnement (de stop kwam te
  // laat of mislukte): niet omzetten en niet verlengen, de klant heeft opgezegd. Melden, zodat
  // Arno beslist over terugbetalen.
  if (sub.status === 'cancelled' && isGeplandeBetaling(sub, mp)) {
    await notifyTelegram(`Betaling van een geplande wijziging ontvangen na opzegging op arno.bot\n\nUser: ${sub.user_id}\nBetaling: ${mp.id}\nDe periode is NIET verlengd. Beoordeel of terugbetalen nodig is.`)
    return
  }

  // Eerste betaling van een gepland abonnement: eerst de rij omzetten (plan, cyclus, bedrag, btw,
  // Mollie-id), pas daarna de periode verlengen. Anders telt de verkeerde periodelengte mee.
  let huidig = sub
  if (isGeplandeBetaling(sub, mp)) huidig = await zetGeplandeWijzigingOm(sub)

  // Een betaling van een door een overstap of verlenging VERVANGEN abonnement met een ander bedrag
  // dan het huidige: de periodelengte is dan niet te raden (na een omzetting is de cyclus van de rij
  // al de nieuwe). Niet verlengen, melden. Gelijk bedrag (de gewone verlenging) loopt zoals vroeger.
  if (
    mp.subscriptionId &&
    huidig.mollie_subscription_id &&
    mp.subscriptionId !== huidig.mollie_subscription_id &&
    mollieNaarCenten(mp.amount.value) !== huidig.bedrag_cent
  ) {
    console.warn('[billing] betaling van vervangen abonnement met afwijkend bedrag niet verwerkt', huidig.id, mp.id)
    await notifyTelegram(`Betaling van een vervangen abonnement met een afwijkend bedrag op arno.bot\n\nUser: ${huidig.user_id}\nBetaling: ${mp.id}\nBedrag: €${(mollieNaarCenten(mp.amount.value) / 100).toFixed(2)}, huidig abonnement: €${(huidig.bedrag_cent / 100).toFixed(2)}\nDe periode is NIET verlengd. Beoordeel handmatig.`)
    return
  }

  const huidigEinde = huidig.periode_einde ? new Date(huidig.periode_einde) : betaaldOp
  const nieuwEinde = voegMaandenToe(huidigEinde, periodeMaanden(huidig.cyclus))
  await billingDb
    .from('arnobot_subscriptions')
    .update({ periode_start: iso(huidigEinde), periode_einde: iso(nieuwEinde), updated_at: iso(new Date()) })
    .eq('id', huidig.id)

  await zetToegang(huidig.user_id, huidig.plan, nieuwEinde, { eerste: false, betaaldOp })

  // Opgezegd, en dit was de laatste betaling die nog verschuldigd was: abonnement stoppen.
  if (
    huidig.opzegging_ingaat_at &&
    huidig.mollie_subscription_id &&
    !huidig.mollie_sub_geannuleerd_at &&
    moetMollieAbonnementNuStoppen(nieuwEinde, new Date(huidig.opzegging_ingaat_at))
  ) {
    await stopMollieAbonnement(huidig)
  }

  await verstuurBillingMail(huidig.user_id, 'betaling_bevestiging', {
    planNaam: planNaam(huidig.plan),
    bedragCent: rij.bedrag_cent,
    btwCent: rij.btw_cent,
    datum: iso(nieuwEinde),
    eerste: false,
    betaalId: mp.id,
  })
  await factureerBetaling(rij.id)
}

/** Hoort deze betaling bij het GEPLANDE Mollie-abonnement van de rij (de eerste na een overstap)? */
function isGeplandeBetaling(sub: SubRow, mp: MolliePayment): boolean {
  return !!sub.gepland_mollie_subscription_id && mp.subscriptionId === sub.gepland_mollie_subscription_id
}

/**
 * Zet een geplande wijziging om naar de huidige waarden: plan, cyclus, bedrag, btw en het
 * Mollie-abonnement-id worden die van het geplande abonnement, de guard van het oude abonnement
 * wordt vrijgegeven en alle gepland-kolommen worden leeg. Atomair: de update werkt alleen zolang
 * het geplande id er nog staat, dus twee gelijktijdige verwerkingen leveren één omzetting op; de
 * andere krijgt de al omgezette rij terug. Geeft de bijgewerkte rij.
 */
async function zetGeplandeWijzigingOm(sub: SubRow): Promise<SubRow> {
  const geplandId = sub.gepland_mollie_subscription_id
  if (!geplandId) return sub
  const nu = iso(new Date())
  const nieuweCyclus = sub.gepland_cyclus ?? sub.cyclus
  const patch: Record<string, unknown> = {
    plan: sub.gepland_plan ?? sub.plan,
    cyclus: nieuweCyclus,
    bedrag_cent: sub.gepland_bedrag_cent ?? sub.bedrag_cent,
    btw_cent: sub.gepland_btw_cent ?? sub.btw_cent,
    mollie_subscription_id: geplandId,
    mollie_sub_geannuleerd_at: null,
    gepland_plan: null,
    gepland_cyclus: null,
    gepland_bedrag_cent: null,
    gepland_btw_cent: null,
    gepland_mollie_subscription_id: null,
    gepland_mollie_sub_geannuleerd_at: null,
    gepland_ingangs_at: null,
    gepland_at: null,
    updated_at: nu,
  }
  // Een particulier die van maand naar jaar gaat krijgt een jaarcontract met verlengvraag aan het
  // einde; alleen dat geval heeft een contracteinde (zie contractEinde in perioden.ts).
  if (sub.klant_type === 'particulier' && sub.cyclus === 'maandelijks' && nieuweCyclus === 'jaarlijks') {
    const start = sub.periode_einde ? new Date(sub.periode_einde) : new Date()
    patch.contract_einde = iso(voegMaandenToe(start, 12))
    patch.herinnering_30_at = null
    patch.herinnering_7_at = null
  }
  const { data } = await billingDb
    .from('arnobot_subscriptions')
    .update(patch)
    .eq('id', sub.id)
    .eq('gepland_mollie_subscription_id', geplandId)
    .select('*')
    .returns<SubRow[]>()
  if (data?.length === 1) return data[0]
  // Een gelijktijdige verwerking was ons voor: de actuele rij ophalen.
  const { data: actueel } = await billingDb.from('arnobot_subscriptions').select('*').eq('id', sub.id).maybeSingle<SubRow>()
  return actueel ?? sub
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
  await creditnotaVoorBetaling(rij.id)
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

/**
 * Stopt één Mollie-abonnement, vraagt Mollie of het echt gestopt is en legt het pas dan vast in
 * de guardkolom. Zo betekent "guardkolom gezet" altijd "Mollie bevestigt: gestopt", en blijft
 * een mislukte of onbevestigde stop opnieuw te proberen. Geeft true bij een bevestigde stop.
 */
export async function stopEnBevestig(
  sub: SubRow,
  abonnementId: string,
  // 'ongeregistreerd': een zojuist aangemaakt abonnement dat (nog) nergens in de rij staat, bijvoorbeeld
  // bij het terugdraaien van een mislukte stap. Er wordt dan geen guardkolom gezet.
  soort: 'huidig' | 'gepland' | 'ongeregistreerd',
): Promise<boolean> {
  const kolom = soort === 'huidig' ? 'mollie_sub_geannuleerd_at' : soort === 'gepland' ? 'gepland_mollie_sub_geannuleerd_at' : null
  const label = soort === 'huidig' ? 'Mollie-abonnement' : soort === 'gepland' ? 'Gepland Mollie-abonnement' : 'Nieuw aangemaakt Mollie-abonnement'
  try {
    await stopAbonnement(sub.mollie_customer_id, abonnementId)
    // Bevestigen: een abonnement dat Mollie niet meer kent (404, 410) telt als gestopt.
    const ms = await haalAbonnement(sub.mollie_customer_id, abonnementId).catch(e => {
      if (e instanceof MollieError && (e.status === 404 || e.status === 410)) return null
      throw e
    })
    if (ms && ms.status !== 'canceled' && ms.status !== 'completed') {
      throw new Error(`Mollie meldt na het stoppen nog status ${ms.status}`)
    }
    if (kolom) {
      const nu = iso(new Date())
      await billingDb.from('arnobot_subscriptions').update({ [kolom]: nu, updated_at: nu }).eq('id', sub.id)
    }
    return true
  } catch (e) {
    Sentry.captureException(e, { tags: { onderdeel: 'billing-abonnement-stoppen' } })
    await notifyTelegram(`${label} stoppen mislukt of niet bevestigd op arno.bot\n\nUser: ${sub.user_id}\nAbonnement: ${abonnementId}\nStop het handmatig in het Mollie-dashboard.`)
    return false
  }
}

/**
 * Stopt het huidige én het geplande Mollie-abonnement van een rij, elk onafhankelijk met een eigen
 * guardkolom (een mislukte stop van het ene houdt de andere niet tegen). Geeft true als er niets
 * meer openstaat; false als een stop mislukte of niet bevestigd is. Bestaande aanroepers mogen de
 * waarde negeren.
 */
export async function stopMollieAbonnement(sub: SubRow): Promise<boolean> {
  let alles = true
  if (sub.mollie_subscription_id && !sub.mollie_sub_geannuleerd_at) {
    alles = (await stopEnBevestig(sub, sub.mollie_subscription_id, 'huidig')) && alles
  }
  if (
    sub.gepland_mollie_subscription_id &&
    !sub.gepland_mollie_sub_geannuleerd_at &&
    sub.gepland_mollie_subscription_id !== sub.mollie_subscription_id
  ) {
    alles = (await stopEnBevestig(sub, sub.gepland_mollie_subscription_id, 'gepland')) && alles
  }
  return alles
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
