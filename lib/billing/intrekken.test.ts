/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Een geplande overstap of een opzegging intrekken (docs/OVERSTAP_PLAN.md): het Mollie-abonnement dat
// bij het plannen of opzeggen is gestopt, komt zo nodig terug, in een veilige volgorde met
// terugdraaien per stap. Database, Mollie en meldingen zijn nagemaakt.

type Rij = Record<string, any>
const h = vi.hoisted(() => ({
  tabellen: {} as Record<string, Rij[]>,
  heeftGeldigeMachtiging: vi.fn(),
  haalAbonnement: vi.fn(),
  maakAbonnement: vi.fn(),
  stopEnBevestig: vi.fn(),
  notifyTelegram: vi.fn(async () => {}),
  verstuurBillingMail: vi.fn(async () => true),
  failUpdates: { n: 0 },
  soloStoptVoorTeam: vi.fn(),
}))

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))
vi.mock('@/lib/cron-notify', () => ({ notifyTelegram: h.notifyTelegram }))
vi.mock('@/lib/internalTestAccounts', () => ({ isInternalTestUser: vi.fn() }))
vi.mock('./openstaandeBetaling', () => ({ heeftOpenstaandeBetaling: vi.fn() }))
vi.mock('./verwerking', () => ({ stopEnBevestig: h.stopEnBevestig }))
vi.mock('./soloNaarTeam', () => ({ soloStoptVoorTeam: h.soloStoptVoorTeam }))
vi.mock('./mails', () => ({ verstuurBillingMail: h.verstuurBillingMail }))
vi.mock('./mollie', () => ({
  heeftGeldigeMachtiging: h.heeftGeldigeMachtiging,
  haalAbonnement: h.haalAbonnement,
  maakAbonnement: h.maakAbonnement,
  mollieBeschikbaarVoor: vi.fn(),
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
          if (tabel === 'arnobot_subscriptions' && h.failUpdates.n > 0) {
            h.failUpdates.n--
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

import { trekOpzeggingIn, trekOverstapIn } from './intrekken'
import { berekenBedrag } from './prijzen'

const ISO = (s: string) => new Date(s).toISOString()
const NU = new Date('2026-11-20T10:00:00.000Z')
const GEPLAND_AT = ISO('2026-11-10T09:00:00.000Z')

function rij(extra: Rij = {}): Rij {
  return {
    id: 'rij-1', user_id: 'user_1', plan: 'basis', cyclus: 'maandelijks', klant_type: 'particulier', status: 'active',
    bedrag_cent: 2900, btw_cent: 503, mollie_customer_id: 'cst_1',
    mollie_subscription_id: 'sub_huidig', mollie_sub_geannuleerd_at: ISO('2026-11-10'),
    periode_start: ISO('2026-11-04'), periode_einde: ISO('2026-12-04'), contract_einde: null,
    opzegging_aangevraagd_at: null, opzegging_ingaat_at: null, created_at: ISO('2026-11-04'),
    gepland_plan: null, gepland_cyclus: null, gepland_bedrag_cent: null, gepland_btw_cent: null,
    gepland_mollie_subscription_id: null, gepland_mollie_sub_geannuleerd_at: null, gepland_ingangs_at: null, gepland_at: null,
    ...extra,
  }
}

/** Een geplande overstap maand naar jaar. */
const gepland = {
  gepland_plan: 'basis', gepland_cyclus: 'jaarlijks', gepland_bedrag_cent: 22800, gepland_btw_cent: 3957,
  gepland_mollie_subscription_id: 'sub_gepland', gepland_ingangs_at: ISO('2026-12-04'), gepland_at: GEPLAND_AT,
}

const sub = () => h.tabellen.arnobot_subscriptions[0]
const geplandLeeg = () => Object.keys(sub()).filter(k => k.startsWith('gepland_')).every(k => sub()[k] === null)

function zet(r: Rij) {
  h.tabellen = { arnobot_subscriptions: [r], approved_users: [{ user_id: 'user_1', cancelled_at: ISO('2026-11-10') }] }
}

beforeEach(() => {
  for (const f of [h.heeftGeldigeMachtiging, h.haalAbonnement, h.maakAbonnement, h.stopEnBevestig, h.notifyTelegram, h.verstuurBillingMail]) f.mockReset()
  h.verstuurBillingMail.mockResolvedValue(true)
  h.failUpdates.n = 0
  h.soloStoptVoorTeam.mockReset()
  h.soloStoptVoorTeam.mockResolvedValue(null)
  h.heeftGeldigeMachtiging.mockResolvedValue(true)
  h.haalAbonnement.mockResolvedValue({ id: 'x', status: 'active' })
  h.maakAbonnement.mockResolvedValue({ id: 'sub_herstel', status: 'pending' })
  h.stopEnBevestig.mockResolvedValue(true)
  h.notifyTelegram.mockResolvedValue(undefined)
})

describe('trekOverstapIn: gelukt', () => {
  beforeEach(() => zet(rij(gepland)))

  it('maakt het oude abonnement opnieuw aan vanaf de ingangsdatum, stopt het geplande en zet de rij terug', async () => {
    expect(await trekOverstapIn('user_1', NU)).toEqual({ ok: true })
    expect(h.maakAbonnement).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      klantId: 'cst_1', brutoCent: 2900, interval: '1 month', times: null, startDatum: new Date('2026-12-04T00:00:00.000Z'),
      metadata: { userId: 'user_1', subscriptionRowId: 'rij-1' }, idempotencyKey: `intrekken-rij-1-${GEPLAND_AT}`,
    }))
    expect(h.stopEnBevestig).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ id: 'rij-1' }), 'sub_gepland', 'gepland')
    expect(sub()).toMatchObject({ mollie_subscription_id: 'sub_herstel', mollie_sub_geannuleerd_at: null, plan: 'basis', cyclus: 'maandelijks', bedrag_cent: 2900 })
    expect(geplandLeeg()).toBe(true)
    expect(h.notifyTelegram).toHaveBeenCalledTimes(1)
  })

  it('zakelijk jaar (Pro naar Basic ingetrokken): doorlopend jaarabonnement terug', async () => {
    zet(rij({ ...gepland, klant_type: 'zakelijk', cyclus: 'jaarlijks', plan: 'premium', bedrag_cent: 56628, gepland_plan: 'basis' }))
    await trekOverstapIn('user_1', NU)
    expect(h.maakAbonnement).toHaveBeenCalledWith(expect.objectContaining({ brutoCent: 56628, interval: '12 months', times: null }))
  })

  it('een tweede keer intrekken doet niets meer (er staat dan niets meer gepland)', async () => {
    await trekOverstapIn('user_1', NU)
    h.maakAbonnement.mockClear()
    expect(await trekOverstapIn('user_1', NU)).toMatchObject({ ok: false, status: 409 })
    expect(h.maakAbonnement).not.toHaveBeenCalled()
  })

  it('een gelijktijdige aanvraag was ons voor: het eigen aangemaakte abonnement wordt weer gestopt', async () => {
    h.stopEnBevestig.mockImplementationOnce(async () => {
      Object.assign(sub(), { ...Object.fromEntries(Object.keys(sub()).filter(k => k.startsWith('gepland_')).map(k => [k, null])), mollie_subscription_id: 'sub_van_de_ander' })
      return true
    })
    expect(await trekOverstapIn('user_1', NU)).toEqual({ ok: true })
    expect(h.stopEnBevestig).toHaveBeenLastCalledWith(expect.anything(), 'sub_herstel', 'ongeregistreerd')
    expect(sub().mollie_subscription_id).toBe('sub_van_de_ander')
  })

  it('probeert het bijwerken van de rij opnieuw als het eerst mislukt', async () => {
    h.failUpdates.n = 1
    expect(await trekOverstapIn('user_1', NU)).toEqual({ ok: true })
    expect(sub().mollie_subscription_id).toBe('sub_herstel')
  })
})

