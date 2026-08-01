// Gedeeld tussen alle anonieme-tracking-routes (track-pageview, track-cta-click), zodat
// een aanpassing aan het patroon niet op één route wordt doorgevoerd en op de andere
// vergeten wordt.
export const BOT_UA_PATTERN = /bot|crawler|spider|slurp|bingpreview|facebookexternalhit|headlesschrome|python-requests|curl\/|wget\//i

export function isBotUserAgent(userAgent: string): boolean {
  return BOT_UA_PATTERN.test(userAgent)
}
