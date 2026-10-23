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
  renewal_requested_at?: string | null
}

export const TRIAL_DAGEN = 30
/** Wie op "doorgaan" klikte maar nog niet betaald heeft, houdt nog zoveel dagen toegang na het
 *  einde van de proefperiode, zodat het betalen rustig kan. De cron trial-emails stemt de
 *  betaalwaarschuwing en blokkade hierop af. */
export const UITLOOP_DAGEN = 5

const DAG_MS = 24 * 60 * 60 * 1000

/**
 * Toegang op basis van de eigen datums van de gebruiker. Een gezette expires_at is altijd
 * bindend, ook voor betalende gebruikers: zo begrenst de admin of de betaalperiode de toegang.
 * Alleen paid_at zonder expires_at is onbeperkte toegang. Zonder beide telt de trial van 30 dagen,
 * met een uitloop van 5 dagen voor wie al heeft aangegeven door te willen gaan.
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
    const dagen = TRIAL_DAGEN + (user.renewal_requested_at ? UITLOOP_DAGEN : 0)
    return nu < new Date(start.getTime() + dagen * DAG_MS)
  }
  return false
}

export type ZonderToegangBeslissing = { actie: 'door' } | { actie: 'redirect'; naar: string }

/** Wat er met een pagina-aanvraag gebeurt van een ingelogde gebruiker zonder actieve toegang. */
export function beslisZonderToegang(path: string): ZonderToegangBeslissing {
  return isHerstelPad(path) ? { actie: 'door' } : { actie: 'redirect', naar: HERSTEL_STANDAARD }
}
