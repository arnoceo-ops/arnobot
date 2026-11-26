/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from 'vitest'

// De cron mag niet herinneren of blokkeren als niet vaststaat dat er niet betaald is, of als de klant niet kon betalen.

type Rij = Record<string, any>
const h = vi.hoisted(() => ({
  tabellen: {} as Record<string, Rij[]>,
  gemist: vi.fn(),
  mail: vi.fn(async () => {}),
  tg: vi.fn(async (_t: string) => {}),
}))

vi.mock('@/lib/cronRun', () => ({ registreerCronRun: (_p: string, f: unknown) => f }))
vi.mock('@/lib/billing/mollie', () => ({ mollieIngeschakeld: () => true }))
vi.mock('@/lib/billing/teamFacturatie', () => ({
  haalGemisteTeamBetalingenIn: h.gemist, huidigSeats: vi.fn(async () => 3), maakTeamFactuur: vi.fn(async () => ({ ok: true })),
  berekenReguliereBedrag: vi.fn(), berekenTussentijdsBedrag: vi.fn(),
}))
vi.mock('@/lib/billing/teamBetalingen', () => ({ controleerBetaaldeTeamFacturen: vi.fn(async () => ({ gecontroleerd: 0, gewijzigd: 0, fouten: 0 })) }))
vi.mock('@/lib/billing/teamMails', () => ({ verstuurTeamMail: h.mail }))
vi.mock('@/lib/cron-notify', () => ({ notifyTelegram: h.tg, notifyCronFailure: vi.fn() }))
vi.mock('@/lib/teamOpzegging', () => ({ stopOpgezegdeTeams: vi.fn(async () => []) }))
vi.mock('@/lib/billing/db', () => ({
  billingDb: {
    from(tabel: string) {
      const filters: Array<(r: Rij) => boolean> = []
      let patch: Rij | null = null
      const uitvoeren = () => {
        const treffers = (h.tabellen[tabel] ?? []).filter(r => filters.every(f => f(r)))
        if (patch) for (const r of treffers) Object.assign(r, patch)
        return { data: treffers.map(r => ({ ...r })), error: null }
      }
      const q: any = {
        select: () => q,
        eq: (k: string, v: unknown) => { filters.push(r => r[k] === v); return q },
        neq: (k: string, v: unknown) => { filters.push(r => r[k] !== v); return q },
        not: () => q, order: () => q, limit: () => q, returns: () => q,
        is: (k: string, v: unknown) => { filters.push(r => (r[k] ?? null) === v); return q },
        update: (p: Rij) => { patch = p; return q },
        maybeSingle: async () => ({ data: uitvoeren().data[0] ?? null, error: null }),
        then: (res: any, rej: any) => Promise.resolve(uitvoeren()).then(res, rej),
      }
      return q
    },
  },
}))

import { GET } from './route'

const oud = () => new Date(Date.now() - 60 * 86_400_000).toISOString()
const factuur = (id: string, extra: Rij = {}): Rij => ({ id, team_id: 't1', status: 'open', bedrag_cent: 100, seats_aantal: 3, created_at: oud(), herinnering_at: null, mollie_payment_link_url: 'https://pay.test/x', ...extra })
const draai = () => (GET as any)(new Request('https://x.test', { headers: { authorization: 'Bearer geheim' } }))
const team = () => h.tabellen.arnobot_teams[0]

beforeEach(() => {
  vi.clearAllMocks()
  process.env.CRON_SECRET = 'geheim'
  h.tabellen = {
    arnobot_teams: [{ id: 't1', name: 'Team Een', manager_id: 'm1', min_seats: 3, cyclus: 'maandelijks', volgende_factuurdatum: '2099-01-01', geblokkeerd_at: null }],
    arnobot_team_facturen: [factuur('f1')],
  }
  h.gemist.mockResolvedValue({ ingehaald: 0, fouten: 0, nietGecontroleerd: [], afwijkend: [] })
})

describe('cron team-facturatie: herinnering en blokkade', () => {
  it('echt onbetaald en ver over tijd: blokkeren', async () => {
    await draai()
    expect(team().geblokkeerd_at).toBeTruthy()
  })
  it('niet bij Mollie kunnen controleren: niets doen, wel melden', async () => {
    h.gemist.mockResolvedValue({ ingehaald: 0, fouten: 1, nietGecontroleerd: ['f1'], afwijkend: [] })
    await draai()
    expect(team().geblokkeerd_at).toBeNull()
    expect(h.mail).not.toHaveBeenCalled()
    expect(h.tg.mock.calls.some(c => c[0].includes('fout'))).toBe(true)
  })
  it('afwijkend bedrag ontvangen: niet blokkeren', async () => {
    h.gemist.mockResolvedValue({ ingehaald: 0, fouten: 0, nietGecontroleerd: [], afwijkend: ['f1'] })
    await draai()
    expect(team().geblokkeerd_at).toBeNull()
  })
  it('factuur zonder betaallink: nooit blokkeren, wel melden', async () => {
    h.tabellen.arnobot_team_facturen = [factuur('f1', { mollie_payment_link_url: null })]
    await draai()
    expect(team().geblokkeerd_at).toBeNull()
    expect(h.tg.mock.calls[0][0]).toContain('zonder betaallink')
  })
  it('twee facturen over tijd geven één blokkademail', async () => {
    h.tabellen.arnobot_team_facturen = [factuur('f1', { herinnering_at: oud() }), factuur('f2', { herinnering_at: oud() })]
    await draai()
    expect(h.mail).toHaveBeenCalledTimes(1)
  })
})
