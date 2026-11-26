// Referraltegoed wordt verrekend door (een deel van) een betaling terug te storten. Dat deel staat per betaling in
// arnobot_payments.referral_refund_cent en is geen terugbetaling van de koop: het mag nooit het abonnement
// beëindigen. Dit is de enige plek die bepaalt wat "volledig terugbetaald" is (webhook, cron, admin en herroeping).
// De kolom bestaat na docs/sql/2026-11-25-referral-fundament.sql; ontbreekt hij, dan telt hij als 0.

export interface TerugbetaalRij {
  bedrag_cent: number
  referral_refund_cent?: number | null
  /**
   * Wat per bank over deze betaling is teruggegeven (kolom na docs/sql/2026-11-26-referral-verrekening.sql). Gaat wel af
   * van wat er nog terug te betalen is, en telt nooit mee in vergelijkingen met wat Mollie noemt.
   */
  referral_bank_cent?: number | null
}

const tegoedDeel = (rij: TerugbetaalRij) => rij.referral_refund_cent ?? 0

/** Wat er van deze betaling nog van de klant bij ons staat: zonder verrekend referraltegoed en wat per bank terugging. */
export function restantCent(rij: TerugbetaalRij): number {
  return Math.max(0, rij.bedrag_cent - tegoedDeel(rij) - (rij.referral_bank_cent ?? 0))
}

/** Is er buiten het referraltegoed om al iets terugbetaald? */
export function heeftAndereTerugbetaling(rij: TerugbetaalRij, terugbetaaldCent: number): boolean {
  return terugbetaaldCent > tegoedDeel(rij)
}

/** Volledig terugbetaald: alles is terug én dat is niet alleen referraltegoed. */
export function isVolledigTerugbetaald(rij: TerugbetaalRij, terugbetaaldCent: number): boolean {
  return terugbetaaldCent >= rij.bedrag_cent && heeftAndereTerugbetaling(rij, terugbetaaldCent)
}
