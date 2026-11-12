import * as Sentry from '@sentry/nextjs'
import { billingDb, type SubRow } from './db'
import { haalAbonnement, heeftGeldigeMachtiging, maakAbonnement, maakLosseHerhaalBetaling, mollieBeschikbaarVoor } from './mollie'
import { abonnementVoorOverstap } from './perioden'
import { berekenBedrag, planNaam, type Bedrag, type Cyclus, type Plan } from './prijzen'
import { berekenUpgradeBedrag } from './upgradeBedrag'
import { heeftOpenstaandeBetaling } from './openstaandeBetaling'
import { stopEnBevestig } from './verwerking'
import { notifyTelegram } from '@/lib/cron-notify'
import { isInternalTestUser } from '@/lib/internalTestAccounts'

// Wijzigingen aan een lopend abonnement (docs/OVERSTAP_PLAN.md):
//  - overstap per einde van de betaalde periode: maand naar jaar (zelfde plan) en Pro naar Basic
//    (zelfde cyclus). Het huidige Mollie-abonnement stopt, een nieuw abonnement start op de volgende
//    incassodatum. De rij houdt tot de eerste betaling van het nieuwe abonnement de oude waarden; de
//    webhook (verwerking.ts) zet dan om.
//  - upgrade van Basic naar Pro, direct: het Pro-abonnement gaat ook per einde van de periode in
//    (zelfde machinerie als de overstap), maar de klant krijgt Pro meteen en betaalt het prijsverschil
//    naar rato direct bij, met een losse vervolgbetaling op de bestaande machtiging.
// Jaar naar maand bestaat niet (besluit Arno, 2026-11-11).

/** Minimaal aantal dagen tussen de overstap en de volgende incasso (schatting, niet bij Mollie geverifieerd). */
export const MIN_DAGEN_VOORAF = 4
/** Hoeveel dagen Mollies volgende incassodatum mag afwijken van onze `periode_einde`. */
export const MAX_AFWIJKING_DAGEN = 3
/** SEPA-standaardlimiet per incasso (docs.mollie.com/docs/sepa-direct-debit): daarboven niet automatisch. */
export const MAX_UPGRADE_CENT = 100000

const DAG_MS = 24 * 60 * 60 * 1000

export interface Wens {
  plan: Plan
  cyclus: Cyclus
}

export type OverstapUitkomst =
  | {
      ok: true
      ingaatOp: string
      plan: Plan
      cyclus: Cyclus
      bedragCent: number
      /** Alleen bij een upgrade: kreeg de klant Pro direct, en hoeveel betaalt hij nu bij? */
      upgrade?: { direct: boolean; bijbetalingCent: number }
    }
  | { ok: false; status: number; fout: string }

/**
 * Wie de overstap mag gebruiken. Tot Arno hem openzet (OVERSTAP_OPEN=true) alleen de eigenaar en de
 * interne testaccounts, bovenop de gewone regel voor online betalen.
 */
export function overstapBeschikbaarVoor(userId: string): boolean {
  if (!mollieBeschikbaarVoor(userId)) return false
  if (process.env.OVERSTAP_OPEN === 'true') return true
  const eigenaar = process.env.ARNOBOT_OWNER_USER_ID
  return isInternalTestUser(userId) || (!!eigenaar && eigenaar === userId)
}

/** Welke wijzigingen per einde van de betaalde periode zijn toegestaan? */
export function isToegestaneOverstap(huidig: Wens, nieuw: Wens): boolean {
  const zelfdePlan = huidig.plan === nieuw.plan
  const zelfdeCyclus = huidig.cyclus === nieuw.cyclus
  if (zelfdePlan && zelfdeCyclus) return false
  // Maand naar jaar, zelfde plan. Jaar naar maand bestaat niet (besluit Arno, 2026-11-11).
  if (zelfdePlan && huidig.cyclus === 'maandelijks' && nieuw.cyclus === 'jaarlijks') return true
  // Pro naar Basic, zelfde cyclus. Basic naar Pro gaat direct en met verrekening (plaatsUpgrade).
  if (zelfdeCyclus && huidig.plan === 'premium' && nieuw.plan === 'basis') return true
  return false
}

