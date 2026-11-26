/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Zelf omzetten van particulier naar zakelijk: wanneer starten mag, en het vervangen van het Mollie-abonnement zonder
// ooit twee lopende abonnementen achter te laten. Mollie is een kleine nabootsing met echte toestand.

type Rij = Record<string, any>
const h = vi.hoisted(() => ({
  tabellen: {} as Record<string, Rij[]>,
  mollie: {} as Record<string, Rij>,
  maak: vi.fn(),
  stop: vi.fn(),
  openstaand: vi.fn(async () => false),
  maakVoor: vi.fn(async () => {}),
  tg: vi.fn(async (_t: string) => {}),
  schrijfFout: null as null | string,
}))

vi.mock('@/lib/cron-notify', () => ({ notifyTelegram: h.tg }))
vi.mock('./openstaandeBetaling', () => ({ heeftOpenstaandeBetaling: h.openstaand }))
vi.mock('./verwerking', () => ({ stopEnBevestig: h.stop, maakMollieAbonnementVoor: h.maakVoor }))
vi.mock('./mollie', () => ({
  MollieError: class extends Error { status = 0 },
  maakAbonnement: h.maak,
  haalAbonnement: vi.fn(async (_k: string, id: string) => ({ ...h.mollie[id] })),
}))
vi.mock('./db', () => ({
  billingDb: {
    from(tabel: string) {
      const filters: Array<(r: Rij) => boolean> = []
      let patch: Rij | null = null
      const uitvoeren = () => {
        const treffers = (h.tabellen[tabel] ?? []).filter(r => filters.every(f => f(r)))
        if (patch) {
          if (h.schrijfFout && h.schrijfFout in patch) return { data: null, error: { message: 'db stuk' } }
          for (const r of treffers) Object.assign(r, patch)
        }
        return { data: treffers.map(r => ({ ...r })), error: null }
      }
      const q: any = {
        select: () => q, limit: () => q,
        eq: (k: string, v: unknown) => { filters.push(r => r[k] === v); return q },
        is: (k: string, v: unknown) => { filters.push(r => (r[k] ?? null) === v); return q },
        update: (p: Rij) => { patch = p; return q },
        maybeSingle: async () => ({ data: uitvoeren().data?.[0] ?? null, error: null }),
        then: (res: any, rej: any) => Promise.resolve(uitvoeren()).then(res, rej),
      }
      return q
    },
  },
}))

import { controleerStart, zakelijkBedragVan, zetAbonnementZakelijk, TEKST_BETALING_LOOPT, TEKST_CORRECTIE_OPEN, TEKST_GEPLAND, TEKST_INCASSO_DICHTBIJ } from './klanttypeOmzetten'

const NU = new Date('2026-12-01T10:00:00Z')
const sub = (extra: Rij = {}): any => ({
  id: 's1', user_id: 'u1', plan: 'premium', cyclus: 'maandelijks', klant_type: 'particulier', status: 'active',
  bedrag_cent: 5900, btw_cent: 1024, mollie_customer_id: 'cst_1', mollie_subscription_id: 'sub_oud', mollie_sub_geannuleerd_at: null,
  periode_start: '2026-11-15T00:00:00Z', periode_einde: '2026-12-15T00:00:00Z', contract_einde: null,
  gepland_at: null, gepland_mollie_subscription_id: null, ...extra,
})
const rij = (extra: Rij = {}): any => ({
  id: 'c1', user_id: 'u1', subscription_id: 's1', nieuw_bedrag_cent: 7139, nieuw_btw_cent: 1239,
  nieuw_mollie_subscription_id: null, created_at: '2026-12-01T09:00:00Z', ...extra,
})
const db = () => h.tabellen.arnobot_subscriptions[0]
const lopend = () => Object.entries(h.mollie).filter(([, m]) => m.status === 'active').map(([id]) => id)

beforeEach(() => {
  vi.clearAllMocks()
  h.schrijfFout = null
  h.openstaand.mockResolvedValue(false)
  h.tabellen = { arnobot_subscriptions: [sub()], arnobot_klanttype_correcties: [rij()] }
  h.mollie = { sub_oud: { id: 'sub_oud', status: 'active', nextPaymentDate: '2026-12-15' } }
  let n = 0
  h.maak.mockImplementation(async (i: Rij) => {
    const id = `sub_nieuw${++n}`
    h.mollie[id] = { id, status: 'active', nextPaymentDate: i.startDatum.toISOString().slice(0, 10) }
    return { ...h.mollie[id] }
  })
  h.stop.mockImplementation(async (_s: unknown, id: string) => { h.mollie[id].status = 'canceled'; return true })
})

