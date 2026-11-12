/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from 'vitest'

// De overstap per einde van de betaalde periode (docs/OVERSTAP_PLAN.md): weigerregels, vaste volgorde
// (claim, nieuw abonnement, huidig stoppen) en het terugdraaien als een stap mislukt. Database, Mollie
// en meldingen zijn nagemaakt: de echte logica draait, er gaat niets naar buiten.

type Rij = Record<string, any>
const h = vi.hoisted(() => ({
  tabellen: {} as Record<string, Rij[]>,
  heeftGeldigeMachtiging: vi.fn(),
  haalAbonnement: vi.fn(),
  maakAbonnement: vi.fn(),
  mollieBeschikbaarVoor: vi.fn(),
  heeftOpenstaandeBetaling: vi.fn(),
  stopEnBevestig: vi.fn(),
  notifyTelegram: vi.fn(async () => {}),
  verstuurBillingMail: vi.fn(async () => true),
  isInternalTestUser: vi.fn(() => false),
  updateFout: { aan: false },
}))

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))
vi.mock('@/lib/cron-notify', () => ({ notifyTelegram: h.notifyTelegram }))
vi.mock('@/lib/internalTestAccounts', () => ({ isInternalTestUser: h.isInternalTestUser }))
vi.mock('./openstaandeBetaling', () => ({ heeftOpenstaandeBetaling: h.heeftOpenstaandeBetaling }))
vi.mock('./verwerking', () => ({ stopEnBevestig: h.stopEnBevestig }))
vi.mock('./mails', () => ({ verstuurBillingMail: h.verstuurBillingMail }))
vi.mock('./mollie', () => ({
  heeftGeldigeMachtiging: h.heeftGeldigeMachtiging,
  haalAbonnement: h.haalAbonnement,
  maakAbonnement: h.maakAbonnement,
  mollieBeschikbaarVoor: h.mollieBeschikbaarVoor,
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
          // Simuleert een databasefout bij het opslaan van het geplande Mollie-id.
          if (h.updateFout.aan && 'gepland_mollie_subscription_id' in patch && patch.gepland_mollie_subscription_id) {
            return { data: null, error: { message: 'db stuk' } }
          }
          for (const r of treffers) Object.assign(r, patch)
          return { data: teruggeven ? treffers.map(r => ({ ...r })) : null, error: null }
        }
        return { data: treffers.map(r => ({ ...r })), error: null }
      }
      const q: any = {
        select: () => { teruggeven = true; return q },
        eq: (k: string, v: unknown) => { filters.push(r => r[k] === v); return q },
        is: (k: string, v: unknown) => { filters.push(r => (r[k] ?? null) === v); return q },
        order: () => q,
        limit: () => q,
        update: (p: Rij) => { patch = p; return q },
        maybeSingle: async () => ({ data: (uitvoeren().data as Rij[] | null)?.[0] ?? null, error: null }),
        then: (res: any, rej: any) => Promise.resolve(uitvoeren()).then(res, rej),
      }
      return q
    },
  },
}))

import { isToegestaneOverstap, overstapBeschikbaarVoor, plaatsOverstap } from './overstap'
import { abonnementVoorOverstap } from './perioden'
import { berekenBedrag } from './prijzen'

const ISO = (s: string) => new Date(s).toISOString()
const NU = new Date('2026-11-20T10:00:00.000Z')

function basisRij(extra: Rij = {}): Rij {
  return {
    id: 'rij-1', user_id: 'user_1', plan: 'basis', cyclus: 'maandelijks', klant_type: 'particulier', status: 'active',
    bedrag_cent: 2900, btw_cent: 503, mollie_customer_id: 'cst_1',
    mollie_subscription_id: 'sub_huidig', mollie_sub_geannuleerd_at: null,
    periode_start: ISO('2026-11-04'), periode_einde: ISO('2026-12-04'), contract_einde: null,
    created_at: ISO('2026-11-04'),
    gepland_plan: null, gepland_cyclus: null, gepland_bedrag_cent: null, gepland_btw_cent: null,
    gepland_mollie_subscription_id: null, gepland_mollie_sub_geannuleerd_at: null, gepland_ingangs_at: null, gepland_at: null,
    ...extra,
  }
}

