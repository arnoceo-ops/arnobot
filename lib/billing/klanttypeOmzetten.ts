import { billingDb, type SubRow } from './db'
import { haalAbonnement, maakAbonnement, MollieError, type MollieSubscription } from './mollie'
import { BTW_PERCENTAGE, planNaam, type Bedrag } from './prijzen'
import { periodeMaanden } from './perioden'
import { heeftOpenstaandeBetaling } from './openstaandeBetaling'
import { maakMollieAbonnementVoor, stopEnBevestig } from './verwerking'
import { notifyTelegram } from '@/lib/cron-notify'

// Het abonnement zelf omzetten van particulier naar zakelijk (docs/REFERRAL_CONTROLE_2026-11-26.md, N5). Het bedrag van
// een Mollie-abonnement hoort bij het abonnement bij Mollie, dus alleen onze database aanpassen is niet genoeg: het
// lopende abonnement wordt vervangen. Vaste volgorde, zodat een fout nooit tot een dubbele incasso leidt: nieuw
// aanmaken, het id vastleggen, het oude stoppen en bevestigen, pas dan de database.

const DAG_MS = 24 * 60 * 60 * 1000

/** Zo ver moet de volgende incasso weg zijn, bij het starten en bij het omzetten. */
export const MIN_DAGEN_VOOR_INCASSO = 4
/** Zo lang is de betaallink van een correctie hooguit geldig. */
export const LINK_GELDIG_UREN = 24
/** Zo lang telt een onbetaalde correctie als openstaand (blokkeert overstappen en upgraden). */
export const CORRECTIE_OPEN_UREN = 48

export const TEKST_GEPLAND = 'Er staat een wijziging van je abonnement gepland. Trek die eerst in op je accountpagina en probeer het daarna opnieuw.'
export const TEKST_INCASSO_DICHTBIJ = `Je volgende betaling is binnen ${MIN_DAGEN_VOOR_INCASSO} dagen. Probeer het opnieuw nadat die betaling is gedaan.`
export const TEKST_BETALING_LOOPT = 'Er loopt nog een betaling. Probeer het over een paar dagen opnieuw.'
export const TEKST_CORRECTIE_OPEN = 'Er staat nog een correctie open. Rond die eerst af.'
export const TEKST_NIET_NU = 'Dit abonnement kan nu niet worden gewijzigd. Mail naar admin@arno.bot.'

/**
 * Het zakelijke bedrag bij het eigen particuliere abonnement: hetzelfde getoonde bedrag, nu plus btw. Uit het
 * abonnement en niet uit de prijslijst, zodat een latere prijswijziging een bestaande klant niet raakt.
 */
export function zakelijkBedragVan(particulierBrutoCent: number): Bedrag {
  const btwCent = Math.round(particulierBrutoCent * (BTW_PERCENTAGE / 100))
  return { nettoCent: particulierBrutoCent, btwCent, brutoCent: particulierBrutoCent + btwCent }
}

/** Loopt er voor dit abonnement een Mollie-abonnement dat nog gaat incasseren en dus vervangen moet worden? */
const incasseertNog = (sub: SubRow) => sub.status === 'active' && !!sub.mollie_subscription_id && !sub.mollie_sub_geannuleerd_at

const dagMs = (jjjjmmdd: string) => Date.parse(`${jjjjmmdd}T00:00:00.000Z`)

export type StartControle = { ok: true; linkVerlooptOp: Date } | { ok: false; fout: string }