const weiger = (status: number, fout: string): OverstapUitkomst => ({ ok: false, status, fout })

export const GEPLAND_LEEG = {
  gepland_plan: null,
  gepland_cyclus: null,
  gepland_bedrag_cent: null,
  gepland_btw_cent: null,
  gepland_mollie_subscription_id: null,
  gepland_mollie_sub_geannuleerd_at: null,
  gepland_ingangs_at: null,
  gepland_at: null,
}

/** Maakt onze eigen claim ongedaan (alleen als hij nog van deze aanvraag is). */
async function herstelClaim(subId: string, claimIso: string): Promise<void> {
  await billingDb
    .from('arnobot_subscriptions')
    .update({ ...GEPLAND_LEEG, updated_at: new Date().toISOString() })
    .eq('id', subId)
    .eq('gepland_at', claimIso)
}

/** Voor Arno: wie stapt over, en is deze klant via een referral binnengekomen (het tegoed is handwerk)? */
async function infoVoorTelegram(userId: string): Promise<string> {
  try {
    const { data: betaald } = await billingDb.from('arnobot_payments').select('id').eq('user_id', userId).eq('status', 'paid')
    const { data: verw } = await billingDb.from('arnobot_referrals').select('status').eq('referred_user_id', userId).maybeSingle<{ status: string }>()
    return `Betalingen tot nu toe: ${betaald?.length ?? 0}\nReferral: ${verw ? `ja, status ${verw.status}` : 'nee'}`
  } catch {
    return 'Betalingen en referral niet op te zoeken'
  }
}

/**
 * Staat de database klaar voor een upgradebetaling? `arnobot_payments.soort` heeft een CHECK-constraint
 * die eerst met 'upgrade' verruimd moet zijn (docs/sql/2026-11-12-betaalsoort-upgrade.sql). Een probe-rij
 * (meteen weer verwijderd) voorkomt dat we een betaling bij Mollie aanmaken die we daarna niet kunnen vastleggen.
 */
async function upgradeSoortBeschikbaar(userId: string, nu: Date): Promise<boolean> {
  const probe = `probe-upgrade-${nu.getTime()}`
  const { error } = await billingDb.from('arnobot_payments').insert({
    user_id: userId, subscription_id: null, mollie_payment_id: probe, soort: 'upgrade', status: 'probe', bedrag_cent: 1, btw_cent: 0,
  })
  if (error) return false
  await billingDb.from('arnobot_payments').delete().eq('mollie_payment_id', probe).eq('user_id', userId)
  return true
}

/** Maakt de bijbetaling bij Mollie aan en legt hem vast. false als de betaling niet aangemaakt kon worden. */
async function maakUpgradeBetaling(sub: SubRow, userId: string, upgrade: Bedrag, claimIso: string): Promise<boolean> {
  try {
    const betaling = await maakLosseHerhaalBetaling({
      klantId: sub.mollie_customer_id,
      brutoCent: upgrade.brutoCent,
      omschrijving: 'ArnoBot upgrade naar Pro, naar rato',
      metadata: { userId, subscriptionRowId: sub.id, soort: 'upgrade' },
      idempotencyKey: `upgrade-${sub.id}-${claimIso}`,
    })
    const { error } = await billingDb.from('arnobot_payments').insert({
      user_id: userId, subscription_id: sub.id, mollie_payment_id: betaling.id, soort: 'upgrade',
      status: betaling.status, bedrag_cent: upgrade.brutoCent, btw_cent: upgrade.btwCent,
    })
    if (error) {
      // De klant is wel belast. De webhook negeert een upgradebetaling zonder rij (en meldt het), dus
      // verwerken we hem niet verkeerd; wel dringend nakijken.
      Sentry.captureException(new Error(error.message), { tags: { onderdeel: 'billing-upgrade-rij' } })
      await notifyTelegram(`UPGRADEBETALING AANGEMAAKT MAAR NIET VASTGELEGD op arno.bot\n\nUser: ${userId}\nBetaling: ${betaling.id}\nBedrag: €${(upgrade.brutoCent / 100).toFixed(2)}\nMaak de rij in arnobot_payments handmatig aan (soort upgrade, abonnement ${sub.id}).`)
    }
    return true
  } catch (e) {
    Sentry.captureException(e, { tags: { onderdeel: 'billing-upgrade-betaling' } })
    return false
  }
}