describe('zakelijk bedrag', () => {
  it('het eigen bedrag plus btw, gelijk aan de huidige prijslijst', () => {
    expect(zakelijkBedragVan(5900)).toEqual({ nettoCent: 5900, btwCent: 1239, brutoCent: 7139 })
  })
})

describe('starten', () => {
  it('ruim voor de incasso: mag, link een dag geldig', async () => {
    expect(await controleerStart(sub(), NU)).toEqual({ ok: true, linkVerlooptOp: new Date('2026-12-02T10:00:00Z') })
  })
  it('link verloopt vóór de grens van vier dagen voor de incasso', async () => {
    h.mollie.sub_oud.nextPaymentDate = '2026-12-06'
    expect(await controleerStart(sub(), NU)).toEqual({ ok: true, linkVerlooptOp: new Date('2026-12-02T00:00:00Z') })
  })
  it('incasso binnen vier dagen: weigeren', async () => {
    h.mollie.sub_oud.nextPaymentDate = '2026-12-04'
    expect(await controleerStart(sub(), NU)).toEqual({ ok: false, fout: TEKST_INCASSO_DICHTBIJ })
  })
  it('geplande wijziging: weigeren', async () => {
    expect(await controleerStart(sub({ gepland_at: '2026-11-30T00:00:00Z' }), NU)).toEqual({ ok: false, fout: TEKST_GEPLAND })
  })
  it('lopende betaling: weigeren', async () => {
    h.openstaand.mockResolvedValue(true)
    expect(await controleerStart(sub(), NU)).toEqual({ ok: false, fout: TEKST_BETALING_LOOPT })
  })
  it('betaald maar nog niet omgezet: niet nog eens laten betalen', async () => {
    h.tabellen.arnobot_klanttype_correcties = [rij({ status: 'paid', abonnement_omgezet_at: null })]
    expect(await controleerStart(sub(), NU)).toEqual({ ok: false, fout: TEKST_CORRECTIE_OPEN })
  })
  it('particulier jaar zonder incasso: mag', async () => {
    expect(await controleerStart(sub({ cyclus: 'jaarlijks', mollie_subscription_id: null, periode_einde: '2027-06-01T00:00:00Z' }), NU)).toMatchObject({ ok: true })
  })
})

