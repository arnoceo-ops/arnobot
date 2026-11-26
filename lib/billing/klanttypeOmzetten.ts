import { randomUUID } from 'node:crypto'
import { billingDb, type SubRow } from './db'
import { haalAbonnement, lijstKlantAbonnementen, maakAbonnement, MollieError, type MollieSubscription } from './mollie'
import { mollieNaarCenten } from './geld'
import { BTW_PERCENTAGE, planNaam, type Bedrag } from './prijzen'
import { periodeMaanden } from './perioden'
import { heeftOpenstaandeBetaling } from './openstaandeBetaling'
import { stopEnBevestig } from './verwerking'
import { notifyTelegram } from '@/lib/cron-notify'
import { wieIs } from './wie'

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

/** Loopt er voor dit abonnement een Mollie-abonnement dat nog gaat incasseren? */
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
    .is('afgehandeld_at', null)
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
      // Zelfde rekening als bij het omzetten (de startdatum van het nieuwe abonnement), anders kan betalen wel en omzetten niet.
      volgende = dagMs(sub.periode_einde.slice(0, 10))
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
  plan: SubRow['plan']
  cyclus: SubRow['cyclus']
  verschil_cent: number
  nieuw_bedrag_cent: number
  nieuw_btw_cent: number
  omzetting_gestart_at: string | null
}

/**
 * 'wacht': nu niet veilig, de billing-cron probeert het later opnieuw. 'handwerk': er wordt niets omgezet, ook later
 * niet. Elke fout gooit.
 */
export type OmzetUitkomst = { stand: 'omgezet' } | { stand: 'wacht'; reden: string } | { stand: 'handwerk'; reden: string }

const wacht = (reden: string): OmzetUitkomst => ({ stand: 'wacht', reden })

async function haalOfNiets(klantId: string, id: string): Promise<MollieSubscription | null> {
  try {
    return await haalAbonnement(klantId, id)
  } catch (e) {
    if (e instanceof MollieError && (e.status === 404 || e.status === 410)) return null
    throw e
  }
}

const loopt = (ms: MollieSubscription) => ms.status === 'active' || ms.status === 'pending'

/** De lopende abonnementen die bij deze correctie zijn aangemaakt, ook als wij het id nooit hebben vastgelegd. */
async function vanDezeCorrectie(sub: SubRow, rijId: string): Promise<MollieSubscription[]> {
  return (await lijstKlantAbonnementen(sub.mollie_customer_id))
    .filter(ms => loopt(ms) && ms.metadata?.klanttypeCorrectie === rijId && ms.id !== sub.mollie_subscription_id)
}

async function stopAlle(sub: SubRow, lijst: MollieSubscription[]): Promise<void> {
  for (const ms of lijst) {
    if (!(await stopEnBevestig(sub, ms.id, 'ongeregistreerd'))) throw new Error(`abonnement ${ms.id} is niet te stoppen`)
  }
}

async function schrijfRij(rijId: string, velden: Record<string, unknown>): Promise<void> {
  const { error } = await billingDb.from('arnobot_klanttype_correcties')
    .update({ ...velden, updated_at: new Date().toISOString() })
    .eq('id', rijId)
  if (error) throw new Error(`correctie niet bijgewerkt: ${error.message}`)
}

async function leesAbonnement(rij: OmzetRij): Promise<SubRow> {
  const { data, error } = await billingDb.from('arnobot_subscriptions').select('*').eq('id', rij.subscription_id).maybeSingle<SubRow>()
  if (error) throw new Error(`abonnement opzoeken mislukt: ${error.message}`)
  if (!data) throw new Error(`abonnement ${rij.subscription_id} bestaat niet`)
  return data
}

/** Een enkele update: klanttype, bedrag en Mollie-id wisselen altijd samen. */
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

/**
 * Zet het abonnement van een betaalde correctie om. Veilig om vaker aan te roepen, maar niet gelijktijdig: de aanroeper
 * houdt een slot op het abonnement (klanttypeCorrectie.ts).
 */
