// De gratis proef van 30 dagen voor een manager die via de link van een sales agent binnenkwam
// (docs/SALES_DEVELOPMENT.md). Alleen die teams hebben een proef: een team dat via het
// aanvraagformulier komt of al facturatie heeft, valt hier buiten en eindigt alleen via betaling.
//
// Waarom dit nodig is: zo'n manager krijgt bij het aanmaken van zijn account command_manager = true,
// en de toegangspoort (proxy.ts) laat iemand met command_manager binnen zolang zijn team niet
// geblokkeerd is. De proefmails (trial-emails) slaan managers en teamleden over. Zonder deze
// controle eindigt de proef dus nooit. /api/cron/team-proef beëindigt hem nu na 30 dagen.

export const PROEF_DAGEN = 30
/** Zoveel dagen voor het einde krijgt Arno een melding, zodat er tijd is voor het gesprek over een betaald Team. */
export const PROEF_WAARSCHUWING_DAGEN = 5

export type ProefManager = {
  trial_start: string | null
  expires_at: string | null
  paid_at: string | null
  sd_attribution_method: string | null
}

/**
 * Is dit een agent-proef? De manager kwam via een agent-link (sd_attribution_method 'link', een
 * handmatige toewijzing telt niet), betaalt niet zelf en het team heeft nog geen facturatie
 * (min. seats leeg; staat die erin, dan is het een klant en geen proef meer).
 */
export function isAgentProef(manager: ProefManager, minSeats: number | null | undefined): boolean {
  return manager.sd_attribution_method === 'link' && !manager.paid_at && (minSeats === null || minSeats === undefined)
}

/**
 * Het einde van de proef: een gezette einddatum (handmatig verlengd, of gratis toegang t/m) gaat voor,
 * anders 30 dagen na de aanmelding. null als beide ontbreken.
 */
export function proefEinde(manager: ProefManager): Date | null {
  const dag = (iso: string) => { const d = new Date(iso); return isNaN(d.getTime()) ? null : d }
  if (manager.expires_at) return dag(manager.expires_at)
  if (manager.trial_start) {
    const start = dag(manager.trial_start)
    return start ? new Date(start.getTime() + PROEF_DAGEN * 86_400_000) : null
  }
  return null
}

export type ProefStaat = 'loopt' | 'bijna' | 'verlopen'

/** Staat van de proef op dit moment, met de resterende dagen naar boven afgerond (0 of lager bij verlopen). */
export function proefStand(einde: Date, nu: Date = new Date()): { staat: ProefStaat; dagen: number } {
  const dagen = Math.ceil((einde.getTime() - nu.getTime()) / 86_400_000)
  if (einde.getTime() <= nu.getTime()) return { staat: 'verlopen', dagen }
  return { staat: dagen <= PROEF_WAARSCHUWING_DAGEN ? 'bijna' : 'loopt', dagen }
}

/** Voorgestelde nieuwe einddatum (JJJJ-MM-DD) bij VERLENG PROEF: 30 dagen na het einde, of na vandaag als dat al voorbij is. */
export function verlengStandaardDatum(einde: Date | null, nu: Date = new Date()): string {
  const basis = Math.max(nu.getTime(), einde?.getTime() ?? 0)
  return new Date(basis + PROEF_DAGEN * 86_400_000).toISOString().slice(0, 10)
}