const sub = () => h.tabellen.arnobot_subscriptions[0]
const geplandLeeg = () => {
  const r = sub()
  return Object.keys(r).filter(k => k.startsWith('gepland_')).every(k => r[k] === null)
}

function zet(rij: Rij, extra: Record<string, Rij[]> = {}) {
  h.tabellen = { arnobot_subscriptions: [rij], arnobot_klanttype_correcties: [], arnobot_payments: [], arnobot_referrals: [], ...extra }
}

beforeEach(() => {
  for (const f of [h.heeftGeldigeMachtiging, h.haalAbonnement, h.maakAbonnement, h.mollieBeschikbaarVoor, h.heeftOpenstaandeBetaling, h.stopEnBevestig, h.notifyTelegram, h.verstuurBillingMail, h.isInternalTestUser]) f.mockReset()
  h.verstuurBillingMail.mockResolvedValue(true)
  h.updateFout.aan = false
  h.heeftGeldigeMachtiging.mockResolvedValue(true)
  h.haalAbonnement.mockResolvedValue({ id: 'sub_huidig', status: 'active', nextPaymentDate: '2026-12-04' })
  h.maakAbonnement.mockResolvedValue({ id: 'sub_nieuw', status: 'pending' })
  h.mollieBeschikbaarVoor.mockReturnValue(true)
  h.heeftOpenstaandeBetaling.mockResolvedValue(false)
  h.stopEnBevestig.mockResolvedValue(true)
  h.notifyTelegram.mockResolvedValue(undefined)
  h.isInternalTestUser.mockReturnValue(false)
  delete process.env.OVERSTAP_OPEN
  delete process.env.ARNOBOT_OWNER_USER_ID
  zet(basisRij())
})

describe('isToegestaneOverstap', () => {
  const b = 'basis', p = 'premium', m = 'maandelijks', j = 'jaarlijks'
  it.each([
    [b, m, b, j, true],
    [p, m, p, j, true],
    [p, m, b, m, true],
    [p, j, b, j, true],
    [b, j, b, m, false], // jaar naar maand bestaat niet
    [p, j, p, m, false],
    [b, m, p, m, false], // Basic naar Pro gaat direct, niet via deze route
    [b, m, p, j, false],
    [p, m, b, j, false], // twee dingen tegelijk
    [b, m, b, m, false], // niets veranderd
  ] as const)('%s %s naar %s %s: %s', (pl1, c1, pl2, c2, verwacht) => {
    expect(isToegestaneOverstap({ plan: pl1, cyclus: c1 }, { plan: pl2, cyclus: c2 })).toBe(verwacht)
  })
})

describe('abonnementVoorOverstap', () => {
  const d = new Date('2026-12-04T00:00:00.000Z')
  it('maand: doorlopend, per maand', () => {
    expect(abonnementVoorOverstap(d, 'maandelijks', 'particulier')).toEqual({ interval: '1 month', times: null, startDatum: d })
    expect(abonnementVoorOverstap(d, 'maandelijks', 'zakelijk')).toEqual({ interval: '1 month', times: null, startDatum: d })
  })
  it('particulier jaar: één betaling', () => {
    expect(abonnementVoorOverstap(d, 'jaarlijks', 'particulier')).toEqual({ interval: '12 months', times: 1, startDatum: d })
  })
  it('zakelijk jaar: doorlopend per jaar', () => {
    expect(abonnementVoorOverstap(d, 'jaarlijks', 'zakelijk')).toEqual({ interval: '12 months', times: null, startDatum: d })
  })
})

describe('overstapBeschikbaarVoor', () => {
  it('nee als online betalen niet beschikbaar is', () => {
    h.mollieBeschikbaarVoor.mockReturnValue(false)
    expect(overstapBeschikbaarVoor('user_1')).toBe(false)
  })
  it('nee voor een gewone gebruiker zolang OVERSTAP_OPEN niet aan staat', () => {
    expect(overstapBeschikbaarVoor('user_1')).toBe(false)
  })
  it('ja voor de eigenaar', () => {
    process.env.ARNOBOT_OWNER_USER_ID = 'user_1'
    expect(overstapBeschikbaarVoor('user_1')).toBe(true)
  })
  it('ja voor een intern testaccount', () => {
    h.isInternalTestUser.mockReturnValue(true)
    expect(overstapBeschikbaarVoor('user_1')).toBe(true)
  })
  it('ja voor iedereen als OVERSTAP_OPEN=true', () => {
    process.env.OVERSTAP_OPEN = 'true'
    expect(overstapBeschikbaarVoor('user_1')).toBe(true)
  })
})

