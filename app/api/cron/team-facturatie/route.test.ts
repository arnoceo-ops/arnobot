/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from 'vitest'

// De cron mag niet herinneren of blokkeren als niet vaststaat dat er niet betaald is, of als de klant niet kon betalen.

type Rij = Record<string, any>
const h = vi.hoisted(() => ({
  tabellen: {} as Record<string, Rij[]>,
  gemist: vi.fn(),
  mail: vi.fn(async () => {}),
  tg: vi.fn(async (_t: string) => {}),
  nieuw: vi.fn(async (_s: string, _n: string) => true),
}))

vi.mock('@/lib/capaciteit', () => ({ nieuwMelden: h.nieuw }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))
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
import { berekenReguliereBedrag, berekenTussentijdsBedrag, huidigSeats, maakTeamFactuur } from '@/lib/billing/teamFacturatie'

const oud = () => new Date(Date.now() - 60 * 86_400_000).toISOString()
const factuur = (id: string, extra: Rij = {}): Rij => ({ id, team_id: 't1', status: 'open', bedrag_cent: 100, seats_aantal: 3, created_at: oud(), herinnering_at: null, mollie_payment_link_url: 'https://pay.test/x', bezorgd_at: oud(), ...extra })
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
  it('automatische blokkade is geen eigen blokkade', async () => {
    await draai()
    expect(team().geblokkeerd_handmatig).toBe(false)
  })
  it.each([[null], [undefined]])('niet als bezorgd vastgelegd (%s): geen herinnering en geen blokkade, wel melden', async bezorgd => {
    h.tabellen.arnobot_team_facturen = [factuur('f1', { bezorgd_at: bezorgd })]
    await draai()
    expect(team().geblokkeerd_at).toBeNull()
    expect(h.mail).not.toHaveBeenCalled()
    expect(h.tg.mock.calls[0][0]).toContain('niet als bezorgd')
  })
  it('dezelfde melding komt niet elke dag terug', async () => {
    h.nieuw.mockResolvedValueOnce(false)
    h.tabellen.arnobot_team_facturen = [factuur('f1', { bezorgd_at: null })]
    await draai()
    expect(h.tg).not.toHaveBeenCalled()
  })
  it('twee facturen over tijd geven één blokkademail', async () => {
    h.tabellen.arnobot_team_facturen = [factuur('f1', { herinnering_at: oud() }), factuur('f2', { herinnering_at: oud() })]
    await draai()
    expect(h.mail).toHaveBeenCalledTimes(1)
  })
})

describe('cron team-facturatie: tellen en factureren', () => {
  const jaarteam = () => {
    Object.assign(team(), { cyclus: 'jaarlijks' })
    h.tabellen.arnobot_team_facturen = [factuur('f1', { status: 'paid', seats_aantal: 3 })]
    vi.mocked(berekenTussentijdsBedrag).mockReturnValue({ nettoCent: 100, btwCent: 21, brutoCent: 121 })
  }
  it('een telfout houdt de blokkade van een onbetaalde factuur niet tegen', async () => {
    team().volgende_factuurdatum = '2020-01-01'
    vi.mocked(huidigSeats).mockRejectedValueOnce(new Error('teamleden tellen mislukt'))
    await draai()
    expect(maakTeamFactuur).not.toHaveBeenCalled()
    expect(team().geblokkeerd_at).toBeTruthy()
    expect(h.tg.mock.calls.some(c => c[0].includes('fout'))).toBe(true)
  })
  it('een fout bij het rekenen voor team A laat team B gewoon factureren', async () => {
    h.tabellen.arnobot_teams = [1, 2].map(n => ({ id: `t${n}`, name: `Team ${n}`, manager_id: 'm1', min_seats: 3, cyclus: 'maandelijks', volgende_factuurdatum: '2020-01-01', geblokkeerd_at: null }))
    h.tabellen.arnobot_team_facturen = []
    vi.mocked(berekenReguliereBedrag).mockReturnValue({ nettoCent: 100, btwCent: 21, brutoCent: 121 })
    vi.mocked(berekenReguliereBedrag).mockImplementationOnce(() => { throw new Error('geen teamprijs') })
    await draai()
    expect(vi.mocked(maakTeamFactuur).mock.calls.map(c => (c[0] as { id: string }).id)).toEqual(['t2'])
  })
  it('jaarteam zonder extra teamlid krijgt geen tussenfactuur', async () => {
    jaarteam()
    vi.mocked(huidigSeats).mockResolvedValueOnce(3)
    await draai()
    expect(maakTeamFactuur).not.toHaveBeenCalled()
  })
  it('jaarteam met een extra teamlid krijgt precies een extra teamlid in rekening', async () => {
    jaarteam()
    vi.mocked(huidigSeats).mockResolvedValueOnce(4)
    await draai()
    expect(vi.mocked(berekenTussentijdsBedrag).mock.calls[0][0]).toBe(1)
    expect(maakTeamFactuur).toHaveBeenCalledTimes(1)
  })
})
