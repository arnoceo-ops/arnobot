/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Teamfacturen na de betaling: terugbetaling, terugboeking, dubbele betaling en de twee adminacties.

type Rij = Record<string, any>
const h = vi.hoisted(() => ({
  rijen: [] as Rij[],
  dbFout: null as null | { message: string },
  tg: vi.fn(async (_t: string) => {}),
  archiveer: vi.fn(async () => {}),
  lijst: vi.fn(),
  ontblokkeer: vi.fn(async () => true),
}))

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))
vi.mock('@/lib/cron-notify', () => ({ notifyTelegram: h.tg }))
vi.mock('@/lib/teamOpzegging', () => ({ ontblokkeerNaBetaling: h.ontblokkeer }))
vi.mock('./mollie', () => ({ archiveerBetaalLink: h.archiveer, lijstBetaalLinkBetalingen: h.lijst }))
vi.mock('./db', () => ({
  billingDb: {
    from() {
      const filters: Array<(r: Rij) => boolean> = []
      let patch: Rij | null = null
      const uitvoeren = () => {
        if (patch && h.dbFout) return { data: null, error: h.dbFout }
        const treffers = h.rijen.filter(r => filters.every(f => f(r)))
        if (patch) for (const r of treffers) Object.assign(r, patch)
        return { data: treffers.map(r => ({ ...r })), error: null }
      }
      const q: any = {
        select: () => q,
        eq: (k: string, v: unknown) => { filters.push(r => r[k] === v); return q },
        is: (k: string, v: unknown) => { filters.push(r => (r[k] ?? null) === v); return q },
        in: (k: string, v: unknown[]) => { filters.push(r => v.includes(r[k])); return q },
        not: (k: string) => { filters.push(r => r[k] != null); return q },
        gte: (k: string, v: string) => { filters.push(r => r[k] >= v); return q },
        returns: () => q,
        update: (p: Rij) => { patch = p; return q },
        maybeSingle: async () => ({ data: uitvoeren().data?.[0] ?? null, error: null }),
        then: (res: any, rej: any) => Promise.resolve(uitvoeren()).then(res, rej),
      }
      return q
    },
  },
}))

import { controleerBetaaldeTeamFacturen, verwerkTeamNaBetaling, zetBetaaldPerBank, zetTeruggedraaid } from './teamBetalingen'

const factuur = (extra: Rij = {}): Rij => ({
  id: 'f1', team_id: 't1', status: 'paid', bedrag_cent: 29645, mollie_payment_link_id: 'pl_1', mollie_payment_id: 'tr_1',
  paid_via: 'mollie', terugbetaald_cent: 0, teruggeboekt_cent: 0, reversed_at: null, betaald_at: '2026-11-20T10:00:00.000Z', ...extra,
})
const betaling = (extra: Rij = {}): any => ({ id: 'tr_1', status: 'paid', amount: { currency: 'EUR', value: '296.45' }, ...extra })
const eur = (value: string) => ({ currency: 'EUR', value })
const verwerk = (b: any) => verwerkTeamNaBetaling({ ...h.rijen[0] } as any, [b])

beforeEach(() => {
  h.rijen = [factuur()]
  h.dbFout = null
  vi.clearAllMocks()
})

