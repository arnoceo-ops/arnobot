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
/**
 * Coulance na het einde van de gratis proef: het team houdt nog zoveel dagen toegang, zodat de manager rustig kan activeren
 * zonder gat. Op dag 30 krijgt de manager een mail, op dag 40 (30 + dit aantal) blokkeert het team.
 */
export const PROEF_COULANCE_DAGEN = 10

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

/** Tot wanneer het team toegang houdt: het einde van de gratis proef plus de coulance. */
export function toegangTot(einde: Date): Date {
  return new Date(einde.getTime() + PROEF_COULANCE_DAGEN * 86_400_000)
}

/** loopt en bijna: de gratis proef. coulance: de proef is voorbij maar het team heeft nog toegang. verlopen: de toegang is voorbij. */
export type ProefStaat = 'loopt' | 'bijna' | 'coulance' | 'verlopen'

/**
 * Staat van de proef op dit moment, met de resterende dagen naar boven afgerond. Bij loopt en bijna zijn het de dagen tot
 * het einde van de gratis proef, bij coulance de dagen tot de toegang stopt, bij verlopen 0 of lager.
 */
export function proefStand(einde: Date, nu: Date = new Date()): { staat: ProefStaat; dagen: number } {
  const dagen = Math.ceil((einde.getTime() - nu.getTime()) / 86_400_000)
  if (einde.getTime() > nu.getTime()) return { staat: dagen <= PROEF_WAARSCHUWING_DAGEN ? 'bijna' : 'loopt', dagen }
  const tot = toegangTot(einde)
  const dagenToegang = Math.ceil((tot.getTime() - nu.getTime()) / 86_400_000)
  if (tot.getTime() > nu.getTime()) return { staat: 'coulance', dagen: dagenToegang }
  return { staat: 'verlopen', dagen: dagenToegang }
}

/** Voorgestelde nieuwe einddatum (JJJJ-MM-DD) bij VERLENG PROEF: 30 dagen na het einde, of na vandaag als dat al voorbij is. */
export function verlengStandaardDatum(einde: Date | null, nu: Date = new Date()): string {
  const basis = Math.max(nu.getTime(), einde?.getTime() ?? 0)
  return new Date(basis + PROEF_DAGEN * 86_400_000).toISOString().slice(0, 10)
}