/** Pro direct: plan op de abonnementsrij en op het account. */
async function zetPlanOpPro(subId: string, userId: string, extra: Record<string, unknown> = {}): Promise<void> {
  await billingDb.from('arnobot_subscriptions').update({ plan: 'premium', ...extra, updated_at: new Date().toISOString() }).eq('id', subId)
  await billingDb.from('approved_users').update({ plan: 'premium' }).eq('user_id', userId)
}

/**
 * Plant een overstap voor het lopende abonnement van `userId`. Weigert (met een duidelijke melding) in
 * alle gevallen waarin het niet veilig kan, en laat dan niets achter. Vaste volgorde, zodat een fout
 * nooit tot een dubbele incasso leidt: claim in de database, nieuw Mollie-abonnement aanmaken, het
 * huidige stoppen en bij Mollie bevestigen; mislukt een stap, dan wordt de vorige teruggedraaid.
 */
export async function plaatsOverstap(userId: string, wens: Wens, nu: Date = new Date()): Promise<OverstapUitkomst> {
  return plaats(userId, wens, nu, 'overstap')
}

/**
 * Upgrade van Basic naar Pro, direct: Pro-toegang meteen, het prijsverschil naar rato direct bijbetaald met
 * een losse incasso op de bestaande machtiging, en het Pro-abonnement gaat per einde van de periode in (de
 * overstapmachinerie). Lukt de bijbetaling niet, dan blijft het bij een overstap per einde van de periode.
 * Mislukt de bijbetaling later, dan zet de webhook het plan terug naar Basic.
 */
export async function plaatsUpgrade(userId: string, nu: Date = new Date()): Promise<OverstapUitkomst> {
  return plaats(userId, null, nu, 'upgrade')
}

