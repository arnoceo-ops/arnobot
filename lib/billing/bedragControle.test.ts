/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ plat: false, subs: [] as any[], ms: {} as Record<string, any>, tg: vi.fn(async (_t: string) => {}) }))

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))
vi.mock('@/lib/cron-notify', () => ({ notifyTelegram: h.tg }))
vi.mock('@/lib/capaciteit', () => ({ nieuwMelden: async () => true }))
vi.mock('@/lib/internalTestAccounts', () => ({ isInternalTestUser: (u: string) => u === 'test' }))
vi.mock('./mollie', () => ({ lijstKlantAbonnementen: async () => { if (h.plat) throw new Error('mollie plat'); return Object.entries(h.ms).map(([id, m]) => ({ id, ...(m as object) })) } }))
vi.mock('./db', () => ({
  billingDb: {
    from() {
      const q: any = { select: () => q, in: () => q, limit: () => q, returns: () => q, then: (res: any) => Promise.resolve({ data: h.subs, error: null }).then(res) }
      return q
    },
  },
}))

import { controleerAbonnementsBedragen } from './bedragControle'

const sub = (extra: any = {}) => ({ status: 'active', user_id: 'u1', mollie_customer_id: 'c', mollie_subscription_id: 'a', mollie_sub_geannuleerd_at: null, bedrag_cent: 7139, gepland_mollie_subscription_id: null, ...extra })
const actief = (value: string) => ({ status: 'active', amount: { currency: 'EUR', value } })

beforeEach(() => { vi.clearAllMocks(); h.subs = [sub()]; h.ms = { a: actief('71.39') }; h.plat = false })

describe('bedragcontrole', () => {
  it('gelijk: stil', async () => {
    expect(await controleerAbonnementsBedragen()).toBe(0)
    expect(h.tg).not.toHaveBeenCalled()
  })
  it('afwijkend: melding met beide bedragen', async () => {
    h.ms.a = actief('59.00')
    expect(await controleerAbonnementsBedragen()).toBe(1)
    expect(h.tg.mock.calls[0][0]).toContain('Bij Mollie')
  })
  it('gepland abonnement wordt tegen het geplande bedrag gehouden, een gestopt abonnement niet', async () => {
    h.subs = [sub({ mollie_sub_geannuleerd_at: 'x', gepland_mollie_subscription_id: 'b', gepland_bedrag_cent: 1000 })]
    h.ms = { b: actief('12.00') }
    expect(await controleerAbonnementsBedragen()).toBe(1)
  })
  it('testaccounts tellen niet mee', async () => {
    h.subs = [sub({ user_id: 'test' })]
    h.ms.a = actief('1.00')
    expect(await controleerAbonnementsBedragen()).toBe(0)
  })
  it.each(['canceled', 'suspended', 'completed'])('lopende klant met een %s abonnement: melding', async status => {
    h.ms.a = { ...actief('71.39'), status }
    expect(await controleerAbonnementsBedragen()).toBe(1)
    expect(h.tg.mock.calls[0][0]).toContain('ontbreekt bij Mollie')
  })
  it('verlengd particulier abonnement dat klaar is: stil', async () => {
    h.subs = [sub({ status: 'active', contract_einde: '2027-01-01' })]
    h.ms.a = { ...actief('71.39'), status: 'completed' }
    expect(await controleerAbonnementsBedragen()).toBe(0)
  })
  it('onbekend lopend abonnement: melding', async () => {
    h.ms.extra = actief('71.39')
    expect(await controleerAbonnementsBedragen()).toBe(1)
    expect(h.tg.mock.calls[0][0]).toContain('Onbekend lopend abonnement')
  })
  it('niet te lezen bij Mollie: fout, niet stil', async () => {
    h.plat = true
    await expect(controleerAbonnementsBedragen()).rejects.toThrow()
  })
})