describe('plaatsOverstap: gelukt', () => {
  it('maand naar jaar (particulier): claim, nieuw abonnement, huidig gestopt, Telegram', async () => {
    const r = await plaatsOverstap('user_1', { plan: 'basis', cyclus: 'jaarlijks' }, NU)
    const bedrag = berekenBedrag('basis', 'jaarlijks', 'particulier')
    expect(r).toEqual({ ok: true, ingaatOp: '2026-12-04', plan: 'basis', cyclus: 'jaarlijks', bedragCent: bedrag.brutoCent })
    expect(sub()).toMatchObject({
      gepland_plan: 'basis', gepland_cyclus: 'jaarlijks', gepland_bedrag_cent: bedrag.brutoCent, gepland_btw_cent: bedrag.btwCent,
      gepland_mollie_subscription_id: 'sub_nieuw', gepland_ingangs_at: ISO('2026-12-04'), gepland_at: NU.toISOString(),
      // De huidige waarden blijven tot de eerste betaling van het nieuwe abonnement.
      plan: 'basis', cyclus: 'maandelijks', bedrag_cent: 2900, mollie_subscription_id: 'sub_huidig',
    })
    expect(h.maakAbonnement).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      klantId: 'cst_1', brutoCent: bedrag.brutoCent, interval: '12 months', times: 1, startDatum: new Date('2026-12-04T00:00:00.000Z'),
      metadata: { userId: 'user_1', subscriptionRowId: 'rij-1' },
      idempotencyKey: `overstap-rij-1-${NU.toISOString()}`,
    }))
    expect(h.stopEnBevestig).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ id: 'rij-1' }), 'sub_huidig', 'huidig')
    expect(h.notifyTelegram).toHaveBeenCalledTimes(1)
    expect(h.verstuurBillingMail).toHaveBeenCalledExactlyOnceWith('user_1', 'overstap_ingepland', {
      van: 'Basic maandelijks', naar: 'Basic jaarlijks', bedragCent: bedrag.brutoCent, datum: ISO('2026-12-04'), perPeriode: 'per jaar',
    })
  })

  it('maand naar jaar (zakelijk): doorlopend jaarabonnement met zakelijk bedrag', async () => {
    zet(basisRij({ klant_type: 'zakelijk' }))
    const r = await plaatsOverstap('user_1', { plan: 'basis', cyclus: 'jaarlijks' }, NU)
    expect(r.ok).toBe(true)
    expect(h.maakAbonnement).toHaveBeenCalledWith(expect.objectContaining({
      brutoCent: berekenBedrag('basis', 'jaarlijks', 'zakelijk').brutoCent, interval: '12 months', times: null,
    }))
  })

  it('Pro naar Basic (zelfde cyclus): maandabonnement met het Basic-bedrag', async () => {
    zet(basisRij({ plan: 'premium', bedrag_cent: 5900 }))
    const r = await plaatsOverstap('user_1', { plan: 'basis', cyclus: 'maandelijks' }, NU)
    expect(r.ok).toBe(true)
    expect(h.maakAbonnement).toHaveBeenCalledWith(expect.objectContaining({
      brutoCent: berekenBedrag('basis', 'maandelijks', 'particulier').brutoCent, interval: '1 month', times: null,
    }))
    expect(sub()).toMatchObject({ gepland_plan: 'basis', gepland_cyclus: 'maandelijks', plan: 'premium' })
    expect(h.verstuurBillingMail).toHaveBeenCalledExactlyOnceWith('user_1', 'overstap_ingepland', expect.objectContaining({
      van: 'Pro maandelijks', naar: 'Basic maandelijks', perPeriode: 'per maand',
    }))
  })

  it('gebruikt Mollies volgende incassodatum als ingangsdatum, ook als die iets afwijkt van periode_einde', async () => {
    h.haalAbonnement.mockResolvedValue({ id: 'sub_huidig', status: 'active', nextPaymentDate: '2026-12-06' })
    const r = await plaatsOverstap('user_1', { plan: 'basis', cyclus: 'jaarlijks' }, NU)
    expect(r).toMatchObject({ ok: true, ingaatOp: '2026-12-06' })
  })

  it('geeft in Telegram aan of de klant via een referral kwam', async () => {
    zet(basisRij(), { arnobot_referrals: [{ referred_user_id: 'user_1', status: 'converted' }], arnobot_payments: [{ user_id: 'user_1', status: 'paid' }, { user_id: 'user_1', status: 'paid' }] })
    await plaatsOverstap('user_1', { plan: 'basis', cyclus: 'jaarlijks' }, NU)
    const tekst = String((h.notifyTelegram.mock.calls[0] as unknown[])[0])
    expect(tekst).toContain('Referral: ja, status converted')
    expect(tekst).toContain('Betalingen tot nu toe: 2')
  })

  it('een dubbele aanvraag levert één abonnement op', async () => {
    const [a, b] = [await plaatsOverstap('user_1', { plan: 'basis', cyclus: 'jaarlijks' }, NU), await plaatsOverstap('user_1', { plan: 'basis', cyclus: 'jaarlijks' }, NU)]
    expect(a.ok).toBe(true)
    expect(b).toMatchObject({ ok: false, status: 409 })
    expect(h.maakAbonnement).toHaveBeenCalledTimes(1)
  })
})