describe('trekOverstapIn: weigeren of terugdraaien', () => {
  beforeEach(() => zet(rij(gepland)))

  it('geen lopend abonnement', async () => { h.tabellen.arnobot_subscriptions = []; expect(await trekOverstapIn('user_1', NU)).toMatchObject({ ok: false, status: 404 }) })
  it('niets gepland', async () => { zet(rij()); expect(await trekOverstapIn('user_1', NU)).toMatchObject({ ok: false, status: 409 }); expect(h.maakAbonnement).not.toHaveBeenCalled() })
  it('gepland zonder opgeslagen id: niet automatisch', async () => { zet(rij({ gepland_at: GEPLAND_AT })); expect(await trekOverstapIn('user_1', NU)).toMatchObject({ ok: false, status: 409 }); expect(h.maakAbonnement).not.toHaveBeenCalled() })
  it('de overstap gaat binnen een dag in', async () => {
    expect(await trekOverstapIn('user_1', new Date('2026-12-03T12:00:00.000Z'))).toMatchObject({ ok: false, status: 409 })
    expect(h.maakAbonnement).not.toHaveBeenCalled()
  })
  it('precies een dag vooraf mag nog', async () => {
    expect((await trekOverstapIn('user_1', new Date('2026-12-03T00:00:00.000Z'))).ok).toBe(true)
  })
  it('geen geldige machtiging', async () => {
    h.heeftGeldigeMachtiging.mockResolvedValue(false)
    expect(await trekOverstapIn('user_1', NU)).toMatchObject({ ok: false, status: 409 })
    expect(h.maakAbonnement).not.toHaveBeenCalled()
  })
  it('Mollie niet te bevragen: 502 en niets gewijzigd', async () => {
    h.heeftGeldigeMachtiging.mockRejectedValue(new Error('storing'))
    expect(await trekOverstapIn('user_1', NU)).toMatchObject({ ok: false, status: 502 })
    expect(h.maakAbonnement).not.toHaveBeenCalled()
    expect(sub().gepland_mollie_subscription_id).toBe('sub_gepland')
  })
  it('nieuw abonnement aanmaken mislukt: niets gestopt en de geplande overstap blijft staan', async () => {
    h.maakAbonnement.mockRejectedValue(new Error('storing'))
    expect(await trekOverstapIn('user_1', NU)).toMatchObject({ ok: false, status: 502 })
    expect(h.stopEnBevestig).not.toHaveBeenCalled()
    expect(sub()).toMatchObject({ gepland_mollie_subscription_id: 'sub_gepland', mollie_subscription_id: 'sub_huidig' })
  })
  it('geplande abonnement stoppen mislukt: het nieuw aangemaakte wordt weer gestopt en alles blijft zoals het was', async () => {
    h.stopEnBevestig.mockImplementation(async (_s: Rij, id: string) => id !== 'sub_gepland')
    expect(await trekOverstapIn('user_1', NU)).toMatchObject({ ok: false, status: 502 })
    expect(h.stopEnBevestig).toHaveBeenLastCalledWith(expect.anything(), 'sub_herstel', 'ongeregistreerd')
    expect(sub()).toMatchObject({ gepland_mollie_subscription_id: 'sub_gepland', mollie_subscription_id: 'sub_huidig' })
    expect(h.notifyTelegram).not.toHaveBeenCalled()
  })
  it('beide stops mislukken: dringende melding met beide id\'s', async () => {
    h.stopEnBevestig.mockResolvedValue(false)
    expect(await trekOverstapIn('user_1', NU)).toMatchObject({ ok: false, status: 502 })
    expect(String((h.notifyTelegram.mock.calls[0] as unknown[])[0])).toContain('INTREKKEN HALF AFGEROND')
  })
  it('rij niet bij te werken, ook niet na een herkansing: dringende melding en 502', async () => {
    h.failUpdates.n = 2
    expect(await trekOverstapIn('user_1', NU)).toMatchObject({ ok: false, status: 502 })
    expect(String((h.notifyTelegram.mock.calls[0] as unknown[])[0])).toContain('RIJ NIET BIJGEWERKT')
  })
})

