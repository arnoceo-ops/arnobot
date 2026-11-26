/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Vangnet voor een gemiste webhook op een open teamfactuur. De echte verwerkingscode draait.

type Rij = Record<string, any>
const h = vi.hoisted(() => ({
  rijen: [] as Rij[],
  betaald: vi.fn(),
  ontblokkeer: vi.fn(async () => true),
  vastleggen: vi.fn(async () => {}),
  dbFout: null as null | 'lezen' | 'schrijven',
}))

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/lib/cron-notify', () => ({ notifyTelegram: vi.fn(async () => {}) }))
vi.mock('@/lib/teamOpzegging', () => ({ ontblokkeerNaBetaling: h.ontblokkeer }))
vi.mock('./mollie', () => ({ betaaldeBetalingVanLink: h.betaald, SITE_URL: 'https://x.test' }))
vi.mock('./teamBetalingen', () => ({
  legBetaalwijzeVast: h.vastleggen, verwerkTeamNaBetaling: vi.fn(),
  terugBijMollie: (p: any) => ({
    terugbetaald: p.amountRefunded ? Math.round(Number(p.amountRefunded.value) * 100) : 0,
    teruggeboekt: p.amountChargedBack ? Math.round(Number(p.amountChargedBack.value) * 100) : 0,
  }),
}))
vi.mock('./moneybird', () => ({ moneybirdIngeschakeld: () => false }))
vi.mock('./teamMails', () => ({ verstuurTeamMail: vi.fn() }))
vi.mock('./db', () => ({
  billingDb: {
    from() {
      const filters: Array<(r: Rij) => boolean> = []
      let patch: Rij | null = null
      const uitvoeren = () => {
        const treffers = h.rijen.filter(r => filters.every(f => f(r)))
        if (patch) for (const r of treffers) Object.assign(r, patch)
        return { data: treffers.map(r => ({ ...r })), error: null }
      }
      const fout = { data: null, error: { message: 'database weg' } }
      const q: any = {
        select: () => q,
        eq: (k: string, v: unknown) => { filters.push(r => r[k] === v); return q },
        not: (k: string) => { filters.push(r => r[k] != null); return q },
        returns: () => q,
        update: (p: Rij) => { patch = p; return q },
        maybeSingle: async () => (h.dbFout === 'lezen' ? fout : { data: uitvoeren().data[0] ?? null, error: null }),
        then: (res: any, rej: any) => Promise.resolve(h.dbFout === 'schrijven' && patch ? fout : uitvoeren()).then(res, rej),
      }
      return q
    },
  },
}))

import { haalGemisteTeamBetalingenIn } from './teamFacturatie'

const factuur = (extra: Rij = {}): Rij => ({ id: 'f1', team_id: 't1', status: 'open', bedrag_cent: 29645, mollie_payment_link_id: 'pl_1', moneybird_factuur_id: null, ...extra })
const betaling = (value = '296.45') => ({ id: 'tr_1', status: 'paid', amount: { currency: 'EUR', value }, paidAt: '2026-11-24T09:00:00.000Z' })

beforeEach(() => { h.rijen = [factuur()]; h.dbFout = null; vi.clearAllMocks() })

describe('gemiste teambetalingen inhalen', () => {
  it('betaald bij Mollie: factuur op betaald, blokkade eraf, betaalwijze vastgelegd', async () => {
    h.betaald.mockResolvedValue(betaling())
    expect(await haalGemisteTeamBetalingenIn()).toMatchObject({ ingehaald: 1, fouten: 0 })
    expect(h.rijen[0]).toMatchObject({ status: 'paid', betaald_at: '2026-11-24T09:00:00.000Z' })
    expect(h.ontblokkeer).toHaveBeenCalledWith('t1', expect.any(String))
    expect(h.vastleggen).toHaveBeenCalledWith('f1', 'tr_1')
  })
  it('nog niet betaald: niets verandert', async () => {
    h.betaald.mockResolvedValue(null)
    expect(await haalGemisteTeamBetalingenIn()).toEqual({ ingehaald: 0, fouten: 0, nietGecontroleerd: [], afwijkend: [] })
    expect(h.rijen[0].status).toBe('open')
  })
  it('afwijkend bedrag telt niet als betaald en wordt apart teruggegeven', async () => {
    h.betaald.mockResolvedValue(betaling('1.00'))
    expect(await haalGemisteTeamBetalingenIn()).toMatchObject({ ingehaald: 0, afwijkend: ['f1'] })
    expect(h.rijen[0].status).toBe('open')
  })
  it('betaald maar al teruggeboekt: niet op betaald en geen blokkade opheffen', async () => {
    h.betaald.mockResolvedValue({ ...betaling(), amountChargedBack: { currency: 'EUR', value: '296.45' } })
    expect(await haalGemisteTeamBetalingenIn()).toMatchObject({ ingehaald: 0, fouten: 0 })
    expect(h.rijen[0]).toMatchObject({ status: 'refunded', teruggeboekt_cent: 29645 })
    expect(h.rijen[0].reversed_at).toBeTruthy()
    expect(h.ontblokkeer).not.toHaveBeenCalled()
  })
  it.each(['lezen', 'schrijven'] as const)('databasefout bij %s: geldt als niet gecontroleerd, dus geen herinnering of blokkade', async soort => {
    h.dbFout = soort
    h.betaald.mockResolvedValue(betaling())
    expect(await haalGemisteTeamBetalingenIn()).toMatchObject({ ingehaald: 0, fouten: 1, nietGecontroleerd: ['f1'] })
    expect(h.ontblokkeer).not.toHaveBeenCalled()
  })
  it('fout bij één factuur houdt de andere niet tegen', async () => {
    h.rijen = [factuur(), factuur({ id: 'f2', mollie_payment_link_id: 'pl_2' })]
    h.betaald.mockRejectedValueOnce(new Error('mollie plat')).mockResolvedValueOnce(betaling())
    // De mislukte factuur komt terug, zodat de cron er niet voor herinnert of blokkeert.
    expect(await haalGemisteTeamBetalingenIn()).toMatchObject({ ingehaald: 1, fouten: 1, nietGecontroleerd: ['f1'] })
  })
})
