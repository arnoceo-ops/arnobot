/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Zakelijke solo-klant met een maandabonnement wordt Team (docs/OVERSTAP_PLAN.md): het Mollie-abonnement stopt direct,
// de rij loopt door tot het einde van de betaalde periode (zonder cancelled_at op het account), het Team start op die
// datum. Database, Mollie en meldingen zijn nagemaakt.

type Rij = Record<string, any>
const h = vi.hoisted(() => ({
  tabellen: {} as Record<string, Rij[]>,
  haalAbonnement: vi.fn(),
  heeftOpenstaandeBetaling: vi.fn(),
  stopEnBevestig: vi.fn(),
  notifyTelegram: vi.fn(async () => {}),
  verstuurBillingMail: vi.fn(async () => true),
  failRijUpdate: { n: 0 },
  stopOk: { ja: true },
}))

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))
vi.mock('@/lib/cron-notify', () => ({ notifyTelegram: h.notifyTelegram }))
vi.mock('./mollie', () => ({ haalAbonnement: h.haalAbonnement }))
vi.mock('./openstaandeBetaling', () => ({ heeftOpenstaandeBetaling: h.heeftOpenstaandeBetaling }))
vi.mock('./mails', () => ({ verstuurBillingMail: h.verstuurBillingMail }))
vi.mock('./teamFacturatie', () => ({
  huidigSeats: vi.fn(async (_teamId: string, min: number) => min),
  berekenReguliereBedrag: (seats: number) => ({ nettoCent: seats * 5000, btwCent: 0, brutoCent: 0 }),
}))
vi.mock('./verwerking', () => ({
  // Zoals het echte stopEnBevestig: bij Mollie bevestigd stopt, dan zet het de bewaking op de rij.
  stopEnBevestig: h.stopEnBevestig.mockImplementation(async (sub: Rij) => {
    if (!h.stopOk.ja) return false
    const r = (h.tabellen.arnobot_subscriptions ?? []).find(x => x.id === sub.id)
    if (r) r.mollie_sub_geannuleerd_at = '2026-11-20T10:00:00.000Z'
    return true
  }),
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
          if (tabel === 'arnobot_subscriptions' && h.failRijUpdate.n > 0) {
            h.failRijUpdate.n--
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
        in: (k: string, v: unknown[]) => { filters.push(r => v.includes(r[k])); return q },
        not: (k: string) => { filters.push(r => r[k] != null); return q },
        order: () => q,
        limit: () => q,
        returns: () => q,
        update: (p: Rij) => { patch = p; return q },
        maybeSingle: async () => ({ data: (uitvoeren().data as Rij[] | null)?.[0] ?? null, error: null }),
        then: (res: any, rej: any) => Promise.resolve(uitvoeren()).then(res, rej),
      }
      return q
    },
  },
}))

import { bekijkSoloNaarTeam, soloStoptVoorTeam, voerSoloNaarTeamUit } from './soloNaarTeam'

const ISO = (s: string) => new Date(s).toISOString()
const NU = new Date('2026-11-20T10:00:00.000Z')
const INVOER = { minSeats: 3, cyclus: 'maandelijks' as const }

function zet(sub: Rij = {}, team: Rij = {}) {
  h.tabellen = {
    arnobot_teams: [{ id: 't1', name: 'Acme', manager_id: 'user_m', min_seats: null, cyclus: null, volgende_factuurdatum: null, ...team }],
    arnobot_team_members: [{ team_id: 't1', user_id: 'user_m', role: 'manager' }],
    approved_users: [{ user_id: 'user_m', command_manager: true }],
    arnobot_subscriptions: [{
      id: 'rij-1', user_id: 'user_m', plan: 'basis', cyclus: 'maandelijks', klant_type: 'zakelijk', status: 'active',
      bedrag_cent: 3509, btw_cent: 609, mollie_customer_id: 'cst_1', mollie_subscription_id: 'sub_solo', mollie_sub_geannuleerd_at: null,
      periode_start: ISO('2026-11-04'), periode_einde: ISO('2026-12-04'), contract_einde: null,
      opzegging_aangevraagd_at: null, opzegging_ingaat_at: null, created_at: ISO('2026-11-04'),
      gepland_plan: null, gepland_cyclus: null, gepland_bedrag_cent: null, gepland_btw_cent: null,
      gepland_mollie_subscription_id: null, gepland_mollie_sub_geannuleerd_at: null, gepland_ingangs_at: null, gepland_at: null,
      ...sub,
    }],
  }
}
const sub = () => h.tabellen.arnobot_subscriptions[0]
const team = () => h.tabellen.arnobot_teams[0]

