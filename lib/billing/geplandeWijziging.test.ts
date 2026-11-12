/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from 'vitest'

// De webhook-verwerking van een GEPLANDE abonnementswijziging (docs/OVERSTAP_PLAN.md): de rij blijft
// tot de eerste betaling van het nieuwe Mollie-abonnement op het oude plan en de oude cyclus staan,
// en wordt dan atomair omgezet voordat de periode wordt verlengd en gefactureerd. Database, Mollie en
// meldingen zijn hier nagemaakt: de echte verwerkingscode draait, er gaat niets naar buiten.

type Rij = Record<string, any>
const h = vi.hoisted(() => ({
  tabellen: {} as Record<string, Rij[]>,
  haalBetaling: vi.fn(),
  notifyTelegram: vi.fn(async () => {}),
  verstuurBillingMail: vi.fn(async () => {}),
  factureerBetaling: vi.fn(async () => {}),
  teller: { n: 0 },
}))

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))
vi.mock('@/lib/cron-notify', () => ({ notifyTelegram: h.notifyTelegram }))
vi.mock('@/lib/toegang', () => ({ trialEinde: vi.fn(() => null) }))
vi.mock('./mails', () => ({ verstuurBillingMail: h.verstuurBillingMail }))
vi.mock('./facturatie', () => ({ creditnotaVoorBetaling: vi.fn(), factureerBetaling: h.factureerBetaling }))
vi.mock('./mollie', () => ({
  MollieError: class extends Error { status = 0 },
  haalBetaling: h.haalBetaling,
  haalAbonnement: vi.fn(),
  stopAbonnement: vi.fn(async () => {}),
  maakAbonnement: vi.fn(),
}))
vi.mock('./db', () => ({
  billingDb: {
    from(tabel: string) {
      const rijen = (h.tabellen[tabel] ??= [])
      const filters: Array<(r: Rij) => boolean> = []
      let modus: 'select' | 'update' | 'upsert' = 'select'
      let patch: Rij = {}
      let nieuweRij: Rij = {}
      let opties: { onConflict?: string; ignoreDuplicates?: boolean } = {}
      let teruggeven = false
      const uitvoeren = () => {
        const treffers = rijen.filter(r => filters.every(f => f(r)))
        if (modus === 'update') {
          for (const r of treffers) Object.assign(r, patch)
          return { data: teruggeven ? treffers.map(r => ({ ...r })) : null, error: null }
        }
        if (modus === 'upsert') {
          const sleutel = opties.onConflict
          const bestaand = sleutel ? rijen.find(r => r[sleutel] === nieuweRij[sleutel]) : undefined
          if (!bestaand) {
            rijen.push({
              id: `${tabel}-${++h.teller.n}`, verwerkt_at: null, terugbetaling_verwerkt_at: null,
              terugbetaald_cent: 0, teruggeboekt_cent: 0, betaald_at: null, moneybird_factuur_id: null, ...nieuweRij,
            })
          } else if (!opties.ignoreDuplicates) Object.assign(bestaand, nieuweRij)
          return { data: null, error: null }
        }
        return { data: treffers.map(r => ({ ...r })), error: null }
      }
      const q: any = {
        select: () => { teruggeven = true; return q },
        eq: (k: string, v: unknown) => { filters.push(r => r[k] === v); return q },
        is: (k: string, v: unknown) => { filters.push(r => (r[k] ?? null) === v); return q },
        returns: () => q,
        update: (p: Rij) => { modus = 'update'; patch = p; return q },
        upsert: (r: Rij, o: typeof opties) => { modus = 'upsert'; nieuweRij = r; opties = o ?? {}; return q },
        maybeSingle: async () => ({ data: (uitvoeren().data as Rij[] | null)?.[0] ?? null, error: null }),
        then: (res: any, rej: any) => Promise.resolve(uitvoeren()).then(res, rej),
      }
      return q
    },
  },
}))

import { verwerkMolliebetaling } from './verwerking'

const ISO = (s: string) => new Date(s).toISOString()

