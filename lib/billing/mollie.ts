import { centenNaarMollie } from './geld'
import { INTERNAL_TEST_USER_IDS } from '@/lib/internalTestAccounts'

// Dunne Mollie-client op rauwe fetch (geen SDK, zelfde keuze als OpenAI en ElevenLabs
// elders in de app). Alleen de endpoints die we echt gebruiken.
// Docs: https://docs.mollie.com/reference/overview

const API = 'https://api.mollie.com/v2'

// Altijd www: arno.bot zonder www stuurt een 308-redirect, en een redirect op een
// webhook-POST breekt de aflevering.
export const SITE_URL = 'https://www.arno.bot'
export const MOLLIE_WEBHOOK_URL = `${SITE_URL}/api/webhooks/mollie`

export function mollieIngeschakeld(): boolean {
  return !!process.env.MOLLIE_API_KEY
}

/**
 * Mag deze gebruiker online afrekenen? Met een live_-sleutel iedereen. Met een test_-sleutel
 * alleen de eigenaar en de interne testaccounts: in testmodus is een nepbetaling gratis te
 * voltooien, dus echte gebruikers blijven op de handmatige factuurflow tot de live-sleutel er staat.
 */
export function mollieBeschikbaarVoor(userId: string): boolean {
  const key = process.env.MOLLIE_API_KEY
  if (!key) return false
  if (key.startsWith('live_')) return true
  const eigenaar = process.env.ARNOBOT_OWNER_USER_ID
  return INTERNAL_TEST_USER_IDS.includes(userId) || (!!eigenaar && eigenaar === userId)
}

export class MollieError extends Error {
  status: number
  detail: string
  constructor(status: number, detail: string) {
    super(`Mollie ${status}: ${detail}`)
    this.status = status
    this.detail = detail
  }
}

export interface MollieAmount { currency: string; value: string }

export type MolliePaymentStatus = 'open' | 'canceled' | 'pending' | 'authorized' | 'expired' | 'failed' | 'paid'

export interface MolliePayment {
  id: string
  /** Modus waarin de betaling is gedaan; Mollie toont met een live_-sleutel alleen live-betalingen. */
  mode?: 'live' | 'test'
  status: MolliePaymentStatus
  amount: MollieAmount
  amountRefunded?: MollieAmount
  amountChargedBack?: MollieAmount
  paidAt?: string | null
  customerId?: string | null
  subscriptionId?: string | null
  mandateId?: string | null
  sequenceType?: 'oneoff' | 'first' | 'recurring'
  metadata?: Record<string, unknown> | null
  _links?: { checkout?: { href: string } }
}

export interface MollieSubscription {
  id: string
  status: 'pending' | 'active' | 'canceled' | 'suspended' | 'completed'
  nextPaymentDate?: string | null
}

export interface MollieMandate {
  id: string
  status: 'valid' | 'pending' | 'invalid'
  method: string
}