describe('abonnement omzetten', () => {
  it('nieuw abonnement op het zakelijke bedrag vanaf de volgende incasso, oude gestopt, database bij', async () => {
    h.tabellen.arnobot_subscriptions = [sub({ contract_einde: '2027-11-15T00:00:00Z' })]
    expect(await zetAbonnementZakelijk(rij(), NU)).toEqual({ stand: 'omgezet' })
    expect(h.maak.mock.calls[0][0]).toMatchObject({ brutoCent: 7139, interval: '1 month', times: null })
    expect(lopend()).toEqual(['sub_nieuw1'])
    expect(db()).toMatchObject({ klant_type: 'zakelijk', bedrag_cent: 7139, btw_cent: 1239, mollie_subscription_id: 'sub_nieuw1', contract_einde: null })
  })
  it.each([
    ['incasso te dichtbij', () => { h.mollie.sub_oud.nextPaymentDate = '2026-12-03' }],
    ['lopende betaling', () => { h.openstaand.mockResolvedValue(true) }],
    ['oude niet actief', () => { h.mollie.sub_oud.status = 'suspended' }],
    ['intussen een wijziging gepland', () => { h.tabellen.arnobot_subscriptions = [sub({ gepland_at: 'x' })] }],
  ])('%s: wachten en niets wijzigen', async (_n, zet) => {
    zet()
    expect(await zetAbonnementZakelijk(rij(), NU)).toMatchObject({ stand: 'wacht' })
    expect(h.maak).not.toHaveBeenCalled()
    expect(db()).toMatchObject({ klant_type: 'particulier', bedrag_cent: 5900 })
  })
  it('oude niet te stoppen: het nieuwe gaat weer weg, nooit twee lopende', async () => {
    h.stop.mockImplementation(async (_s: unknown, id: string) => { if (id === 'sub_oud') return false; h.mollie[id].status = 'canceled'; return true })
    await expect(zetAbonnementZakelijk(rij(), NU)).rejects.toThrow()
    expect(lopend()).toEqual(['sub_oud'])
    expect(h.tabellen.arnobot_klanttype_correcties[0].nieuw_mollie_subscription_id).toBeNull()
    expect(db().klant_type).toBe('particulier')
  })
  it('geen van beide te stoppen: dringende melding', async () => {
    h.stop.mockResolvedValue(false)
    await expect(zetAbonnementZakelijk(rij(), NU)).rejects.toThrow()
    expect(h.tg.mock.calls[0][0]).toContain('HALF AFGEROND')
  })
  it('nieuw id niet op te slaan: het nieuwe meteen weer gestopt, oude loopt door', async () => {
    h.schrijfFout = 'nieuw_mollie_subscription_id'
    await expect(zetAbonnementZakelijk(rij(), NU)).rejects.toThrow()
    expect(lopend()).toEqual(['sub_oud'])
  })
  it('database faalt na het stoppen: de herhaling maakt geen derde abonnement en werkt de database bij', async () => {
    h.schrijfFout = 'klant_type'
    await expect(zetAbonnementZakelijk(rij(), NU)).rejects.toThrow()
    h.schrijfFout = null
    expect(await zetAbonnementZakelijk(rij({ nieuw_mollie_subscription_id: 'sub_nieuw1' }), new Date('2026-12-02T10:00:00Z'))).toEqual({ stand: 'omgezet' })
    expect(h.maak).toHaveBeenCalledTimes(1)
    expect(lopend()).toEqual(['sub_nieuw1'])
    expect(db().mollie_subscription_id).toBe('sub_nieuw1')
  })
  it('blijven liggen terwijl het oude intussen heeft geïncasseerd: het nieuwe gaat weg en er komt een nieuwe start', async () => {
    h.mollie.sub_blijf = { id: 'sub_blijf', status: 'active', nextPaymentDate: '2026-12-15' }
    h.mollie.sub_oud.nextPaymentDate = '2027-01-15'
    await zetAbonnementZakelijk(rij({ nieuw_mollie_subscription_id: 'sub_blijf' }), new Date('2026-12-20T10:00:00Z'))
    expect(lopend()).toEqual(['sub_nieuw1'])
    expect(h.mollie.sub_nieuw1.nextPaymentDate).toBe('2027-01-15')
  })
  it('al omgezet, alleen het afvinken mislukt: niets bij Mollie', async () => {
    h.tabellen.arnobot_subscriptions = [sub({ klant_type: 'zakelijk', mollie_subscription_id: 'sub_nieuw1' })]
    expect(await zetAbonnementZakelijk(rij({ nieuw_mollie_subscription_id: 'sub_nieuw1' }), NU)).toEqual({ stand: 'omgezet' })
    expect(h.stop).not.toHaveBeenCalled()
  })
  it('particulier jaar: geen contracteinde meer en een zakelijk abonnement erbij', async () => {
    h.tabellen.arnobot_subscriptions = [sub({ cyclus: 'jaarlijks', mollie_subscription_id: null, contract_einde: '2027-11-15T00:00:00Z' })]
    expect(await zetAbonnementZakelijk(rij(), NU)).toEqual({ stand: 'omgezet' })
    expect(db()).toMatchObject({ klant_type: 'zakelijk', contract_einde: null })
    expect(h.maakVoor).toHaveBeenCalledWith(expect.objectContaining({ klant_type: 'zakelijk', bedrag_cent: 7139 }), expect.any(Date))
  })
  it('opgezegd abonnement: alleen de database, geen nieuwe incasso', async () => {
    h.tabellen.arnobot_subscriptions = [sub({ status: 'cancelled', mollie_sub_geannuleerd_at: 'x' })]
    await zetAbonnementZakelijk(rij(), NU)
    expect(h.maak).not.toHaveBeenCalled()
    expect(h.maakVoor).not.toHaveBeenCalled()
    expect(db().klant_type).toBe('zakelijk')
  })
})
