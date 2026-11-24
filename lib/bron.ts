// Bronattributie voor folders en andere offline kanalen (docs/FOLDER_PLAN.md).
// Een QR wijst naar bijvoorbeeld /start?bron=folder-solo. De bron is een korte code en gaat
// ongewijzigd door naar arnobot_pageviews, arnobot_cta_clicks en approved_users, waar een
// databasecheck dezelfde vorm afdwingt (docs/sql/2026-11-24-bron-attributie.sql).
// Bewust niet `ref`: dat is het referralprogramma.

export const BRON_COOKIE = 'arnobot_bron'
export const BRON_COOKIE_DAGEN = 30

const BRON_PATROON = /^[a-z0-9-]{1,40}$/

/** Geeft de genormaliseerde bron terug, of null als de waarde ontbreekt of ongeldig is. */
export function schoonBron(waarde: unknown): string | null {
  if (typeof waarde !== 'string') return null
  const klein = waarde.trim().toLowerCase()
  return BRON_PATROON.test(klein) ? klein : null
}