describe('trekOpzeggingIn', () => {
  const opgezegd = { status: 'cancelled', opzegging_aangevraagd_at: ISO('2026-11-10'), opzegging_ingaat_at: ISO('2026-12-04') }

  it('particulier maand, Mollie gestopt bij het opzeggen: nieuw abonnement vanaf het einde van de periode, rij weer actief', async () => {
    zet(rij(opgezegd))
    expect(await trekOpzeggingIn('user_1', NU)).toEqual({ ok: true })
    expect(h.maakAbonnement).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      klantId: 'cst_1', brutoCent: 2900, interval: '1 month', times: null, startDatum: new Date('2026-12-04T00:00:00.000Z'),
      idempotencyKey: `opzegging-intrekken-rij-1-${ISO('2026-11-10')}`,
    }))
    expect(sub()).toMatchObject({ status: 'active', opzegging_aangevraagd_at: null, opzegging_ingaat_at: null, mollie_subscription_id: 'sub_herstel', mollie_sub_geannuleerd_at: null })
    expect(h.tabellen.approved_users[0].cancelled_at).toBeNull()
    expect(h.notifyTelegram).toHaveBeenCalledTimes(1)
    expect(h.verstuurBillingMail).toHaveBeenCalledExactlyOnceWith('user_1', 'opzegging_ingetrokken', { datum: ISO('2026-12-04'), metBetaling: true })
  })

  // Gevonden bij de test in testmodus (2026-11-12): upgrade naar Pro, opzeggen, opzegging intrekken gaf een
  // abonnement van €29 terwijl het plan Pro was, en een mislukte bijbetaling zette het plan niet meer terug.
  it('na een nog niet omgezette upgrade: nieuw abonnement met het Pro-bedrag, als geplande wijziging', async () => {
    zet(rij({ ...opgezegd, plan: 'premium', bedrag_cent: 2900, btw_cent: 503 }))
    expect(await trekOpzeggingIn('user_1', NU)).toEqual({ ok: true })
    expect(h.maakAbonnement).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      brutoCent: berekenBedrag('premium', 'maandelijks', 'particulier').brutoCent, startDatum: new Date('2026-12-04T00:00:00.000Z'),
    }))
    expect(sub()).toMatchObject({
      status: 'active', plan: 'premium',
      // het gestopte basisabonnement blijft als gestopt geregistreerd, het Pro-abonnement is de geplande wijziging
      mollie_subscription_id: 'sub_huidig', mollie_sub_geannuleerd_at: ISO('2026-11-10'),
      gepland_plan: 'premium', gepland_cyclus: 'maandelijks', gepland_mollie_subscription_id: 'sub_herstel',
      gepland_bedrag_cent: berekenBedrag('premium', 'maandelijks', 'particulier').brutoCent,
      gepland_btw_cent: berekenBedrag('premium', 'maandelijks', 'particulier').btwCent,
      gepland_ingangs_at: ISO('2026-12-04'), gepland_mollie_sub_geannuleerd_at: null,
    })
  })

  it('een gewone Pro-klant (bedrag al het Pro-bedrag): ongewijzigd, geen geplande wijziging', async () => {
    const pro = berekenBedrag('premium', 'maandelijks', 'particulier')
    zet(rij({ ...opgezegd, plan: 'premium', bedrag_cent: pro.brutoCent, btw_cent: pro.btwCent }))
    expect(await trekOpzeggingIn('user_1', NU)).toEqual({ ok: true })
    expect(h.maakAbonnement).toHaveBeenCalledWith(expect.objectContaining({ brutoCent: pro.brutoCent }))
    expect(sub()).toMatchObject({ mollie_subscription_id: 'sub_herstel', mollie_sub_geannuleerd_at: null, gepland_plan: null, gepland_mollie_subscription_id: null })
  })

  it('gestopt omdat de klant Team wordt: niet in te trekken, er gebeurt niets bij Mollie', async () => {
    zet(rij(opgezegd))
    h.soloStoptVoorTeam.mockResolvedValue(ISO('2026-12-04'))
    expect(await trekOpzeggingIn('user_1', NU)).toMatchObject({ ok: false, status: 409 })
    expect(h.maakAbonnement).not.toHaveBeenCalled()
    expect(sub()).toMatchObject({ status: 'cancelled' })
  })

  it('zakelijk te laat opgezegd: het Mollie-abonnement loopt nog, er wordt niets nieuws aangemaakt', async () => {
    zet(rij({ ...opgezegd, klant_type: 'zakelijk', mollie_sub_geannuleerd_at: null, opzegging_ingaat_at: ISO('2027-01-04') }))
    expect(await trekOpzeggingIn('user_1', NU)).toEqual({ ok: true })
    expect(h.haalAbonnement).toHaveBeenCalledWith('cst_1', 'sub_huidig')
    expect(h.maakAbonnement).not.toHaveBeenCalled()
    expect(sub()).toMatchObject({ status: 'active', opzegging_ingaat_at: null, mollie_subscription_id: 'sub_huidig' })
    expect(h.tabellen.approved_users[0].cancelled_at).toBeNull()
    expect(h.verstuurBillingMail).toHaveBeenCalledExactlyOnceWith('user_1', 'opzegging_ingetrokken', expect.objectContaining({ metBetaling: true }))
  })

  it('weigert als het lopende Mollie-abonnement niet meer actief blijkt', async () => {
    zet(rij({ ...opgezegd, mollie_sub_geannuleerd_at: null }))
    h.haalAbonnement.mockResolvedValue({ id: 'x', status: 'suspended' })
    expect(await trekOpzeggingIn('user_1', NU)).toMatchObject({ ok: false, status: 409 })
    expect(sub().status).toBe('cancelled')
  })

  it('particulier jaar (geen Mollie-abonnement): alleen de rij weer actief, bij Mollie gebeurt niets', async () => {
    zet(rij({ ...opgezegd, cyclus: 'jaarlijks', mollie_subscription_id: null, mollie_sub_geannuleerd_at: null }))
    expect(await trekOpzeggingIn('user_1', NU)).toEqual({ ok: true })
    expect(h.heeftGeldigeMachtiging).not.toHaveBeenCalled()
    expect(h.maakAbonnement).not.toHaveBeenCalled()
    expect(sub()).toMatchObject({ status: 'active', opzegging_ingaat_at: null, mollie_subscription_id: null })
    // Geen automatische betaling bij een particulier jaarabonnement: de mail zegt dat niet.
    expect(h.verstuurBillingMail).toHaveBeenCalledExactlyOnceWith('user_1', 'opzegging_ingetrokken', expect.objectContaining({ metBetaling: false }))
  })

  it('geen opgezegd abonnement', async () => { zet(rij()); expect(await trekOpzeggingIn('user_1', NU)).toMatchObject({ ok: false, status: 404 }) })
  it('er staat ook een overstap gepland: niet automatisch', async () => {
    zet(rij({ ...opgezegd, ...gepland }))
    expect(await trekOpzeggingIn('user_1', NU)).toMatchObject({ ok: false, status: 409 })
    expect(h.maakAbonnement).not.toHaveBeenCalled()
  })
  it('de opzegging is al ingegaan', async () => {
    zet(rij({ ...opgezegd, opzegging_ingaat_at: ISO('2026-11-15') }))
    expect(await trekOpzeggingIn('user_1', NU)).toMatchObject({ ok: false, status: 409 })
  })
  it('het einde van de betaalde periode is binnen een dag: opnieuw afrekenen na afloop', async () => {
    zet(rij(opgezegd))
    expect(await trekOpzeggingIn('user_1', new Date('2026-12-03T12:00:00.000Z'))).toMatchObject({ ok: false, status: 409 })
    expect(h.maakAbonnement).not.toHaveBeenCalled()
  })
  it('geen geldige machtiging', async () => {
    zet(rij(opgezegd))
    h.heeftGeldigeMachtiging.mockResolvedValue(false)
    expect(await trekOpzeggingIn('user_1', NU)).toMatchObject({ ok: false, status: 409 })
    expect(sub().status).toBe('cancelled')
  })
  it('nieuw abonnement aanmaken mislukt: opzegging blijft staan', async () => {
    zet(rij(opgezegd))
    h.maakAbonnement.mockRejectedValue(new Error('storing'))
    expect(await trekOpzeggingIn('user_1', NU)).toMatchObject({ ok: false, status: 502 })
    expect(sub().status).toBe('cancelled')
    expect(h.tabellen.approved_users[0].cancelled_at).not.toBeNull()
  })
  it('rij niet bij te werken: het zojuist aangemaakte abonnement wordt weer gestopt', async () => {
    zet(rij(opgezegd))
    h.failUpdates.n = 2
    expect(await trekOpzeggingIn('user_1', NU)).toMatchObject({ ok: false, status: 502 })
    expect(h.stopEnBevestig).toHaveBeenCalledExactlyOnceWith(expect.anything(), 'sub_herstel', 'ongeregistreerd')
    expect(sub().status).toBe('cancelled')
  })
  it('gelijktijdig al ingetrokken: het zojuist aangemaakte abonnement wordt weer gestopt', async () => {
    zet(rij(opgezegd))
    h.maakAbonnement.mockImplementationOnce(async () => { sub().status = 'active'; return { id: 'sub_herstel', status: 'pending' } })
    expect(await trekOpzeggingIn('user_1', NU)).toMatchObject({ ok: false, status: 409 })
    expect(h.stopEnBevestig).toHaveBeenCalledExactlyOnceWith(expect.anything(), 'sub_herstel', 'ongeregistreerd')
  })
})