describe('plaatsOverstap: weigeren zonder iets achter te laten', () => {
  const jaar = { plan: 'basis', cyclus: 'jaarlijks' } as const

  async function weigert(status: number, wens: { plan: 'basis' | 'premium'; cyclus: 'maandelijks' | 'jaarlijks' } = jaar) {
    const r = await plaatsOverstap('user_1', wens, NU)
    expect(r).toMatchObject({ ok: false, status })
    expect(h.maakAbonnement).not.toHaveBeenCalled()
    expect(h.stopEnBevestig).not.toHaveBeenCalled()
    expect(h.verstuurBillingMail).not.toHaveBeenCalled()
    expect(geplandLeeg()).toBe(true)
  }

  it('geen lopend abonnement', async () => { h.tabellen.arnobot_subscriptions = []; expect((await plaatsOverstap('user_1', jaar, NU))).toMatchObject({ ok: false, status: 404 }) })
  it('een opgezegd abonnement', async () => { zet(basisRij({ status: 'cancelled' })); expect((await plaatsOverstap('user_1', jaar, NU))).toMatchObject({ ok: false, status: 404 }) })
  it('al een wijziging gepland', async () => { zet(basisRij({ gepland_at: ISO('2026-11-10') })); expect((await plaatsOverstap('user_1', jaar, NU))).toMatchObject({ ok: false, status: 409 }); expect(h.maakAbonnement).not.toHaveBeenCalled() })
  it('jaar naar maand', async () => { zet(basisRij({ cyclus: 'jaarlijks' })); await weigert(400, { plan: 'basis', cyclus: 'maandelijks' }) })
  it('Basic naar Pro', async () => { await weigert(400, { plan: 'premium', cyclus: 'maandelijks' }) })
  it('geen Mollie-abonnement (particulier jaar)', async () => { zet(basisRij({ cyclus: 'jaarlijks', mollie_subscription_id: null, plan: 'premium' })); await weigert(409, { plan: 'basis', cyclus: 'jaarlijks' }) })
  it('Mollie-abonnement al als gestopt vastgelegd', async () => { zet(basisRij({ mollie_sub_geannuleerd_at: ISO('2026-11-10') })); await weigert(409) })
  it('betaalperiode al voorbij', async () => { zet(basisRij({ periode_einde: ISO('2026-11-15') })); await weigert(409) })
  it('open klanttype-correctie', async () => { zet(basisRij(), { arnobot_klanttype_correcties: [{ subscription_id: 'rij-1', status: 'open' }] }); await weigert(409) })
  it('geen geldige machtiging', async () => { h.heeftGeldigeMachtiging.mockResolvedValue(false); await weigert(409) })
  it('Mollie-abonnement niet actief', async () => { h.haalAbonnement.mockResolvedValue({ id: 'x', status: 'suspended', nextPaymentDate: '2026-12-04' }); await weigert(409) })
  it('geen volgende incassodatum bekend', async () => { h.haalAbonnement.mockResolvedValue({ id: 'x', status: 'active', nextPaymentDate: null }); await weigert(409) })
  it('volgende incasso binnen 4 dagen', async () => { h.haalAbonnement.mockResolvedValue({ id: 'x', status: 'active', nextPaymentDate: '2026-11-23' }); zet(basisRij({ periode_einde: ISO('2026-11-23') })); await weigert(409) })
  it('precies op de grens van 4 dagen mag wel', async () => {
    h.haalAbonnement.mockResolvedValue({ id: 'x', status: 'active', nextPaymentDate: '2026-11-24' })
    zet(basisRij({ periode_einde: ISO('2026-11-24') }))
    expect((await plaatsOverstap('user_1', jaar, new Date('2026-11-20T00:00:00.000Z'))).ok).toBe(true)
  })
  it('Mollies incassodatum wijkt meer dan 3 dagen af van periode_einde, en meldt het', async () => {
    h.haalAbonnement.mockResolvedValue({ id: 'x', status: 'active', nextPaymentDate: '2026-12-09' })
    await weigert(409)
    expect(h.notifyTelegram).toHaveBeenCalledTimes(1)
  })
  it('een betaling is nog onderweg', async () => { h.heeftOpenstaandeBetaling.mockResolvedValue(true); await weigert(409) })
  it('Mollie niet te bevragen: 502 en niets gewijzigd', async () => { h.haalAbonnement.mockRejectedValue(new Error('storing')); await weigert(502) })
})

