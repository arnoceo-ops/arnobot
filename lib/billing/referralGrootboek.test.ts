/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Het grootboek met de echte beoordeling en rekenregels, op een nagebootste database.

type Rij = Record<string, any>
const h = vi.hoisted(() => ({
  tabellen: {} as Record<string, Rij[]>, fouten: {} as Record<string, { message: string; code?: string }>,
  terugbetalingen: {} as Record<string, Rij[]>, mollieFout: false,
}))

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('./teamFacturatie', () => ({ huidigSeats: vi.fn(async (_id: string, min: number) => min) }))
vi.mock('./mollie', () => ({
  mollieIngeschakeld: () => true,
  lijstBetalingTerugbetalingen: vi.fn(async (id: string) => {
    if (h.mollieFout) throw new Error('mollie plat')
    return h.terugbetalingen[id] ?? []
  }),
}))
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

import { draaiGrootboek, legBesluitVast, nieuweMijlpalen, saldoPerAanbrenger } from './referralGrootboek'
import { berekenBedrag, type Cyclus, type KlantType, type Plan } from './prijzen'

const gebruiker = (user_id: string, extra: Rij = {}): Rij => ({
  user_id, email: `${user_id}@voorbeeld.nl`, is_active: true, trial_start: '2027-01-01T10:00:00.000Z', expires_at: null, paid_at: null,
  command_manager: false, sd_attribution_method: null, ...extra,
})
const prijs = (plan: Plan, cyclus: Cyclus, klant: KlantType) => {
  const b = berekenBedrag(plan, cyclus, klant)
  return { bedrag_cent: b.brutoCent, btw_cent: b.btwCent }
}
const sub = (user_id: string, extra: Rij = {}): Rij => {
  const r = { plan: 'premium', cyclus: 'maandelijks', klant_type: 'particulier', ...extra } as Rij
  return {
    id: `sub_${user_id}`, user_id, status: 'active', created_at: '2027-01-05T10:00:00.000Z', periode_start: '2027-01-05T10:00:00.000Z',
    periode_einde: '2027-06-01T00:00:00.000Z', ...prijs(r.plan, r.cyclus, r.klant_type), ...r,
  }
}
/** Jaarbetaling Basic van een zakelijke klant: kwalificeert direct. */
const jaar = (user_id: string, extra: Rij = {}): Rij => ({
  id: `pay_${user_id}`, user_id, mollie_payment_id: `tr_${user_id}`, subscription_id: `sub_${user_id}`, soort: 'eerste', status: 'paid',
  ...prijs('basis', 'jaarlijks', 'zakelijk'), terugbetaald_cent: 0, teruggeboekt_cent: 0,
  terugbetaling_verwerkt_at: null, betaald_at: '2027-01-20T10:00:00.000Z', plan: 'basis', cyclus: 'jaarlijks', klant_type: 'zakelijk',
  periode_start: '2027-01-31T10:00:00.000Z', periode_einde: '2028-01-31T10:00:00.000Z', ...extra,
})
const referral = { id: 'r1', referrer_user_id: 'aanbrenger', referred_user_id: 'klant', created_at: '2027-01-01T10:00:00.000Z' }
const NU = new Date('2027-03-01T06:00:00.000Z')

