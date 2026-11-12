import { beforeEach, describe, expect, it, vi } from 'vitest'

// stopMollieAbonnement stopt het huidige en het geplande Mollie-abonnement, elk met een eigen
// guardkolom, en legt een stop pas vast als Mollie bevestigt dat het gestopt is. De afhankelijkheden
// (database, Mollie, meldingen) zijn hier nagemaakt: er gaat niets naar Mollie of Supabase.

const h = vi.hoisted(() => {
  class MollieError extends Error {
    status: number
    constructor(status: number, message: string) {
      super(message)
      this.status = status
    }
  }
  return {
    MollieError,
    stopAbonnement: vi.fn(),
    haalAbonnement: vi.fn(),
    notifyTelegram: vi.fn(async () => {}),
    updates: [] as Array<{ tabel: string; data: Record<string, unknown>; id: unknown }>,
  }
})

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))
vi.mock('@/lib/cron-notify', () => ({ notifyTelegram: h.notifyTelegram }))
vi.mock('@/lib/toegang', () => ({ trialEinde: vi.fn() }))
vi.mock('./mails', () => ({ verstuurBillingMail: vi.fn() }))
vi.mock('./facturatie', () => ({ creditnotaVoorBetaling: vi.fn(), factureerBetaling: vi.fn() }))
vi.mock('./db', () => ({
  billingDb: {
    from: (tabel: string) => ({
      update: (data: Record<string, unknown>) => ({
        eq: (_kolom: string, id: unknown) => {
          h.updates.push({ tabel, data, id })
          return Promise.resolve({ data: null, error: null })
        },
      }),
    }),
  },
}))
vi.mock('./mollie', () => ({
  MollieError: h.MollieError,
  stopAbonnement: h.stopAbonnement,
  haalAbonnement: h.haalAbonnement,
  haalBetaling: vi.fn(),
  maakAbonnement: vi.fn(),
}))

import { stopMollieAbonnement } from './verwerking'
import type { SubRow } from './db'

function rij(extra: Partial<SubRow> = {}): SubRow {
  return {
    id: 'rij-1',
    user_id: 'user_1',
    plan: 'basis',
    cyclus: 'maandelijks',
    klant_type: 'particulier',
    status: 'active',
    bedrag_cent: 2900,
    btw_cent: 503,
    mollie_customer_id: 'cst_1',
    mollie_subscription_id: null,
    mollie_sub_geannuleerd_at: null,
    periode_start: null,
    periode_einde: null,
    contract_einde: null,
    opzegging_aangevraagd_at: null,
    opzegging_ingaat_at: null,
    herinnering_30_at: null,
    herinnering_7_at: null,
    einde_mail_at: null,
    ...extra,
  }
}

beforeEach(() => {
  h.stopAbonnement.mockReset()
  h.haalAbonnement.mockReset()
  h.notifyTelegram.mockClear()
  h.updates.length = 0
  h.stopAbonnement.mockResolvedValue(undefined)
  h.haalAbonnement.mockResolvedValue({ id: 'x', status: 'canceled' })
})