describe('terugbetaling en terugboeking van een teamfactuur', () => {
  it('niets veranderd: geen melding', async () => {
    expect(await verwerk(betaling())).toBe(false)
    expect(h.tg).not.toHaveBeenCalled()
  })
  it('alleen referralgeld terug: vastgelegd zonder melding, ook als dat de hele factuur is', async () => {
    h.rijen = [factuur({ referral_refund_cent: 29645 })]
    await verwerk(betaling({ amountRefunded: eur('296.45') }))
    expect(h.rijen[0]).toMatchObject({ status: 'paid', terugbetaald_cent: 29645, reversed_at: null })
    expect(h.tg).not.toHaveBeenCalled()
  })
  it('de rest buiten het referralgeld om ook terug: teruggedraaid, met de waarschuwing over de creditnota', async () => {
    h.rijen = [factuur({ referral_refund_cent: 2299, terugbetaald_cent: 2299 })]
    await verwerk(betaling({ amountRefunded: eur('296.45') }))
    expect(h.rijen[0]).toMatchObject({ status: 'refunded' })
    expect(String(h.tg.mock.calls[0][0])).toContain('als referralgeld geboekt')
  })
  it('de reservering is vrijgegeven na een volledige terugbetaling: bij dezelfde bedragen alsnog teruggedraaid', async () => {
    h.rijen = [factuur({ referral_refund_cent: 0, terugbetaald_cent: 29645 })]
    await verwerk(betaling({ amountRefunded: eur('296.45') }))
    expect(h.rijen[0]).toMatchObject({ status: 'refunded' })
    expect(h.tg).toHaveBeenCalledTimes(1)
  })
  it('gedeeltelijk terugbetaald: bedrag vastgelegd, factuur blijft betaald', async () => {
    await verwerk(betaling({ amountRefunded: eur('50.00') }))
    expect(h.rijen[0]).toMatchObject({ status: 'paid', terugbetaald_cent: 5000, reversed_at: null })
    expect(h.tg).toHaveBeenCalledTimes(1)
  })
  it('volledig terugbetaald: teruggedraaid, en een tweede melding van Mollie doet niets', async () => {
    await verwerk(betaling({ amountRefunded: eur('296.45') }))
    expect(h.rijen[0]).toMatchObject({ status: 'refunded', terugbetaald_cent: 29645 })
    expect(h.rijen[0].reversed_at).toBeTruthy()
    await verwerk(betaling({ amountRefunded: eur('296.45') }))
    expect(h.tg).toHaveBeenCalledTimes(1)
  })
  it('elke terugboeking draait de factuur terug en raakt de toegang niet', async () => {
    await verwerk(betaling({ amountChargedBack: eur('296.45') }))
    expect(h.rijen[0]).toMatchObject({ status: 'refunded', teruggeboekt_cent: 29645 })
    expect(h.tg.mock.calls[0][0]).toContain('CHARGEBACK')
    expect(h.ontblokkeer).not.toHaveBeenCalled()
  })
  it('oude factuur zonder betaal-id: id aangevuld', async () => {
    h.rijen = [factuur({ mollie_payment_id: null, paid_via: null })]
    await verwerk(betaling())
    expect(h.rijen[0]).toMatchObject({ mollie_payment_id: 'tr_1', paid_via: 'mollie' })
  })
  it('per bank betaald en toch via de link: één melding dubbel betaald', async () => {
    h.rijen = [factuur({ paid_via: 'bank', mollie_payment_id: null })]
    await verwerk(betaling())
    await verwerk(betaling())
    expect(h.tg).toHaveBeenCalledTimes(1)
    expect(h.tg.mock.calls[0][0]).toContain('dubbel betaald')
  })
  it('dubbele betaling die al is teruggestort: geen melding meer', async () => {
    h.rijen = [factuur({ paid_via: 'bank', mollie_payment_id: null })]
    await verwerk(betaling({ amountRefunded: eur('296.45') }))
    expect(h.tg).not.toHaveBeenCalled()
    expect(h.rijen[0].status).toBe('paid')
  })
})

describe('dagelijkse nacontrole', () => {
  it('pikt een terugbetaling uit het Mollie-dashboard op', async () => {
    h.lijst.mockResolvedValue([betaling({ amountRefunded: eur('296.45') })])
    expect(await controleerBetaaldeTeamFacturen(new Date('2026-11-25'))).toEqual({ gecontroleerd: 1, gewijzigd: 1, fouten: 0 })
  })
  it('doet niets zolang de migratie niet is uitgevoerd', async () => {
    const { terugbetaald_cent: _weg, ...oud } = factuur()
    h.rijen = [oud]
    expect(await controleerBetaaldeTeamFacturen(new Date('2026-11-25'))).toEqual({ gecontroleerd: 0, gewijzigd: 0, fouten: 0 })
    expect(h.lijst).not.toHaveBeenCalled()
  })
})

