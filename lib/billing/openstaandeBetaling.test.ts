/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from 'vitest'

// De dagelijkse cron sluit een verlopen abonnement af, tenzij er nog een betaling onderweg is
// (SEPA kan dagen op "pending" staan). Database en Mollie zijn hier nagemaakt.

const h = vi.hoisted(() => ({
  dbBetalingen: [] as Array<{ subscription_id: string; status: string }>,
  lijst: vi.fn(),
}))

vi.mock('./db', () => ({
  billingDb: {
    from() {
      const filters: Array<(r: any) => boolean> = []
      const q: any = {
        select: () => q,
        eq: (k: string, v: unknown) => { filters.push(r => r[k] === v); return q },
        in: (k: string, v: unknown[]) => { filters.push(r => v.includes(r[k])); return q },
        limit: () => q,
        then: (res: any, rej: any) =>
          Promise.resolve({ data: h.dbBetalingen.filter(r => filters.every(f => f(r))), error: null }).then(res, rej),
      }
      return q
    },
  },
}))
vi.mock('./mollie', () => ({ lijstAbonnementBetalingen: h.lijst }))

import { heeftOpenstaandeBetaling, moetAfsluitingUitstellen, WACHT_OP_BETALING_DAGEN } from './openstaandeBetaling'
import type { SubRow } from './db'

const ISO = (s: string) => new Date(s).toISOString()

function rij(extra: Partial<SubRow> = {}): SubRow {
  return {
    id: 'rij-1', user_id: 'user_1', plan: 'basis', cyclus: 'maandelijks', klant_type: 'particulier', status: 'active',
    bedrag_cent: 2900, btw_cent: 503, mollie_customer_id: 'cst_1',
    mollie_subscription_id: 'sub_huidig', mollie_sub_geannuleerd_at: null,
    periode_start: ISO('2026-11-04'), periode_einde: ISO('2026-12-04'), contract_einde: null,
    opzegging_aangevraagd_at: null, opzegging_ingaat_at: null,
    herinnering_30_at: null, herinnering_7_at: null, einde_mail_at: null,
    ...extra,
  }
}

const NA_RESPIJT = new Date('2026-12-08T10:00:00.000Z') // 4 dagen na het einde: de cron wil afsluiten

beforeEach(() => {
  h.dbBetalingen = []
  h.lijst.mockReset()
  h.lijst.mockResolvedValue([])
})

describe('heeftOpenstaandeBetaling', () => {
  it('false als er nergens een betaling onderweg is', async () => {
    h.dbBetalingen = [{ subscription_id: 'rij-1', status: 'paid' }, { subscription_id: 'rij-1', status: 'failed' }]
    expect(await heeftOpenstaandeBetaling(rij())).toBe(false)
  })

  it.each(['open', 'pending', 'authorized'])('true bij een betaling met status %s in onze database', async status => {
    h.dbBetalingen = [{ subscription_id: 'rij-1', status }]
    expect(await heeftOpenstaandeBetaling(rij())).toBe(true)
    expect(h.lijst).not.toHaveBeenCalled()
  })

  it('negeert een openstaande betaling van een ander abonnement', async () => {
    h.dbBetalingen = [{ subscription_id: 'ander', status: 'pending' }]
    expect(await heeftOpenstaandeBetaling(rij())).toBe(false)
  })

  it('true als Mollie een pending betaling heeft die onze database nog niet kent', async () => {
    h.lijst.mockResolvedValue([{ id: 'tr_1', status: 'pending' }])
    expect(await heeftOpenstaandeBetaling(rij())).toBe(true)
    expect(h.lijst).toHaveBeenCalledWith('cst_1', 'sub_huidig')
  })

  it('kijkt ook bij het geplande abonnement', async () => {
    h.lijst.mockImplementation(async (_klant: string, id: string) => (id === 'sub_gepland' ? [{ id: 'tr_2', status: 'open' }] : []))
    expect(await heeftOpenstaandeBetaling(rij({ gepland_mollie_subscription_id: 'sub_gepland' }))).toBe(true)
    expect(h.lijst).toHaveBeenCalledTimes(2)
  })

  it('vraagt Mollie niets voor een abonnement zonder Mollie-id (particulier jaar)', async () => {
    expect(await heeftOpenstaandeBetaling(rij({ mollie_subscription_id: null }))).toBe(false)
    expect(h.lijst).not.toHaveBeenCalled()
  })
})

describe('moetAfsluitingUitstellen', () => {
  it('niet uitstellen zonder openstaande betaling', async () => {
    expect(await moetAfsluitingUitstellen(rij(), NA_RESPIJT)).toBe(false)
  })

  it('uitstellen zolang er een betaling onderweg is', async () => {
    h.dbBetalingen = [{ subscription_id: 'rij-1', status: 'pending' }]
    expect(await moetAfsluitingUitstellen(rij(), NA_RESPIJT)).toBe(true)
  })

  it(`na ${WACHT_OP_BETALING_DAGEN} dagen toch afsluiten, ook met een hangende betaling (en Mollie wordt niet meer gevraagd)`, async () => {
    h.dbBetalingen = [{ subscription_id: 'rij-1', status: 'pending' }]
    const laat = new Date('2026-12-04T00:00:00.000Z')
    laat.setUTCDate(laat.getUTCDate() + WACHT_OP_BETALING_DAGEN + 1)
    expect(await moetAfsluitingUitstellen(rij(), laat)).toBe(false)
    expect(h.lijst).not.toHaveBeenCalled()
  })

  it('uitstellen als Mollie niet te bevragen is, liever een dag wachten dan onterecht afsluiten', async () => {
    h.lijst.mockRejectedValue(new Error('storing'))
    expect(await moetAfsluitingUitstellen(rij(), NA_RESPIJT)).toBe(true)
  })

  it('niet uitstellen voor een rij zonder einddatum', async () => {
    expect(await moetAfsluitingUitstellen(rij({ periode_einde: null }), NA_RESPIJT)).toBe(false)
  })
})
