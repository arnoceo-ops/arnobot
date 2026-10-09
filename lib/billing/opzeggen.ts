import { billingDb, type SubRow } from './db'
import { moetMollieAbonnementNuStoppen, opzeggingIngaat } from './perioden'
import { stopMollieAbonnement } from './verwerking'

export interface OpzeggingResultaat {
  /** Datum waarop het abonnement eindigt (laatste betaalde periode loopt tot dan). */
  ingaatOp: Date
  /** Is het Mollie-abonnement meteen stopgezet (anders stopt het na de laatste verschuldigde betaling)? */
  mollieDirectGestopt: boolean
}

/**
 * Verwerkt een opzegging op een lopend, online betaald abonnement volgens de voorwaarden
 * (artikel 7). Geeft null als de gebruiker geen lopend abonnement in het billing-systeem
 * heeft; dan blijft de oude handmatige afhandeling gelden.
 */
export async function meldOpzegging(userId: string): Promise<OpzeggingResultaat | null> {
  const { data: sub } = await billingDb
    .from('arnobot_subscriptions')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<SubRow>()
  if (!sub || !sub.periode_einde) return null

  const nu = new Date()
  const periodeEinde = new Date(sub.periode_einde)
  const ingaatOp = opzeggingIngaat(nu, periodeEinde, sub.cyclus, sub.klant_type)

  await billingDb
    .from('arnobot_subscriptions')
    .update({
      status: 'cancelled',
      opzegging_aangevraagd_at: nu.toISOString(),
      opzegging_ingaat_at: ingaatOp.toISOString(),
      updated_at: nu.toISOString(),
    })
    .eq('id', sub.id)

  let mollieDirectGestopt = false
  if (sub.mollie_subscription_id && moetMollieAbonnementNuStoppen(periodeEinde, ingaatOp)) {
    await stopMollieAbonnement(sub)
    mollieDirectGestopt = true
  }
  return { ingaatOp, mollieDirectGestopt }
}