describe('terugdraaiing die niet doorgaat', () => {
  const gedraaid = (extra: Rij) => factuur({ status: 'refunded', reversed_at: '2026-11-22T10:00:00.000Z', ...extra })
  it('geannuleerde terugbetaling: factuur weer betaald, geen advies voor een creditnota', async () => {
    h.rijen = [gedraaid({ terugbetaald_cent: 29645 })]
    await verwerk(betaling())
    expect(h.rijen[0]).toMatchObject({ status: 'paid', reversed_at: null, terugbetaald_cent: 0 })
    expect(h.tg.mock.calls[0][0]).toContain('niet doorgegaan')
    expect(h.tg.mock.calls[0][0]).not.toContain('Maak de creditnota')
  })
  it('door Mollie teruggedraaide chargeback: factuur weer betaald', async () => {
    h.rijen = [gedraaid({ teruggeboekt_cent: 29645 })]
    await verwerk(betaling())
    expect(h.rijen[0]).toMatchObject({ status: 'paid', teruggeboekt_cent: 0 })
  })
  it('met de hand teruggedraaid blijft teruggedraaid', async () => {
    h.rijen = [gedraaid({})]
    await verwerk(betaling())
    expect(h.rijen[0].status).toBe('refunded')
    expect(h.tg).not.toHaveBeenCalled()
  })
})

describe('adminacties', () => {
  beforeEach(() => { h.lijst.mockReset(); h.lijst.mockResolvedValue([]) })
  it('betaald per bank terwijl er al via de link betaald is: weigeren en niets wijzigen', async () => {
    h.rijen = [factuur({ status: 'open', paid_via: null })]
    h.lijst.mockResolvedValue([betaling()])
    expect(await zetBetaaldPerBank('f1', new Date())).toMatchObject({ ok: false, status: 409, alViaMollie: 'pl_1' })
    expect(h.rijen[0].status).toBe('open')
    expect(h.archiveer).not.toHaveBeenCalled()
  })
  it('betaald per bank als Mollie niet te controleren is: weigeren', async () => {
    h.rijen = [factuur({ status: 'open' })]
    h.lijst.mockRejectedValue(new Error('mollie plat'))
    expect(await zetBetaaldPerBank('f1', new Date())).toMatchObject({ ok: false, status: 502 })
    expect(h.rijen[0].status).toBe('open')
  })
  it('betaaldatum vóór de factuurdatum wordt geweigerd', async () => {
    h.rijen = [factuur({ status: 'open', created_at: '2026-11-20T05:10:00.000Z' })]
    expect(await zetBetaaldPerBank('f1', new Date('2025-11-24T12:00:00Z'))).toMatchObject({ ok: false, status: 400 })
  })
  it('betaald per bank: betaald, blokkade eraf, betaallink uit', async () => {
    h.rijen = [factuur({ status: 'open', paid_via: null, betaald_at: null })]
    const uit = await zetBetaaldPerBank('f1', new Date('2026-11-24T12:00:00Z'))
    expect(uit).toMatchObject({ ok: true, waarschuwing: undefined })
    expect(h.rijen[0]).toMatchObject({ status: 'paid', paid_via: 'bank', betaald_at: '2026-11-24T12:00:00.000Z' })
    expect(h.ontblokkeer).toHaveBeenCalledWith('t1', expect.any(String))
    expect(h.archiveer).toHaveBeenCalledWith('pl_1')
  })
  it('betaallink uitzetten mislukt: wel betaald, met waarschuwing', async () => {
    h.rijen = [factuur({ status: 'open' })]
    h.archiveer.mockRejectedValueOnce(new Error('mollie plat'))
    const uit = await zetBetaaldPerBank('f1', new Date())
    expect(uit.ok && uit.waarschuwing).toContain('betaallink')
  })
  it('al betaalde factuur kan niet nog eens op betaald per bank', async () => {
    expect(await zetBetaaldPerBank('f1', new Date())).toMatchObject({ ok: false, status: 409 })
  })
  it('zonder migratie: duidelijke fout en niets gebeurt', async () => {
    h.rijen = [factuur({ status: 'open' })]
    h.dbFout = { message: 'column paid_via does not exist' }
    expect(await zetBetaaldPerBank('f1', new Date())).toMatchObject({ ok: false, status: 500 })
    expect(h.ontblokkeer).not.toHaveBeenCalled()
    expect(h.archiveer).not.toHaveBeenCalled()
  })
  it('teruggedraaid: alleen op een betaalde factuur', async () => {
    expect(await zetTeruggedraaid('f1')).toMatchObject({ ok: true })
    expect(h.rijen[0].status).toBe('refunded')
    expect(await zetTeruggedraaid('f1')).toMatchObject({ ok: false, status: 409 })
  })
})