function basisRij(extra: Rij = {}): Rij {
  return {
    id: 'rij-1', user_id: 'user_1', plan: 'basis', cyclus: 'maandelijks', klant_type: 'particulier', status: 'active',
    bedrag_cent: 2900, btw_cent: 503, mollie_customer_id: 'cst_1',
    mollie_subscription_id: 'sub_oud', mollie_sub_geannuleerd_at: ISO('2026-12-01'),
    periode_start: ISO('2026-11-04'), periode_einde: ISO('2026-12-04'), contract_einde: null,
    opzegging_aangevraagd_at: null, opzegging_ingaat_at: null,
    herinnering_30_at: null, herinnering_7_at: null, einde_mail_at: null,
    gepland_plan: null, gepland_cyclus: null, gepland_bedrag_cent: null, gepland_btw_cent: null,
    gepland_mollie_subscription_id: null, gepland_mollie_sub_geannuleerd_at: null, gepland_ingangs_at: null, gepland_at: null,
    ...extra,
  }
}

/** Maand naar jaar, particulier Basic: €29 per maand wordt €228 per jaar (btw 21% inbegrepen). */
const naarJaar = { gepland_cyclus: 'jaarlijks', gepland_plan: 'basis', gepland_bedrag_cent: 22800, gepland_btw_cent: 3957,
  gepland_mollie_subscription_id: 'sub_nieuw', gepland_ingangs_at: ISO('2026-12-04'), gepland_at: ISO('2026-11-20') }

function betaling(extra: Rij = {}) {
  return {
    id: 'tr_nieuw1', status: 'paid', amount: { currency: 'EUR', value: '228.00' }, paidAt: '2026-12-04T08:00:00.000Z',
    subscriptionId: 'sub_nieuw', metadata: { subscriptionRowId: 'rij-1' }, ...extra,
  }
}

const sub = () => h.tabellen.arnobot_subscriptions[0]
const betalingen = () => h.tabellen.arnobot_payments
const gebruiker = () => h.tabellen.approved_users[0]

function zet(rij: Rij) {
  h.tabellen.arnobot_subscriptions = [rij]
  h.tabellen.arnobot_payments = []
  h.tabellen.approved_users = [{ user_id: 'user_1', plan: 'basis', is_active: true, expires_at: ISO('2026-12-07') }]
}

beforeEach(() => {
  h.haalBetaling.mockReset()
  h.notifyTelegram.mockClear()
  h.verstuurBillingMail.mockClear()
  h.factureerBetaling.mockClear()
  h.teller.n = 0
})