export async function zetAbonnementZakelijk(rij: OmzetRij, nu: Date = new Date()): Promise<OmzetUitkomst> {
  const sub = await leesAbonnement(rij)
  const zelfde = sub.plan === rij.plan && sub.cyclus === rij.cyclus
  // Onze eigen update is al geslaagd (die wisselt alles in een keer), alleen het afvinken niet.
  if (zelfde && sub.klant_type === 'zakelijk' && sub.bedrag_cent === rij.nieuw_bedrag_cent) return { stand: 'omgezet' }

  const handwerk = async (reden: string): Promise<OmzetUitkomst> => {
    if (rij.omzetting_gestart_at) await stopAlle(sub, await vanDezeCorrectie(sub, rij.id))
    return { stand: 'handwerk', reden }
  }
  if (sub.status !== 'active' && sub.status !== 'cancelled') return handwerk(`het abonnement is intussen ${sub.status}`)
  if (!zelfde || sub.klant_type !== 'particulier' || sub.bedrag_cent !== rij.nieuw_bedrag_cent - rij.verschil_cent) {
    return handwerk('het abonnement is sinds het starten van de correctie gewijzigd')
  }
  if (sub.gepland_at || sub.gepland_mollie_subscription_id) return wacht('er staat een wijziging van het abonnement gepland')

  if (sub.status === 'cancelled') {
    // Opgezegd: geen nieuw abonnement. Wat een eerdere poging aanmaakte gaat weg.
    if (rij.omzetting_gestart_at) await stopAlle(sub, await vanDezeCorrectie(sub, rij.id))
    await zetRijOpZakelijk(sub, rij)
    return { stand: 'omgezet' }
  }

  const klant = sub.mollie_customer_id
  const oudId = sub.mollie_subscription_id
  // Particulier jaar heeft geen incasso; zakelijk wel, vanaf het einde van het betaalde jaar.
  const jaarZonderIncasso = !oudId && sub.cyclus === 'jaarlijks'
  if (!jaarZonderIncasso && (!oudId || sub.mollie_sub_geannuleerd_at)) return wacht('er is geen lopend Mollie-abonnement bekend')
  const oud = oudId ? await haalOfNiets(klant, oudId) : null
  const oudLoopt = !!oud && oud.status === 'active'
  const bestaand = rij.omzetting_gestart_at ? await vanDezeCorrectie(sub, rij.id) : []

  // Het oude is al weg: alleen verder als dat bij een eerdere poging is gebeurd en precies ons nieuwe er staat.
  if (oudId && !oudLoopt) {
    if (!rij.omzetting_gestart_at) return wacht('het lopende abonnement is bij Mollie niet actief')
    const goed = bestaand.filter(ms => ms.amount && mollieNaarCenten(ms.amount.value) === rij.nieuw_bedrag_cent)
    if (goed.length !== 1 || bestaand.length !== 1) throw new Error(`oud abonnement ${oudId} loopt niet meer en er is niet precies een nieuw abonnement (${bestaand.map(m => m.id).join(', ') || 'geen'}): met de hand herstellen`)
    await schrijfRij(rij.id, { nieuw_mollie_subscription_id: goed[0].id })
    await rondAfInDatabase(sub, rij, goed[0].id)
    return { stand: 'omgezet' }
  }

  const start = oudId ? oud?.nextPaymentDate : sub.periode_einde?.slice(0, 10)
  const onveilig = !start ? 'de volgende incassodatum is onbekend'
    : dagMs(start) - nu.getTime() < MIN_DAGEN_VOOR_INCASSO * DAG_MS ? `de volgende incasso (${start}) is te dichtbij`
    : (await heeftOpenstaandeBetaling(sub)) ? 'er loopt nog een betaling'
    : null
  if (onveilig) {
    // Nooit een tweede abonnement laten staan terwijl het oude doorloopt: dat zou samen incasseren.
    await stopAlle(sub, bestaand)
    return wacht(onveilig)
  }

  const past = (ms: MollieSubscription) => ms.nextPaymentDate === start && !!ms.amount && mollieNaarCenten(ms.amount.value) === rij.nieuw_bedrag_cent
  let id = bestaand.find(past)?.id
  await stopAlle(sub, bestaand.filter(ms => ms.id !== id))

  if (!id) {
    // Eerst vastleggen dat we gaan aanmaken: vanaf nu zoeken alle stoppaden bij Mollie naar dit abonnement.
    if (!rij.omzetting_gestart_at) await schrijfRij(rij.id, { omzetting_gestart_at: nu.toISOString() })
    const ms = await maakAbonnement({
      klantId: klant,
      brutoCent: rij.nieuw_bedrag_cent,
      interval: periodeMaanden(sub.cyclus) === 12 ? '12 months' : '1 month',
      times: null,
      startDatum: new Date(dagMs(start as string)),
      omschrijving: `ArnoBot ${planNaam(sub.plan)} ${sub.cyclus} (zakelijk)`,
      metadata: { userId: sub.user_id, subscriptionRowId: sub.id, klanttypeCorrectie: rij.id },
      // Elke poging een eigen sleutel: Mollie speelt anders een eerder antwoord af, ook van een al gestopt abonnement.
      // Dubbel aanmaken voorkomen we met de lijst hierboven en het slot van de aanroeper.
      idempotencyKey: `klanttype-${rij.id}-${randomUUID()}`,
    })
    const echt = await haalOfNiets(klant, ms.id)
    if (!echt || !loopt(echt)) throw new Error(`nieuw abonnement ${ms.id} loopt niet (${echt?.status ?? 'onbekend'})`)
    id = ms.id
  }
  await schrijfRij(rij.id, { nieuw_mollie_subscription_id: id })

  // Nooit twee lopende abonnementen: lukt het stoppen van het oude niet, dan gaat het nieuwe weer weg.
  if (oudId && !(await stopEnBevestig(sub, oudId, 'ongeregistreerd'))) {
    if (!(await stopEnBevestig(sub, id, 'ongeregistreerd'))) {
      await notifyTelegram(`KLANTTYPE-OMZETTING HALF AFGEROND, GEEN DUBBELE INCASSO TOELATEN op arno.bot\n\nWie: ${await wieIs(sub.user_id)}\nOud abonnement: ${oudId}\nNieuw abonnement: ${id}\nBeide staan mogelijk actief. Stop er een in het Mollie-dashboard en controleer arnobot_subscriptions (${sub.id}).`)
    }
    throw new Error(`oud abonnement ${oudId} stoppen is niet gelukt`)
  }

  await rondAfInDatabase(sub, rij, id)
  return { stand: 'omgezet' }
}

async function rondAfInDatabase(sub: SubRow, rij: OmzetRij, id: string): Promise<void> {
  await zetRijOpZakelijk(sub, rij, { mollie_subscription_id: id, mollie_sub_geannuleerd_at: null })
  // Intussen opgezegd (of beëindigd): het opzeggen kende het nieuwe abonnement nog niet.
  const nuSub = await leesAbonnement(rij)
  if (nuSub.status !== 'active' && !(await stopEnBevestig(nuSub, id, 'huidig'))) throw new Error(`nieuw abonnement ${id} na opzegging niet gestopt`)
}