async function mollie<T>(
  pad: string,
  init: { method?: 'GET' | 'POST' | 'DELETE'; body?: unknown; idempotencyKey?: string } = {},
): Promise<T> {
  const key = process.env.MOLLIE_API_KEY
  if (!key) throw new MollieError(0, 'MOLLIE_API_KEY ontbreekt')
  const res = await fetch(`${API}${pad}`, {
    method: init.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...(init.idempotencyKey ? { 'Idempotency-Key': init.idempotencyKey } : {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    signal: AbortSignal.timeout(15000),
  })
  if (res.status === 204) return undefined as T
  const text = await res.text()
  let json: unknown = null
  try { json = text ? JSON.parse(text) : null } catch { /* geen JSON */ }
  if (!res.ok) {
    const detail = (json as { detail?: string; title?: string } | null)?.detail
      ?? (json as { title?: string } | null)?.title
      ?? text.slice(0, 200)
    throw new MollieError(res.status, detail)
  }
  return json as T
}

/**
 * `vervangt` is het id van een klant die bij Mollie niet (meer) bestaat; de idempotency-key krijgt dan een
 * eigen achtervoegsel, anders zou Mollie binnen de bewaartermijn de oude respons teruggeven.
 */
export async function maakKlant(input: { naam: string; email: string; userId: string; vervangt?: string }): Promise<{ id: string }> {
  return mollie('/customers', {
    method: 'POST',
    body: { name: input.naam, email: input.email, metadata: { userId: input.userId } },
    idempotencyKey: input.vervangt ? `klant-${input.userId}-na-${input.vervangt}` : `klant-${input.userId}`,
  })
}

/**
 * Bestaat deze klant bij Mollie in de huidige modus (test of live)? Een klant uit de andere modus, of uit een
 * ander profiel, geeft 404. Andere fouten (Mollie onbereikbaar, sleutel fout) gooien we door: dan weten we het niet.
 */
export async function klantBestaat(klantId: string): Promise<boolean> {
  if (!/^cst_[A-Za-z0-9]+$/.test(klantId)) return false
  try {
    await mollie(`/customers/${klantId}`)
    return true
  } catch (e) {
    if (e instanceof MollieError && (e.status === 404 || e.status === 410)) return false
    throw e
  }
}

/** Methoden voor een eerste betaling. Bancontact is voor Belgische klanten; iDEAL en kaart voor de rest. */
const EERSTE_BETALING_METHODEN = ['ideal', 'creditcard', 'bancontact']

export async function maakEersteBetaling(input: {
  klantId: string
  brutoCent: number
  omschrijving: string
  redirectUrl: string
  metadata: Record<string, unknown>
  idempotencyKey: string
}): Promise<MolliePayment> {
  const maak = (methoden: string[], sleutel: string) =>
    mollie<MolliePayment>('/payments', {
      method: 'POST',
      idempotencyKey: sleutel,
      body: {
        amount: { currency: 'EUR', value: centenNaarMollie(input.brutoCent) },
        description: input.omschrijving,
        redirectUrl: input.redirectUrl,
        webhookUrl: MOLLIE_WEBHOOK_URL,
        customerId: input.klantId,
        sequenceType: 'first',
        method: methoden,
        locale: 'nl_NL',
        metadata: input.metadata,
      },
    })

  try {
    return await maak(EERSTE_BETALING_METHODEN, input.idempotencyKey)
  } catch (e) {
    // Een methode die nog niet is geactiveerd op het Mollie-profiel (bijv. Bancontact) laat
    // Mollie de hele aanvraag weigeren (422). Dan zonder die methode opnieuw, zodat afrekenen
    // nooit stukgaat op een activatie die nog moet gebeuren.
    if (e instanceof MollieError && e.status === 422) {
      return maak(['ideal', 'creditcard'], `${input.idempotencyKey}-basis`)
    }
    throw e
  }
}

export async function haalBetaling(id: string): Promise<MolliePayment> {
  if (!/^tr_[A-Za-z0-9]+$/.test(id)) throw new MollieError(422, 'Ongeldig betaal-id')
  return mollie(`/payments/${id}`)
}

export async function maakAbonnement(input: {
  klantId: string
  brutoCent: number
  interval: '1 month' | '12 months'
  times: number | null
  startDatum: Date
  omschrijving: string
  metadata: Record<string, unknown>
  idempotencyKey: string
}): Promise<MollieSubscription> {
  return mollie(`/customers/${input.klantId}/subscriptions`, {
    method: 'POST',
    idempotencyKey: input.idempotencyKey,
    body: {
      amount: { currency: 'EUR', value: centenNaarMollie(input.brutoCent) },
      interval: input.interval,
      ...(input.times ? { times: input.times } : {}),
      startDate: input.startDatum.toISOString().slice(0, 10),
      description: input.omschrijving,
      webhookUrl: MOLLIE_WEBHOOK_URL,
      metadata: input.metadata,
    },
  })
}

/**
 * Een losse vervolgbetaling met de bestaande machtiging van de klant (geen abonnement), bijvoorbeeld de
 * bijbetaling bij een upgrade. Gaat direct af; bij SEPA blijft hij eerst "pending". Gemeten in testmodus
 * (2026-11-12): geen subscriptionId, wel de eigen metadata, mandateId staat erbij.
 */
export async function maakLosseHerhaalBetaling(input: {
  klantId: string
  brutoCent: number
  omschrijving: string
  metadata: Record<string, unknown>
  idempotencyKey: string
}): Promise<MolliePayment> {
  return mollie('/payments', {
    method: 'POST',
    idempotencyKey: input.idempotencyKey,
    body: {
      amount: { currency: 'EUR', value: centenNaarMollie(input.brutoCent) },
      description: input.omschrijving,
      webhookUrl: MOLLIE_WEBHOOK_URL,
      customerId: input.klantId,
      sequenceType: 'recurring',
      metadata: input.metadata,
    },
  })
}

export async function stopAbonnement(klantId: string, abonnementId: string): Promise<void> {
  try {
    await mollie(`/customers/${klantId}/subscriptions/${abonnementId}`, { method: 'DELETE' })
  } catch (e) {
    // Al geannuleerd of voltooid is voor ons hetzelfde als gelukt.
    if (e instanceof MollieError && (e.status === 404 || e.status === 410 || e.status === 422)) return
    throw e
  }
}

/** Haalt een abonnement bij Mollie op (status, volgende incassodatum). Alleen lezen. */
export async function haalAbonnement(klantId: string, abonnementId: string): Promise<MollieSubscription> {
  if (!/^sub_[A-Za-z0-9]+$/.test(abonnementId)) throw new MollieError(422, 'Ongeldig abonnement-id')
  return mollie(`/customers/${klantId}/subscriptions/${abonnementId}`)
}

/** Betalingen van één abonnement bij Mollie (nieuwste eerst, standaard maximaal 50). Alleen lezen. */
export async function lijstAbonnementBetalingen(klantId: string, abonnementId: string): Promise<MolliePayment[]> {
  if (!/^sub_[A-Za-z0-9]+$/.test(abonnementId)) throw new MollieError(422, 'Ongeldig abonnement-id')
  const res = await mollie<{ _embedded?: { payments?: MolliePayment[] } }>(`/customers/${klantId}/subscriptions/${abonnementId}/payments`)
  return res._embedded?.payments ?? []
}

export async function heeftGeldigeMachtiging(klantId: string): Promise<boolean> {
  const res = await mollie<{ _embedded?: { mandates?: MollieMandate[] } }>(`/customers/${klantId}/mandates`)
  return (res._embedded?.mandates ?? []).some(m => m.status === 'valid')
}

export async function betaalTerug(input: {
  betalingId: string
  brutoCent: number
  omschrijving: string
  idempotencyKey: string
}): Promise<{ id: string; status: string }> {
  return mollie(`/payments/${input.betalingId}/refunds`, {
    method: 'POST',
    idempotencyKey: input.idempotencyKey,
    body: {
      amount: { currency: 'EUR', value: centenNaarMollie(input.brutoCent) },
      description: input.omschrijving,
    },
  })
}

export interface MolliePaymentLink {
  id: string
  url: string
  _links?: { paymentLink?: { href: string } }
}

/**
 * Eenmalige betaallink met een vast bedrag (Payment Links API). Gebruikt voor Team-facturen:
 * daar varieert het bedrag per factuur (seats × prijs), dus geen Mollie Subscription (die wil
 * een vast bedrag per cyclus). reusable staat bewust niet aan: één link hoort bij één factuur.
 *
 * Een betaallink kent GEEN metadata (Mollie geeft 422). De koppeling met onze eigen rij loopt
 * via `?r=<rij-id>` in de webhookUrl, zie lib/billing/webhookId.ts.
 */
export async function maakBetaalLink(input: {
  brutoCent: number
  omschrijving: string
  redirectUrl: string
  /** Welke webhook de statusupdates van betalingen via deze link ontvangt. */
  webhookUrl: string
  idempotencyKey: string
}): Promise<MolliePaymentLink> {
  const res = await mollie<{ id: string; _links?: { paymentLink?: { href: string } } }>('/payment-links', {
    method: 'POST',
    idempotencyKey: input.idempotencyKey,
    body: {
      amount: { currency: 'EUR', value: centenNaarMollie(input.brutoCent) },
      description: input.omschrijving,
      redirectUrl: input.redirectUrl,
      webhookUrl: input.webhookUrl,
    },
  })
  // Mollie geeft de betaalpagina als _links.paymentLink.href, er is geen `url`-veld.
  const url = res._links?.paymentLink?.href
  if (!url) throw new MollieError(0, 'Mollie gaf geen betaallink-url terug')
  return { id: res.id, url, _links: res._links }
}

/** Betalingen die via een betaallink zijn gedaan (Mollie: GET /payment-links/{id}/payments). */
export async function lijstBetaalLinkBetalingen(linkId: string): Promise<MolliePayment[]> {
  const res = await mollie<{ _embedded?: { payments?: MolliePayment[] } }>(`/payment-links/${encodeURIComponent(linkId)}/payments`)
  return res._embedded?.payments ?? []
}

/**
 * De betaalde betaling van een betaallink, of null. Bij een tr_-id telt alleen die ene
 * betaling, en alleen als Mollie bevestigt dat hij bij deze link hoort: zo kan een nagemaakte
 * webhook-aanroep nooit een andere betaling aan deze factuur koppelen.
 */
export async function betaaldeBetalingVanLink(linkId: string, webhookId: string): Promise<MolliePayment | null> {
  const betalingen = await lijstBetaalLinkBetalingen(linkId)
  const kandidaten = webhookId.startsWith('tr_') ? betalingen.filter(p => p.id === webhookId) : betalingen
  return kandidaten.find(p => p.status === 'paid') ?? null
}

export interface MollieRefund {
  id: string
  paymentId: string
  status: 'queued' | 'pending' | 'processing' | 'refunded' | 'failed' | 'canceled'
  amount: MollieAmount
  createdAt: string
}

/** Recente terugbetalingen van het hele profiel, ook die in het Mollie-dashboard zijn gedaan. */
export async function lijstRecenteTerugbetalingen(limiet = 250): Promise<MollieRefund[]> {
  const res = await mollie<{ _embedded?: { refunds?: MollieRefund[] } }>(`/refunds?limit=${limiet}`)
  return res._embedded?.refunds ?? []
}

/** Testmodus of live, afgeleid van het sleutelvoorvoegsel (de sleutel zelf verlaat dit bestand niet). */
export function mollieModus(): 'live' | 'test' | null {
  const key = process.env.MOLLIE_API_KEY
  if (!key) return null
  return key.startsWith('live_') ? 'live' : 'test'
}

/** Gezondheidscheck: een alleen-lezen aanroep die slaagt als de sleutel geldig is en Mollie bereikbaar. */
export async function pingMollie(): Promise<void> {
  await mollie('/methods')
}
