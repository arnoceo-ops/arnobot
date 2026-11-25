/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Het grootboek met de echte beoordeling en rekenregels, op een nagebootste database.

type Rij = Record<string, any>
const h = vi.hoisted(() => ({ tabellen: {} as Record<string, Rij[]>, fouten: {} as Record<string, { message: string; code?: string }> }))

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('./teamFacturatie', () => ({ huidigSeats: vi.fn(async (_id: string, min: number) => min) }))
vi.mock('./db', () => ({
  billingDb: {
    from(tabel: string) {
      const filters: Array<(r: Rij) => boolean> = []
      let nieuw: Rij | null = null
      let bereik: [number, number] | null = null
      const uitvoeren = () => {
        if (h.fouten[tabel]) return { data: null, error: h.fouten[tabel] }
        const rijen = (h.tabellen[tabel] ??= [])
        if (nieuw) {
          if (rijen.some(r => r.event_key === nieuw!.event_key && r.meeloop === nieuw!.meeloop)) return { data: null, error: { message: 'dubbel', code: '23505' } }
          rijen.push({ ...nieuw, created_at: new Date().toISOString() })
          return { data: null, error: null }
        }
        const treffers = rijen.filter(r => filters.every(f => f(r))).map(r => ({ ...r }))
        return { data: bereik ? treffers.slice(bereik[0], bereik[1] + 1) : treffers, error: null }
      }
      const q: any = {
        select: () => q,
        eq: (k: string, v: unknown) => { filters.push(r => r[k] === v); return q },
        in: (k: string, v: unknown[]) => { filters.push(r => v.includes(r[k])); return q },
        order: () => q,
        limit: () => q,
        range: (van: number, tot: number) => { bereik = [van, tot]; return q },
        returns: () => q,
        insert: (r: Rij) => { nieuw = r; return q },
        maybeSingle: async () => { const r = uitvoeren(); return { data: r.data?.[0] ?? null, error: r.error } },
        then: (res: any, rej: any) => Promise.resolve(uitvoeren()).then(res, rej),
      }
      return q
    },
  },
}))

import { draaiGrootboek, nieuweMijlpalen, saldoPerAanbrenger } from './referralGrootboek'

const gebruiker = (user_id: string, extra: Rij = {}): Rij => ({
  user_id, trial_start: '2027-01-01T10:00:00.000Z', paid_at: null, command_manager: false, sd_attribution_method: null, ...extra,
})
const sub = (user_id: string, extra: Rij = {}): Rij => ({
  id: `sub_${user_id}`, user_id, plan: 'premium', cyclus: 'maandelijks', klant_type: 'particulier', status: 'active',
  periode_einde: '2027-06-01T00:00:00.000Z', ...extra,
})
/** Jaarbetaling Basic van een zakelijke klant: kwalificeert direct. */
const jaar = (user_id: string, extra: Rij = {}): Rij => ({
  id: `pay_${user_id}`, user_id, subscription_id: `sub_${user_id}`, status: 'paid', bedrag_cent: 20000, terugbetaald_cent: 0, teruggeboekt_cent: 0,
  terugbetaling_verwerkt_at: null, betaald_at: '2027-01-20T10:00:00.000Z', plan: 'basis', cyclus: 'jaarlijks', klant_type: 'zakelijk',
  periode_start: '2027-01-31T10:00:00.000Z', periode_einde: '2028-01-31T10:00:00.000Z', ...extra,
})
const referral = { id: 'r1', referrer_user_id: 'aanbrenger', referred_user_id: 'klant', created_at: '2027-01-01T10:00:00.000Z' }
const NU = new Date('2027-03-01T06:00:00.000Z')

function zet(extra: Record<string, Rij[]> = {}) {
  h.fouten = {}
  h.tabellen = {
    arnobot_referral_grootboek: [],
    arnobot_referrals: [referral],
    approved_users: [gebruiker('aanbrenger'), gebruiker('klant')],
    arnobot_subscriptions: [sub('aanbrenger'), sub('klant', { plan: 'basis', cyclus: 'jaarlijks', klant_type: 'zakelijk' })],
    arnobot_payments: [jaar('klant')],
    arnobot_team_members: [], arnobot_teams: [], arnobot_team_facturen: [],
    ...extra,
  }
}
const boek = () => h.tabellen.arnobot_referral_grootboek
const draai = (nu = NU) => draaiGrootboek(nu, { schrijf: true })

