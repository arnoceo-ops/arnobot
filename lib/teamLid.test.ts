import { describe, it, expect, vi, beforeEach } from 'vitest'

// Bewijst de regels rond een teamlid: wanneer een team zijn toegang nog dekt, wanneer hij een eigen abonnement heeft,
// en dat zijn plan na verwijderen uit het team gelijk wordt aan wat hij zelf betaalt.

type Rij = Record<string, unknown>
const { db } = vi.hoisted(() => ({
  db: { arnobot_team_members: [] as Rij[], approved_users: [] as Rij[], arnobot_subscriptions: [] as Rij[] },
}))

type Tabel = keyof typeof db
function bouwer(tabel: Tabel) {
  const filters: ((r: Rij) => boolean)[] = []
  let op: 'select' | 'update' = 'select'
  let waarden: Rij = {}
  let max = Infinity
  const uitvoer = () => {
    const raak = db[tabel].filter(r => filters.every(f => f(r)))
    if (op === 'update') { raak.forEach(r => Object.assign(r, waarden)); return { data: raak, error: null } }
    return { data: raak.slice(0, max), error: null }
  }
  const b: Record<string, unknown> = {}
  b.select = () => b
  b.eq = (k: string, v: unknown) => { filters.push(r => r[k] === v); return b }
  b.in = (k: string, v: unknown[]) => { filters.push(r => v.includes(r[k])); return b }
  b.order = () => b
  b.limit = (n: number) => { max = n; return b }
  b.returns = () => b
  b.update = (w: Rij) => { op = 'update'; waarden = w; return b }
  b.maybeSingle = () => Promise.resolve({ data: (uitvoer().data as Rij[])[0] ?? null, error: null })
  b.then = (ok: (v: unknown) => unknown) => Promise.resolve(uitvoer()).then(ok)
  return b
}

vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ from: bouwer }) }))

const { isTeamDekkingActief, isTeamCovered } = await import('./teamAccess')
const { heeftEigenAbonnement, herstelPlanNaVerwijderen } = await import('./teamLid')

const nu = new Date('2026-11-15T12:00:00Z')
const dagen = (d: number) => new Date(nu.getTime() + d * 86_400_000).toISOString()

beforeEach(() => {
  db.arnobot_team_members = []; db.approved_users = [{ user_id: 'u1', command_manager: false, plan: 'premium' }]; db.arnobot_subscriptions = []
})

describe('isTeamDekkingActief', () => {
  const lid = (role: string, geblokkeerd: string | null) => { db.arnobot_team_members = [{ user_id: 'u1', role, arnobot_teams: { geblokkeerd_at: geblokkeerd } }] }

  it('dekt een lid van een actief team', async () => {
    lid('member', null)
    expect(await isTeamDekkingActief('u1')).toBe(true)
  })
  it('dekt een lid van een geblokkeerd team niet meer: hij mag zelf afrekenen', async () => {
    lid('member', dagen(-2))
    expect(await isTeamDekkingActief('u1')).toBe(false)
    expect(await isTeamCovered('u1')).toBe(true) // de oude, ruimere check blijft zoals hij was
  })
  it('dekt een manager altijd, ook van een geblokkeerd team (hij activeert op zijn accountpagina)', async () => {
    lid('manager', dagen(-2))
    expect(await isTeamDekkingActief('u1')).toBe(true)
  })
  it('dekt een command_manager zonder team', async () => {
    db.approved_users = [{ user_id: 'u1', command_manager: true }]
    expect(await isTeamDekkingActief('u1')).toBe(true)
  })
  it('dekt iemand zonder team niet', async () => {
    expect(await isTeamDekkingActief('u1')).toBe(false)
  })
})

describe('heeftEigenAbonnement', () => {
  it('is waar bij een lopend online abonnement', async () => {
    db.arnobot_subscriptions = [{ user_id: 'u1', status: 'active' }]
    expect(await heeftEigenAbonnement('u1')).toBe(true)
  })
  it('is onwaar bij een opgezegd, afgebroken of ontbrekend abonnement', async () => {
    db.arnobot_subscriptions = [{ user_id: 'u1', status: 'cancelled' }, { user_id: 'u1', status: 'abandoned' }]
    expect(await heeftEigenAbonnement('u1')).toBe(false)
    db.arnobot_subscriptions = []
    expect(await heeftEigenAbonnement('u1')).toBe(false)
  })
})

describe('herstelPlanNaVerwijderen', () => {
  it('zet het plan gelijk aan een lopend eigen Basic-abonnement', async () => {
    db.arnobot_subscriptions = [{ user_id: 'u1', status: 'active', plan: 'basis', created_at: dagen(-10) }]
    expect(await herstelPlanNaVerwijderen('u1', nu)).toBe('plan_gezet')
    expect(db.approved_users[0].plan).toBe('basis')
  })
  it('telt een opgezegd abonnement met een einddatum in de toekomst ook mee (de betaalperiode loopt nog)', async () => {
    db.arnobot_subscriptions = [{ user_id: 'u1', status: 'cancelled', plan: 'basis', periode_einde: dagen(9), created_at: dagen(-10) }]
    expect(await herstelPlanNaVerwijderen('u1', nu)).toBe('plan_gezet')
    expect(db.approved_users[0].plan).toBe('basis')
  })
  it('laat het plan ongemoeid bij een opgezegd abonnement waarvan de periode voorbij is', async () => {
    db.arnobot_subscriptions = [{ user_id: 'u1', status: 'cancelled', plan: 'basis', periode_einde: dagen(-3), created_at: dagen(-40) }]
    expect(await herstelPlanNaVerwijderen('u1', nu)).toBe('ongewijzigd')
    expect(db.approved_users[0].plan).toBe('premium')
  })
  it('laat het plan ongemoeid zonder eigen abonnement', async () => {
    expect(await herstelPlanNaVerwijderen('u1', nu)).toBe('ongewijzigd')
    expect(db.approved_users[0].plan).toBe('premium')
  })
})