beforeEach(() => {
  for (const f of [h.haalAbonnement, h.heeftOpenstaandeBetaling, h.notifyTelegram, h.verstuurBillingMail]) f.mockReset()
  h.stopEnBevestig.mockClear()
  h.stopOk.ja = true
  h.failRijUpdate.n = 0
  h.haalAbonnement.mockResolvedValue({ id: 'sub_solo', status: 'active', nextPaymentDate: '2026-12-04' })
  h.heeftOpenstaandeBetaling.mockResolvedValue(false)
  h.verstuurBillingMail.mockResolvedValue(true)
  h.notifyTelegram.mockResolvedValue(undefined)
  zet()
})

describe('bekijkSoloNaarTeam (voorbeeld, wijzigt niets)', () => {
  it('geeft datum, bedragen en wat er gebeurt, en raakt niets aan', async () => {
    const r = await bekijkSoloNaarTeam('t1', INVOER, NU)
    expect(r).toMatchObject({
      ok: true, ingaatOp: '2026-12-04', seats: 3, cyclus: 'maandelijks', teamNettoCent: 15000,
      soloOmschrijving: 'Basic maandelijks', alGeregeld: false, hervat: false,
    })
    expect(h.stopEnBevestig).not.toHaveBeenCalled()
    expect(sub().status).toBe('active')
    expect(team()).toMatchObject({ min_seats: null, volgende_factuurdatum: null })
  })

  it.each([
    ['klant is geen zakelijk', { klant_type: 'particulier' }, 409],
    ['jaarabonnement', { cyclus: 'jaarlijks' }, 409],
    ['geen Mollie-abonnement', { mollie_subscription_id: null }, 409],
    ['er staat een overstap gepland', { gepland_at: ISO('2026-11-10'), gepland_mollie_subscription_id: 'sub_x' }, 409],
    ['al opgezegd door de klant zelf', { status: 'cancelled', opzegging_ingaat_at: ISO('2027-01-04') }, 409],
  ])('weigert: %s', async (_naam, extra, status) => {
    zet(extra as Rij)
    expect(await bekijkSoloNaarTeam('t1', INVOER, NU)).toMatchObject({ ok: false, status })
  })

  it('weigert als de teambaas geen manager is met command_manager', async () => {
    h.tabellen.approved_users[0].command_manager = false
    expect(await bekijkSoloNaarTeam('t1', INVOER, NU)).toMatchObject({ ok: false, status: 409 })
    zet()
    h.tabellen.arnobot_team_members[0].role = 'member'
    expect(await bekijkSoloNaarTeam('t1', INVOER, NU)).toMatchObject({ ok: false, status: 409 })
  })

  it('weigert zonder solo-abonnement en voor een onbekend team', async () => {
    h.tabellen.arnobot_subscriptions = []
    expect(await bekijkSoloNaarTeam('t1', INVOER, NU)).toMatchObject({ ok: false, status: 404 })
    expect(await bekijkSoloNaarTeam('bestaat-niet', INVOER, NU)).toMatchObject({ ok: false, status: 404 })
  })

  it('weigert ongeldige invoer', async () => {
    expect(await bekijkSoloNaarTeam('t1', { minSeats: 0, cyclus: 'maandelijks' }, NU)).toMatchObject({ ok: false, status: 400 })
    expect(await bekijkSoloNaarTeam('t1', { minSeats: 3, cyclus: 'wekelijks' as any }, NU)).toMatchObject({ ok: false, status: 400 })
  })

  it('weigert als de volgende incasso binnen 4 dagen ligt: het Team start dan een periode later', async () => {
    h.haalAbonnement.mockResolvedValue({ id: 'sub_solo', status: 'active', nextPaymentDate: '2026-11-22' })
    zet({ periode_einde: ISO('2026-11-22') })
    expect(await bekijkSoloNaarTeam('t1', INVOER, NU)).toMatchObject({ ok: false, status: 409 })
  })

  it('weigert als Mollies incassodatum ver van het einde van de periode afwijkt (een betaling kan openstaan)', async () => {
    h.haalAbonnement.mockResolvedValue({ id: 'sub_solo', status: 'active', nextPaymentDate: '2027-01-04' })
    expect(await bekijkSoloNaarTeam('t1', INVOER, NU)).toMatchObject({ ok: false, status: 409 })
  })

  it('weigert als het Mollie-abonnement niet actief is of Mollie niet te bereiken is', async () => {
    h.haalAbonnement.mockResolvedValue({ id: 'sub_solo', status: 'canceled' })
    expect(await bekijkSoloNaarTeam('t1', INVOER, NU)).toMatchObject({ ok: false, status: 409 })
    h.haalAbonnement.mockRejectedValue(new Error('storing'))
    expect(await bekijkSoloNaarTeam('t1', INVOER, NU)).toMatchObject({ ok: false, status: 502 })
  })

  it('weigert bij een betaling onderweg, en als dat niet te controleren is', async () => {
    h.heeftOpenstaandeBetaling.mockResolvedValue(true)
    expect(await bekijkSoloNaarTeam('t1', INVOER, NU)).toMatchObject({ ok: false, status: 409 })
    h.heeftOpenstaandeBetaling.mockRejectedValue(new Error('storing'))
    expect(await bekijkSoloNaarTeam('t1', INVOER, NU)).toMatchObject({ ok: false, status: 502 })
  })

  it('overschrijft geen bestaande factuurdatum die niet bij het einde van het solo-abonnement hoort', async () => {
    zet({}, { volgende_factuurdatum: '2027-03-01', min_seats: 3, cyclus: 'maandelijks' })
    expect(await bekijkSoloNaarTeam('t1', INVOER, NU)).toMatchObject({ ok: false, status: 409 })
  })
})

