import type { SubRow } from './db'
import { getoondBedragEuro } from './prijzen'
import { berekenUpgradeBedrag } from './upgradeBedrag'

// Wat de accountpagina over overstappen toont (docs/OVERSTAP_PLAN.md). Puur rekenwerk op de
// abonnementsrij; de server beslist, de pagina toont alleen. De uiteindelijke weigerregels staan in
// de routes zelf, dit bepaalt alleen welke kaart er verschijnt.

export interface OverstapStatus {
  /** Maandklant: overstappen naar jaar. `ingaatOp` is Mollies volgende incassodatum (YYYY-MM-DD). */
  naarJaar: null | {
    ingaatOp: string
    maandbedragEuro: number
    jaarbedragEuro: number
    besparingEuro: number
    zakelijk: boolean
  }
  /** Basic-klant: direct naar Pro. `bijbetalingCent` is het getoonde bedrag: exclusief btw voor zakelijk, inclusief voor particulier. */
  upgrade: null | { bijbetalingCent: number; zakelijk: boolean }
  /** Een geplande overstap die nog kan worden ingetrokken. */
  gepland: null | { ingaatOp: string }
  /** Een opzegging die nog kan worden ingetrokken. */
  opzeggingIntrekbaar: boolean
}

const LEEG: OverstapStatus = { naarJaar: null, upgrade: null, gepland: null, opzeggingIntrekbaar: false }

/**
 * @param volgendeIncasso Mollies `nextPaymentDate` van het huidige abonnement (YYYY-MM-DD), of null als die
 *   niet op te halen was: dan verschijnt de kaart "per jaar betalen" niet, want zonder datum is er niets te bevestigen.
 */
export function bepaalOverstapStatus(sub: SubRow, nu: Date, volgendeIncasso: string | null): OverstapStatus {
  if (sub.status === 'cancelled') {
    const ingaat = sub.opzegging_ingaat_at ? new Date(sub.opzegging_ingaat_at) : null
    const geplandOpRij = !!sub.gepland_at || !!sub.gepland_mollie_subscription_id
    return { ...LEEG, opzeggingIntrekbaar: !!ingaat && ingaat.getTime() > nu.getTime() && !geplandOpRij }
  }
  if (sub.status !== 'active') return LEEG

  const zakelijk = sub.klant_type === 'zakelijk'

  // Er staat al een wijziging gepland. Bij een upgrade (het plan is al Pro en het Pro-abonnement gaat
  // nog in) is er niets in te trekken en niets te tonen; anders de kaart met de ingangsdatum.
  if (sub.gepland_at || sub.gepland_mollie_subscription_id) {
    const upgradeLoopt = sub.plan === 'premium' && sub.gepland_plan === 'premium'
    if (upgradeLoopt || !sub.gepland_ingangs_at) return LEEG
    return { ...LEEG, gepland: { ingaatOp: sub.gepland_ingangs_at.slice(0, 10) } }
  }

  const status: OverstapStatus = { ...LEEG }

  if (sub.cyclus === 'maandelijks' && sub.mollie_subscription_id && !sub.mollie_sub_geannuleerd_at && volgendeIncasso) {
    const maand = getoondBedragEuro(sub.plan, 'maandelijks')
    const jaar = getoondBedragEuro(sub.plan, 'jaarlijks')
    status.naarJaar = { ingaatOp: volgendeIncasso, maandbedragEuro: maand, jaarbedragEuro: jaar, besparingEuro: maand * 12 - jaar, zakelijk }
  }

  if (sub.plan === 'basis' && sub.periode_start && sub.periode_einde && new Date(sub.periode_einde).getTime() > nu.getTime()) {
    const bij = berekenUpgradeBedrag(sub.klant_type, sub.cyclus, new Date(sub.periode_start), new Date(sub.periode_einde), nu)
    // Zakelijke bedragen worden altijd exclusief btw getoond; de werkelijke betaling blijft inclusief btw.
    status.upgrade = { bijbetalingCent: zakelijk ? bij.nettoCent : bij.brutoCent, zakelijk }
  }

  return status
}