function zet(extra: Record<string, Rij[]> = {}) {
  h.fouten = {}
  h.terugbetalingen = {}
  h.mollieFout = false
  h.tabellen = {
    arnobot_referral_grootboek: [],
    arnobot_referrals: [referral],
    approved_users: [gebruiker('aanbrenger'), gebruiker('klant')],
    arnobot_subscriptions: [sub('aanbrenger'), sub('klant', { plan: 'basis', cyclus: 'jaarlijks', klant_type: 'zakelijk' })],
    arnobot_payments: [jaar('klant')],
    arnobot_team_members: [], arnobot_teams: [], arnobot_team_facturen: [], arnobot_admin_log: [],
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
  it('nog in de proef: toekennen zonder bedrag, het bedrag volgt pas bij de eerste verrekening', async () => {
    zet({
      approved_users: [gebruiker('aanbrenger', { trial_start: '2027-02-15T10:00:00.000Z' }), gebruiker('klant')],
      arnobot_subscriptions: [sub('klant', { plan: 'basis', cyclus: 'jaarlijks', klant_type: 'zakelijk' })],
    })
    await draai()
    expect(boek()[0]).toMatchObject({ soort: 'toekenning', netto_cent: null })
    h.tabellen.arnobot_subscriptions.push(sub('aanbrenger', { plan: 'basis', cyclus: 'jaarlijks', created_at: '2027-03-01T08:00:00.000Z' }))
    await draai(new Date('2027-03-02T06:00:00.000Z'))
    expect(boek()).toHaveLength(1)
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
  const t = (n: number, wie = 'a') => Array.from({ length: n }, () => ({ soort: 'toekenning', aanbrenger_user_id: wie }) as any)
  it('meldt een mijlpaal alleen in de run waarin hij wordt gehaald', () => {
    expect(nieuweMijlpalen(t(50), t(1))).toEqual([{ aanbrengerId: 'a', aantal: 50 }])
    expect(nieuweMijlpalen(t(51), t(1))).toEqual([])
  })
  it('telt per aanbrenger, niet alle aanbrengers samen', () => {
    expect(nieuweMijlpalen([...t(30, 'a'), ...t(20, 'b')], t(1, 'b'))).toEqual([])
  })
})

// ── Ronde 2 (docs/REFERRAL_CONTROLE_2026-11-26.md) ──

const klantSub = () => sub('klant', { plan: 'basis', cyclus: 'jaarlijks', klant_type: 'zakelijk' })
const soloGestopt = (einde: string, extra: Rij = {}) => sub('aanbrenger', { status: 'ended', periode_einde: einde, ...extra })
const team = (extra: Rij = {}): Rij => ({
  id: 't1', manager_id: 'aanbrenger', min_seats: 3, cyclus: 'maandelijks', volgende_factuurdatum: '2027-03-01', geblokkeerd_at: null, stopt_op: null, ...extra,
})
const factuur = (extra: Rij = {}): Rij => ({
  id: 'f1', team_id: 't1', soort: 'regulier', status: 'paid', cyclus: 'maandelijks', created_at: '2027-02-01T06:00:00.000Z',
  betaald_at: '2027-02-03T10:00:00.000Z', periode_start: '2027-02-01', periode_einde: '2027-03-01', reversed_at: null, ...extra,
})
const uitkomst = (run: Awaited<ReturnType<typeof draai>>) => (run.referrals[0] as any).beoordeling

describe('B1 solo naar Team', () => {
  const open = () => factuur({ status: 'open', betaald_at: null, created_at: '2027-02-01T06:00:00.000Z' })
  it('openstaande eerste teamfactuur: niets afwijzen, ook lang na het einde van solo', async () => {
    zet({ arnobot_subscriptions: [soloGestopt('2027-02-01T00:00:00.000Z'), klantSub()], arnobot_teams: [team()], arnobot_team_facturen: [open()] })
    const run = await draai(new Date('2027-03-01T06:00:00.000Z'))
    expect(uitkomst(run).uitkomst).toBe('wacht')
    expect(boek()).toHaveLength(0)
  })
  it('na betaling van de teamfactuur alsnog toekennen', async () => {
    zet({ arnobot_subscriptions: [soloGestopt('2027-02-01T00:00:00.000Z'), klantSub()], arnobot_teams: [team()], arnobot_team_facturen: [factuur({ betaald_at: '2027-02-28T10:00:00.000Z' })] })
    await draai()
    expect(boek().map(r => r.soort)).toEqual(['toekenning'])
  })
  it('een bestaande toekenning vervalt niet terwijl de factuur openstaat', async () => {
    await draai()
    h.tabellen.arnobot_subscriptions = [soloGestopt('2027-03-05T00:00:00.000Z'), klantSub()]
    h.tabellen.arnobot_teams = [team()]
    h.tabellen.arnobot_team_facturen = [open()]
    await draai(new Date('2027-04-10T06:00:00.000Z'))
    expect(boek().map(r => r.soort)).toEqual(['toekenning'])
  })
})

describe('B2 verlengde teamproef', () => {
  const manager = (extra: Rij = {}) => gebruiker('aanbrenger', { command_manager: true, sd_attribution_method: 'link', expires_at: '2027-04-30T00:00:00.000Z', ...extra })
  it('de termijn schuift mee met de verlengde proef', async () => {
    zet({ approved_users: [manager(), gebruiker('klant')], arnobot_subscriptions: [klantSub()], arnobot_teams: [team({ min_seats: null, volgende_factuurdatum: null })] })
    await draai(new Date('2027-04-15T06:00:00.000Z'))
    expect(boek().map(r => r.soort)).toEqual(['toekenning'])
    await draai(new Date('2027-05-09T06:00:00.000Z'))
    expect(boek()).toHaveLength(1)
    await draai(new Date('2027-05-12T06:00:00.000Z'))
    expect(boek().map(r => r.soort)).toEqual(['toekenning', 'verval'])
  })
})

describe('B3 deelterugbetaling', () => {
  it('telt nog steeds voor "op tijd betaald"', async () => {
    zet({
      arnobot_payments: [
        jaar('klant', { terugbetaald_cent: 100 }),
        jaar('klant', { id: 'p2', mollie_payment_id: 'tr_2', soort: 'herhaling', betaald_at: '2027-02-25T10:00:00.000Z' }),
      ],
    })
    await draai()
    expect(boek().map(r => r.soort)).toEqual(['toekenning'])
  })
})

describe('B4 eerst online, daarna met de hand op BETAALD', () => {
  const eerderOnline = { id: 'oud', user_id: 'aanbrenger', mollie_payment_id: 'tr_oud', soort: 'eerste', status: 'paid', bedrag_cent: 4900, btw_cent: 850, terugbetaald_cent: 0, teruggeboekt_cent: 0, betaald_at: '2027-01-05T10:00:00.000Z' }
  it('aanbrenger: zelf beoordelen in plaats van afwijzen', async () => {
    zet({
      approved_users: [gebruiker('aanbrenger', { paid_at: '2027-02-20T09:00:00.000Z' }), gebruiker('klant')],
      arnobot_subscriptions: [soloGestopt('2027-02-05T00:00:00.000Z'), klantSub()],
      arnobot_payments: [jaar('klant'), eerderOnline],
    })
    await draai()
    expect(boek().map(r => r.soort)).toEqual(['handwerk'])
  })
  it('online betaald en gestopt (paid_at is van die betaling): gewoon afwijzen', async () => {
    zet({
      approved_users: [gebruiker('aanbrenger', { paid_at: '2027-01-05T10:00:00.000Z' }), gebruiker('klant')],
      arnobot_subscriptions: [soloGestopt('2027-02-05T00:00:00.000Z'), klantSub()],
      arnobot_payments: [jaar('klant'), eerderOnline],
    })
    await draai()
    expect(boek().map(r => r.soort)).toEqual(['afwijzing'])
  })
  it('klant die te laat lijkt maar ook met de hand op betaald staat: zelf beoordelen', async () => {
    zet({
      approved_users: [gebruiker('aanbrenger'), gebruiker('klant', { paid_at: '2027-02-01T09:00:00.000Z' })],
      arnobot_subscriptions: [sub('aanbrenger'), sub('klant', { status: 'ended', periode_einde: '2027-02-28T00:00:00.000Z' })],
      arnobot_payments: [jaar('klant', { betaald_at: '2027-02-20T10:00:00.000Z' })],
    })
    await draai()
    expect(boek().map(r => r.soort)).toEqual(['handwerk'])
  })
})

describe('E1 teruggedraaide teamfactuur', () => {
  it('maakt de manager niet betalend', async () => {
    zet({
      arnobot_subscriptions: [klantSub()], arnobot_teams: [team({ volgende_factuurdatum: null, min_seats: null })],
      arnobot_team_facturen: [factuur({ status: 'refunded', reversed_at: '2027-02-10T00:00:00.000Z' })],
    })
    await draai()
    // Niets betaald en de teamtermijn is voorbij.
    expect(boek()[0]).toMatchObject({ soort: 'afwijzing' })
  })
})

describe('E2 upgrade met een lopende bijbetaling', () => {
  const upgrade = (wie: string, status: string): Rij => ({
    id: `up_${wie}`, user_id: wie, mollie_payment_id: `tr_up_${wie}`, subscription_id: `sub_${wie}`, soort: 'upgrade', status,
    bedrag_cent: 20000, btw_cent: 3471, terugbetaald_cent: 0, teruggeboekt_cent: 0, terugbetaling_verwerkt_at: null, betaald_at: null,
  })
  const proKlant = () => sub('klant', { plan: 'premium', cyclus: 'jaarlijks', klant_type: 'zakelijk' })
  it.each(['open', 'pending'])('klant (%s): nog niets beslissen', async status => {
    zet({ arnobot_subscriptions: [sub('aanbrenger'), proKlant()], arnobot_payments: [jaar('klant'), upgrade('klant', status)] })
    const run = await draai()
    expect(uitkomst(run).uitkomst).toBe('wacht')
    expect(boek()).toHaveLength(0)
  })
  it('klant: na de bijbetaling telt Pro', async () => {
    zet({ arnobot_subscriptions: [sub('aanbrenger'), proKlant()], arnobot_payments: [jaar('klant'), upgrade('klant', 'paid')] })
    await draai()
    expect(boek()[0].klant_maand_netto_cent).toBe(Math.round((prijs('premium', 'jaarlijks', 'zakelijk').bedrag_cent - prijs('premium', 'jaarlijks', 'zakelijk').btw_cent) / 12))
  })
  it('klant: mislukte bijbetaling telt als Basic, ook als de rij nog op Pro staat', async () => {
    zet({ arnobot_subscriptions: [sub('aanbrenger'), proKlant()], arnobot_payments: [jaar('klant'), upgrade('klant', 'failed')] })
    await draai()
    expect(boek()[0].klant_maand_netto_cent).toBe(1900)
  })
  it('aanbrenger: wachten tot de bijbetaling binnen is', async () => {
    zet({ arnobot_payments: [jaar('klant'), upgrade('aanbrenger', 'pending')] })
    await draai()
    expect(boek()).toHaveLength(0)
  })
})

describe('E6 en besluit 2: terugkomen helpt niet', () => {
  const terug = (start: string) => [
    soloGestopt('2027-02-01T00:00:00.000Z'), sub('aanbrenger', { id: 'nieuw', created_at: start, periode_start: start }), klantSub(),
  ]
  it('meer dan 14 dagen weg na de aanmelding: geen tegoed, ook al loopt er nu weer een abonnement', async () => {
    zet({ arnobot_subscriptions: terug('2027-02-25T00:00:00.000Z') })
    await draai()
    expect(boek().map(r => r.soort)).toEqual(['afwijzing'])
  })
  it('binnen 14 dagen terug: wel tegoed', async () => {
    zet({ arnobot_subscriptions: terug('2027-02-10T00:00:00.000Z') })
    await draai()
    expect(boek().map(r => r.soort)).toEqual(['toekenning'])
  })
  it('aanmelding van na het gat telt gewoon', async () => {
    zet({
      approved_users: [gebruiker('aanbrenger'), gebruiker('klant', { trial_start: '2027-02-18T10:00:00.000Z' })],
      arnobot_subscriptions: terug('2027-02-25T00:00:00.000Z'), arnobot_referrals: [{ ...referral, created_at: '2027-02-18T10:00:00.000Z' }], arnobot_payments: [jaar('klant', { betaald_at: '2027-02-20T10:00:00.000Z' })],
    })
    await draai()
    expect(boek().map(r => r.soort)).toEqual(['toekenning'])
  })
  it('eerste abonnement pas na de proef plus 15 dagen: geen tegoed', async () => {
    zet({ arnobot_subscriptions: [sub('aanbrenger', { created_at: '2027-02-20T10:00:00.000Z', periode_start: '2027-02-20T10:00:00.000Z' }), klantSub()] })
    await draai()
    expect(boek().map(r => r.soort)).toEqual(['afwijzing'])
  })
  it('een toekenning vervalt ook als het gat en de terugkeer tussen twee runs vallen', async () => {
    await draai()
    h.tabellen.arnobot_subscriptions = [
      soloGestopt('2027-03-05T00:00:00.000Z'), sub('aanbrenger', { id: 'nieuw', created_at: '2027-04-10T00:00:00.000Z', periode_start: '2027-04-10T00:00:00.000Z' }), klantSub(),
    ]
    await draai(new Date('2027-04-11T06:00:00.000Z'))
    expect(boek().map(r => r.soort)).toEqual(['toekenning', 'verval'])
  })
})

describe('eerder met de hand op betaald: een gat is niet zeker', () => {
  const log = [{ doel_user_id: 'aanbrenger', actie: 'betaald_gezet' }]
  const metGat = [
    soloGestopt('2027-02-01T00:00:00.000Z'), sub('aanbrenger', { id: 'nieuw', created_at: '2027-02-25T00:00:00.000Z', periode_start: '2027-02-25T00:00:00.000Z' }), klantSub(),
  ]
  it('niet afwijzen maar zelf beoordelen', async () => {
    zet({ arnobot_subscriptions: metGat, arnobot_admin_log: log })
    await draai()
    expect(boek().map(r => r.soort)).toEqual(['handwerk'])
  })
  it('een toekenning vervalt niet om zo een gat, Arno krijgt het een keer als handwerk', async () => {
    zet({ arnobot_admin_log: log })
    await draai()
    h.tabellen.arnobot_subscriptions = metGat
    await draai()
    await draai()
    expect(boek().map(r => r.event_key)).toEqual(['uitkomst:r1', 'verval-handwerk:r1'])
    expect(saldoPerAanbrenger(boek() as any).get('aanbrenger')).toBe(1900)
  })
})

describe('handmatige toekenning', () => {
  const metGat = () => [
    soloGestopt('2027-02-01T00:00:00.000Z'), sub('aanbrenger', { id: 'nieuw', created_at: '2027-02-25T00:00:00.000Z', periode_start: '2027-02-25T00:00:00.000Z' }), klantSub(),
  ]
  const besloten = (extra: Rij[] = []) => zet({
    arnobot_subscriptions: metGat(),
    arnobot_referral_grootboek: [
      { event_key: 'uitkomst:r1', meeloop: true, soort: 'toekenning', referral_id: 'r1', aanbrenger_user_id: 'aanbrenger', klant_user_id: 'klant', netto_cent: 1900, reden: 'handmatig besluit: akkoord', klant_maand_netto_cent: 1900, created_at: '2027-02-28T10:00:00.000Z' },
      ...extra,
    ],
  })
  it('vervalt niet om een gat van voor het besluit', async () => {
    besloten()
    await draai()
    expect(boek().map(r => r.soort)).toEqual(['toekenning'])
  })
  it('vervalt wel als de aanbrenger daarna stopt', async () => {
    besloten()
    h.tabellen.arnobot_subscriptions = [soloGestopt('2027-03-05T00:00:00.000Z'), klantSub()]
    await draai(new Date('2027-03-25T06:00:00.000Z'))
    expect(boek().map(r => r.soort)).toEqual(['toekenning', 'verval'])
  })
})

describe('E7 geanonimiseerd account', () => {
  const anoniem = (id: string) => gebruiker(id, { email: null, is_active: false })
  it('aanbrenger: tegoed vervalt', async () => {
    await draai()
    h.tabellen.approved_users = [anoniem('aanbrenger'), gebruiker('klant')]
    await draai()
    expect(boek().map(r => r.soort)).toEqual(['toekenning', 'verval'])
  })
  it('nieuwe gebruiker: zelf beoordelen', async () => {
    zet({ approved_users: [gebruiker('aanbrenger'), anoniem('klant')] })
    await draai()
    expect(boek().map(r => r.soort)).toEqual(['handwerk'])
  })
})

describe('E8 handmatig besluit', () => {
  const metDeHand = () => zet({ approved_users: [gebruiker('aanbrenger', { paid_at: '2027-01-01T00:00:00.000Z' }), gebruiker('klant')], arnobot_subscriptions: [klantSub()] })
  it('na handwerk beslist de cron nooit meer zelf, ook niet als de feiten veranderen', async () => {
    metDeHand()
    await draai()
    h.tabellen.approved_users = [gebruiker('aanbrenger'), gebruiker('klant')]
    h.tabellen.arnobot_subscriptions.push(sub('aanbrenger'))
    const run = await draai()
    expect(run.referrals[0].stand).toBe('handwerk_open')
    expect(boek().map(r => r.soort)).toEqual(['handwerk'])
  })
  it('toekennen: een keer, daarna definitief', async () => {
    metDeHand()
    await draai()
    expect(await legBesluitVast('r1', { besluit: 'toekennen', nettoCent: 1900, toelichting: 'bank gezien' })).toMatchObject({ ok: true })
    expect(boek()[1]).toMatchObject({ soort: 'toekenning', netto_cent: 1900, event_key: 'uitkomst:r1', meeloop: true })
    expect(await legBesluitVast('r1', { besluit: 'afwijzen', nettoCent: null, toelichting: 'toch niet' })).toMatchObject({ ok: false, status: 409 })
    expect((await draai()).referrals[0].stand).toBe('afgehandeld')
  })
  it('afwijzen legt nul vast', async () => {
    metDeHand()
    await draai()
    await legBesluitVast('r1', { besluit: 'afwijzen', nettoCent: 5000, toelichting: 'niet betaald' })
    expect(boek()[1]).toMatchObject({ soort: 'afwijzing', netto_cent: 0 })
  })
  it('niet zonder toelichting, bedrag of open handwerk', async () => {
    metDeHand()
    await draai()
    expect(await legBesluitVast('r1', { besluit: 'toekennen', nettoCent: null, toelichting: 'x' })).toMatchObject({ status: 400 })
    expect(await legBesluitVast('r1', { besluit: 'toekennen', nettoCent: 1900, toelichting: '  ' })).toMatchObject({ status: 400 })
    expect(await legBesluitVast('r9', { besluit: 'afwijzen', nettoCent: null, toelichting: 'x' })).toMatchObject({ status: 404 })
  })
})

describe('besluit 1: teamfactuur binnen de termijn aangemaakt', () => {
  // Klant is manager. Eerste proef eindigt 31 januari, uiterlijk 10 februari.
  const klantTeam = (extra: Rij) => zet({
    approved_users: [gebruiker('aanbrenger'), gebruiker('klant', { command_manager: true })],
    arnobot_subscriptions: [sub('aanbrenger')], arnobot_payments: [],
    arnobot_teams: [team({ manager_id: 'klant' })],
    arnobot_team_facturen: [factuur({ cyclus: 'jaarlijks', periode_einde: '2028-02-09', periode_start: '2027-02-09', created_at: '2027-02-09T06:00:00.000Z', ...extra })],
  })
  it('betaald na de termijn van de proef maar binnen de factuurtermijn: telt', async () => {
    klantTeam({ betaald_at: '2027-02-22T10:00:00.000Z' })
    await draai()
    expect(boek().map(r => r.soort)).toEqual(['toekenning'])
  })
  it('betaald na de factuurtermijn: te laat', async () => {
    klantTeam({ betaald_at: '2027-02-27T10:00:00.000Z' })
    await draai()
    expect(boek().map(r => r.soort)).toEqual(['afwijzing'])
  })
  it('factuur na proef plus 10 dagen aangemaakt: te laat', async () => {
    klantTeam({ created_at: '2027-02-12T06:00:00.000Z', betaald_at: '2027-02-13T10:00:00.000Z' })
    await draai()
    expect(boek().map(r => r.soort)).toEqual(['afwijzing'])
  })
})

describe('besluit 3: de eerste proefperiode telt', () => {
  it('een tweede proef opent de termijn niet opnieuw', async () => {
    zet({
      approved_users: [gebruiker('aanbrenger'), gebruiker('klant', { trial_start: '2027-02-20T10:00:00.000Z', trial_reactivated_at: '2027-02-20T10:00:00.000Z', eerste_proef_start: '2027-01-01T10:00:00.000Z' })],
      arnobot_payments: [jaar('klant', { betaald_at: '2027-02-25T10:00:00.000Z' })],
    })
    await draai()
    expect(boek().map(r => r.soort)).toEqual(['afwijzing'])
  })
})

describe('besluit 4: Lifetime', () => {
  const lifetime = () => gebruiker('aanbrenger', { lifetime_sinds: '2027-01-02T00:00:00.000Z' })
  it('zonder abonnement na de termijn: toekennen zonder bedrag, niet laten vervallen', async () => {
    zet({ approved_users: [lifetime(), gebruiker('klant')], arnobot_subscriptions: [klantSub()] })
    await draai(new Date('2027-06-01T06:00:00.000Z'))
    await draai(new Date('2027-09-01T06:00:00.000Z'))
    expect(boek().map(r => r.soort)).toEqual(['toekenning'])
    expect(boek()[0].netto_cent).toBeNull()
  })
  it('betaald abonnement gestopt: tegoed blijft', async () => {
    zet({ approved_users: [lifetime(), gebruiker('klant')] })
    await draai()
    h.tabellen.arnobot_subscriptions = [soloGestopt('2027-03-05T00:00:00.000Z'), klantSub()]
    await draai(new Date('2027-06-01T06:00:00.000Z'))
    expect(boek().map(r => r.soort)).toEqual(['toekenning'])
  })
})

describe('lopende terugbetaling (amountRefunded is dan nog 0)', () => {
  const terug = (status: string) => ({ tr_klant: [{ id: 're_1', status, amount: { currency: 'EUR', value: '10.00' } }] })
  it.each(['queued', 'pending', 'processing', 'refunded'])('%s: niet toekennen', async status => {
    h.terugbetalingen = terug(status)
    const run = await draai()
    expect(uitkomst(run)).toMatchObject({ uitkomst: 'wacht' })
    expect(boek()).toHaveLength(0)
  })
  it.each(['failed', 'canceled'])('%s telt niet', async status => {
    h.terugbetalingen = terug(status)
    await draai()
    expect(boek().map(r => r.soort)).toEqual(['toekenning'])
  })
  it('Mollie niet te bereiken: fout, morgen opnieuw', async () => {
    h.mollieFout = true
    const run = await draai()
    expect(run.fouten).toHaveLength(1)
    expect(boek()).toHaveLength(0)
  })
})

describe('bedragen uit wat er echt is afgesproken', () => {
  it('een oude prijs van de klant blijft gelden, niet de huidige prijslijst', async () => {
    zet({ arnobot_subscriptions: [sub('aanbrenger'), sub('klant', { plan: 'basis', cyclus: 'jaarlijks', klant_type: 'zakelijk', bedrag_cent: 14520, btw_cent: 2520 })] })
    await draai()
    expect(boek()[0].netto_cent).toBe(1000)
  })
  it('de referral fee op de eerste betaling verlaagt het tegoed niet', async () => {
    zet({ arnobot_payments: [jaar('klant', { bedrag_cent: 25289, btw_cent: 4389 })] })
    await draai()
    expect(boek()[0].netto_cent).toBe(1900)
  })
  it('ontbrekende btw: fout in plaats van een onzinbedrag', async () => {
    zet({ arnobot_subscriptions: [sub('aanbrenger', { btw_cent: undefined }), klantSub()] })
    const run = await draai()
    expect(run.fouten).toHaveLength(1)
    expect(boek()).toHaveLength(0)
  })
})

// ── Hercontrole ronde 2: met rijen zoals de app ze echt wegschrijft ──

const netto = (plan: Plan, cyclus: Cyclus, klant: KlantType) => {
  const p = prijs(plan, cyclus, klant)
  return Math.round((p.bedrag_cent - p.btw_cent) / (cyclus === 'jaarlijks' ? 12 : 1))
}
const bijbetaling = (wie: string, extra: Rij = {}): Rij => ({
  id: `up_${wie}`, user_id: wie, mollie_payment_id: `tr_up_${wie}`, subscription_id: `sub_${wie}`, soort: 'upgrade', status: 'paid',
  bedrag_cent: 10000, btw_cent: 1736, terugbetaald_cent: 0, teruggeboekt_cent: 0, terugbetaling_verwerkt_at: null, betaald_at: '2027-02-01T10:00:00.000Z', ...extra,
})
/** Zo laat overstap.ts de rij achter: plan al Pro, bedrag en btw nog Basic, de Pro-prijs in gepland_*. */
const directeUpgrade = (wie: string, cyclus: Cyclus, klant: KlantType, extra: Rij = {}) => sub(wie, {
  plan: 'premium', cyclus, klant_type: klant, ...prijs('basis', cyclus, klant),
  gepland_plan: 'premium', gepland_cyclus: cyclus,
  gepland_bedrag_cent: prijs('premium', cyclus, klant).bedrag_cent, gepland_btw_cent: prijs('premium', cyclus, klant).btw_cent, ...extra,
})
/** Na opzeggen wist opzeggen.ts de gepland-kolommen. */
const zonderGepland = { gepland_plan: null, gepland_cyclus: null, gepland_bedrag_cent: null, gepland_btw_cent: null, status: 'cancelled' }

describe('1 bedrag na een directe upgrade', () => {
  const proAanbrenger = () => sub('aanbrenger', { plan: 'premium', cyclus: 'jaarlijks', klant_type: 'zakelijk' })
  it.each([['met geplande Pro-prijs', {}], ['na opzeggen', zonderGepland]])('klant per jaar, %s: Pro-prijs', async (_naam, extra) => {
    zet({ arnobot_subscriptions: [proAanbrenger(), directeUpgrade('klant', 'jaarlijks', 'zakelijk', extra)], arnobot_payments: [jaar('klant'), bijbetaling('klant')] })
    await draai()
    expect(boek()[0]).toMatchObject({ netto_cent: netto('premium', 'jaarlijks', 'zakelijk'), klant_maand_netto_cent: netto('premium', 'jaarlijks', 'zakelijk') })
  })
  it.each([['met geplande Pro-prijs', {}], ['na opzeggen', zonderGepland]])('aanbrenger per maand, %s: plafond is Pro', async (_naam, extra) => {
    zet({
      arnobot_subscriptions: [directeUpgrade('aanbrenger', 'maandelijks', 'particulier', extra), sub('klant', { plan: 'premium', cyclus: 'jaarlijks', klant_type: 'zakelijk' })],
      arnobot_payments: [jaar('klant', { plan: 'premium', ...prijs('premium', 'jaarlijks', 'zakelijk') }), bijbetaling('aanbrenger')],
    })
    await draai()
    expect(boek()[0].netto_cent).toBe(Math.min(netto('premium', 'maandelijks', 'particulier'), netto('premium', 'jaarlijks', 'zakelijk')))
    expect(boek()[0].netto_cent).toBeGreaterThan(netto('basis', 'maandelijks', 'particulier'))
  })
  it('upgrade zonder bijbetaling (geen betaalrij) telt als Pro', async () => {
    zet({ arnobot_subscriptions: [proAanbrenger(), directeUpgrade('klant', 'jaarlijks', 'zakelijk')] })
    await draai()
    expect(boek()[0].klant_maand_netto_cent).toBe(netto('premium', 'jaarlijks', 'zakelijk'))
  })
  it('deelterugbetaling op de bijbetaling: nog steeds Pro', async () => {
    zet({ arnobot_subscriptions: [proAanbrenger(), directeUpgrade('klant', 'jaarlijks', 'zakelijk')], arnobot_payments: [jaar('klant'), bijbetaling('klant', { terugbetaald_cent: 100 })] })
    await draai()
    expect(boek()[0].klant_maand_netto_cent).toBe(netto('premium', 'jaarlijks', 'zakelijk'))
  })
  it('Basic per jaar met referral fee zonder passende rij: toch de volle maandprijs', async () => {
    const fee = { bedrag_cent: 25289, btw_cent: 4389 }
    zet({ arnobot_subscriptions: [sub('aanbrenger'), sub('klant', { plan: 'premium', cyclus: 'maandelijks' })], arnobot_payments: [jaar('klant', fee)] })
    await draai()
    expect(boek()[0].klant_maand_netto_cent).toBe(netto('basis', 'jaarlijks', 'zakelijk'))
  })
})

describe('2 eerste teamfactuur leidt tot een blokkade', () => {
  const open = () => factuur({ status: 'open', betaald_at: null })
  const naBlokkade = () => ({
    arnobot_subscriptions: [soloGestopt('2027-02-01T00:00:00.000Z'), klantSub()],
    arnobot_teams: [team({ geblokkeerd_at: '2027-03-18T06:00:00.000Z' })], arnobot_team_facturen: [open()],
  })
  it('wachtende referral: 30 dagen stil, daarna afgewezen', async () => {
    zet(naBlokkade())
    await draai(new Date('2027-03-19T06:00:00.000Z'))
    await draai(new Date('2027-04-16T06:00:00.000Z'))
    expect(boek()).toHaveLength(0)
    await draai(new Date('2027-04-19T06:00:00.000Z'))
    expect(boek().map(r => r.soort)).toEqual(['afwijzing'])
  })
  it('bestaande toekenning: niet vervallen op de dag van de blokkade', async () => {
    await draai()
    Object.assign(h.tabellen, naBlokkade())
    await draai(new Date('2027-03-19T06:00:00.000Z'))
    expect(boek().map(r => r.soort)).toEqual(['toekenning'])
  })
})

describe('3 handmatige toekenning blijft staan', () => {
  it('niet vervallen om een einde van voor het besluit, ook niet als de BETAALD-vlag gewist is', async () => {
    zet({
      arnobot_subscriptions: [soloGestopt('2027-01-31T00:00:00.000Z'), klantSub()],
      arnobot_admin_log: [{ doel_user_id: 'aanbrenger', actie: 'betaald_gezet' }],
      arnobot_referral_grootboek: [{ event_key: 'uitkomst:r1', meeloop: true, soort: 'toekenning', referral_id: 'r1', aanbrenger_user_id: 'aanbrenger', klant_user_id: 'klant', netto_cent: 1900, reden: 'handmatig besluit: bank gezien', klant_maand_netto_cent: 1900, created_at: '2027-02-28T10:00:00.000Z' }],
    })
    await draai()
    await draai(new Date('2027-06-01T06:00:00.000Z'))
    expect(boek().map(r => r.soort)).toEqual(['toekenning'])
  })
  it('ook zonder dat adminlog: een oud einde telt niet', async () => {
    zet({
      arnobot_subscriptions: [soloGestopt('2027-01-31T00:00:00.000Z'), klantSub()],
      arnobot_referral_grootboek: [{ event_key: 'uitkomst:r1', meeloop: true, soort: 'toekenning', referral_id: 'r1', aanbrenger_user_id: 'aanbrenger', klant_user_id: 'klant', netto_cent: 1900, reden: 'handmatig besluit: akkoord', klant_maand_netto_cent: 1900, created_at: '2027-02-28T10:00:00.000Z' }],
    })
    await draai()
    expect(boek().map(r => r.soort)).toEqual(['toekenning'])
  })
})

describe('4 en 5 eerder per bank betaald', () => {
  const logVan = (wie: string) => [{ doel_user_id: wie, actie: 'betaald_gezet' }]
  it('aanbrenger: einde van voor de aanmelding, daarna per bank en toen gratis: niet afwijzen', async () => {
    zet({ arnobot_subscriptions: [soloGestopt('2026-12-15T00:00:00.000Z', { created_at: '2026-11-15T00:00:00.000Z' }), klantSub()], arnobot_admin_log: logVan('aanbrenger') })
    await draai()
    expect(boek().map(r => r.soort)).toEqual(['handwerk'])
  })
  it('klant: op tijd per bank, later online: niet afwijzen als te laat', async () => {
    zet({ arnobot_payments: [jaar('klant', { betaald_at: '2027-04-10T10:00:00.000Z', periode_start: '2027-04-10T10:00:00.000Z' })], arnobot_admin_log: logVan('klant') })
    await draai(new Date('2027-04-11T06:00:00.000Z'))
    expect(boek().map(r => r.soort)).toEqual(['handwerk'])
  })
})

describe('6 en 7 de eerste echte proef', () => {
  it('aanbrenger: een tweede proef maakt een gemiste termijn niet ongedaan', async () => {
    zet({
      approved_users: [gebruiker('aanbrenger', { trial_start: '2027-09-01T00:00:00.000Z', trial_reactivated_at: '2027-09-01T00:00:00.000Z', eerste_proef_start: '2027-01-01T10:00:00.000Z' }), gebruiker('klant')],
      arnobot_subscriptions: [sub('aanbrenger', { created_at: '2027-09-10T00:00:00.000Z', periode_start: '2027-09-10T00:00:00.000Z', periode_einde: '2027-12-01T00:00:00.000Z' }), klantSub()],
    })
    await draai(new Date('2027-09-15T06:00:00.000Z'))
    expect(boek().map(r => r.soort)).toEqual(['afwijzing'])
  })
  it('klant: de proef die na de intake start telt, niet de aanmelddag', async () => {
    zet({
      approved_users: [gebruiker('aanbrenger'), gebruiker('klant', { trial_start: '2027-01-12T10:00:00.000Z' })],
      arnobot_payments: [jaar('klant', { betaald_at: '2027-02-22T10:00:00.000Z' })],
    })
    await draai()
    expect(boek().map(r => r.soort)).toEqual(['toekenning'])
  })
})

describe('8 oud-teamlid is niet per se gestopt', () => {
  const metGat = () => [soloGestopt('2027-02-01T00:00:00.000Z'), sub('aanbrenger', { id: 'nieuw', created_at: '2027-05-01T00:00:00.000Z', periode_start: '2027-05-01T00:00:00.000Z', periode_einde: '2027-07-01T00:00:00.000Z' }), klantSub()]
  const oudLid = () => [gebruiker('aanbrenger', { ooit_teamlid_at: '2027-02-01T00:00:00.000Z' }), gebruiker('klant')]
  it('wachtende referral: zelf beoordelen', async () => {
    zet({ approved_users: oudLid(), arnobot_subscriptions: metGat() })
    await draai(new Date('2027-05-02T06:00:00.000Z'))
    expect(boek().map(r => r.soort)).toEqual(['handwerk'])
  })
  it('bestaande toekenning: niet vervallen', async () => {
    await draai()
    h.tabellen.approved_users = oudLid()
    h.tabellen.arnobot_subscriptions = metGat()
    await draai(new Date('2027-05-02T06:00:00.000Z'))
    expect(boek().map(r => r.event_key)).toEqual(['uitkomst:r1', 'verval-handwerk:r1'])
  })
})

describe('11 anonimiseren', () => {
  it('naam en e-mailadres leeg, nog actief: toch niet meer bestaand', async () => {
    await draai()
    h.tabellen.approved_users = [gebruiker('aanbrenger', { email: null, voornaam: null }), gebruiker('klant')]
    await draai()
    expect(boek().map(r => r.soort)).toEqual(['toekenning', 'verval'])
  })
  it('alleen geen e-mailadres is niet geanonimiseerd', async () => {
    zet({ approved_users: [gebruiker('aanbrenger', { email: null, voornaam: 'Sam', is_active: false }), gebruiker('klant')] })
    await draai()
    expect(boek().map(r => r.soort)).toEqual(['toekenning'])
  })
})

describe('14 Lifetime randgevallen', () => {
  it('termijn al verlopen voor Lifetime: geen tegoed', async () => {
    zet({ approved_users: [gebruiker('aanbrenger', { lifetime_sinds: '2027-02-20T00:00:00.000Z' }), gebruiker('klant')], arnobot_subscriptions: [klantSub()] })
    await draai()
    expect(boek().map(r => r.soort)).toEqual(['afwijzing'])
  })
  it('Lifetime met de BETAALD-vlag: geen handwerk', async () => {
    zet({ approved_users: [gebruiker('aanbrenger', { lifetime_sinds: '2027-01-02T00:00:00.000Z', paid_at: '2027-01-02T00:00:00.000Z' }), gebruiker('klant')], arnobot_subscriptions: [klantSub()] })
    await draai()
    expect(boek().map(r => r.soort)).toEqual(['toekenning'])
  })
})
