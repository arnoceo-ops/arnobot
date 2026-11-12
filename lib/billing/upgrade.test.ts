/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Upgrade van Basic naar Pro, direct (docs/OVERSTAP_PLAN.md): het bedrag naar rato en de aanvraag zelf
// (Pro meteen, bijbetaling met een losse incasso, het Pro-abonnement per einde periode). Database, Mollie
// en meldingen zijn nagemaakt: de echte logica draait, er gaat niets naar buiten.

type Rij = Record<string, any>
const h = vi.hoisted(() => ({
  tabellen: {} as Record<string, Rij[]>,
  heeftGeldigeMachtiging: vi.fn(),
  haalAbonnement: vi.fn(),
  maakAbonnement: vi.fn(),
  maakLosseHerhaalBetaling: vi.fn(),
  mollieBeschikbaarVoor: vi.fn(),
  heeftOpenstaandeBetaling: vi.fn(),
  stopEnBevestig: vi.fn(),
  notifyTelegram: vi.fn(async () => {}),
  verstuurBillingMail: vi.fn(async () => true),
  isInternalTestUser: vi.fn(() => false),
  insertFout: { aan: false },
  teller: { n: 0 },
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
  maakLosseHerhaalBetaling: h.maakLosseHerhaalBetaling,
  mollieBeschikbaarVoor: h.mollieBeschikbaarVoor,
}))
vi.mock('./db', () => ({
  billingDb: {
    from(tabel: string) {
      const rijen = (h.tabellen[tabel] ??= [])
      const filters: Array<(r: Rij) => boolean> = []
      let modus: 'select' | 'update' | 'insert' | 'delete' = 'select'
      let patch: Rij = {}
      let nieuweRij: Rij = {}
      let teruggeven = false
      const uitvoeren = () => {
        const treffers = rijen.filter(r => filters.every(f => f(r)))
        if (modus === 'insert') {
          if (h.insertFout.aan && tabel === 'arnobot_payments' && nieuweRij.soort === 'upgrade') return { data: null, error: { message: 'constraint' } }
          rijen.push({ id: `${tabel}-${++h.teller.n}`, ...nieuweRij })
          return { data: null, error: null }
        }
        if (modus === 'delete') {
          for (const r of treffers) rijen.splice(rijen.indexOf(r), 1)
          return { data: null, error: null }
        }
        if (modus === 'update') {
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
        returns: () => q,
        update: (p: Rij) => { modus = 'update'; patch = p; return q },
        insert: (r: Rij) => { modus = 'insert'; nieuweRij = r; return q },
        delete: () => { modus = 'delete'; return q },
        maybeSingle: async () => ({ data: (uitvoeren().data as Rij[] | null)?.[0] ?? null, error: null }),
        then: (res: any, rej: any) => Promise.resolve(uitvoeren()).then(res, rej),
      }
      return q
    },
  },
}))

import { plaatsUpgrade } from './overstap'
import { berekenBedrag } from './prijzen'
import { berekenUpgradeBedrag } from './upgradeBedrag'

const ISO = (s: string) => new Date(s).toISOString()
const NU = new Date('2026-11-20T10:00:00.000Z')

describe('berekenUpgradeBedrag', () => {
  const start = new Date('2026-11-04T00:00:00.000Z')
  const einde = new Date('2026-12-04T00:00:00.000Z') // 30 dagen
  const halverwege = new Date('2026-11-19T00:00:00.000Z')

  it('particulier: het bruto prijsverschil naar rato, btw eruit gehaald', () => {
    const basic = berekenBedrag('basis', 'maandelijks', 'particulier')
    const pro = berekenBedrag('premium', 'maandelijks', 'particulier')
    const r = berekenUpgradeBedrag('particulier', 'maandelijks', start, einde, halverwege)
    expect(r.brutoCent).toBe(Math.round((pro.brutoCent - basic.brutoCent) * 0.5))
    expect(r.nettoCent + r.btwCent).toBe(r.brutoCent)
    expect(r.nettoCent).toBe(Math.round(r.brutoCent / 1.21))
  })

  it('zakelijk: het netto verschil naar rato, 21% btw erbovenop', () => {
    const basic = berekenBedrag('basis', 'maandelijks', 'zakelijk')
    const pro = berekenBedrag('premium', 'maandelijks', 'zakelijk')
    const r = berekenUpgradeBedrag('zakelijk', 'maandelijks', start, einde, halverwege)
    expect(r.nettoCent).toBe(Math.round((pro.nettoCent - basic.nettoCent) * 0.5))
    expect(r.btwCent).toBe(Math.round(r.nettoCent * 0.21))
    expect(r.brutoCent).toBe(r.nettoCent + r.btwCent)
  })

  it('bij het begin van de periode het volle verschil, aan het einde niets', () => {
    const basic = berekenBedrag('basis', 'jaarlijks', 'particulier')
    const pro = berekenBedrag('premium', 'jaarlijks', 'particulier')
    expect(berekenUpgradeBedrag('particulier', 'jaarlijks', start, einde, start).brutoCent).toBe(pro.brutoCent - basic.brutoCent)
    expect(berekenUpgradeBedrag('particulier', 'jaarlijks', start, einde, einde).brutoCent).toBe(0)
  })

  it('klemt: vóór het begin telt als het begin, na het einde als nul', () => {
    const voor = berekenUpgradeBedrag('particulier', 'maandelijks', start, einde, new Date('2026-10-01T00:00:00.000Z'))
    expect(voor).toEqual(berekenUpgradeBedrag('particulier', 'maandelijks', start, einde, start))
    expect(berekenUpgradeBedrag('particulier', 'maandelijks', start, einde, new Date('2027-01-01T00:00:00.000Z')).brutoCent).toBe(0)
  })

  it('een periode zonder lengte geeft nul', () => {
    expect(berekenUpgradeBedrag('zakelijk', 'maandelijks', einde, einde, start).brutoCent).toBe(0)
  })

  it('gebruikt de jaarprijzen bij een jaarabonnement', () => {
    const maand = berekenUpgradeBedrag('particulier', 'maandelijks', start, einde, start).brutoCent
    const jaar = berekenUpgradeBedrag('particulier', 'jaarlijks', start, einde, start).brutoCent
    expect(jaar).toBeGreaterThan(maand)
  })
})

function basisRij(extra: Rij = {}): Rij {
  return {
    id: 'rij-1', user_id: 'user_1', plan: 'basis', cyclus: 'maandelijks', klant_type: 'particulier', status: 'active',
    bedrag_cent: 2900, btw_cent: 503, mollie_customer_id: 'cst_1',
    mollie_subscription_id: 'sub_huidig', mollie_sub_geannuleerd_at: null,
    periode_start: ISO('2026-11-04'), periode_einde: ISO('2026-12-04'), contract_einde: null, created_at: ISO('2026-11-04'),
    gepland_plan: null, gepland_cyclus: null, gepland_bedrag_cent: null, gepland_btw_cent: null,
    gepland_mollie_subscription_id: null, gepland_mollie_sub_geannuleerd_at: null, gepland_ingangs_at: null, gepland_at: null,
    ...extra,
  }
}

const sub = () => h.tabellen.arnobot_subscriptions[0]
const gebruiker = () => h.tabellen.approved_users[0]
const geplandLeeg = () => Object.keys(sub()).filter(k => k.startsWith('gepland_')).every(k => sub()[k] === null)
const upgradeRijen = () => h.tabellen.arnobot_payments.filter(r => r.soort === 'upgrade')

function zet(rij: Rij) {
  h.tabellen = {
    arnobot_subscriptions: [rij], arnobot_klanttype_correcties: [], arnobot_payments: [], arnobot_referrals: [],
    approved_users: [{ user_id: 'user_1', plan: 'basis' }],
  }
}

beforeEach(() => {
  for (const f of [h.heeftGeldigeMachtiging, h.haalAbonnement, h.maakAbonnement, h.maakLosseHerhaalBetaling, h.mollieBeschikbaarVoor, h.heeftOpenstaandeBetaling, h.stopEnBevestig, h.notifyTelegram, h.verstuurBillingMail, h.isInternalTestUser]) f.mockReset()
  h.verstuurBillingMail.mockResolvedValue(true)
  h.insertFout.aan = false
  h.teller.n = 0
  h.heeftGeldigeMachtiging.mockResolvedValue(true)
  h.haalAbonnement.mockResolvedValue({ id: 'sub_huidig', status: 'active', nextPaymentDate: '2026-12-04' })
  h.maakAbonnement.mockResolvedValue({ id: 'sub_nieuw', status: 'pending' })
  h.maakLosseHerhaalBetaling.mockResolvedValue({ id: 'tr_upgrade1', status: 'pending' })
  h.mollieBeschikbaarVoor.mockReturnValue(true)
  h.heeftOpenstaandeBetaling.mockResolvedValue(false)
  h.stopEnBevestig.mockResolvedValue(true)
  h.notifyTelegram.mockResolvedValue(undefined)
  zet(basisRij())
})

describe('plaatsUpgrade: maandabonnement (het Pro-abonnement start per einde periode)', () => {
  it('Pro direct, bijbetaling aangemaakt en vastgelegd, Pro-abonnement gepland, oude gestopt', async () => {
    const r = await plaatsUpgrade('user_1', NU)
    const bij = berekenUpgradeBedrag('particulier', 'maandelijks', new Date(ISO('2026-11-04')), new Date(ISO('2026-12-04')), NU)
    const pro = berekenBedrag('premium', 'maandelijks', 'particulier')
    expect(r).toEqual({ ok: true, ingaatOp: '2026-12-04', plan: 'premium', cyclus: 'maandelijks', bedragCent: pro.brutoCent, upgrade: { direct: true, bijbetalingCent: bij.brutoCent } })

    expect(h.maakLosseHerhaalBetaling).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      klantId: 'cst_1', brutoCent: bij.brutoCent, metadata: { userId: 'user_1', subscriptionRowId: 'rij-1', soort: 'upgrade' },
      idempotencyKey: `upgrade-rij-1-${NU.toISOString()}`,
    }))
    expect(upgradeRijen()).toHaveLength(1)
    expect(upgradeRijen()[0]).toMatchObject({ user_id: 'user_1', subscription_id: 'rij-1', mollie_payment_id: 'tr_upgrade1', soort: 'upgrade', status: 'pending', bedrag_cent: bij.brutoCent, btw_cent: bij.btwCent })

    // Pro direct, op rij en account. Bedrag en cyclus blijven tot de omzetting van het geplande abonnement.
    expect(sub()).toMatchObject({ plan: 'premium', bedrag_cent: 2900, cyclus: 'maandelijks', gepland_plan: 'premium', gepland_cyclus: 'maandelijks', gepland_bedrag_cent: pro.brutoCent, gepland_mollie_subscription_id: 'sub_nieuw' })
    expect(gebruiker().plan).toBe('premium')
    expect(h.maakAbonnement).toHaveBeenCalledWith(expect.objectContaining({ brutoCent: pro.brutoCent, interval: '1 month', times: null }))
    expect(h.stopEnBevestig).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ id: 'rij-1' }), 'sub_huidig', 'huidig')
    // De probe-rij voor de betaalsoort is weer weg.
    expect(h.tabellen.arnobot_payments.some(p => String(p.mollie_payment_id).startsWith('probe-'))).toBe(false)
    // Meteen een eigen mail (de betaalbevestiging volgt pas na de incasso), met de bijbetaling en het Pro-bedrag.
    expect(h.verstuurBillingMail).toHaveBeenCalledExactlyOnceWith('user_1', 'upgrade_gelukt', {
      bedragCent: pro.brutoCent, bijbetalingCent: bij.brutoCent, zakelijk: false, datum: ISO('2026-12-04'), perPeriode: 'per maand',
    })
  })

  it('zakelijk: de upgrademail toont bedragen exclusief BTW', async () => {
    zet(basisRij({ klant_type: 'zakelijk' }))
    await plaatsUpgrade('user_1', NU)
    const bij = berekenUpgradeBedrag('zakelijk', 'maandelijks', new Date(ISO('2026-11-04')), new Date(ISO('2026-12-04')), NU)
    expect(h.verstuurBillingMail).toHaveBeenCalledExactlyOnceWith('user_1', 'upgrade_gelukt', expect.objectContaining({
      zakelijk: true, bijbetalingCent: bij.nettoCent, bedragCent: berekenBedrag('premium', 'maandelijks', 'zakelijk').nettoCent,
    }))
  })

  it('zakelijk jaar: doorlopend jaarabonnement voor Pro en een zakelijk bedrag', async () => {
    zet(basisRij({ klant_type: 'zakelijk', cyclus: 'jaarlijks', periode_start: ISO('2026-10-04'), periode_einde: ISO('2027-10-04') }))
    h.haalAbonnement.mockResolvedValue({ id: 'x', status: 'active', nextPaymentDate: '2027-10-04' })
    const r = await plaatsUpgrade('user_1', NU)
    expect(r.ok).toBe(true)
    expect(h.maakAbonnement).toHaveBeenCalledWith(expect.objectContaining({
      brutoCent: berekenBedrag('premium', 'jaarlijks', 'zakelijk').brutoCent, interval: '12 months', times: null,
    }))
    const bij = berekenUpgradeBedrag('zakelijk', 'jaarlijks', new Date(ISO('2026-10-04')), new Date(ISO('2027-10-04')), NU)
    expect(h.maakLosseHerhaalBetaling).toHaveBeenCalledWith(expect.objectContaining({ brutoCent: bij.brutoCent }))
  })

  it('lukt de bijbetaling niet aan te maken, dan blijft het een overstap per einde periode en blijft het plan Basic', async () => {
    h.maakLosseHerhaalBetaling.mockRejectedValue(new Error('storing'))
    const r = await plaatsUpgrade('user_1', NU)
    expect(r).toMatchObject({ ok: true, upgrade: { direct: false, bijbetalingCent: 0 } })
    expect(sub()).toMatchObject({ plan: 'basis', gepland_plan: 'premium', gepland_mollie_subscription_id: 'sub_nieuw' })
    expect(gebruiker().plan).toBe('basis')
    expect(upgradeRijen()).toHaveLength(0)
  })

  it('legt de bijbetaling niet vast maar meldt het dringend als de rij niet te schrijven is, en geeft toch Pro', async () => {
    // De probe slaagt; pas het vastleggen van de echte rij faalt (bijvoorbeeld een constraint-fout).
    h.maakLosseHerhaalBetaling.mockImplementation(async () => { h.insertFout.aan = true; return { id: 'tr_upgrade1', status: 'pending' } })
    const r = await plaatsUpgrade('user_1', NU)
    expect(r).toMatchObject({ ok: true, upgrade: { direct: true } })
    expect(upgradeRijen()).toHaveLength(0)
    expect(String(h.notifyTelegram.mock.calls.map(c => (c as unknown[])[0]).find(t => String(t).includes('NIET VASTGELEGD')))).toContain('tr_upgrade1')
    expect(gebruiker().plan).toBe('premium')
  })
})

