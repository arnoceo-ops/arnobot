/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Opzeggen (voorwaarden artikel 7), inclusief het geval dat er een overstap gepland staat
// (docs/OVERSTAP_PLAN.md, besluit 1): dan eindigt de opzegging aan het einde van de betaalde
// periode, ook zakelijk, en wordt het geplande Mollie-abonnement gestopt. Database en de stopfunctie
// zijn nagemaakt.

type Rij = Record<string, any>
const h = vi.hoisted(() => ({
  rijen: [] as Rij[],
  stop: vi.fn(),
}))

vi.mock('./verwerking', () => ({ stopMollieAbonnement: h.stop }))
vi.mock('./db', () => ({
  billingDb: {
    from() {
      const filters: Array<(r: Rij) => boolean> = []
      let patch: Rij | null = null
      const uitvoeren = () => {
        const treffers = h.rijen.filter(r => filters.every(f => f(r)))
        if (patch) for (const r of treffers) Object.assign(r, patch)
        return { data: patch ? null : treffers.map(r => ({ ...r })), error: null }
      }
      const q: any = {
        select: () => q,
        eq: (k: string, v: unknown) => { filters.push(r => r[k] === v); return q },
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

import { meldOpzegging } from './opzeggen'

const ISO = (s: string) => new Date(s).toISOString()

function rij(extra: Rij = {}): Rij {
  return {
    id: 'rij-1', user_id: 'user_1', plan: 'premium', cyclus: 'maandelijks', klant_type: 'particulier', status: 'active',
    bedrag_cent: 5900, btw_cent: 1024, mollie_customer_id: 'cst_1',
    mollie_subscription_id: 'sub_huidig', mollie_sub_geannuleerd_at: null,
    periode_start: ISO('2026-11-04'), periode_einde: ISO('2026-12-04'), contract_einde: null,
    opzegging_aangevraagd_at: null, opzegging_ingaat_at: null,
    gepland_plan: null, gepland_cyclus: null, gepland_bedrag_cent: null, gepland_btw_cent: null,
    gepland_mollie_subscription_id: null, gepland_mollie_sub_geannuleerd_at: null, gepland_ingangs_at: null, gepland_at: null,
    ...extra,
  }
}

const gepland = {
  gepland_cyclus: 'jaarlijks', gepland_plan: 'premium', gepland_bedrag_cent: 46800, gepland_btw_cent: 8122,
  gepland_mollie_subscription_id: 'sub_gepland', gepland_ingangs_at: ISO('2026-12-04'), gepland_at: ISO('2026-11-10'),
  mollie_sub_geannuleerd_at: ISO('2026-11-10'),
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-11-20T10:00:00.000Z'))
  h.stop.mockReset()
  h.stop.mockResolvedValue(true)
})
afterEach(() => vi.useRealTimers())

describe('meldOpzegging zonder geplande wijziging (bestaand gedrag)', () => {
  it('geeft null als er geen lopend abonnement is', async () => {
    h.rijen = []
    expect(await meldOpzegging('user_1')).toBeNull()
  })

  it('particulier: eindigt aan het einde van de betaalperiode en stopt Mollie direct', async () => {
    h.rijen = [rij()]
    const r = await meldOpzegging('user_1')
    expect(r?.ingaatOp.toISOString()).toBe(ISO('2026-12-04'))
    expect(h.stop).toHaveBeenCalledTimes(1)
    expect(h.rijen[0]).toMatchObject({ status: 'cancelled', opzegging_ingaat_at: ISO('2026-12-04') })
  })

  it('zakelijk maand, te laat opgezegd: nog één periode extra (artikel 7)', async () => {
    h.rijen = [rij({ klant_type: 'zakelijk' })]
    const r = await meldOpzegging('user_1')
    expect(r?.ingaatOp.toISOString()).toBe(ISO('2027-01-04'))
    expect(h.stop).not.toHaveBeenCalled() // het abonnement moet nog één betaling doen
  })
})

describe('meldOpzegging met een geplande overstap', () => {
  it('zakelijk: eindigt aan het einde van de betaalde periode, zonder de extra maand', async () => {
    h.rijen = [rij({ klant_type: 'zakelijk', ...gepland })]
    const r = await meldOpzegging('user_1')
    expect(r?.ingaatOp.toISOString()).toBe(ISO('2026-12-04'))
    expect(h.rijen[0]).toMatchObject({ status: 'cancelled', opzegging_ingaat_at: ISO('2026-12-04') })
  })

  it('stopt het geplande abonnement en wist de gepland-kolommen na een bevestigde stop', async () => {
    h.rijen = [rij(gepland)]
    const r = await meldOpzegging('user_1')
    expect(h.stop).toHaveBeenCalledTimes(1)
    expect(r?.mollieDirectGestopt).toBe(true)
    expect(h.rijen[0]).toMatchObject({
      gepland_plan: null, gepland_cyclus: null, gepland_bedrag_cent: null, gepland_btw_cent: null,
      gepland_mollie_subscription_id: null, gepland_ingangs_at: null, gepland_at: null,
    })
  })

  it('legt de opzegging wel vast maar laat de gepland-kolommen staan als het stoppen mislukt, zodat de cron het opnieuw probeert', async () => {
    h.stop.mockResolvedValue(false)
    h.rijen = [rij(gepland)]
    const r = await meldOpzegging('user_1')
    expect(r?.mollieDirectGestopt).toBe(false)
    expect(h.rijen[0]).toMatchObject({ status: 'cancelled', gepland_mollie_subscription_id: 'sub_gepland', gepland_cyclus: 'jaarlijks' })
  })

  it('herkent een geplande wijziging ook aan alleen het claim-tijdstip (id nog niet gevuld)', async () => {
    h.rijen = [rij({ klant_type: 'zakelijk', gepland_at: ISO('2026-11-10') })]
    const r = await meldOpzegging('user_1')
    expect(r?.ingaatOp.toISOString()).toBe(ISO('2026-12-04'))
  })
})