describe('stopMollieAbonnement', () => {
  it('doet niets en geeft true als er niets te stoppen is', async () => {
    expect(await stopMollieAbonnement(rij())).toBe(true)
    expect(h.stopAbonnement).not.toHaveBeenCalled()
    expect(h.updates).toHaveLength(0)
  })

  it('stopt het huidige abonnement en legt het vast nadat Mollie het bevestigt', async () => {
    const ok = await stopMollieAbonnement(rij({ mollie_subscription_id: 'sub_huidig' }))
    expect(ok).toBe(true)
    expect(h.stopAbonnement).toHaveBeenCalledExactlyOnceWith('cst_1', 'sub_huidig')
    expect(h.haalAbonnement).toHaveBeenCalledWith('cst_1', 'sub_huidig')
    expect(h.updates).toHaveLength(1)
    expect(h.updates[0].data).toHaveProperty('mollie_sub_geannuleerd_at')
    expect(h.updates[0].data).not.toHaveProperty('gepland_mollie_sub_geannuleerd_at')
  })

  it('stopt het geplande abonnement ook als het huidige al als gestopt is vastgelegd', async () => {
    const ok = await stopMollieAbonnement(
      rij({
        mollie_subscription_id: 'sub_huidig',
        mollie_sub_geannuleerd_at: '2026-11-12T10:00:00.000Z',
        gepland_mollie_subscription_id: 'sub_gepland',
      }),
    )
    expect(ok).toBe(true)
    expect(h.stopAbonnement).toHaveBeenCalledExactlyOnceWith('cst_1', 'sub_gepland')
    expect(h.updates).toHaveLength(1)
    expect(h.updates[0].data).toHaveProperty('gepland_mollie_sub_geannuleerd_at')
    expect(h.updates[0].data).not.toHaveProperty('mollie_sub_geannuleerd_at')
  })

  it('stopt beide abonnementen met elk een eigen guardkolom', async () => {
    const ok = await stopMollieAbonnement(
      rij({ mollie_subscription_id: 'sub_huidig', gepland_mollie_subscription_id: 'sub_gepland' }),
    )
    expect(ok).toBe(true)
    expect(h.stopAbonnement).toHaveBeenCalledTimes(2)
    expect(h.updates.map(u => Object.keys(u.data).find(k => k.endsWith('geannuleerd_at')))).toEqual([
      'mollie_sub_geannuleerd_at',
      'gepland_mollie_sub_geannuleerd_at',
    ])
  })

  it('slaat een geplande stop over die al is vastgelegd', async () => {
    const ok = await stopMollieAbonnement(
      rij({
        gepland_mollie_subscription_id: 'sub_gepland',
        gepland_mollie_sub_geannuleerd_at: '2026-11-12T10:00:00.000Z',
      }),
    )
    expect(ok).toBe(true)
    expect(h.stopAbonnement).not.toHaveBeenCalled()
  })

  it('stopt hetzelfde abonnement niet twee keer als huidig en gepland gelijk zijn', async () => {
    await stopMollieAbonnement(rij({ mollie_subscription_id: 'sub_zelfde', gepland_mollie_subscription_id: 'sub_zelfde' }))
    expect(h.stopAbonnement).toHaveBeenCalledTimes(1)
  })

  it('legt niets vast en meldt het als Mollie na het stoppen nog "active" zegt', async () => {
    h.haalAbonnement.mockResolvedValue({ id: 'x', status: 'active' })
    const ok = await stopMollieAbonnement(rij({ mollie_subscription_id: 'sub_huidig' }))
    expect(ok).toBe(false)
    expect(h.updates).toHaveLength(0)
    expect(h.notifyTelegram).toHaveBeenCalledTimes(1)
  })

  it('meldt het en geeft false als het stoppen zelf mislukt, en probeert het geplande toch', async () => {
    h.stopAbonnement.mockRejectedValueOnce(new h.MollieError(500, 'storing'))
    const ok = await stopMollieAbonnement(
      rij({ mollie_subscription_id: 'sub_huidig', gepland_mollie_subscription_id: 'sub_gepland' }),
    )
    expect(ok).toBe(false)
    expect(h.stopAbonnement).toHaveBeenCalledTimes(2)
    expect(h.updates).toHaveLength(1)
    expect(h.updates[0].data).toHaveProperty('gepland_mollie_sub_geannuleerd_at')
    expect(h.notifyTelegram).toHaveBeenCalledTimes(1)
  })

  it('legt niets vast als de bevestiging bij Mollie zelf mislukt (storing), zodat het opnieuw kan', async () => {
    h.haalAbonnement.mockRejectedValue(new h.MollieError(503, 'storing'))
    const ok = await stopMollieAbonnement(rij({ mollie_subscription_id: 'sub_huidig' }))
    expect(ok).toBe(false)
    expect(h.updates).toHaveLength(0)
  })

  it('telt een abonnement dat Mollie niet meer kent (404) als gestopt', async () => {
    h.haalAbonnement.mockRejectedValue(new h.MollieError(404, 'niet gevonden'))
    const ok = await stopMollieAbonnement(rij({ mollie_subscription_id: 'sub_huidig' }))
    expect(ok).toBe(true)
    expect(h.updates).toHaveLength(1)
  })

  it('telt status "completed" als gestopt', async () => {
    h.haalAbonnement.mockResolvedValue({ id: 'x', status: 'completed' })
    expect(await stopMollieAbonnement(rij({ mollie_subscription_id: 'sub_huidig' }))).toBe(true)
  })
})
