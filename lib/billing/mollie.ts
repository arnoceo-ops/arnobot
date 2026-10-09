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

export async function maakKlant(input: { naam: string; email: string; userId: string }): Promise<{ id: string }> {
  return mollie('/customers', {
    method: 'POST',
    body: { name: input.naam, email: input.email, metadata: { userId: input.userId } },
    idempotencyKey: `klant-${input.userId}`,
  })
}

export async function maakEersteBetaling(input: {
  klantId: string
  brutoCent: number
  omschrijving: string
  redirectUrl: string
  metadata: Record<string, unknown>
  idempotencyKey: string
}): Promise<MolliePayment> {
  return mollie('/payments', {
    method: 'POST',
    idempotencyKey: input.idempotencyKey,
    body: {
      amount: { currency: 'EUR', value: centenNaarMollie(input.brutoCent) },
      description: input.omschrijving,
      redirectUrl: input.redirectUrl,
      webhookUrl: MOLLIE_WEBHOOK_URL,
      customerId: input.klantId,
      sequenceType: 'first',
      method: ['ideal', 'creditcard'],
      locale: 'nl_NL',
      metadata: input.metadata,
    },
  })
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

export async function stopAbonnement(klantId: string, abonnementId: string): Promise<void> {
  try {
    await mollie(`/customers/${klantId}/subscriptions/${abonnementId}`, { method: 'DELETE' })
  } catch (e) {
    // Al geannuleerd of voltooid is voor ons hetzelfde als gelukt.
    if (e instanceof MollieError && (e.status === 404 || e.status === 410 || e.status === 422)) return
    throw e
  }
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
