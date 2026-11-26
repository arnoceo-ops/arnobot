import { billingDb, type PayRow } from './db'
import { haalBetaling, lijstBetalingTerugbetalingen, mollieIngeschakeld } from './mollie'
import { mollieNaarCenten } from './geld'
import { heeftAndereTerugbetaling } from './terugbetaling'
import { isTeruggedraaid, type SaldoRegel } from './referralSaldo'
import type { TeamFactuurRow } from './teamFacturatie'

// Geen uitkering zonder positief bewijs dat de betaling eronder nog staat: volgens onze database EN volgens Mollie.
// Alles wat niet zeker is (niet te lezen, een lopende of uitgevoerde terugbetaling die niet van ons is, een chargeback,
// een kenmerk dat ontbreekt) is geen bewijs: dan wordt er gewacht, nooit betaald. Dit hangt niet aan de nacontrole, haar
// porties of haar termijn. Gebruikt door de planner (voor het reserveren) en de machine (voor het versturen).

export type Bewijs = { staat: true } | { staat: false; reden: string }

const STAAT: Bewijs = { staat: true }
const nee = (reden: string): Bewijs => ({ staat: false, reden })
const dood = (status: string) => status === 'failed' || status === 'canceled'

function kenmerk(metadata: unknown): string | null {
  let m = metadata
  if (typeof m === 'string') {
    try { m = JSON.parse(m) } catch { return null }
  }
  const k = (m as { referralActie?: unknown } | null | undefined)?.referralActie
  return typeof k === 'string' ? k : null
}

/** Staat de betaling bij Mollie? Alleen terugbetalingen van onze eigen referralacties op deze betaling mogen er zijn. */
async function bewijsBijMollie(mollieId: string, doelId: string): Promise<Bewijs> {
  if (!mollieIngeschakeld()) return nee('Mollie is niet ingeschakeld')
  const mp = await haalBetaling(mollieId)
  if (mp.status !== 'paid') return nee(`${mollieId} staat bij Mollie op ${mp.status}`)
  if (mp.amountChargedBack && mollieNaarCenten(mp.amountChargedBack.value) > 0) return nee(`${mollieId} is teruggeboekt`)
  const lopend = (await lijstBetalingTerugbetalingen(mollieId)).filter(r => !dood(r.status))
  let eigen: { id: string; mollie_refund_id: string | null }[] = []
  if (lopend.length) {
    const { data, error } = await billingDb.from('arnobot_referral_acties').select('id, mollie_refund_id')
      .eq('doel_id', doelId).in('status', ['bezig', 'verzonden', 'bevestigd', 'vastgelopen']).limit(100)
    if (error) return nee('de referralacties zijn niet te lezen')
    eigen = (data ?? []) as typeof eigen
  }
  const vanOns = lopend.filter(r => eigen.some(a => a.id === kenmerk(r.metadata) || a.mollie_refund_id === r.id))
  if (vanOns.length < lopend.length) return nee(`bij ${mollieId} loopt of staat een terugbetaling die niet van ons is`)
  const onsCent = vanOns.reduce((som, r) => som + mollieNaarCenten(r.amount.value), 0)
  if (mp.amountRefunded && mollieNaarCenten(mp.amountRefunded.value) > onsCent) return nee(`Mollie noemt bij ${mollieId} meer terugbetaald dan wij kennen`)
  return STAAT
}

/** Een bronkenmerk is een Mollie-betaling (tr_) van een individu, of het id van een teamfactuur. */
async function bewijs(bronId: string, userId: string): Promise<Bewijs> {
  if (bronId.startsWith('tr_')) {
    const { data, error } = await billingDb.from('arnobot_payments').select('*').eq('mollie_payment_id', bronId).eq('user_id', userId).maybeSingle<PayRow>()
    if (error) return nee(`${bronId} is niet te lezen`)
    if (!data) return nee(`${bronId} staat niet in onze database`)
    if (data.status !== 'paid') return nee(`${bronId} staat bij ons op ${data.status}`)
    if (data.terugbetaling_verwerkt_at) return nee(`bij ${bronId} is een terugbetaling verwerkt of onderweg`)
    if (data.teruggeboekt_cent > 0) return nee(`${bronId} is teruggeboekt`)
    if (heeftAndereTerugbetaling(data, data.terugbetaald_cent ?? 0)) return nee(`van ${bronId} is iets terugbetaald`)
    return bewijsBijMollie(bronId, data.id)
  }
  const { data, error } = await billingDb.from('arnobot_team_facturen').select('*').eq('id', bronId).maybeSingle<TeamFactuurRow>()
  if (error) return nee(`teamfactuur ${bronId} is niet te lezen`)
  if (!data) return nee(`teamfactuur ${bronId} staat niet in onze database`)
  if (data.status !== 'paid' || data.reversed_at || heeftAndereTerugbetaling(data, data.terugbetaald_cent ?? 0) || (data.teruggeboekt_cent ?? 0) > 0) {
    return nee(`teamfactuur ${bronId} staat niet (volledig) betaald`)
  }
  if (!data.mollie_payment_id || data.paid_via === 'bank') return nee(`teamfactuur ${bronId} heeft geen Mollie-betaling (per bank): niet te controleren`)
  return bewijsBijMollie(data.mollie_payment_id, data.id)
}

export type Bewijzer = (bronnen: string[], userId: string) => Promise<Bewijs>

/** Een bewijzer die elke bron binnen een ronde een keer opzoekt. Gooit nooit: een fout is geen bewijs. */
export function maakBewijzer(): Bewijzer {
  const gezien = new Map<string, Promise<Bewijs>>()
  return async (bronnen, userId) => {
    if (!bronnen.length) return nee('er zijn geen betalingskenmerken vastgelegd')
    for (const bron of bronnen) {
      const sleutel = `${userId}:${bron}`
      let uit = gezien.get(sleutel)
      if (!uit) gezien.set(sleutel, (uit = bewijs(bron, userId).catch(e => nee(`${bron} niet te controleren: ${e instanceof Error ? e.message : e}`))))
      const b = await uit
      if (!b.staat) return b
    }
    return STAAT
  }
}

export type BronRegel = SaldoRegel & { klant_user_id: string; bron_ids?: string[] | null }

/** De toekenningen die verbruikt worden: niet teruggedraaid, en alle betalingen eronder bewezen. */
export async function bewijsToekenningen(regels: BronRegel[], referralIds: string[], bewijzer: Bewijzer): Promise<Bewijs> {
  if (!referralIds.length) return nee('niet te zien op welk tegoed dit rust')
  for (const ref of referralIds) {
    const t = regels.find(r => r.soort === 'toekenning' && r.referral_id === ref)
    if (!t) return nee(`toekenning ${ref} niet gevonden`)
    if (isTeruggedraaid(regels, ref)) return nee(`toekenning ${ref} is teruggedraaid`)
    if (!t.bron_ids?.length) return nee(`toekenning ${ref} heeft geen betalingskenmerken`)
    const b = await bewijzer(t.bron_ids, t.klant_user_id)
    if (!b.staat) return b
  }
  return STAAT
}
