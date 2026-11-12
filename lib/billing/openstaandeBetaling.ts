import { billingDb, type SubRow } from './db'
import { lijstAbonnementBetalingen } from './mollie'

/**
 * Hoe lang na het einde van de betaalde periode de dagelijkse cron een afsluiting uitstelt voor een
 * betaling die nog onderweg is. Een SEPA-incasso kan dagen op "pending" staan. Sluiten we dan al af,
 * dan wordt de betaling die daarna binnenkomt genegeerd (verwerking.ts) en betaalt de klant zonder
 * toegang. Na deze termijn sluiten we toch af, zodat een hangende betaling niets eeuwig openhoudt.
 */
export const WACHT_OP_BETALING_DAGEN = 14

const DAG_MS = 24 * 60 * 60 * 1000
const ONDERWEG = ['open', 'pending', 'authorized']

/** Staat er voor dit abonnement een betaling open of onderweg, in onze database of bij Mollie? */
export async function heeftOpenstaandeBetaling(sub: SubRow): Promise<boolean> {
  const { data } = await billingDb
    .from('arnobot_payments')
    .select('id')
    .eq('subscription_id', sub.id)
    .in('status', ONDERWEG)
    .limit(1)
  if (data?.length) return true

  // Een betaling die Mollie net heeft aangemaakt kent onze database pas na de webhook: ook bij
  // Mollie zelf kijken, voor het huidige én het geplande abonnement.
  for (const id of [sub.mollie_subscription_id, sub.gepland_mollie_subscription_id]) {
    if (!id) continue
    const betalingen = await lijstAbonnementBetalingen(sub.mollie_customer_id, id)
    if (betalingen.some(p => ONDERWEG.includes(p.status))) return true
  }
  return false
}

/**
 * Moet de cron het afsluiten van dit verlopen abonnement uitstellen? Alleen binnen
 * WACHT_OP_BETALING_DAGEN na het einde van de periode, en alleen als er een betaling onderweg is.
 * Kan Mollie niet worden bevraagd, dan wachten we liever een dag dan dat we onterecht afsluiten.
 */
export async function moetAfsluitingUitstellen(sub: SubRow, nu: Date): Promise<boolean> {
  if (!sub.periode_einde) return false
  const dagenNaEinde = (nu.getTime() - new Date(sub.periode_einde).getTime()) / DAG_MS
  if (dagenNaEinde > WACHT_OP_BETALING_DAGEN) return false
  try {
    return await heeftOpenstaandeBetaling(sub)
  } catch (e) {
    console.error('[billing] openstaande betaling niet te controleren, afsluiting uitgesteld', sub.id, e instanceof Error ? e.message : e)
    return true
  }
}