describe('plaatsOverstap: terugdraaien als een stap mislukt', () => {
  const jaar = { plan: 'basis', cyclus: 'jaarlijks' } as const

  it('nieuw abonnement aanmaken mislukt: claim teruggedraaid, huidig abonnement niet gestopt', async () => {
    h.maakAbonnement.mockRejectedValue(new Error('storing'))
    const r = await plaatsOverstap('user_1', jaar, NU)
    expect(r).toMatchObject({ ok: false, status: 502 })
    expect(geplandLeeg()).toBe(true)
    expect(h.stopEnBevestig).not.toHaveBeenCalled()
  })

  it('huidig abonnement stoppen mislukt: het nieuwe wordt weer gestopt en de claim gewist', async () => {
    h.stopEnBevestig.mockImplementation(async (_s: Rij, id: string) => id !== 'sub_huidig')
    const r = await plaatsOverstap('user_1', jaar, NU)
    expect(r).toMatchObject({ ok: false, status: 502 })
    expect(h.stopEnBevestig).toHaveBeenCalledTimes(2)
    expect(h.stopEnBevestig).toHaveBeenLastCalledWith(expect.objectContaining({ gepland_mollie_subscription_id: 'sub_nieuw' }), 'sub_nieuw', 'gepland')
    expect(geplandLeeg()).toBe(true)
    expect(h.verstuurBillingMail).not.toHaveBeenCalled()
    expect(h.notifyTelegram).not.toHaveBeenCalled() // de stopfunctie meldt zelf een mislukte stop
  })

  it('beide stops mislukken: de gegevens blijven staan en Arno krijgt een dringende melding', async () => {
    h.stopEnBevestig.mockResolvedValue(false)
    const r = await plaatsOverstap('user_1', jaar, NU)
    expect(r).toMatchObject({ ok: false, status: 502 })
    expect(sub()).toMatchObject({ gepland_mollie_subscription_id: 'sub_nieuw', gepland_at: NU.toISOString() })
    expect(h.notifyTelegram).toHaveBeenCalledTimes(1)
    expect(String((h.notifyTelegram.mock.calls[0] as unknown[])[0])).toContain('OVERSTAP HALF AFGEROND')
  })

  it('geplande id niet op te slaan: het nieuwe abonnement wordt meteen gestopt en de claim gewist', async () => {
    h.updateFout.aan = true
    const r = await plaatsOverstap('user_1', jaar, NU)
    expect(r).toMatchObject({ ok: false, status: 502 })
    expect(h.stopEnBevestig).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ id: 'rij-1' }), 'sub_nieuw', 'gepland')
    expect(geplandLeeg()).toBe(true)
  })
})
