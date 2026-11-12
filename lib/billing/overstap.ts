import * as Sentry from '@sentry/nextjs'
import { billingDb, type SubRow } from './db'
import { haalAbonnement, heeftGeldigeMachtiging, maakAbonnement, mollieBeschikbaarVoor } from './mollie'
import { abonnementVoorOverstap } from './perioden'
import { berekenBedrag, planNaam, type Cyclus, type Plan } from './prijzen'
import { heeftOpenstaandeBetaling } from './openstaandeBetaling'
import { stopEnBevestig } from './verwerking'
import { notifyTelegram } from '@/lib/cron-notify'
import { isInternalTestUser } from '@/lib/internalTestAccounts'

// Overstappen per einde van de betaalde periode (docs/OVERSTAP_PLAN.md): maand naar jaar (zelfde plan)
// en Pro naar Basic (zelfde cyclus). Het huidige Mollie-abonnement stopt, een nieuw abonnement start op
// de volgende incassodatum. De rij houdt tot de eerste betaling van het nieuwe abonnement de oude
// waarden; de webhook (verwerking.ts) zet dan om. Basic naar Pro en jaar naar maand zitten hier NIET in.

/** Minimaal aantal dagen tussen de overstap en de volgende incasso (schatting, niet bij Mollie geverifieerd). */
export const MIN_DAGEN_VOORAF = 4
/** Hoeveel dagen Mollies volgende incassodatum mag afwijken van onze `periode_einde`. */
export const MAX_AFWIJKING_DAGEN = 3

const DAG_MS = 24 * 60 * 60 * 1000

export interface Wens {
  plan: Plan
  cyclus: Cyclus
}

export type OverstapUitkomst =
  | { ok: true; ingaatOp: string; plan: Plan; cyclus: Cyclus; bedragCent: number }
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
  // Pro naar Basic, zelfde cyclus. Basic naar Pro gaat direct en met verrekening, niet via deze route.
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
 * Plant een overstap voor het lopende abonnement van `userId`. Weigert (met een duidelijke melding) in
 * alle gevallen waarin het niet veilig kan, en laat dan niets achter. Vaste volgorde, zodat een fout
 * nooit tot een dubbele incasso leidt: claim in de database, nieuw Mollie-abonnement aanmaken, het
 * huidige stoppen en bij Mollie bevestigen; mislukt een stap, dan wordt de vorige teruggedraaid.
 */
export async function plaatsOverstap(userId: string, wens: Wens, nu: Date = new Date()): Promise<OverstapUitkomst> {
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
  if (!isToegestaneOverstap({ plan: sub.plan, cyclus: sub.cyclus }, wens)) return weiger(400, 'Deze wijziging is niet mogelijk')
  if (!sub.mollie_subscription_id || sub.mollie_sub_geannuleerd_at) {
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
  let ingang: Date
  try {
    if (!(await heeftGeldigeMachtiging(sub.mollie_customer_id))) {
      return weiger(409, 'Er is geen geldige betaalmachtiging meer. Rond eerst een nieuwe betaling af.')
    }
    const huidigMollie = await haalAbonnement(sub.mollie_customer_id, sub.mollie_subscription_id)
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
    if (await heeftOpenstaandeBetaling(sub)) {
      return weiger(409, 'Er loopt nog een betaling. Probeer het over een paar dagen opnieuw.')
    }
  } catch (e) {
    Sentry.captureException(e, { tags: { onderdeel: 'billing-overstap-controle' } })
    return weiger(502, 'Controleren bij de betaalprovider is niet gelukt. Probeer het zo opnieuw.')
  }

  const bedrag = berekenBedrag(wens.plan, wens.cyclus, sub.klant_type)
  const claimIso = nu.toISOString()

  // 1. Claim: voorkomt dubbele overstappen (dubbelklik, twee tabbladen).
  const { data: geclaimd } = await billingDb
    .from('arnobot_subscriptions')
    .update({
      gepland_plan: wens.plan,
      gepland_cyclus: wens.cyclus,
      gepland_bedrag_cent: bedrag.brutoCent,
      gepland_btw_cent: bedrag.btwCent,
      gepland_ingangs_at: ingang.toISOString(),
      gepland_at: claimIso,
      updated_at: claimIso,
    })
    .eq('id', sub.id)
    .eq('status', 'active')
    .is('gepland_at', null)
    .select('id')
  if (geclaimd?.length !== 1) return weiger(409, 'Er staat al een wijziging gepland')

  // 2. Het nieuwe Mollie-abonnement aanmaken, start op de volgende incassodatum.
  const nieuw = abonnementVoorOverstap(ingang, wens.cyclus, sub.klant_type)
  let nieuwId: string
  try {
    const ms = await maakAbonnement({
      klantId: sub.mollie_customer_id,
      brutoCent: bedrag.brutoCent,
      interval: nieuw.interval,
      times: nieuw.times,
      startDatum: nieuw.startDatum,
      omschrijving: `ArnoBot ${planNaam(wens.plan)} ${wens.cyclus} (overstap)`,
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
  if (!(await stopEnBevestig(sub, sub.mollie_subscription_id, 'huidig'))) {
    const teruggedraaid = await stopEnBevestig(metGeplandId, nieuwId, 'gepland')
    if (teruggedraaid) {
      await herstelClaim(sub.id, claimIso)
    } else {
      await notifyTelegram(`OVERSTAP HALF AFGEROND, GEEN DUBBELE INCASSO TOELATEN op arno.bot\n\nUser: ${userId}\nHuidig abonnement: ${sub.mollie_subscription_id}\nNieuw abonnement: ${nieuwId}\nBeide staan mogelijk actief. Stop er één in het Mollie-dashboard en controleer arnobot_subscriptions (${sub.id}).`)
    }
    return weiger(502, 'Overstappen is niet gelukt. Er is niets gewijzigd aan je betalingen. Probeer het later opnieuw of mail admin@arno.bot.')
  }

  const datum = ingang.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Amsterdam' })
  await notifyTelegram(
    `Overstap gepland op arno.bot\n\nUser: ${userId}\n${planNaam(sub.plan)} ${sub.cyclus} naar ${planNaam(wens.plan)} ${wens.cyclus}, ${sub.klant_type}\nIngaand: ${datum}\nNieuw bedrag: €${(bedrag.brutoCent / 100).toFixed(2)}\n${await infoVoorTelegram(userId)}`,
  ).catch(() => {})

  return { ok: true, ingaatOp: ingang.toISOString().slice(0, 10), plan: wens.plan, cyclus: wens.cyclus, bedragCent: bedrag.brutoCent }
}