/** Mag de correctie nu gestart worden, en tot wanneer mag de betaallink geldig zijn? Een fout bij het controleren gooit. */
export async function controleerStart(sub: SubRow, nu: Date = new Date()): Promise<StartControle> {
  if (sub.gepland_at || sub.gepland_mollie_subscription_id) return { ok: false, fout: TEKST_GEPLAND }

  // Betaald maar nog niet omgezet: niet nog een keer laten betalen.
  const { data: wachtend, error } = await billingDb
    .from('arnobot_klanttype_correcties')
    .select('id')
    .eq('subscription_id', sub.id)
    .eq('status', 'paid')
    .is('abonnement_omgezet_at', null)
    .limit(1)
  if (error) throw new Error(`correcties opzoeken mislukt: ${error.message}`)
  if (wachtend?.length) return { ok: false, fout: TEKST_CORRECTIE_OPEN }

  if (await heeftOpenstaandeBetaling(sub)) return { ok: false, fout: TEKST_BETALING_LOOPT }

  let grens = nu.getTime() + LINK_GELDIG_UREN * 60 * 60 * 1000
  if (sub.status === 'active') {
    let volgende: number
    if (incasseertNog(sub)) {
      const ms = await haalAbonnement(sub.mollie_customer_id, sub.mollie_subscription_id as string)
      if (ms.status !== 'active' || !ms.nextPaymentDate) return { ok: false, fout: TEKST_NIET_NU }
      volgende = dagMs(ms.nextPaymentDate)
    } else if (sub.klant_type === 'particulier' && sub.cyclus === 'jaarlijks' && sub.periode_einde) {
      // Een particulier jaar heeft geen incasso; wel moet het jaar nog ruim genoeg lopen.
      volgende = Date.parse(sub.periode_einde)
    } else {
      return { ok: false, fout: TEKST_NIET_NU }
    }
    const laatsteMoment = volgende - MIN_DAGEN_VOOR_INCASSO * DAG_MS
    // Minstens een uur om te betalen.
    if (!(laatsteMoment - nu.getTime() >= 60 * 60 * 1000)) return { ok: false, fout: TEKST_INCASSO_DICHTBIJ }
    grens = Math.min(grens, laatsteMoment)
  }
  return { ok: true, linkVerlooptOp: new Date(grens) }
}

export interface OmzetRij {
  id: string
  user_id: string
  subscription_id: string
  nieuw_bedrag_cent: number
  nieuw_btw_cent: number
  nieuw_mollie_subscription_id: string | null
  created_at: string
}

/** 'wacht': nu niet veilig, de billing-cron probeert het later opnieuw. Elke fout gooit. */
export type OmzetUitkomst = { stand: 'omgezet' } | { stand: 'wacht'; reden: string }

const wacht = (reden: string): OmzetUitkomst => ({ stand: 'wacht', reden })

async function haalOfNiets(klantId: string, id: string): Promise<MollieSubscription | null> {
  try {
    return await haalAbonnement(klantId, id)
  } catch (e) {
    if (e instanceof MollieError && (e.status === 404 || e.status === 410)) return null
    throw e
  }
}

async function schrijfNieuwId(rijId: string, id: string | null): Promise<void> {
  const { error } = await billingDb.from('arnobot_klanttype_correcties')
    .update({ nieuw_mollie_subscription_id: id, updated_at: new Date().toISOString() })
    .eq('id', rijId)
  if (error) throw new Error(`nieuw abonnement niet vastgelegd: ${error.message}`)
}

async function zetRijOpZakelijk(sub: SubRow, rij: OmzetRij, extra: Record<string, unknown> = {}): Promise<void> {
  const { error } = await billingDb.from('arnobot_subscriptions')
    .update({
      klant_type: 'zakelijk', bedrag_cent: rij.nieuw_bedrag_cent, btw_cent: rij.nieuw_btw_cent,
      // Zakelijk loopt door tot opzegging, dus geen contracteinde en geen verlengvraag.
      contract_einde: null, ...extra, updated_at: new Date().toISOString(),
    })
    .eq('id', sub.id)
    .eq('user_id', rij.user_id)
  if (error) throw new Error(`abonnement niet op zakelijk gezet: ${error.message}`)
}

