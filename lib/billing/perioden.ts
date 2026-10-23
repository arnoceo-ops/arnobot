import type { Cyclus, KlantType } from './prijzen'

// Respijt na het einde van een betaalde periode, zodat een iets late herhaalbetaling niet
// meteen de toegang afsnijdt. proxy.ts leest alleen approved_users.expires_at.
export const RESPIJT_DAGEN = 3

// Particulier jaarlijks loopt een jaar (voorwaarden artikel 4), daarna volgt de vraag om te
// verlengen. Particulier maandelijks loopt sinds 2026-10-13 net als zakelijk gewoon door tot
// opzegging (besloten: Wet Van Dam-risico geldt voor een stilzwijgend verlengd JAARcontract,
// niet voor een altijd-opzegbaar maandabonnement; zie docs/MOLLIE_PLAN.md).
// PARTICULIER_LOOPTIJD_MAANDEN blijft de lengte van het jaarlijkse contract en van de
// verlengperiode na een geslaagde verlenging (abonnementVoorVerlenging hieronder).
export const PARTICULIER_LOOPTIJD_MAANDEN = 12

const DAG_MS = 24 * 60 * 60 * 1000

/** Binnen hoeveel dagen vóór het contracteinde het verlengen openstaat. */
export const VERLENG_VENSTER_DAGEN = 45

/** Telt maanden op en klemt op de laatste dag van de maand (31 jan + 1 maand = 28/29 feb). */
export function voegMaandenToe(datum: Date, maanden: number): Date {
  const d = new Date(datum.getTime())
  const dag = d.getUTCDate()
  d.setUTCDate(1)
  d.setUTCMonth(d.getUTCMonth() + maanden)
  const laatsteDag = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()
  d.setUTCDate(Math.min(dag, laatsteDag))
  return d
}

export function periodeMaanden(cyclus: Cyclus): number {
  return cyclus === 'jaarlijks' ? 12 : 1
}

/** Einde van de eerste betaalde periode. */
export function eersteperiodeEinde(start: Date, cyclus: Cyclus): Date {
  return voegMaandenToe(start, periodeMaanden(cyclus))
}

/** Tot wanneer de toegang loopt voor een betaalde periode. */
export function toegangTot(periodeEinde: Date): Date {
  return new Date(periodeEinde.getTime() + RESPIJT_DAGEN * DAG_MS)
}

/**
 * Contracteinde: alleen particulier jaarlijks (12 maanden vanaf de start, daarna de
 * verlengvraag). Particulier maandelijks en alles zakelijk: geen contracteinde, loopt door tot
 * opzegging.
 */
export function contractEinde(start: Date, klantType: KlantType, cyclus: Cyclus): Date | null {
  return klantType === 'particulier' && cyclus === 'jaarlijks' ? voegMaandenToe(start, PARTICULIER_LOOPTIJD_MAANDEN) : null
}

export interface AbonnementPlan {
  /** Aantal Mollie-betalingen in het abonnement (zonder de eerste betaling), null = doorlopend. */
  times: number | null
  /** Mollie-interval, of null als er geen abonnement nodig is. */
  interval: '1 month' | '12 months' | null
  startDatum: Date | null
}

/**
 * Welk Mollie-abonnement hoort bij een afgeronde eerste betaling?
 *  - particulier maandelijks: doorlopend, net als zakelijk (besloten 2026-10-13, geen
 *    12-maanden-stop meer, zie contractEinde hierboven)
 *  - particulier jaarlijks: geen abonnement, een jaar is één betaling
 *  - zakelijk: doorlopend, per maand of per jaar
 */
export function abonnementNaEerstebetaling(start: Date, cyclus: Cyclus, klantType: KlantType): AbonnementPlan {
  if (klantType === 'particulier') {
    if (cyclus === 'jaarlijks') return { times: null, interval: null, startDatum: null }
    return { times: null, interval: '1 month', startDatum: voegMaandenToe(start, 1) }
  }
  return {
    times: null,
    interval: cyclus === 'jaarlijks' ? '12 months' : '1 month',
    startDatum: eersteperiodeEinde(start, cyclus),
  }
}

/** Mollie-abonnement voor een verlengde particuliere looptijd, start op het contracteinde. */
export function abonnementVoorVerlenging(contractEindeDatum: Date, cyclus: Cyclus): AbonnementPlan {
  return cyclus === 'jaarlijks'
    ? { times: 1, interval: '12 months', startDatum: contractEindeDatum }
    : { times: PARTICULIER_LOOPTIJD_MAANDEN, interval: '1 month', startDatum: contractEindeDatum }
}

/**
 * Wanneer eindigt een abonnement na een opzegging?
 *  - particulier: aan het einde van de lopende betaalperiode
 *  - zakelijk: opzegtermijn van één maand vóór het einde van de lopende betaalperiode; is dat
 *    te laat, dan loopt het nog één periode door (voorwaarden artikel 7)
 */
export function opzeggingIngaat(
  nu: Date,
  periodeEinde: Date,
  cyclus: Cyclus,
  klantType: KlantType,
): Date {
  if (klantType === 'particulier') return periodeEinde
  const uiterlijk = voegMaandenToe(periodeEinde, -1)
  if (nu.getTime() <= uiterlijk.getTime()) return periodeEinde
  return voegMaandenToe(periodeEinde, periodeMaanden(cyclus))
}

/** Is er na deze betaalde periode nog een betaling nodig om de opzeggingsdatum te halen? */
export function moetMollieAbonnementNuStoppen(periodeEinde: Date, opzeggingIngaatOp: Date): boolean {
  return periodeEinde.getTime() >= opzeggingIngaatOp.getTime()
}

/** Welke herinneringsmails zijn nu aan de beurt voor een particulier contract? */
export function herinneringenDue(
  nu: Date,
  contractEindeDatum: Date,
  verzonden: { dertig: boolean; zeven: boolean },
): { dertig: boolean; zeven: boolean } {
  const dagenOver = (contractEindeDatum.getTime() - nu.getTime()) / DAG_MS
  if (dagenOver <= 0) return { dertig: false, zeven: false }
  return {
    zeven: !verzonden.zeven && dagenOver <= 7,
    // De 30-dagenmail slaan we over als we al binnen de 7 dagen zitten (late start of cron-gat).
    dertig: !verzonden.dertig && dagenOver <= 30 && dagenOver > 7,
  }
}

/**
 * Wanneer gaat de eerste betaalde periode in? Betaalt iemand tijdens de proefperiode, dan op het
 * einde daarvan (de proefdagen blijven van de gebruiker), anders op het betaalmoment.
 */
export function eerstePeriodeStart(betaaldOp: Date, trialEindeDatum: Date | null): Date {
  return trialEindeDatum && trialEindeDatum > betaaldOp ? trialEindeDatum : betaaldOp
}
