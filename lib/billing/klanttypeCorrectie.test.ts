/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from 'vitest'

// De betaalde correctie: pas factureren en mailen als het abonnement is omgezet, en dat precies een keer.

type Rij = Record<string, any>
const h = vi.hoisted(() => ({
  tabellen: {} as Record<string, Rij[]>,
  omzet: vi.fn(),
  stopExtra: vi.fn(async () => true),
  teruggestort: null as null | string,
  moneybird: false,
  mail: vi.fn(async () => true),
  tg: vi.fn(async (_t: string) => {}),
  leesFout: false,
}))

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/lib/cron-notify', () => ({ notifyTelegram: h.tg }))
vi.mock('@/lib/capaciteit', () => ({ nieuwMelden: async () => true }))
vi.mock('./mails', () => ({ verstuurBillingMail: h.mail }))
vi.mock('./moneybird', () => ({ moneybirdIngeschakeld: () => h.moneybird }))
vi.mock('./referralKorting', () => ({ redenGeenZelfCorrectie: async () => null }))
vi.mock('./verwerking', () => ({ stopCorrectieAbonnementen: h.stopExtra }))
vi.mock('./klanttypeOmzetten', () => ({ zetAbonnementZakelijk: h.omzet, controleerStart: vi.fn(), zakelijkBedragVan: vi.fn() }))
vi.mock('./mollie', () => ({
  SITE_URL: 'https://x.test', klantBestaat: async () => true,
  betaaldeBetalingVanLink: async () => ({ id: 'tr_1', status: 'paid', amount: { currency: 'EUR', value: '12.39' }, ...(h.teruggestort ? { amountRefunded: { value: h.teruggestort } } : {}) }),
}))
vi.mock('./db', () => ({
  billingDb: {
    from(tabel: string) {
      const filters: Array<(r: Rij) => boolean> = []
      let patch: Rij | null = null
      const uitvoeren = () => {
        const treffers = (h.tabellen[tabel] ?? []).filter(r => filters.every(f => f(r)))
        if (patch) for (const r of treffers) Object.assign(r, patch)
        return { data: treffers.map(r => ({ ...r })), error: null }
      }
      const q: any = {
        select: () => q, limit: () => q, order: () => q, returns: () => q, gt: () => { filters.push(() => false); return q },
        lt: (k: string, v: string) => { filters.push(r => !!r[k] && r[k] < v); return q },
        eq: (k: string, v: unknown) => { filters.push(r => r[k] === v); return q },
        is: (k: string, v: unknown) => { filters.push(r => (r[k] ?? null) === v); return q },
        not: (k: string) => { filters.push(r => (r[k] ?? null) !== null); return q },
        update: (p: Rij) => { patch = p; return q },
        upsert: async () => ({ error: null }),
        maybeSingle: async () => (h.leesFout ? { data: null, error: { message: 'weg' } } : { data: uitvoeren().data[0] ?? null, error: null }),
        then: (res: any, rej: any) => Promise.resolve(uitvoeren()).then(res, rej),
      }
      return q
    },
  },
}))

import { verwerkKlanttypeCorrectie } from './klanttypeCorrectie'

const rij = (extra: Rij = {}): Rij => ({
  id: 'c1', user_id: 'u1', subscription_id: 's1', status: 'open', mollie_payment_id: 'pl_1', verschil_cent: 1239,
  nieuw_bedrag_cent: 7139, nieuw_btw_cent: 1239, afgehandeld_at: null, handwerk_reden: null, bedrijfsnaam: 'Voorbeeld BV', created_at: '2026-12-01T09:00:00Z', ...extra,
})
// De melding 'betaald' volgt alleen bij het daadwerkelijk afronden; de klantmail hangt aan Moneybird.
const afgerond = () => h.tg.mock.calls.filter(c => c[0].startsWith('Klanttype-correctie betaald op'))
const correctie = () => h.tabellen.arnobot_klanttype_correcties[0]

beforeEach(() => {
  vi.clearAllMocks()
  h.leesFout = false
  h.teruggestort = null
  h.moneybird = false
  h.omzet.mockResolvedValue({ stand: 'omgezet' })
  h.tabellen = {
    arnobot_klanttype_correcties: [rij()],
    arnobot_subscriptions: [{ id: 's1', user_id: 'u1', plan: 'premium', cyclus: 'maandelijks' }],
    approved_users: [{ user_id: 'u1', voornaam: 'Test', email: 'u@x.nl' }],
    arnobot_billing_customers: [{ user_id: 'u1', mollie_customer_id: 'cst_1' }],
    arnobot_payments: [],
  }
})