describe('geplande wijziging: maand naar jaar (particulier)', () => {
  beforeEach(() => zet(basisRij(naarJaar)))

  it('zet de rij om bij de eerste betaling van het geplande abonnement, en verlengt dan 12 maanden', async () => {
    h.haalBetaling.mockResolvedValue(betaling())
    await verwerkMolliebetaling('tr_nieuw1')

    expect(sub()).toMatchObject({
      cyclus: 'jaarlijks', plan: 'basis', bedrag_cent: 22800, btw_cent: 3957,
      mollie_subscription_id: 'sub_nieuw', mollie_sub_geannuleerd_at: null,
      periode_start: ISO('2026-12-04'), periode_einde: ISO('2027-12-04'),
      contract_einde: ISO('2027-12-04'),
      gepland_cyclus: null, gepland_plan: null, gepland_bedrag_cent: null, gepland_btw_cent: null,
      gepland_mollie_subscription_id: null, gepland_ingangs_at: null, gepland_at: null,
    })
    // Toegang volgt de nieuwe periode (einde plus 3 dagen respijt).
    expect(gebruiker()).toMatchObject({ is_active: true, plan: 'basis', expires_at: ISO('2027-12-07') })
    expect(betalingen()).toHaveLength(1)
    expect(betalingen()[0]).toMatchObject({ soort: 'herhaling', bedrag_cent: 22800, btw_cent: 3957, status: 'paid' })
    expect(h.verstuurBillingMail).toHaveBeenCalledWith('user_1', 'betaling_bevestiging', expect.objectContaining({ datum: ISO('2027-12-04') }))
    expect(h.factureerBetaling).toHaveBeenCalledTimes(1)
  })

  it('verwerkt dezelfde betaling twee keer zonder dubbele verlenging', async () => {
    h.haalBetaling.mockResolvedValue(betaling())
    await verwerkMolliebetaling('tr_nieuw1')
    await verwerkMolliebetaling('tr_nieuw1')
    expect(sub().periode_einde).toBe(ISO('2027-12-04'))
    expect(betalingen()).toHaveLength(1)
    expect(h.verstuurBillingMail).toHaveBeenCalledTimes(1)
    expect(h.factureerBetaling).toHaveBeenCalledTimes(1)
  })

  it('zet niet om bij een nog niet betaalde betaling, maar bewaart wel de geplande btw op de betaalrij', async () => {
    h.haalBetaling.mockResolvedValue(betaling({ status: 'pending' }))
    await verwerkMolliebetaling('tr_nieuw1')
    expect(sub()).toMatchObject({ cyclus: 'maandelijks', bedrag_cent: 2900, mollie_subscription_id: 'sub_oud', gepland_cyclus: 'jaarlijks' })
    expect(betalingen()[0]).toMatchObject({ btw_cent: 3957, status: 'pending' })
    expect(h.verstuurBillingMail).not.toHaveBeenCalled()
  })

  it('zet de omzetting ook door als de betaling eerst pending en daarna paid is', async () => {
    h.haalBetaling.mockResolvedValueOnce(betaling({ status: 'pending' }))
    await verwerkMolliebetaling('tr_nieuw1')
    h.haalBetaling.mockResolvedValueOnce(betaling({ status: 'paid' }))
    await verwerkMolliebetaling('tr_nieuw1')
    expect(sub()).toMatchObject({ cyclus: 'jaarlijks', periode_einde: ISO('2027-12-04'), gepland_cyclus: null })
    expect(betalingen()[0]).toMatchObject({ btw_cent: 3957 })
    expect(h.factureerBetaling).toHaveBeenCalledTimes(1)
  })

  it('verwerkt niets en meldt het als het bedrag niet het geplande bedrag is', async () => {
    h.haalBetaling.mockResolvedValue(betaling({ amount: { currency: 'EUR', value: '100.00' } }))
    await verwerkMolliebetaling('tr_nieuw1')
    expect(sub()).toMatchObject({ cyclus: 'maandelijks', bedrag_cent: 2900, gepland_cyclus: 'jaarlijks' })
    expect(betalingen()).toHaveLength(0)
    expect(h.notifyTelegram).toHaveBeenCalledTimes(1)
    expect(h.verstuurBillingMail).not.toHaveBeenCalled()
  })

  it('zet niet om als de eerste betaling van het nieuwe abonnement mislukt', async () => {
    h.haalBetaling.mockResolvedValue(betaling({ status: 'failed' }))
    await verwerkMolliebetaling('tr_nieuw1')
    expect(sub()).toMatchObject({ cyclus: 'maandelijks', bedrag_cent: 2900, periode_einde: ISO('2026-12-04') })
    expect(h.verstuurBillingMail).toHaveBeenCalledWith('user_1', 'betaling_mislukt', expect.anything())
  })

  it('verlengt een laat binnengekomen betaling van het OUDE abonnement na de omzetting niet met 12 maanden', async () => {
    h.haalBetaling.mockResolvedValueOnce(betaling())
    await verwerkMolliebetaling('tr_nieuw1')
    const naOmzetting = sub().periode_einde
    h.haalBetaling.mockResolvedValueOnce(betaling({ id: 'tr_oud1', subscriptionId: 'sub_oud', amount: { currency: 'EUR', value: '29.00' } }))
    await verwerkMolliebetaling('tr_oud1')
    expect(sub().periode_einde).toBe(naOmzetting)
    expect(h.notifyTelegram).toHaveBeenCalledTimes(1)
    expect(h.verstuurBillingMail).toHaveBeenCalledTimes(1) // alleen die van de eerste betaling
  })
})

