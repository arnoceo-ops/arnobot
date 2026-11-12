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
  // Staat er een overstap gepland (docs/OVERSTAP_PLAN.md, besluit 1)? Dan is het nieuwe contract nog
  // niet ingegaan: de opzegging eindigt aan het einde van de al betaalde periode, ook zakelijk
  // (zonder de extra maand uit artikel 7), en het geplande Mollie-abonnement vervalt.
  const heeftGeplandeWijziging = !!sub.gepland_mollie_subscription_id || !!sub.gepland_at
  const ingaatOp = heeftGeplandeWijziging
    ? periodeEinde
    : opzeggingIngaat(nu, periodeEinde, sub.cyclus, sub.klant_type)

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
  if (heeftGeplandeWijziging) {
    // Stopt het geplande abonnement (het huidige is bij het plannen al gestopt; een nog lopend
    // huidig abonnement stopt hier ook). Pas als Mollie het bevestigt wissen we de gepland-kolommen;
    // anders blijven ze staan zodat de billing-cron het opnieuw probeert.
    mollieDirectGestopt = await stopMollieAbonnement(sub)
    if (mollieDirectGestopt) {
      await billingDb
        .from('arnobot_subscriptions')
        .update({
          gepland_plan: null,
          gepland_cyclus: null,
          gepland_bedrag_cent: null,
          gepland_btw_cent: null,
          gepland_mollie_subscription_id: null,
          gepland_mollie_sub_geannuleerd_at: null,
          gepland_ingangs_at: null,
          gepland_at: null,
          updated_at: nu.toISOString(),
        })
        .eq('id', sub.id)
    }
  } else if (sub.mollie_subscription_id && moetMollieAbonnementNuStoppen(periodeEinde, ingaatOp)) {
    mollieDirectGestopt = await stopMollieAbonnement(sub)
  }
  return { ingaatOp, mollieDirectGestopt }
}
