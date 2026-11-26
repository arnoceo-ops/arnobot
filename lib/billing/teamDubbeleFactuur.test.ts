/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Botst een nieuwe teamfactuur met de unieke index, dan schuift de factuurdatum door in plaats van voor altijd vast te lopen.

type Rij = Record<string, any>
const h = vi.hoisted(() => ({ tabellen: {} as Record<string, Rij[]>, insertFout: null as any, link: vi.fn(), mail: vi.fn(), moneybird: false, verstuur: vi.fn(), tg: vi.fn(async (_t: string) => {}) }))

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/lib/cron-notify', () => ({ notifyTelegram: h.tg }))
vi.mock('@/lib/teamOpzegging', () => ({ ontblokkeerNaBetaling: vi.fn() }))
vi.mock('./mollie', () => ({ maakBetaalLink: h.link, SITE_URL: 'https://x.test' }))
vi.mock('./teamBetalingen', () => ({}))
vi.mock('./moneybird', () => ({
  moneybirdIngeschakeld: () => h.moneybird, btwTariefId: async () => 'btw', omzetGrootboekId: async () => 'gb',
  maakConceptFactuur: async () => ({ id: 'mb1' }), zoekOfMaakContact: async () => 'c1', verstuurFactuur: h.verstuur,
  teamFactuurMailTekst: () => '', teamFactuurVoorwaarden: () => '', registreerBetaling: vi.fn(),
}))
vi.mock('./teamMails', () => ({ verstuurTeamMail: h.mail }))
vi.mock('./db', () => ({
  billingDb: {
    from(tabel: string) {
      const filters: Array<(r: Rij) => boolean> = []
      let patch: Rij | null = null
      let invoegen = false
      const uitvoeren = () => {
        const treffers = (h.tabellen[tabel] ?? []).filter(r => filters.every(f => f(r)))
        if (patch) for (const r of treffers) Object.assign(r, patch)
        return { data: treffers.map(r => ({ ...r })), error: null }
      }
      const q: any = {
        select: () => q, limit: () => q, returns: () => q, upsert: async () => ({ error: null }),
        maybeSingle: async () => ({ data: uitvoeren().data[0] ?? null, error: null }),
        eq: (k: string, v: unknown) => { filters.push(r => r[k] === v); return q },
        in: (k: string, v: unknown[]) => { filters.push(r => v.includes(r[k])); return q },
        insert: () => { invoegen = true; return q },
        update: (p: Rij) => { patch = p; return q },
        single: async () => (invoegen && h.insertFout ? { data: null, error: h.insertFout } : { data: { id: 'nieuw' }, error: null }),
        then: (res: any, rej: any) => Promise.resolve(uitvoeren()).then(res, rej),
      }
      return q
    },
  },
}))

import { maakTeamFactuur } from './teamFacturatie'

const team: any = { id: 't1', name: 'Team Een', manager_id: 'm1', min_seats: 3, cyclus: 'maandelijks', volgende_factuurdatum: '2026-12-01', geblokkeerd_at: null }
const invoer = { soort: 'regulier' as const, periodeStart: new Date('2026-12-01'), periodeEinde: new Date('2027-01-01'), seats: 3, nettoCent: 24400, btwCent: 5124 }

beforeEach(() => {
  vi.clearAllMocks()
  h.insertFout = null
  h.tabellen = { arnobot_teams: [{ ...team }], arnobot_team_facturen: [] }
})

describe('teamfactuur en de unieke periode', () => {
  it('bestond al: datum schuift naar het einde van de bestaande factuur en er komt geen nieuwe betaallink', async () => {
    h.insertFout = { code: '23505', message: 'duplicate key' }
    h.tabellen.arnobot_team_facturen = [{ id: 'oud', team_id: 't1', periode_start: '2026-12-01', periode_einde: '2027-01-01', soort: 'regulier', status: 'open', mollie_payment_link_url: 'https://pay.test/x' }]
    expect(await maakTeamFactuur(team, invoer)).toEqual({ ok: false, reden: 'bestond_al' })
    expect(h.tabellen.arnobot_teams[0].volgende_factuurdatum).toBe('2027-01-01')
    expect(h.link).not.toHaveBeenCalled()
  })
  it('andere databasefout: datum blijft staan, morgen opnieuw', async () => {
    h.insertFout = { code: '08006', message: 'verbinding weg' }
    expect(await maakTeamFactuur(team, invoer)).toEqual({ ok: false, reden: 'niet_aangemaakt' })
    expect(h.tabellen.arnobot_teams[0].volgende_factuurdatum).toBe('2026-12-01')
  })
  it('mail niet verstuurd en geen Moneybird: niet bezorgd en niet gelukt', async () => {
    h.link.mockResolvedValue({ id: 'pl_1', url: 'https://pay.test/y' })
    h.mail.mockResolvedValue(false)
    h.tabellen.arnobot_team_facturen = [{ id: 'nieuw' }]
    expect(await maakTeamFactuur(team, invoer)).toEqual({ ok: false, reden: 'niet_afgerond' })
    expect(h.tabellen.arnobot_team_facturen[0].bezorgd_at).toBeUndefined()
  })
  it('mail verstuurd: factuur staat als bezorgd', async () => {
    h.link.mockResolvedValue({ id: 'pl_1', url: 'https://pay.test/y' })
    h.mail.mockResolvedValue(true)
    h.tabellen.arnobot_team_facturen = [{ id: 'nieuw' }]
    expect(await maakTeamFactuur(team, invoer)).toEqual({ ok: true })
    expect(h.tabellen.arnobot_team_facturen[0].bezorgd_at).toBeTruthy()
  })
  describe('via Moneybird', () => {
    beforeEach(() => {
      h.moneybird = true
      process.env.MOLLIE_API_KEY = 'live_x'
      h.link.mockResolvedValue({ id: 'pl_1', url: 'https://pay.test/y' })
      h.tabellen.arnobot_team_facturen = [{ id: 'nieuw' }]
      h.tabellen.arnobot_billing_customers = [{ user_id: 'm1', mollie_customer_id: 'cst_1', bedrijfsnaam: 'Voorbeeld BV' }]
      h.tabellen.approved_users = [{ user_id: 'm1', voornaam: 'Test', email: 'm@x.nl' }]
    })
    afterEach(() => { h.moneybird = false; delete process.env.MOLLIE_API_KEY })
    it('verzonden: bezorgd, ook als onze eigen mail mislukt', async () => {
      h.verstuur.mockResolvedValue(undefined)
      h.mail.mockResolvedValue(false)
      expect(await maakTeamFactuur(team, invoer)).toEqual({ ok: true })
      expect(h.tabellen.arnobot_team_facturen[0].bezorgd_at).toBeTruthy()
    })
    it('verzenden mislukt: niet bezorgd', async () => {
      h.verstuur.mockRejectedValue(new Error('moneybird plat'))
      expect(await maakTeamFactuur(team, invoer)).toEqual({ ok: false, reden: 'niet_afgerond' })
      expect(h.tabellen.arnobot_team_facturen[0].bezorgd_at).toBeUndefined()
    })
  })
  it('betaallink mislukt: datum staat al vooruit en de uitkomst is niet gelukt', async () => {
    h.link.mockRejectedValue(new Error('mollie plat'))
    expect(await maakTeamFactuur(team, invoer)).toEqual({ ok: false, reden: 'niet_afgerond' })
    expect(h.tabellen.arnobot_teams[0].volgende_factuurdatum).toBe('2027-01-01')
  })
})