describe('betaalde klanttype-correctie', () => {
  it('omgezet: afgevinkt en een keer gemaild, ook bij een herhaalde melding', async () => {
    await verwerkKlanttypeCorrectie('pl_1', null)
    await verwerkKlanttypeCorrectie('pl_1', null)
    expect(correctie()).toMatchObject({ status: 'paid' })
    expect(correctie().afgehandeld_at).toBeTruthy()
    expect(correctie().gefactureerd_at).toBeTruthy()
    expect(afgerond()).toHaveLength(1)
    expect(h.omzet).toHaveBeenCalledTimes(1)
  })
  it('wachten: niet afgevinkt, niet gemaild, wel gemeld', async () => {
    h.omzet.mockResolvedValue({ stand: 'wacht', reden: 'incasso dichtbij' })
    await verwerkKlanttypeCorrectie('pl_1', null)
    expect(correctie().afgehandeld_at).toBeNull()
    expect(h.mail).not.toHaveBeenCalled()
    expect(h.tg.mock.calls[0][0]).toContain('nog niet omgezet')
  })
  it('omzetten mislukt: de fout gaat door, een herhaalde melding maakt het af', async () => {
    h.omzet.mockRejectedValueOnce(new Error('mollie plat'))
    await expect(verwerkKlanttypeCorrectie('pl_1', null)).rejects.toThrow()
    expect(h.mail).not.toHaveBeenCalled()
    await verwerkKlanttypeCorrectie('pl_1', null)
    expect(afgerond()).toHaveLength(1)
  })
  it('tweede betaalde correctie op hetzelfde abonnement: niet nog eens omzetten, wel terugstorten melden', async () => {
    h.tabellen.arnobot_klanttype_correcties = [rij(), rij({ id: 'c0', mollie_payment_id: 'pl_0', status: 'paid', afgehandeld_at: '2026-11-30T00:00:00Z' })]
    await verwerkKlanttypeCorrectie('pl_1', null)
    expect(h.omzet).not.toHaveBeenCalled()
    expect(h.mail).not.toHaveBeenCalled()
    expect(h.tg.mock.calls[0][0]).toContain('dubbel betaald')
  })
  it('slot bezet door een andere aanroep: niets doen, wel als betaald vastgelegd', async () => {
    h.tabellen.arnobot_subscriptions[0].klanttype_bezig_tot = '2999-01-01T00:00:00Z'
    await verwerkKlanttypeCorrectie('pl_1', null)
    expect(h.omzet).not.toHaveBeenCalled()
    expect(correctie().status).toBe('paid')
  })
  it('het slot komt vrij, ook na een fout', async () => {
    h.omzet.mockRejectedValueOnce(new Error('mollie plat'))
    await expect(verwerkKlanttypeCorrectie('pl_1', null)).rejects.toThrow()
    expect(h.tabellen.arnobot_subscriptions[0].klanttype_bezig_tot).toBeNull()
  })
  it('handwerk: afgevinkt met reden, niet gefactureerd, wel gemeld', async () => {
    h.omzet.mockResolvedValue({ stand: 'handwerk', reden: 'het abonnement is intussen refunded' })
    await verwerkKlanttypeCorrectie('pl_1', null)
    expect(correctie()).toMatchObject({ handwerk_reden: 'het abonnement is intussen refunded' })
    expect(afgerond()).toHaveLength(0)
    expect(h.tg.mock.calls[0][0]).toContain('NIET omgezet')
  })
  it('verlopen slot wordt overgenomen', async () => {
    h.tabellen.arnobot_subscriptions[0].klanttype_bezig_tot = '2000-01-01T00:00:00Z'
    await verwerkKlanttypeCorrectie('pl_1', null)
    expect(h.omzet).toHaveBeenCalledTimes(1)
  })
  it('verschil al teruggestort: niet omzetten, afgevinkt als handwerk', async () => {
    h.teruggestort = '12.39'
    await verwerkKlanttypeCorrectie('pl_1', null)
    expect(h.omzet).not.toHaveBeenCalled()
    expect(h.stopExtra).toHaveBeenCalled()
    expect(correctie().handwerk_reden).toBeTruthy()
  })
  it('geen e-mailadres terwijl er gefactureerd moet worden: gemeld, niet stil', async () => {
    h.moneybird = true
    h.tabellen.approved_users = []
    await verwerkKlanttypeCorrectie('pl_1', null)
    expect(h.tg.mock.calls.some(c => c[0].includes('facturatie niet afgerond'))).toBe(true)
  })
  it('databasefout bij het opzoeken gooit, zodat Mollie het opnieuw probeert', async () => {
    h.leesFout = true
    await expect(verwerkKlanttypeCorrectie('pl_1', null)).rejects.toThrow()
  })
})
