/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterEach, describe, expect, it, vi } from 'vitest'

// De echte stand van het grootboek en de gesplitste schakelaar. De keten zelf staat in
// referralKetenEcht.mollie.live.test.ts (echte databasefuncties).

const h = vi.hoisted(() => ({ meeloopRegels: [] as any[], rpc: [] as string[], ingevoegd: 0 }))

vi.mock('./referralStand', () => ({ MEELOOP: false }))
vi.mock('./teamFacturatie', () => ({ huidigSeats: vi.fn(async (_id: string, min: number) => min) }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('./db', () => ({
  billingDb: {
    from() {
      let meeloop: unknown
      const q: any = {
        select: () => q, order: () => q, limit: () => q, range: () => q, returns: () => q, in: () => q,
        eq: (k: string, v: unknown) => { if (k === 'meeloop') meeloop = v; return q },
        insert: () => { h.ingevoegd++; return q },
        maybeSingle: async () => ({ data: null, error: null }),
        then: (ok: any) => ok({ data: meeloop === true ? h.meeloopRegels : [], error: null }),
      }
      return q
    },
    rpc: async (naam: string) => { h.rpc.push(naam); return { data: { ok: true }, error: null } },
  },
}))

import { draaiGrootboek } from './referralGrootboek'
import { magTerugstorten } from './referralSchakelaars'

afterEach(() => { vi.unstubAllEnvs(); h.meeloopRegels = []; h.rpc = []; h.ingevoegd = 0 })

describe('grootboek echt', () => {
  it('staan er nog meeloopregels, dan wordt er niets beoordeeld of geschreven', async () => {
    h.meeloopRegels = [{ event_key: 'uitkomst:r1' }]
    const run = await draaiGrootboek(new Date(), { schrijf: true })
    expect(run.fouten[0]).toContain('overgang in de database')
    expect(run.referrals).toEqual([])
    expect(h.rpc).toEqual([])
    expect(h.ingevoegd).toBe(0)
  })
  it('zonder meeloopregels draait hij gewoon', async () => {
    expect((await draaiGrootboek(new Date(), { schrijf: true })).fouten).toEqual([])
  })
})

describe('gesplitste schakelaar', () => {
  const zet = (hoofd: string, tegoed: string) => {
    vi.stubEnv('REFERRAL_TERUGSTORTEN', hoofd)
    vi.stubEnv('REFERRAL_TEGOED_VERREKENEN', tegoed)
  }
  it('alleen de hoofdschakelaar: wel het voordeel, geen tegoed', () => {
    zet('true', '')
    expect([magTerugstorten('voordeel_maand'), magTerugstorten('voordeel_jaar'), magTerugstorten('tegoed_terugstorten')]).toEqual([true, true, false])
  })
  it('alleen de tegoedschakelaar doet niets', () => {
    zet('', 'true')
    expect([magTerugstorten('voordeel_maand'), magTerugstorten('tegoed_terugstorten')]).toEqual([false, false])
  })
  it('beide: alles', () => {
    zet('true', 'true')
    expect(magTerugstorten('tegoed_terugstorten')).toBe(true)
  })
  it.each(['TRUE', '1', 'ja'])('"%s" is geen aan', waarde => {
    zet('true', waarde)
    expect(magTerugstorten('tegoed_terugstorten')).toBe(false)
  })
})