describe('plaatsUpgrade: particulier jaarabonnement (geen Mollie-abonnement)', () => {
  const jaarRij = () => basisRij({ cyclus: 'jaarlijks', mollie_subscription_id: null, periode_start: ISO('2026-10-04'), periode_einde: ISO('2027-10-04'), bedrag_cent: 22800, btw_cent: 3957 })
  beforeEach(() => zet(jaarRij()))

  it('Pro direct met het Pro-jaarbedrag op de rij, de bijbetaling, en niets bij Mollie vervangen', async () => {
    const r = await plaatsUpgrade('user_1', NU)
    const pro = berekenBedrag('premium', 'jaarlijks', 'particulier')
    const bij = berekenUpgradeBedrag('particulier', 'jaarlijks', new Date(ISO('2026-10-04')), new Date(ISO('2027-10-04')), NU)
    expect(r).toMatchObject({ ok: true, plan: 'premium', cyclus: 'jaarlijks', bedragCent: pro.brutoCent, upgrade: { direct: true, bijbetalingCent: bij.brutoCent } })
    expect(sub()).toMatchObject({ plan: 'premium', bedrag_cent: pro.brutoCent, btw_cent: pro.btwCent })
    expect(geplandLeeg()).toBe(true)
    expect(gebruiker().plan).toBe('premium')
    expect(upgradeRijen()).toHaveLength(1)
    expect(h.haalAbonnement).not.toHaveBeenCalled()
    expect(h.maakAbonnement).not.toHaveBeenCalled()
    expect(h.stopEnBevestig).not.toHaveBeenCalled()
  })

  it('bijbetaling niet aan te maken: alles terug naar Basic en 502', async () => {
    h.maakLosseHerhaalBetaling.mockRejectedValue(new Error('storing'))
    const r = await plaatsUpgrade('user_1', NU)
    expect(r).toMatchObject({ ok: false, status: 502 })
    expect(sub()).toMatchObject({ plan: 'basis', bedrag_cent: 22800, btw_cent: 3957 })
    expect(gebruiker().plan).toBe('basis')
  })

  it('een tweede aanvraag direct erna wordt geweigerd (het plan is al Pro) en betaalt niet nog een keer', async () => {
    await plaatsUpgrade('user_1', NU)
    const tweede = await plaatsUpgrade('user_1', NU)
    expect(tweede).toMatchObject({ ok: false, status: 400 })
    expect(h.maakLosseHerhaalBetaling).toHaveBeenCalledTimes(1)
  })

  it('een gelijktijdige aanvraag was ons voor: 409 en niet nog een keer bijbetalen', async () => {
    // Tussen de controles en de claim zet een andere aanvraag het plan al op Pro.
    h.heeftOpenstaandeBetaling.mockImplementation(async () => { sub().plan = 'premium'; return false })
    const r = await plaatsUpgrade('user_1', NU)
    expect(r).toMatchObject({ ok: false, status: 409 })
    expect(h.maakLosseHerhaalBetaling).not.toHaveBeenCalled()
  })

  it('vlak voor het einde van het jaar is de bijbetaling nul: wel Pro, geen betaling', async () => {
    const r = await plaatsUpgrade('user_1', new Date('2027-10-03T23:59:00.000Z'))
    expect(r).toMatchObject({ ok: true, upgrade: { direct: true, bijbetalingCent: 0 } })
    expect(h.maakLosseHerhaalBetaling).not.toHaveBeenCalled()
    expect(sub().plan).toBe('premium')
  })
})

