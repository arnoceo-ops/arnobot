// Getypte wrapper rond posthog-js voor de ingelogde app (/bot). Buiten dit bestand
// wordt posthog.capture() niet rechtstreeks aangeroepen: elke event-naam staat hier in
// de union, zodat een typo of een niet-goedgekeurd event niet compileert.
//
// Regels (zie CLAUDE.md, "PostHog-sectie" en de privacy-afweging van 2026-08-30):
// - Alleen expliciete events, geen autocapture.
// - Properties bevatten NOOIT vrije tekst, berichtinhoud, AI-output, namen, e-mail of
//   bedrijfsnaam. Alleen categorische waarden, tellingen en booleans.
// - Draait alleen client-side. Server-side tracking loopt hier niet doorheen.

import posthog from 'posthog-js'

// Feature-adoptie en het betreden van een feature-pagina worden gedekt door de
// genormaliseerde $pageview (PostHogTracker.tsx): een pageview op /bot/sparren IS het
// "sparren geopend"-signaal. De events hieronder zijn de momenten die geen pageview
// hebben (een actie voltooid, een CTA geklikt).
export type BotEvent =
  // Activatie-funnel
  | 'gesprek_afgerond'
  | 'sessie_synthese_getoond'
  | 'coaching_gestart'
  | 'coaching_synthese_getoond'
  | 'sparren_gestart'
  | 'sparren_debrief_getoond'
  // Feature-adoptie
  | 'voice_sessie_gestart'
  | 'deel_link_aangemaakt'
  // Conversie
  | 'upgrade_cta_geklikt'
  | 'abonnement_gestart' // nog niet gevuurd: geen betaalprovider (zie OPENSTAANDE_PUNTEN.md)
  | 'opzegging_gestart'
  // Team
  | 'teamlid_uitgenodigd'
  | 'teamlid_geactiveerd'
  | 'team_spotlight_bekeken'
  | 'team_1on1_gegenereerd'

type PropValue = string | number | boolean | null
export type BotEventProps = Record<string, PropValue>

function posthogEnabled(): boolean {
  return typeof window !== 'undefined' && !!process.env.NEXT_PUBLIC_POSTHOG_KEY
}

/**
 * Stuur een product-event naar PostHog. No-op als PostHog uit staat of server-side.
 * Faalt nooit hard: een kapotte analytics-call mag de app niet raken.
 */
export function track(event: BotEvent, properties?: BotEventProps): void {
  if (!posthogEnabled()) return
  try {
    posthog.capture(event, properties)
  } catch {
    // bewust stil: analytics mag de gebruiker nooit blokkeren
  }
}

/**
 * Zet person-properties op de huidige gebruiker. Gebruik alleen voor categorische
 * accountwaarden (plan, rol, status, tellingen), nooit voor PII.
 *
 * Tellingen (aantal_gesprekken e.d.) worden server-side berekend in
 * app/api/bot/posthog-identity/route.ts en bij elke sessiestart als absolute waarde
 * gezet, niet client-side geincrementeerd: dat is autoritatief en voorkomt drift.
 */
export function setPersonProps(properties: BotEventProps): void {
  if (!posthogEnabled()) return
  try {
    posthog.setPersonProperties(properties)
  } catch {
    // bewust stil
  }
}
