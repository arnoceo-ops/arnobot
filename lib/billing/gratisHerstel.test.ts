/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ tabellen: {} as Record<string, any[]>, fouten: {} as Record<string, string>, uitgezet: [] as string[] }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/lib/referralKenmerken', () => ({ zetGratisKenmerk: vi.fn(async (_db: unknown, id: string) => { h.uitgezet.push(id); return true }) }))
vi.mock('./db', () => ({
  billingDb: {
    from(tabel: string) {
      const filters: Array<(r: any) => boolean> = []
      const uit = () => (h.fouten[tabel]
        ? { data: null, error: { message: h.fouten[tabel] } }
        : { data: (h.tabellen[tabel] ?? []).filter(r => filters.every(f => f(r))), error: null })
      const q: any = {
        select: () => q, order: () => q, limit: () => q, range: () => q,
        eq: (k: string, v: unknown) => { filters.push(r => r[k] === v); return q },
        in: (k: string, v: unknown[]) => { filters.push(r => v.includes(r[k])); return q },
        not: (k: string) => { filters.push(r => r[k] != null); return q },
        then: (res: any, rej: any) => Promise.resolve(uit()).then(res, rej),
      }
      return q
    },
  },
}))

import { herstelGratisKenmerken } from './gratisHerstel'

const SINDS = '2027-01-10T00:00:00.000Z'
const betaling = (betaald_at: string, extra: any = {}) => ({ user_id: 'u', status: 'paid', betaald_at, terugbetaling_verwerkt_at: null, teruggeboekt_cent: 0, ...extra })

beforeEach(() => {
  h.fouten = {}
  h.uitgezet = []
  h.tabellen = { approved_users: [{ user_id: 'u', gratis_sinds: SINDS }, { user_id: 'gewoon', gratis_sinds: null }] }
})

describe('vangnet gratis kenmerk', () => {
  it('niets gebeurd na het aanzetten: blijft gratis, ook met oudere betalingen', async () => {
    h.tabellen.arnobot_payments = [betaling('2027-01-01T00:00:00.000Z')]
    expect((await herstelGratisKenmerken()).uitgezet).toEqual([])
  })
  it.each([
    ['betaling', { arnobot_payments: [betaling('2027-02-01T00:00:00.000Z')] }],
    ['herstart', { approved_users: [{ user_id: 'u', gratis_sinds: SINDS, trial_reactivated_at: '2027-02-01T00:00:00.000Z' }] }],
    ['knop BETAALD', { arnobot_admin_log: [{ doel_user_id: 'u', actie: 'betaald_gezet', created_at: '2027-02-01T00:00:00.000Z' }] }],
    ['teamfactuur', { arnobot_teams: [{ id: 't1', manager_id: 'u' }], arnobot_team_facturen: [{ team_id: 't1', status: 'paid', betaald_at: '2027-02-01T00:00:00.000Z' }] }],
  ])('%s na het aanzetten: uit', async (_naam, extra) => {
    Object.assign(h.tabellen, extra)
    expect((await herstelGratisKenmerken()).uitgezet).toEqual(['u'])
  })
  it('een teruggedraaide betaling telt niet', async () => {
    h.tabellen.arnobot_payments = [betaling('2027-02-01T00:00:00.000Z', { teruggeboekt_cent: 100 })]
    expect(h.uitgezet).toEqual((await herstelGratisKenmerken()).uitgezet)
    expect(h.uitgezet).toEqual([])
  })
  it('databasefout: niets uitzetten en melden', async () => {
    h.fouten = { arnobot_payments: 'time-out' }
    const r = await herstelGratisKenmerken()
    expect(r.uitgezet).toEqual([])
    expect(r.fouten).toHaveLength(1)
  })
  it('zonder de kolom is er niets te doen', async () => {
    h.fouten = { approved_users: 'column approved_users.gratis_sinds does not exist' }
    expect(await herstelGratisKenmerken()).toEqual({ uitgezet: [], fouten: [] })
  })
})
