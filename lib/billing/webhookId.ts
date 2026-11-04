// Webhooks van Mollie-betaallinks (Team-facturen en de klanttype-correctie). Een betaallink kent
// geen metadata, dus de koppeling met onze eigen rij loopt via een hint-id in onze eigen
// webhook-URL (`?r=<rij-id>`). Dat hint-id wordt nooit vertrouwd: de betaling moet bij Mollie
// aantoonbaar bij de betaallink van die rij horen en betaald zijn (zie betaaldeBetalingVanLink).

const MOLLIE_ID = /^(tr|pl)_[A-Za-z0-9]{4,40}$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Haalt het betaling- (tr_) of betaallink-id (pl_) uit een webhookbody. Klassiek stuurt Mollie
 * een formulier met `id`, de nieuwe webhooks sturen JSON met `entityId` (het `id` daarin is het
 * event). Alles wat geen geldig tr_- of pl_-id is geeft null.
 */
export function leesWebhookId(raw: string): string | null {
  const form = new URLSearchParams(raw).get('id')
  if (form && MOLLIE_ID.test(form)) return form
  try {
    const json = JSON.parse(raw) as { entityId?: unknown; id?: unknown } | null
    const kandidaat = typeof json?.entityId === 'string' ? json.entityId : typeof json?.id === 'string' ? json.id : null
    return kandidaat && MOLLIE_ID.test(kandidaat) ? kandidaat : null
  } catch {
    return null
  }
}

/** Het hint-id uit de webhook-URL, alleen als het een geldige uuid is. */
export function leesRijHint(waarde: string | null): string | null {
  return waarde && UUID.test(waarde) ? waarde : null
}
