// Beslislogica van proxy.ts over wie /bot mag zien. Los van de proxy gehouden zodat ze
// unit-testbaar is: dit is de fragiele plek waar een fout een redirect-loop of een lege
// pagina voor echte gebruikers oplevert.

// Pagina's die ook bereikbaar zijn zonder actieve toegang: afrekenen of verlengen
// (/bot/doorgaan), een tweede trial na de winback-mail (/bot/herstart) en het account
// (gegevens downloaden, opzeggen en verwijderen, AVG). Alles op die pagina's leunt op
// auth() en eigen checks per API-route.
export const HERSTEL_PADEN = ['/bot/doorgaan', '/bot/herstart', '/bot/account'] as const

/** Waar iemand zonder toegang naartoe gestuurd wordt in plaats van /sign-in. Die laatste gaf
 *  een loop: de inlogpagina stuurt ingelogden weer naar /bot. */
export const HERSTEL_STANDAARD = '/bot/doorgaan'

export function isHerstelPad(path: string): boolean {
  return HERSTEL_PADEN.some(p => path === p || path.startsWith(`${p}/`))
}

export type ToegangVelden = {
  expires_at?: string | null
  paid_at?: string | null
  trial_start?: string | null
}

const TRIAL_DAGEN = 30

/**
 * Toegang op basis van de eigen datums van de gebruiker. Een gezette expires_at is altijd
 * bindend, ook voor betalende gebruikers: zo begrenst de admin of de betaalperiode de toegang.
 * Alleen paid_at zonder expires_at is onbeperkte toegang. Zonder beide telt de trial van 30 dagen.
 * Team-toegang wordt apart (live) gecontroleerd in proxy.ts.
 */
export function datumToegang(user: ToegangVelden, nu: Date = new Date()): boolean {
  if (user.expires_at) {
    const einde = new Date(user.expires_at)
    return !isNaN(einde.getTime()) && einde > nu
  }
  if (user.paid_at) return true
  if (user.trial_start) {
    const start = new Date(user.trial_start)
    if (isNaN(start.getTime())) return false
    return nu < new Date(start.getTime() + TRIAL_DAGEN * 24 * 60 * 60 * 1000)
  }
  return false
}

/** Vanaf zoveel dagen vóór het einde van de proefperiode toont de app de balk "kies je abonnement". */
export const TRIAL_MELDING_DAGEN = 5

/**
 * Hoeveel dagen (naar boven afgerond, 1 tot en met 5) de proefperiode nog loopt, voor de balk in
 * de app. null als er niets te melden valt: al betaald of een gezette einddatum, geen trial, de
 * trial is al voorbij, of er zijn nog meer dan 5 dagen over. Team-toegang wordt door de aanroeper
 * uitgesloten.
 */
export function trialDagenOver(user: ToegangVelden, nu: Date = new Date()): number | null {
  if (user.expires_at || user.paid_at || !user.trial_start) return null
  const start = new Date(user.trial_start)
  if (isNaN(start.getTime())) return null
  const msOver = start.getTime() + TRIAL_DAGEN * 24 * 60 * 60 * 1000 - nu.getTime()
  if (msOver <= 0) return null
  const dagen = Math.ceil(msOver / (24 * 60 * 60 * 1000))
  return dagen <= TRIAL_MELDING_DAGEN ? dagen : null
}

export type ZonderToegangBeslissing = { actie: 'door' } | { actie: 'redirect'; naar: string }

/** Wat er met een pagina-aanvraag gebeurt van een ingelogde gebruiker zonder actieve toegang. */
export function beslisZonderToegang(path: string): ZonderToegangBeslissing {
  return isHerstelPad(path) ? { actie: 'door' } : { actie: 'redirect', naar: HERSTEL_STANDAARD }
}

/**
 * Einde van de proefperiode als de gebruiker op dit moment nog in de proefperiode zit zonder
 * betaling of gezette einddatum, anders null. Gebruikt om een abonnement dat tijdens de trial
 * wordt afgesloten pas op dat moment te laten ingaan, zodat vroeg betalen geen proefdagen kost.
 */
export function trialEinde(user: ToegangVelden, nu: Date = new Date()): Date | null {
  if (user.expires_at || user.paid_at || !user.trial_start) return null
  const start = new Date(user.trial_start)
  if (isNaN(start.getTime())) return null
  const einde = new Date(start.getTime() + TRIAL_DAGEN * 24 * 60 * 60 * 1000)
  return einde > nu ? einde : null
}
