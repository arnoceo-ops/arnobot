/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Een betaling uit een andere Mollie-modus (testbetaling) krijgt nooit een echte Moneybird-factuur. Gevonden op
// 2026-11-13: na het omzetten naar de live_-sleutel kregen twee testbetalingen alsnog een factuur (2026-0027 en
// 2026-0028) in de echte administratie. Database, Mollie en Moneybird zijn nagemaakt.

type Rij = Record<string, any>
const h = vi.hoisted(() => ({
  tabellen: {} as Record<string, Rij[]>,
  haalBetaling: vi.fn(),
  maakConceptFactuur: vi.fn(),
  zoekOfMaakContact: vi.fn(),
  verstuurFactuur: vi.fn(),
}))

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))
vi.mock('@/lib/cron-notify', () => ({ notifyTelegram: vi.fn(async () => {}) }))
vi.mock('./mollie', async orig => ({ ...(await orig<typeof import('./mollie')>()), haalBetaling: h.haalBetaling }))
vi.mock('./moneybird', () => ({
  moneybirdIngeschakeld: () => true,
  btwTariefId: async () => 'btw',
  factuurMailTekst: () => 'tekst',
  maakCreditnota: vi.fn(),
  registreerBetaling: vi.fn(),
  maakConceptFactuur: h.maakConceptFactuur,
  zoekOfMaakContact: h.zoekOfMaakContact,
  verstuurFactuur: h.verstuurFactuur,
}))
vi.mock('./db', () => ({
  billingDb: {
    from(tabel: string) {
      const rijen = (h.tabellen[tabel] ??= [])
      const filters: Array<(r: Rij) => boolean> = []
      let patch: Rij | null = null
      let teruggeven = false
      const uitvoeren = () => {
        const treffers = rijen.filter(r => filters.every(f => f(r)))
        if (patch) {
          for (const r of treffers) Object.assign(r, patch)
          return { data: teruggeven ? treffers.map(r => ({ ...r })) : null, error: null }
        }
        return { data: treffers.map(r => ({ ...r })), error: null }
      }
      const q: any = {
        select: () => { teruggeven = true; return q },
        eq: (k: string, v: unknown) => { filters.push(r => r[k] === v); return q },
        is: (k: string, v: unknown) => { filters.push(r => (r[k] ?? null) === v); return q },
        returns: () => q,
        update: (p: Rij) => { patch = p; return q },
        maybeSingle: async () => ({ data: (uitvoeren().data as Rij[] | null)?.[0] ?? null, error: null }),
        then: (res: any, rej: any) => Promise.resolve(uitvoeren()).then(res, rej),
      }
      return q
    },
  },
}))

import { MollieError } from './mollie'
import { factureerBetaling } from './facturatie'

const betaling = () => h.tabellen.arnobot_payments[0]

beforeEach(() => {
  process.env.MOLLIE_API_KEY = 'live_abc'
  for (const f of [h.haalBetaling, h.maakConceptFactuur, h.zoekOfMaakContact, h.verstuurFactuur]) f.mockReset()
  h.zoekOfMaakContact.mockResolvedValue('contact_1')
  h.maakConceptFactuur.mockResolvedValue({ id: 'factuur_1' })
  h.verstuurFactuur.mockResolvedValue(undefined)
  h.tabellen = {
    arnobot_payments: [{
      id: 'pay-1', user_id: 'user_1', subscription_id: 'rij-1', mollie_payment_id: 'tr_abc', soort: 'eerste', status: 'paid',
      bedrag_cent: 2900, btw_cent: 503, betaald_at: '2026-11-12T17:28:00.000Z', moneybird_factuur_id: null,
    }],
    arnobot_subscriptions: [{ id: 'rij-1', user_id: 'user_1', plan: 'basis', cyclus: 'maandelijks', klant_type: 'particulier', periode_start: '2026-11-12T17:28:00.000Z', periode_einde: '2026-12-12T17:28:00.000Z' }],
    approved_users: [{ user_id: 'user_1', voornaam: 'Test', email: 'test@arno.bot' }],
    arnobot_billing_customers: [],
  }
})

describe('factureerBetaling met een live_-sleutel', () => {
  it('een betaling die Mollie niet kent (testbetaling): geen factuur, en nooit opnieuw proberen', async () => {
    h.haalBetaling.mockRejectedValue(new MollieError(404, 'Not found'))
    await factureerBetaling('pay-1')
    expect(h.maakConceptFactuur).not.toHaveBeenCalled()
    expect(betaling().moneybird_factuur_id).toBe('testmodus')
    // Een tweede poging (bijvoorbeeld de dagelijkse cron) claimt de rij niet meer.
    await factureerBetaling('pay-1')
    expect(h.maakConceptFactuur).not.toHaveBeenCalled()
  })

  it('een betaling die Mollie als test aanmerkt: geen factuur', async () => {
    h.haalBetaling.mockResolvedValue({ id: 'tr_abc', mode: 'test' })
    await factureerBetaling('pay-1')
    expect(h.maakConceptFactuur).not.toHaveBeenCalled()
    expect(betaling().moneybird_factuur_id).toBe('testmodus')
  })

  it('een echte (live) betaling: wel een factuur, het id wordt vastgelegd', async () => {
    h.haalBetaling.mockResolvedValue({ id: 'tr_abc', mode: 'live' })
    await factureerBetaling('pay-1')
    expect(h.maakConceptFactuur).toHaveBeenCalledTimes(1)
    expect(betaling().moneybird_factuur_id).toBe('factuur_1')
  })

  it('Mollie niet te bereiken: de claim wordt losgelaten zodat de cron het opnieuw probeert, zonder factuur', async () => {
    h.haalBetaling.mockRejectedValue(new MollieError(500, 'storing'))
    await factureerBetaling('pay-1')
    expect(h.maakConceptFactuur).not.toHaveBeenCalled()
    expect(betaling().moneybird_factuur_id).toBeNull()
  })
})