describe('geplande wijziging: andere gevallen', () => {
  it('zakelijk maand naar jaar krijgt geen contracteinde', async () => {
    zet(basisRij({ ...naarJaar, klant_type: 'zakelijk', gepland_bedrag_cent: 22800, gepland_btw_cent: 3957 }))
    h.haalBetaling.mockResolvedValue(betaling())
    await verwerkMolliebetaling('tr_nieuw1')
    expect(sub()).toMatchObject({ cyclus: 'jaarlijks', periode_einde: ISO('2027-12-04'), contract_einde: null })
  })

  it('Basic naar Pro (zelfde cyclus): plan en bedrag veranderen, periode blijft één maand', async () => {
    zet(basisRij({
      gepland_plan: 'premium', gepland_cyclus: 'maandelijks', gepland_bedrag_cent: 5900, gepland_btw_cent: 1024,
      gepland_mollie_subscription_id: 'sub_nieuw', gepland_at: ISO('2026-11-20'),
    }))
    h.haalBetaling.mockResolvedValue(betaling({ amount: { currency: 'EUR', value: '59.00' } }))
    await verwerkMolliebetaling('tr_nieuw1')
    expect(sub()).toMatchObject({ plan: 'premium', cyclus: 'maandelijks', bedrag_cent: 5900, btw_cent: 1024, periode_einde: ISO('2027-01-04'), contract_einde: null })
    expect(gebruiker()).toMatchObject({ plan: 'premium', expires_at: ISO('2027-01-07') })
    expect(betalingen()[0]).toMatchObject({ btw_cent: 1024 })
  })

  it('een gewone herhaalbetaling zonder geplande wijziging verandert niets aan het bestaande gedrag', async () => {
    zet(basisRij())
    h.haalBetaling.mockResolvedValue(betaling({ id: 'tr_gewoon', subscriptionId: 'sub_oud', amount: { currency: 'EUR', value: '29.00' } }))
    await verwerkMolliebetaling('tr_gewoon')
    expect(sub()).toMatchObject({ cyclus: 'maandelijks', bedrag_cent: 2900, periode_einde: ISO('2027-01-04'), mollie_subscription_id: 'sub_oud' })
    expect(betalingen()[0]).toMatchObject({ btw_cent: 503, bedrag_cent: 2900 })
    expect(h.notifyTelegram).not.toHaveBeenCalled()
  })

  it('een late betaling van een door verlenging vervangen abonnement met hetzelfde bedrag wordt nog gewoon verwerkt', async () => {
    zet(basisRij({ mollie_subscription_id: 'sub_verleng' }))
    h.haalBetaling.mockResolvedValue(betaling({ id: 'tr_laat', subscriptionId: 'sub_oud', amount: { currency: 'EUR', value: '29.00' } }))
    await verwerkMolliebetaling('tr_laat')
    expect(sub().periode_einde).toBe(ISO('2027-01-04'))
    expect(h.notifyTelegram).not.toHaveBeenCalled()
  })

  it('zet niet om en verlengt niet als de klant inmiddels heeft opgezegd, en meldt het', async () => {
    zet(basisRij({ ...naarJaar, status: 'cancelled', opzegging_ingaat_at: ISO('2026-12-04') }))
    h.haalBetaling.mockResolvedValue(betaling())
    await verwerkMolliebetaling('tr_nieuw1')
    expect(sub()).toMatchObject({ status: 'cancelled', cyclus: 'maandelijks', periode_einde: ISO('2026-12-04'), gepland_cyclus: 'jaarlijks' })
    expect(h.notifyTelegram).toHaveBeenCalledTimes(1)
    expect(h.verstuurBillingMail).not.toHaveBeenCalled()
    expect(h.factureerBetaling).not.toHaveBeenCalled()
  })

  it('negeert een betaling van een geplande wijziging op een al beëindigd abonnement', async () => {
    zet(basisRij({ ...naarJaar, status: 'ended' }))
    h.haalBetaling.mockResolvedValue(betaling())
    await verwerkMolliebetaling('tr_nieuw1')
    expect(sub()).toMatchObject({ cyclus: 'maandelijks', periode_einde: ISO('2026-12-04') })
    expect(h.verstuurBillingMail).not.toHaveBeenCalled()
  })
})