describe('voerSoloNaarTeamUit', () => {
  it('stopt Mollie, zet de rij op cancelled tot het einde van de periode (zonder cancelled_at), zet het Team klaar en mailt', async () => {
    const r = await voerSoloNaarTeamUit('t1', INVOER, NU)
    expect(r).toMatchObject({ ok: true, ingaatOp: '2026-12-04', alGeregeld: false })

    expect(h.stopEnBevestig).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ id: 'rij-1' }), 'sub_solo', 'huidig')
    expect(sub()).toMatchObject({
      status: 'cancelled', opzegging_ingaat_at: ISO('2026-12-04'), opzegging_aangevraagd_at: NU.toISOString(),
      mollie_sub_geannuleerd_at: expect.any(String),
    })
    // Nooit cancelled_at op het account: dat zou de toegang via het Team na de einddatum afsluiten.
    expect(h.tabellen.approved_users[0]).not.toHaveProperty('cancelled_at')
    expect(team()).toMatchObject({ min_seats: 3, cyclus: 'maandelijks', volgende_factuurdatum: '2026-12-04' })
    expect(h.verstuurBillingMail).toHaveBeenCalledExactlyOnceWith('user_m', 'solo_naar_team', {
      datum: ISO('2026-12-04'), bedragCent: 15000, perPeriode: 'per maand',
    })
    expect(h.notifyTelegram).toHaveBeenCalledTimes(1)
  })

  it('een tweede keer uitvoeren verandert niets meer: niet nog eens stoppen of mailen', async () => {
    await voerSoloNaarTeamUit('t1', INVOER, NU)
    h.stopEnBevestig.mockClear()
    h.verstuurBillingMail.mockClear()
    const r = await voerSoloNaarTeamUit('t1', INVOER, NU)
    expect(r).toMatchObject({ ok: true, alGeregeld: true })
    expect(h.stopEnBevestig).not.toHaveBeenCalled()
    expect(h.verstuurBillingMail).not.toHaveBeenCalled()
  })

  it('stoppen bij Mollie mislukt: niets gewijzigd en het Team weer zoals het was', async () => {
    zet({}, { min_seats: 5, cyclus: 'jaarlijks', volgende_factuurdatum: '2026-12-04' })
    h.stopOk.ja = false
    const r = await voerSoloNaarTeamUit('t1', INVOER, NU)
    expect(r).toMatchObject({ ok: false, status: 502 })
    expect(sub()).toMatchObject({ status: 'active', opzegging_ingaat_at: null })
    expect(team()).toMatchObject({ min_seats: 5, cyclus: 'jaarlijks', volgende_factuurdatum: '2026-12-04' })
    expect(h.verstuurBillingMail).not.toHaveBeenCalled()
  })

  it('betaling onderweg na het stoppen: het Team wordt teruggezet en Arno krijgt een melding', async () => {
    h.heeftOpenstaandeBetaling.mockResolvedValueOnce(false).mockResolvedValueOnce(true)
    const r = await voerSoloNaarTeamUit('t1', INVOER, NU)
    expect(r).toMatchObject({ ok: false, status: 409 })
    expect(team()).toMatchObject({ min_seats: null, cyclus: null, volgende_factuurdatum: null })
    expect(sub().status).toBe('active')
    expect(h.notifyTelegram).toHaveBeenCalledTimes(1)
    expect(h.verstuurBillingMail).not.toHaveBeenCalled()
  })

  it('rij niet bij te werken: Mollie is gestopt, het Team staat klaar, Arno krijgt een melding en een nieuwe poging hervat', async () => {
    h.failRijUpdate.n = 1
    const eerste = await voerSoloNaarTeamUit('t1', INVOER, NU)
    expect(eerste).toMatchObject({ ok: false, status: 502 })
    expect(sub()).toMatchObject({ status: 'active', mollie_sub_geannuleerd_at: expect.any(String) })
    expect(team()).toMatchObject({ volgende_factuurdatum: '2026-12-04' })
    expect(h.notifyTelegram).toHaveBeenCalledTimes(1)
    expect(h.verstuurBillingMail).not.toHaveBeenCalled()

    // Hervatten: niet nog eens bij Mollie stoppen (dat zou een al gestopt abonnement opnieuw proberen te stoppen).
    h.stopEnBevestig.mockClear()
    h.haalAbonnement.mockClear()
    const tweede = await voerSoloNaarTeamUit('t1', INVOER, NU)
    expect(tweede).toMatchObject({ ok: true, hervat: true })
    expect(h.stopEnBevestig).not.toHaveBeenCalled()
    expect(h.haalAbonnement).not.toHaveBeenCalled()
    expect(sub()).toMatchObject({ status: 'cancelled', opzegging_ingaat_at: ISO('2026-12-04') })
    expect(h.verstuurBillingMail).toHaveBeenCalledTimes(1)
  })

  it('de datum van het Team is Mollies volgende incassodatum, ook als die een dag afwijkt van periode_einde', async () => {
    h.haalAbonnement.mockResolvedValue({ id: 'sub_solo', status: 'active', nextPaymentDate: '2026-12-05' })
    const r = await voerSoloNaarTeamUit('t1', INVOER, NU)
    expect(r).toMatchObject({ ok: true, ingaatOp: '2026-12-05' })
    expect(team().volgende_factuurdatum).toBe('2026-12-05')
    // Een tweede keer wordt dat nog steeds als al geregeld herkend.
    expect(await voerSoloNaarTeamUit('t1', INVOER, NU)).toMatchObject({ ok: true, alGeregeld: true })
  })
})

