import { beforeEach, describe, expect, it, vi } from 'vitest'

// Wie krijgt de zin over vervallend referraltegoed niet (account en abonnementsmails): een gewoon teamlid, een gratis
// account en wie Lifetime heeft (spelregels artikel 5: met Lifetime vervalt tegoed niet).
const h = vi.hoisted(() => ({ leden: [] as { role: string }[], gebruiker: null as Record<string, unknown> | null, stuk: false }))

vi.mock('./db', () => ({
  billingDb: {
    from: (tabel: string) => ({
      select: () => ({
        eq: () => tabel === 'arnobot_team_members'
          ? { limit: async () => ({ data: h.leden, error: null }) }
          : { maybeSingle: async () => { if (h.stuk) throw new Error('weg'); return { data: h.gebruiker, error: null } } },
      }),
    }),
  },
}))

import { zonderTegoedZin } from './mails'

beforeEach(() => { h.leden = []; h.gebruiker = {}; h.stuk = false })

describe('zonderTegoedZin', () => {
  it('een gewone klant krijgt de zin', async () => expect(await zonderTegoedZin('u')).toBe(false))
  it('een manager krijgt de zin', async () => { h.leden = [{ role: 'manager' }]; expect(await zonderTegoedZin('u')).toBe(false) })
  it('een gewoon teamlid niet', async () => { h.leden = [{ role: 'member' }]; expect(await zonderTegoedZin('u')).toBe(true) })
  it('een gratis account niet', async () => { h.gebruiker = { gratis_sinds: '2026-11-26T00:00:00Z' }; expect(await zonderTegoedZin('u')).toBe(true) })
  it('Lifetime niet, ook niet als er een gratis kenmerk bij staat', async () => {
    h.gebruiker = { lifetime_sinds: '2026-11-01T00:00:00Z' }
    expect(await zonderTegoedZin('u')).toBe(true)
    h.gebruiker = { lifetime_sinds: '2026-11-01T00:00:00Z', gratis_sinds: '2026-11-26T00:00:00Z' }
    expect(await zonderTegoedZin('u')).toBe(true)
  })
  it('lukt opzoeken niet, dan blijft de zin staan en gaat de mail door', async () => { h.stuk = true; expect(await zonderTegoedZin('u')).toBe(false) })
})
