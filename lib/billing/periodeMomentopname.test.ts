/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Per betaling wordt vastgelegd welk abonnement en welke periode zij betaalde, alleen als de periode echt is
// gezet of verlengd (nodig om voor referraltegoed betaalde maanden te tellen). De echte verwerkingscode draait.

type Rij = Record<string, any>
const h = vi.hoisted(() => ({ tabellen: {} as Record<string, Rij[]>, haalBetaling: vi.fn(), tg: vi.fn(async () => {}) }))

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))
vi.mock('@/lib/cron-notify', () => ({ notifyTelegram: h.tg }))
vi.mock('@/lib/toegang', () => ({ trialEinde: vi.fn(() => null) }))
vi.mock('./mails', () => ({ verstuurBillingMail: vi.fn(async () => {}) }))
vi.mock('./facturatie', () => ({ creditnotaVoorBetaling: vi.fn(async () => {}), factureerBetaling: vi.fn(async () => {}) }))
vi.mock('./mollie', () => ({
  MollieError: class extends Error { status = 0 },
  haalBetaling: h.haalBetaling, haalAbonnement: vi.fn(), stopAbonnement: vi.fn(async () => {}),
  maakAbonnement: vi.fn(async () => ({ id: 'sub_mollie' })),
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
        neq: (k: string, v: unknown) => { filters.push(r => r[k] !== v); return q },
        in: (k: string, v: unknown[]) => { filters.push(r => v.includes(r[k])); return q },
        is: (k: string, v: unknown) => { filters.push(r => (r[k] ?? null) === v); return q },
        returns: () => q,
        update: (p: Rij) => { patch = p; return q },
        upsert: () => q,
        maybeSingle: async () => ({ data: (uitvoeren().data as Rij[] | null)?.[0] ?? null, error: null }),
        then: (res: any, rej: any) => Promise.resolve(uitvoeren()).then(res, rej),
      }
      return q
    },
  },
}))

import { verwerkMolliebetaling } from './verwerking'

const ISO = (s: string) => new Date(s).toISOString()
const abonnement = (extra: Rij = {}): Rij => ({
  id: 'rij-1', user_id: 'user_1', plan: 'premium', cyclus: 'maandelijks', klant_type: 'particulier', status: 'active',
  bedrag_cent: 5900, btw_cent: 1024, mollie_customer_id: 'cst_1', mollie_subscription_id: 'sub_mollie', mollie_sub_geannuleerd_at: null,
  periode_start: ISO('2026-11-04'), periode_einde: ISO('2026-12-04'), contract_einde: null, opzegging_ingaat_at: null, ...extra,
})
const betaling = (soort: string): Rij => ({
  id: 'pay-1', user_id: 'user_1', subscription_id: 'rij-1', mollie_payment_id: 'tr_1', soort, status: 'pending',
  bedrag_cent: 5900, btw_cent: 1024, terugbetaald_cent: 0, teruggeboekt_cent: 0, betaald_at: null, verwerkt_at: null, terugbetaling_verwerkt_at: null,
})
const mp = () => ({
  id: 'tr_1', status: 'paid', amount: { currency: 'EUR', value: '59.00' }, paidAt: '2026-12-04T08:00:00.000Z',
  subscriptionId: 'sub_mollie', metadata: { subscriptionRowId: 'rij-1' },
})
const rij = () => h.tabellen.arnobot_payments[0]

function zet(sub: Rij, soort: string) {
  h.tabellen = { arnobot_subscriptions: [sub], arnobot_payments: [betaling(soort)], approved_users: [{ user_id: 'user_1' }], arnobot_referrals: [] }
}

beforeEach(() => { h.haalBetaling.mockReset(); h.haalBetaling.mockResolvedValue(mp()) })

describe('periodemomentopname per betaling', () => {
  it('herhaalbetaling: legt plan, cyclus, klanttype en de verlengde periode vast', async () => {
    zet(abonnement(), 'herhaling')
    await verwerkMolliebetaling('tr_1')
    expect(rij()).toMatchObject({ plan: 'premium', cyclus: 'maandelijks', klant_type: 'particulier', periode_start: ISO('2026-12-04'), periode_einde: ISO('2027-01-04') })
  })
  it('eerste betaling: legt de eerste periode vast', async () => {
    zet(abonnement({ status: 'pending', periode_start: null, periode_einde: null, mollie_subscription_id: null }), 'eerste')
    await verwerkMolliebetaling('tr_1')
    expect(rij()).toMatchObject({ plan: 'premium', cyclus: 'maandelijks', periode_start: ISO('2026-12-04T08:00:00.000Z'), periode_einde: ISO('2027-01-04T08:00:00.000Z') })
  })
  it('betaling op een beëindigd abonnement verlengt niets en krijgt geen periode', async () => {
    zet(abonnement({ status: 'ended' }), 'herhaling')
    await verwerkMolliebetaling('tr_1')
    expect(rij().periode_start).toBeUndefined()
  })
})