/** Zet het abonnement van een betaalde correctie om. Veilig om vaker aan te roepen. */
export async function zetAbonnementZakelijk(rij: OmzetRij, nu: Date = new Date()): Promise<OmzetUitkomst> {
  const { data: sub, error } = await billingDb.from('arnobot_subscriptions').select('*').eq('id', rij.subscription_id).maybeSingle<SubRow>()
  if (error) throw new Error(`abonnement opzoeken mislukt: ${error.message}`)
  if (!sub) throw new Error(`abonnement ${rij.subscription_id} bestaat niet`)
  if (sub.gepland_at || sub.gepland_mollie_subscription_id) return wacht('er staat een wijziging van het abonnement gepland')

  const nieuwId = rij.nieuw_mollie_subscription_id
  // Eerder al helemaal gelukt, alleen het afvinken niet.
  if (nieuwId && sub.mollie_subscription_id === nieuwId) return { stand: 'omgezet' }

  if (!incasseertNog(sub)) {
    await zetRijOpZakelijk(sub, rij)
    // Particulier jaar had geen incasso, zakelijk wel. Mislukt dit, dan probeert de billing-cron het opnieuw.
    if (sub.status === 'active' && !sub.mollie_subscription_id) {
      await maakMollieAbonnementVoor(
        { ...sub, klant_type: 'zakelijk', bedrag_cent: rij.nieuw_bedrag_cent, btw_cent: rij.nieuw_btw_cent },
        new Date(sub.periode_start ?? nu.toISOString()),
      )
    }
    return { stand: 'omgezet' }
  }

  const klant = sub.mollie_customer_id
  const oudId = sub.mollie_subscription_id as string
  const oud = await haalOfNiets(klant, oudId)
  const oudLoopt = oud?.status === 'active'
  let id = nieuwId

  if (id) {
    // Blijven liggen na het aanmaken. Loopt het oude nog, dan moeten beide dezelfde volgende incasso hebben; anders is
    // er intussen geïncasseerd en beginnen we opnieuw.
    const nieuw = await haalOfNiets(klant, id)
    const bruikbaar = !!nieuw && (nieuw.status === 'active' || nieuw.status === 'pending')
    if (!bruikbaar || (oudLoopt && nieuw.nextPaymentDate !== oud.nextPaymentDate)) {
      if (!oudLoopt) throw new Error(`oud abonnement ${oudId} loopt niet meer en het nieuwe ${id} is niet bruikbaar: met de hand herstellen`)
      if (bruikbaar && !(await stopEnBevestig(sub, id, 'ongeregistreerd'))) throw new Error(`niet bruikbaar nieuw abonnement ${id} is niet te stoppen`)
      await schrijfNieuwId(rij.id, null)
      id = null
    }
  }

  if (!id) {
    if (!oudLoopt || !oud.nextPaymentDate) return wacht('het lopende abonnement is bij Mollie niet actief')
    if (dagMs(oud.nextPaymentDate) - nu.getTime() < MIN_DAGEN_VOOR_INCASSO * DAG_MS) return wacht(`de volgende incasso (${oud.nextPaymentDate}) is te dichtbij`)
    if (await heeftOpenstaandeBetaling(sub)) return wacht('er loopt nog een betaling')

    const ms = await maakAbonnement({
      klantId: klant,
      brutoCent: rij.nieuw_bedrag_cent,
      interval: periodeMaanden(sub.cyclus) === 12 ? '12 months' : '1 month',
      times: null,
      startDatum: new Date(dagMs(oud.nextPaymentDate)),
      omschrijving: `ArnoBot ${planNaam(sub.plan)} ${sub.cyclus} (zakelijk)`,
      metadata: { userId: sub.user_id, subscriptionRowId: sub.id },
      // Per uur: een gelijktijdige tweede aanroep krijgt hetzelfde abonnement, een latere poging een nieuw.
      idempotencyKey: `klanttype-${rij.id}-${nu.toISOString().slice(0, 13)}`,
    })
    if (ms.status !== 'active' && ms.status !== 'pending') throw new Error(`Mollie gaf een niet lopend abonnement terug (${ms.id}, ${ms.status})`)
    try {
      await schrijfNieuwId(rij.id, ms.id)
    } catch (e) {
      await stopEnBevestig(sub, ms.id, 'ongeregistreerd')
      throw e
    }
    id = ms.id
  }

  // Nooit twee lopende abonnementen: lukt het stoppen van het oude niet, dan gaat het nieuwe weer weg.
  if (!(await stopEnBevestig(sub, oudId, 'ongeregistreerd'))) {
    if (await stopEnBevestig(sub, id, 'ongeregistreerd')) {
      await schrijfNieuwId(rij.id, null)
    } else {
      await notifyTelegram(`KLANTTYPE-OMZETTING HALF AFGEROND, GEEN DUBBELE INCASSO TOELATEN op arno.bot\n\nUser: ${sub.user_id}\nOud abonnement: ${oudId}\nNieuw abonnement: ${id}\nBeide staan mogelijk actief. Stop er een in het Mollie-dashboard en controleer arnobot_subscriptions (${sub.id}).`)
    }
    throw new Error(`oud abonnement ${oudId} stoppen is niet gelukt`)
  }

  await zetRijOpZakelijk(sub, rij, { mollie_subscription_id: id, mollie_sub_geannuleerd_at: null })
  return { stand: 'omgezet' }
}