async function plaats(userId: string, wens: Wens | null, nu: Date, modus: 'overstap' | 'upgrade'): Promise<OverstapUitkomst> {
  const { data: sub } = await billingDb
    .from('arnobot_subscriptions')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<SubRow>()
  if (!sub || !sub.periode_einde) return weiger(404, 'Geen lopend abonnement gevonden')
  if (sub.gepland_at || sub.gepland_mollie_subscription_id) return weiger(409, 'Er staat al een wijziging gepland')

  const doel: Wens = modus === 'upgrade' ? { plan: 'premium', cyclus: sub.cyclus } : (wens as Wens)
  const toegestaan = modus === 'upgrade' ? sub.plan === 'basis' : isToegestaneOverstap({ plan: sub.plan, cyclus: sub.cyclus }, doel)
  if (!toegestaan) return weiger(400, 'Deze wijziging is niet mogelijk')

  // Particulier jaar heeft geen Mollie-abonnement (één betaling per jaar): een upgrade is dan alleen de
  // bijbetaling en het omzetten van plan en bedrag, er valt niets te vervangen.
  const zonderAbonnement =
    modus === 'upgrade' && sub.cyclus === 'jaarlijks' && sub.klant_type === 'particulier' && !sub.mollie_subscription_id
  if (!zonderAbonnement && (!sub.mollie_subscription_id || sub.mollie_sub_geannuleerd_at)) {
    return weiger(409, 'Dit abonnement kan niet via deze weg worden gewijzigd. Mail naar admin@arno.bot.')
  }
  const periodeEinde = new Date(sub.periode_einde)
  if (periodeEinde.getTime() <= nu.getTime()) return weiger(409, 'Je betaalperiode is afgelopen. Rond eerst je betaling af.')

  const { data: correctie } = await billingDb
    .from('arnobot_klanttype_correcties')
    .select('id')
    .eq('subscription_id', sub.id)
    .eq('status', 'open')
    .limit(1)
  if (correctie?.length) return weiger(409, 'Er staat nog een correctie open. Rond die eerst af.')

  // Controles bij Mollie: machtiging, status van het abonnement en de echte volgende incassodatum.
  let ingang: Date | null = null
  try {
    if (!(await heeftGeldigeMachtiging(sub.mollie_customer_id))) {
      return weiger(409, 'Er is geen geldige betaalmachtiging meer. Rond eerst een nieuwe betaling af.')
    }
    if (!zonderAbonnement) {
      const huidigMollie = await haalAbonnement(sub.mollie_customer_id, sub.mollie_subscription_id as string)
      if (huidigMollie.status !== 'active' || !huidigMollie.nextPaymentDate) {
        return weiger(409, 'Dit abonnement kan nu niet worden gewijzigd. Mail naar admin@arno.bot.')
      }
      ingang = new Date(`${huidigMollie.nextPaymentDate}T00:00:00.000Z`)
      if (Number.isNaN(ingang.getTime())) return weiger(409, 'Dit abonnement kan nu niet worden gewijzigd. Mail naar admin@arno.bot.')
      if ((ingang.getTime() - nu.getTime()) / DAG_MS < MIN_DAGEN_VOORAF) {
        return weiger(409, `Je volgende betaling is binnen ${MIN_DAGEN_VOORAF} dagen. Stap over nadat die betaling is gedaan.`)
      }
      if (Math.abs(ingang.getTime() - periodeEinde.getTime()) / DAG_MS > MAX_AFWIJKING_DAGEN) {
        await notifyTelegram(`Overstap geweigerd: incassodatum wijkt af op arno.bot\n\nUser: ${userId}\nMollie: ${huidigMollie.nextPaymentDate}, onze periode_einde: ${sub.periode_einde.slice(0, 10)}\nBeoordeel handmatig.`)
        return weiger(409, 'Dit abonnement kan niet automatisch worden gewijzigd. Mail naar admin@arno.bot.')
      }
    }
    if (await heeftOpenstaandeBetaling(sub)) {
      return weiger(409, 'Er loopt nog een betaling. Probeer het over een paar dagen opnieuw.')
    }
  } catch (e) {
    Sentry.captureException(e, { tags: { onderdeel: 'billing-overstap-controle' } })
    return weiger(502, 'Controleren bij de betaalprovider is niet gelukt. Probeer het zo opnieuw.')
  }

  // Upgrade: het bedrag dat nu wordt bijbetaald, en of de database klaarstaat voor de betaalsoort.
  let upgrade: Bedrag | null = null
  if (modus === 'upgrade') {
    if (!sub.periode_start) return weiger(409, 'Dit abonnement kan niet automatisch worden gewijzigd. Mail naar admin@arno.bot.')
    upgrade = berekenUpgradeBedrag(sub.klant_type, sub.cyclus, new Date(sub.periode_start), periodeEinde, nu)
    if (upgrade.brutoCent > MAX_UPGRADE_CENT) return weiger(409, 'Dit bedrag kan niet automatisch worden afgeschreven. Mail naar admin@arno.bot.')
    if (upgrade.brutoCent > 0 && !(await upgradeSoortBeschikbaar(userId, nu))) {
      await notifyTelegram(`Upgrade geweigerd: de database kent de betaalsoort upgrade nog niet op arno.bot\n\nVoer docs/sql/2026-11-12-betaalsoort-upgrade.sql uit in Supabase.`)
      return weiger(503, 'Upgraden is nog niet beschikbaar.')
    }
  }

  const bedrag = berekenBedrag(doel.plan, doel.cyclus, sub.klant_type)
  const claimIso = nu.toISOString()
  const datumVandaag = claimIso.slice(0, 10)

  // Particulier jaar: de claim is het omzetten van het plan zelf (alleen als het nog Basic is), zodat twee
  // gelijktijdige aanvragen niet allebei bijbetalen. Mislukt de bijbetaling, dan weer terug naar Basic.
  if (zonderAbonnement && upgrade) {
    const { data: geclaimd } = await billingDb
      .from('arnobot_subscriptions')
      .update({ plan: 'premium', bedrag_cent: bedrag.brutoCent, btw_cent: bedrag.btwCent, updated_at: claimIso })
      .eq('id', sub.id)
      .eq('status', 'active')
      .eq('plan', 'basis')
      .select('id')
    if (geclaimd?.length !== 1) return weiger(409, 'Er is al een wijziging aan de gang')
    if (upgrade.brutoCent > 0 && !(await maakUpgradeBetaling(sub, userId, upgrade, claimIso))) {
      await billingDb
        .from('arnobot_subscriptions')
        .update({ plan: sub.plan, bedrag_cent: sub.bedrag_cent, btw_cent: sub.btw_cent, updated_at: new Date().toISOString() })
        .eq('id', sub.id)
        .eq('plan', 'premium')
      return weiger(502, 'Upgraden is niet gelukt, er is niets gewijzigd. Probeer het zo opnieuw of mail admin@arno.bot.')
    }
    await billingDb.from('approved_users').update({ plan: 'premium' }).eq('user_id', userId)
    await notifyTelegram(`Upgrade naar Pro op arno.bot\n\nUser: ${userId}\nBasic ${sub.cyclus} naar Pro ${sub.cyclus}, ${sub.klant_type}\nBijbetaling: €${(upgrade.brutoCent / 100).toFixed(2)}\n${await infoVoorTelegram(userId)}`).catch(() => {})
    return { ok: true, ingaatOp: datumVandaag, plan: 'premium', cyclus: sub.cyclus, bedragCent: bedrag.brutoCent, upgrade: { direct: true, bijbetalingCent: upgrade.brutoCent } }
  }

  // 1. Claim: voorkomt dubbele overstappen (dubbelklik, twee tabbladen).
  const geplandIngang = ingang as Date
  const { data: geclaimd } = await billingDb
    .from('arnobot_subscriptions')
    .update({
      gepland_plan: doel.plan,
      gepland_cyclus: doel.cyclus,
      gepland_bedrag_cent: bedrag.brutoCent,
      gepland_btw_cent: bedrag.btwCent,
      gepland_ingangs_at: geplandIngang.toISOString(),
      gepland_at: claimIso,
      updated_at: claimIso,
    })
    .eq('id', sub.id)
    .eq('status', 'active')
    .is('gepland_at', null)
    .select('id')
  if (geclaimd?.length !== 1) return weiger(409, 'Er staat al een wijziging gepland')

  // 2. Het nieuwe Mollie-abonnement aanmaken, start op de volgende incassodatum.
  const nieuw = abonnementVoorOverstap(geplandIngang, doel.cyclus, sub.klant_type)
  let nieuwId: string
  try {
    const ms = await maakAbonnement({
      klantId: sub.mollie_customer_id,
      brutoCent: bedrag.brutoCent,
      interval: nieuw.interval,
      times: nieuw.times,
      startDatum: nieuw.startDatum,
      omschrijving: `ArnoBot ${planNaam(doel.plan)} ${doel.cyclus} (overstap)`,
      metadata: { userId, subscriptionRowId: sub.id },
      idempotencyKey: `overstap-${sub.id}-${claimIso}`,
    })
    nieuwId = ms.id
  } catch (e) {
    Sentry.captureException(e, { tags: { onderdeel: 'billing-overstap-aanmaken' } })
    await herstelClaim(sub.id, claimIso)
    return weiger(502, 'Overstappen is niet gelukt, er is niets gewijzigd. Probeer het zo opnieuw of mail admin@arno.bot.')
  }

  const metGeplandId = { ...sub, gepland_mollie_subscription_id: nieuwId }
  const { error: opslaanFout } = await billingDb
    .from('arnobot_subscriptions')
    .update({ gepland_mollie_subscription_id: nieuwId, updated_at: claimIso })
    .eq('id', sub.id)
  if (opslaanFout) {
    // Zonder opgeslagen id is het nieuwe abonnement niet te volgen: meteen weer stoppen.
    Sentry.captureException(new Error(opslaanFout.message), { tags: { onderdeel: 'billing-overstap-opslaan' } })
    if (await stopEnBevestig(metGeplandId, nieuwId, 'gepland')) await herstelClaim(sub.id, claimIso)
    return weiger(502, 'Overstappen is niet gelukt, er is niets gewijzigd. Probeer het zo opnieuw of mail admin@arno.bot.')
  }

  // 3. Het huidige abonnement stoppen en bij Mollie bevestigen. Lukt dat niet, dan het nieuwe weer
  // verwijderen: nooit twee lopende abonnementen laten staan.
  if (!(await stopEnBevestig(sub, sub.mollie_subscription_id as string, 'huidig'))) {
    const teruggedraaid = await stopEnBevestig(metGeplandId, nieuwId, 'gepland')
    if (teruggedraaid) {
      await herstelClaim(sub.id, claimIso)
    } else {
      await notifyTelegram(`OVERSTAP HALF AFGEROND, GEEN DUBBELE INCASSO TOELATEN op arno.bot\n\nUser: ${userId}\nHuidig abonnement: ${sub.mollie_subscription_id}\nNieuw abonnement: ${nieuwId}\nBeide staan mogelijk actief. Stop er één in het Mollie-dashboard en controleer arnobot_subscriptions (${sub.id}).`)
    }
    return weiger(502, 'Overstappen is niet gelukt. Er is niets gewijzigd aan je betalingen. Probeer het later opnieuw of mail admin@arno.bot.')
  }

  // 4. Alleen bij een upgrade: Pro direct en de bijbetaling. Lukt de bijbetaling niet aan te maken, dan blijft het
  // een gewone overstap per einde van de periode (het Pro-abonnement is al gepland), zonder dat de klant iets kwijt is.
  let direct = false
  if (modus === 'upgrade' && upgrade) {
    const betaald = upgrade.brutoCent <= 0 || (await maakUpgradeBetaling(sub, userId, upgrade, claimIso))
    if (betaald) {
      await zetPlanOpPro(sub.id, userId)
      direct = true
    }
  }

  const datum = geplandIngang.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Amsterdam' })
  const soortTekst = modus === 'upgrade'
    ? `Upgrade naar Pro op arno.bot (${direct ? 'Pro direct' : 'Pro per einde periode, bijbetaling niet gelukt'})\n\nUser: ${userId}\n${sub.klant_type}, ${sub.cyclus}\nBijbetaling: €${((upgrade?.brutoCent ?? 0) / 100).toFixed(2)}\nPro-abonnement vanaf: ${datum}, €${(bedrag.brutoCent / 100).toFixed(2)}`
    : `Overstap gepland op arno.bot\n\nUser: ${userId}\n${planNaam(sub.plan)} ${sub.cyclus} naar ${planNaam(doel.plan)} ${doel.cyclus}, ${sub.klant_type}\nIngaand: ${datum}\nNieuw bedrag: €${(bedrag.brutoCent / 100).toFixed(2)}`
  await notifyTelegram(`${soortTekst}\n${await infoVoorTelegram(userId)}`).catch(() => {})

  return {
    ok: true,
    ingaatOp: geplandIngang.toISOString().slice(0, 10),
    plan: doel.plan,
    cyclus: doel.cyclus,
    bedragCent: bedrag.brutoCent,
    ...(modus === 'upgrade' ? { upgrade: { direct, bijbetalingCent: direct ? (upgrade?.brutoCent ?? 0) : 0 } } : {}),
  }
}
