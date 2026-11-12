/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from 'vitest'

// De webhook-kant van een upgrade van Basic naar Pro (docs/OVERSTAP_PLAN.md): de bijbetaling mag de periode
// nooit verlengen, bij mislukken of terugbetalen gaat alleen het plan terug naar Basic (het abonnement
// loopt door), en een upgradebetaling zonder eigen rij wordt nooit als gewone herhaling verwerkt. Database,
// Mollie en meldingen zijn nagemaakt: de echte verwerkingscode draait.

type Rij = Record<string, any>
const h = vi.hoisted(() => ({
  tabellen: {} as Record<string, Rij[]>,
  haalBetaling: vi.fn(),
  stopAbonnement: vi.fn(async () => {}),
  notifyTelegram: vi.fn(async () => {}),
  verstuurBillingMail: vi.fn(async () => {}),
  factureerBetaling: vi.fn(async () => {}),
  creditnotaVoorBetaling: vi.fn(async () => {}),
  teller: { n: 0 },
}))

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))
vi.mock('@/lib/cron-notify', () => ({ notifyTelegram: h.notifyTelegram }))
vi.mock('@/lib/toegang', () => ({ trialEinde: vi.fn(() => null) }))
vi.mock('./mails', () => ({ verstuurBillingMail: h.verstuurBillingMail }))
vi.mock('./facturatie', () => ({ creditnotaVoorBetaling: h.creditnotaVoorBetaling, factureerBetaling: h.factureerBetaling }))
vi.mock('./mollie', () => ({
  MollieError: class extends Error { status = 0 },
  haalBetaling: h.haalBetaling,
  haalAbonnement: vi.fn(),
  stopAbonnement: h.stopAbonnement,
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
import { berekenBedrag } from './prijzen'

const ISO = (s: string) => new Date(s).toISOString()

/** Maandklant die net naar Pro is geüpgraded: plan al Pro, het Pro-abonnement nog gepland per einde periode. */
function upgradeRij(extra: Rij = {}): Rij {
  return {
    id: 'rij-1', user_id: 'user_1', plan: 'premium', cyclus: 'maandelijks', klant_type: 'particulier', status: 'active',
    bedrag_cent: 2900, btw_cent: 503, mollie_customer_id: 'cst_1',
    mollie_subscription_id: 'sub_oud', mollie_sub_geannuleerd_at: ISO('2026-11-20'),
    periode_start: ISO('2026-11-04'), periode_einde: ISO('2026-12-04'), contract_einde: null,
    opzegging_aangevraagd_at: null, opzegging_ingaat_at: null, herinnering_30_at: null, herinnering_7_at: null, einde_mail_at: null,
    gepland_plan: 'premium', gepland_cyclus: 'maandelijks', gepland_bedrag_cent: 5900, gepland_btw_cent: 1024,
    gepland_mollie_subscription_id: 'sub_nieuw', gepland_mollie_sub_geannuleerd_at: null, gepland_ingangs_at: ISO('2026-12-04'), gepland_at: ISO('2026-11-20'),
    ...extra,
  }
}

function upgradeBetalingRij(extra: Rij = {}): Rij {
  return {
    id: 'pay-up', user_id: 'user_1', subscription_id: 'rij-1', mollie_payment_id: 'tr_up1', soort: 'upgrade', status: 'pending',
    bedrag_cent: 1500, btw_cent: 260, terugbetaald_cent: 0, teruggeboekt_cent: 0, betaald_at: null,
    verwerkt_at: null, terugbetaling_verwerkt_at: null, moneybird_factuur_id: null, ...extra,
  }
}

function mp(extra: Rij = {}) {
  return {
    id: 'tr_up1', status: 'paid', amount: { currency: 'EUR', value: '15.00' }, paidAt: '2026-11-21T08:00:00.000Z',
    subscriptionId: undefined, metadata: { subscriptionRowId: 'rij-1', soort: 'upgrade' }, ...extra,
  }
}

const sub = () => h.tabellen.arnobot_subscriptions[0]
const gebruiker = () => h.tabellen.approved_users[0]

function zet(rij: Rij, betalingen: Rij[] = [upgradeBetalingRij()]) {
  h.tabellen = { arnobot_subscriptions: [rij], arnobot_payments: betalingen, approved_users: [{ user_id: 'user_1', plan: 'premium', is_active: true }] }
}

beforeEach(() => {
  h.haalBetaling.mockReset()
  h.stopAbonnement.mockClear()
  h.notifyTelegram.mockClear()
  h.verstuurBillingMail.mockClear()
  h.factureerBetaling.mockClear()
  h.creditnotaVoorBetaling.mockClear()
  h.teller.n = 0
  zet(upgradeRij())
})

describe('upgradebetaling: geslaagd', () => {
  it('verlengt de periode niet, past niets aan de rij aan, bevestigt per mail en factureert', async () => {
    h.haalBetaling.mockResolvedValue(mp())
    await verwerkMolliebetaling('tr_up1')
    expect(sub()).toMatchObject({ plan: 'premium', periode_einde: ISO('2026-12-04'), periode_start: ISO('2026-11-04'), gepland_plan: 'premium', gepland_mollie_subscription_id: 'sub_nieuw' })
    expect(h.verstuurBillingMail).toHaveBeenCalledExactlyOnceWith('user_1', 'betaling_bevestiging', expect.objectContaining({
      planNaam: 'Pro', bedragCent: 1500, btwCent: 260, datum: ISO('2026-12-04'), eerste: false, betaalId: 'tr_up1',
    }))
    expect(h.factureerBetaling).toHaveBeenCalledExactlyOnceWith('pay-up')
    expect(h.tabellen.arnobot_payments[0]).toMatchObject({ status: 'paid', soort: 'upgrade' })
    expect(h.tabellen.arnobot_payments[0].verwerkt_at).not.toBeNull()
  })

  it('verwerkt dezelfde betaling twee keer zonder tweede mail of factuur', async () => {
    h.haalBetaling.mockResolvedValue(mp())
    await verwerkMolliebetaling('tr_up1')
    await verwerkMolliebetaling('tr_up1')
    expect(h.verstuurBillingMail).toHaveBeenCalledTimes(1)
    expect(h.factureerBetaling).toHaveBeenCalledTimes(1)
  })

  it('een betaling die nog pending is doet niets behalve de status bijwerken', async () => {
    h.haalBetaling.mockResolvedValue(mp({ status: 'pending' }))
    await verwerkMolliebetaling('tr_up1')
    expect(h.verstuurBillingMail).not.toHaveBeenCalled()
    expect(h.factureerBetaling).not.toHaveBeenCalled()
    expect(sub().plan).toBe('premium')
  })
})

describe('upgradebetaling: mislukt', () => {
  it('zet het plan terug naar Basic zolang de overstap naar Pro nog niet is ingegaan, en laat de geplande overstap staan', async () => {
    h.haalBetaling.mockResolvedValue(mp({ status: 'failed' }))
    await verwerkMolliebetaling('tr_up1')
    expect(sub()).toMatchObject({ plan: 'basis', gepland_plan: 'premium', gepland_mollie_subscription_id: 'sub_nieuw', status: 'active' })
    expect(gebruiker().plan).toBe('basis')
    expect(h.notifyTelegram).toHaveBeenCalledTimes(1)
    // Niet de gewone "betaling mislukt, je toegang loopt door" (klopt niet voor een upgrade), maar de eigen mail.
    expect(h.verstuurBillingMail).toHaveBeenCalledExactlyOnceWith('user_1', 'upgrade_bijbetaling_mislukt', { datum: ISO('2026-12-04') })
  })

  it.each(['canceled', 'expired'])('ook bij status %s', async status => {
    h.haalBetaling.mockResolvedValue(mp({ status }))
    await verwerkMolliebetaling('tr_up1')
    expect(sub().plan).toBe('basis')
  })

  it('zet het plan NIET terug als de overstap naar Pro al is ingegaan (de klant betaalt dan gewoon Pro)', async () => {
    zet(upgradeRij({
      bedrag_cent: 5900, btw_cent: 1024, mollie_subscription_id: 'sub_nieuw', mollie_sub_geannuleerd_at: null,
      gepland_plan: null, gepland_cyclus: null, gepland_bedrag_cent: null, gepland_btw_cent: null,
      gepland_mollie_subscription_id: null, gepland_ingangs_at: null, gepland_at: null,
    }))
    h.haalBetaling.mockResolvedValue(mp({ status: 'failed' }))
    await verwerkMolliebetaling('tr_up1')
    expect(sub()).toMatchObject({ plan: 'premium', bedrag_cent: 5900 })
    expect(gebruiker().plan).toBe('premium')
    expect(h.notifyTelegram).toHaveBeenCalledTimes(1)
    // Niets veranderd voor de klant: geen mail.
    expect(h.verstuurBillingMail).not.toHaveBeenCalled()
  })

  it('particulier jaar (geen Mollie-abonnement): plan én bedrag terug naar Basic', async () => {
    const pro = berekenBedrag('premium', 'jaarlijks', 'particulier')
    const basic = berekenBedrag('basis', 'jaarlijks', 'particulier')
    zet(upgradeRij({
      cyclus: 'jaarlijks', bedrag_cent: pro.brutoCent, btw_cent: pro.btwCent, mollie_subscription_id: null, mollie_sub_geannuleerd_at: null,
      gepland_plan: null, gepland_cyclus: null, gepland_bedrag_cent: null, gepland_btw_cent: null,
      gepland_mollie_subscription_id: null, gepland_ingangs_at: null, gepland_at: null,
    }))
    h.haalBetaling.mockResolvedValue(mp({ status: 'failed' }))
    await verwerkMolliebetaling('tr_up1')
    expect(sub()).toMatchObject({ plan: 'basis', bedrag_cent: basic.brutoCent, btw_cent: basic.btwCent })
    expect(gebruiker().plan).toBe('basis')
    // Geen geplande overstap om naar te verwijzen: de mail noemt geen datum.
    expect(h.verstuurBillingMail).toHaveBeenCalledExactlyOnceWith('user_1', 'upgrade_bijbetaling_mislukt', { datum: undefined })
  })
})

describe('upgradebetaling: terugbetaald', () => {
  // De betaling is al verwerkt; alleen de terugbetaling komt nu binnen.
  beforeEach(() => zet(upgradeRij(), [upgradeBetalingRij({ status: 'paid', verwerkt_at: ISO('2026-11-21'), betaald_at: ISO('2026-11-21') })]))

  it('beëindigt het abonnement NIET, zet alleen het plan terug, en maakt een creditnota', async () => {
    h.haalBetaling.mockResolvedValue(mp({ amountRefunded: { currency: 'EUR', value: '15.00' } }))
    await verwerkMolliebetaling('tr_up1')
    expect(sub()).toMatchObject({ status: 'active', plan: 'basis', gepland_plan: 'premium' })
    expect(gebruiker()).toMatchObject({ plan: 'basis', is_active: true })
    expect(gebruiker().expires_at).toBeUndefined() // de toegang wordt niet afgesneden
    expect(h.stopAbonnement).not.toHaveBeenCalled()
    expect(h.verstuurBillingMail).toHaveBeenCalledExactlyOnceWith('user_1', 'terugbetaling_bevestiging', expect.objectContaining({ upgrade: true }))
    expect(h.creditnotaVoorBetaling).toHaveBeenCalledExactlyOnceWith('pay-up')
  })

  it('een chargeback op de upgradebetaling beëindigt het abonnement ook niet', async () => {
    h.haalBetaling.mockResolvedValue(mp({ amountChargedBack: { currency: 'EUR', value: '15.00' } }))
    await verwerkMolliebetaling('tr_up1')
    expect(sub().status).toBe('active')
    expect(h.stopAbonnement).not.toHaveBeenCalled()
    expect(gebruiker().expires_at).toBeUndefined()
  })
})

describe('upgradebetaling zonder eigen rij', () => {
  it('wordt nooit als gewone herhaling verwerkt: niets verlengd, geen rij, Arno krijgt een melding', async () => {
    zet(upgradeRij(), [])
    h.haalBetaling.mockResolvedValue(mp())
    await verwerkMolliebetaling('tr_up1')
    expect(sub().periode_einde).toBe(ISO('2026-12-04'))
    expect(h.tabellen.arnobot_payments).toHaveLength(0)
    expect(h.notifyTelegram).toHaveBeenCalledTimes(1)
    expect(h.verstuurBillingMail).not.toHaveBeenCalled()
  })
})