beforeEach(() => zet())

describe('toekennen', () => {
  it('kent het laagste van beide maandprijzen toe, en een tweede run voegt niets toe', async () => {
    await draai()
    expect(boek()).toHaveLength(1)
    // Basic per jaar zakelijk: 228 per jaar, dus 19,00 netto per maand. De aanbrenger (Pro per maand) zit hoger.
    expect(boek()[0]).toMatchObject({ soort: 'toekenning', netto_cent: 1900, meeloop: true, event_key: 'uitkomst:r1' })
    const tweede = await draai()
    expect(tweede.nieuw).toHaveLength(0)
    expect(boek()).toHaveLength(1)
  })
  it('zonder schrijven komt er niets in de tabel', async () => {
    const run = await draaiGrootboek(NU, { schrijf: false })
    expect(run.nieuw).toHaveLength(1)
    expect(boek()).toHaveLength(0)
  })
  it('terugbetaalde klantbetaling: niets', async () => {
    zet({ arnobot_payments: [jaar('klant', { terugbetaald_cent: 20000 })] })
    const run = await draai()
    expect(boek()).toHaveLength(0)
    expect(run.referrals[0]).toMatchObject({ stand: 'beoordeeld', beoordeling: { uitkomst: 'wacht' } })
  })
  it('alleen eigen referraltegoed teruggestort diskwalificeert de klant niet', async () => {
    zet({ arnobot_payments: [jaar('klant', { terugbetaald_cent: 1000, referral_refund_cent: 1000 })] })
    await draai()
    expect(boek()[0]).toMatchObject({ soort: 'toekenning' })
  })
  it('eerste betaling te laat: afgewezen', async () => {
    zet({ arnobot_payments: [jaar('klant', { betaald_at: '2027-02-16T10:00:00.000Z' })] })
    await draai()
    expect(boek()[0]).toMatchObject({ soort: 'afwijzing', netto_cent: 0 })
  })
  it('testaccounts tellen niet mee', async () => {
    zet({ arnobot_referrals: [{ ...referral, referrer_user_id: 'fake_1' }] })
    const run = await draai()
    expect(run.referrals[0].stand).toBe('uitgesloten')
    expect(boek()).toHaveLength(0)
  })
  it('wederzijdse verwijzing: afgewezen', async () => {
    zet({ arnobot_referrals: [referral, { id: 'r2', referrer_user_id: 'klant', referred_user_id: 'aanbrenger', created_at: null }] })
    await draai()
    expect(boek().map(r => r.soort)).toEqual(['afwijzing', 'afwijzing'])
  })
})