describe('plaatsUpgrade: weigeren zonder iets achter te laten', () => {
  async function weigert(status: number) {
    const r = await plaatsUpgrade('user_1', NU)
    expect(r).toMatchObject({ ok: false, status })
    expect(h.maakLosseHerhaalBetaling).not.toHaveBeenCalled()
    expect(h.maakAbonnement).not.toHaveBeenCalled()
    expect(h.stopEnBevestig).not.toHaveBeenCalled()
    expect(geplandLeeg()).toBe(true)
    expect(gebruiker().plan).toBe('basis')
  }

  it('een Pro-abonnement kan niet upgraden', async () => { zet(basisRij({ plan: 'premium' })); await weigert(400) })
  it('al een wijziging gepland', async () => { zet(basisRij({ gepland_at: ISO('2026-11-10') })); const r = await plaatsUpgrade('user_1', NU); expect(r).toMatchObject({ ok: false, status: 409 }); expect(h.maakLosseHerhaalBetaling).not.toHaveBeenCalled() })
  it('geen geldige machtiging', async () => { h.heeftGeldigeMachtiging.mockResolvedValue(false); await weigert(409) })
  it('een betaling is nog onderweg', async () => { h.heeftOpenstaandeBetaling.mockResolvedValue(true); await weigert(409) })
  it('een gelijktijdige aanvraag was ons voor (maandabonnement): geen tweede abonnement en geen tweede bijbetaling', async () => {
    h.heeftOpenstaandeBetaling.mockImplementation(async () => { sub().gepland_at = ISO('2026-11-20T09:59:00.000Z'); return false })
    const r = await plaatsUpgrade('user_1', NU)
    expect(r).toMatchObject({ ok: false, status: 409 })
    expect(h.maakAbonnement).not.toHaveBeenCalled()
    expect(h.maakLosseHerhaalBetaling).not.toHaveBeenCalled()
  })
  it('volgende incasso binnen 4 dagen', async () => {
    h.haalAbonnement.mockResolvedValue({ id: 'x', status: 'active', nextPaymentDate: '2026-11-23' })
    zet(basisRij({ periode_einde: ISO('2026-11-23') }))
    await weigert(409)
  })
  it('de database kent de betaalsoort upgrade nog niet: 503, niets aangemaakt en Arno krijgt een melding', async () => {
    h.insertFout.aan = true
    await weigert(503)
    expect(h.notifyTelegram).toHaveBeenCalledTimes(1)
    expect(String((h.notifyTelegram.mock.calls[0] as unknown[])[0])).toContain('2026-11-12-betaalsoort-upgrade.sql')
  })
})