describe('soloStoptVoorTeam', () => {
  const gestopt = { status: 'cancelled', opzegging_ingaat_at: ISO('2026-12-04'), mollie_sub_geannuleerd_at: ISO('2026-11-20') }
  const actiefTeam = { min_seats: 3, cyclus: 'maandelijks', volgende_factuurdatum: '2026-12-04' }

  it('geeft de einddatum als het solo-abonnement stopt en het Team klaarstaat', async () => {
    zet(gestopt, actiefTeam)
    expect(await soloStoptVoorTeam('user_m', NU)).toBe(ISO('2026-12-04'))
  })

  it('null voor een gewone opzegging (geen Team geactiveerd voor facturatie)', async () => {
    zet(gestopt)
    expect(await soloStoptVoorTeam('user_m', NU)).toBeNull()
  })

  it('null als de einddatum voorbij is, bij een actief abonnement en zonder abonnement', async () => {
    zet({ ...gestopt, opzegging_ingaat_at: ISO('2026-11-01') }, actiefTeam)
    expect(await soloStoptVoorTeam('user_m', NU)).toBeNull()
    zet({ status: 'active' }, actiefTeam)
    expect(await soloStoptVoorTeam('user_m', NU)).toBeNull()
    expect(await soloStoptVoorTeam('niemand', NU)).toBeNull()
  })
})