describe('aanbrenger', () => {
  const gestopt = (einde: string) => [sub('aanbrenger', { status: 'ended', periode_einde: einde }), sub('klant', { plan: 'basis', cyclus: 'jaarlijks', klant_type: 'zakelijk' })]

  it('langer dan 14 dagen gestopt: niets toekennen', async () => {
    zet({ arnobot_subscriptions: gestopt('2027-02-01T00:00:00.000Z') })
    await draai()
    expect(boek()[0]).toMatchObject({ soort: 'afwijzing' })
  })
  it('net gestopt: nog niet beslissen', async () => {
    zet({ arnobot_subscriptions: gestopt('2027-02-25T00:00:00.000Z') })
    await draai()
    expect(boek()).toHaveLength(0)
  })
  it('stopt na de toekenning: tegoed vervalt één keer en het saldo is nul', async () => {
    await draai()
    h.tabellen.arnobot_subscriptions = gestopt('2027-03-05T00:00:00.000Z')
    await draai(new Date('2027-03-10T06:00:00.000Z'))
    expect(boek()).toHaveLength(1)
    await draai(new Date('2027-03-25T06:00:00.000Z'))
    await draai(new Date('2027-03-26T06:00:00.000Z'))
    expect(boek().map(r => r.soort)).toEqual(['toekenning', 'verval'])
    expect(saldoPerAanbrenger(boek() as any).get('aanbrenger')).toBe(0)
  })
  it('nog in de proef: toekennen zonder bedrag, vaststellen bij zijn eerste abonnement', async () => {
    zet({
      approved_users: [gebruiker('aanbrenger', { trial_start: '2027-02-15T10:00:00.000Z' }), gebruiker('klant')],
      arnobot_subscriptions: [sub('klant', { plan: 'basis', cyclus: 'jaarlijks', klant_type: 'zakelijk' })],
    })
    await draai()
    expect(boek()[0]).toMatchObject({ soort: 'toekenning', netto_cent: null })
    h.tabellen.arnobot_subscriptions.push(sub('aanbrenger', { plan: 'basis', cyclus: 'jaarlijks' }))
    await draai(new Date('2027-03-02T06:00:00.000Z'))
    expect(boek()[1]).toMatchObject({ soort: 'vaststelling' })
    expect(boek()[1].netto_cent).toBeGreaterThan(0)
    expect(boek()[1].netto_cent).toBeLessThan(1900)
  })
  it('manager: plafond is de maandprijs van het betaalde team, ook zonder eigen abonnement', async () => {
    zet({
      arnobot_subscriptions: [sub('klant', { plan: 'basis', cyclus: 'jaarlijks', klant_type: 'zakelijk' })],
      arnobot_teams: [{ id: 't1', manager_id: 'aanbrenger', min_seats: 3, cyclus: 'maandelijks', geblokkeerd_at: null, stopt_op: null }],
      arnobot_team_facturen: [{ id: 'f1', team_id: 't1', soort: 'regulier', status: 'paid', betaald_at: '2027-01-05T10:00:00.000Z' }],
    })
    await draai()
    expect(boek()[0]).toMatchObject({ soort: 'toekenning', netto_cent: 1900 })
  })
  it('met de hand op betaald: zelf beoordelen, één keer gemeld en later alsnog te beslissen', async () => {
    zet({
      approved_users: [gebruiker('aanbrenger', { paid_at: '2027-01-01T00:00:00.000Z' }), gebruiker('klant')],
      arnobot_subscriptions: [sub('klant', { plan: 'basis', cyclus: 'jaarlijks', klant_type: 'zakelijk' })],
    })
    await draai()
    await draai()
    expect(boek().map(r => r.soort)).toEqual(['handwerk'])
  })
})

describe('verwijderd account', () => {
  it('aanbrenger weg na de toekenning: tegoed vervalt, geen dagelijkse fout', async () => {
    await draai()
    h.tabellen.approved_users = [gebruiker('klant')]
    const run = await draai()
    expect(run.fouten).toEqual([])
    expect(boek().map(r => r.soort)).toEqual(['toekenning', 'verval'])
  })
  it('nieuwe gebruiker weg vóór de beslissing: één keer zelf beoordelen', async () => {
    zet({ approved_users: [gebruiker('aanbrenger')] })
    await draai()
    const tweede = await draai()
    expect(tweede.fouten).toEqual([])
    expect(boek().map(r => r.soort)).toEqual(['handwerk'])
  })
})

describe('veiligheid bij databasefouten', () => {
  it('mislukte zoekvraag: niets beslissen en niets laten vervallen', async () => {
    await draai()
    h.fouten = { arnobot_subscriptions: { message: 'time-out' } }
    const run = await draai(new Date('2027-09-01T06:00:00.000Z'))
    expect(run.fouten.length).toBeGreaterThan(0)
    expect(boek()).toHaveLength(1)
  })
  it('tabel ontbreekt: niets schrijven, wel kunnen rekenen', async () => {
    h.fouten = { arnobot_referral_grootboek: { message: 'relation does not exist', code: '42P01' } }
    const run = await draai()
    expect(run.migratieOntbreekt).toBe(true)
    expect(run.nieuw).toHaveLength(1)
  })
  it('andere fout op het grootboek stopt de hele run', async () => {
    h.fouten = { arnobot_referral_grootboek: { message: 'time-out' } }
    await expect(draai()).rejects.toThrow('time-out')
  })
})

describe('mijlpalen', () => {
  const t = (n: number) => Array.from({ length: n }, () => ({ soort: 'toekenning' }) as any)
  it('meldt een mijlpaal alleen in de run waarin hij wordt gehaald', () => {
    expect(nieuweMijlpalen(t(50), t(1))).toEqual([50])
    expect(nieuweMijlpalen(t(51), t(1))).toEqual([])
  })
})
