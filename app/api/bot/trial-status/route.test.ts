import { describe, it, expect, vi, beforeEach } from 'vitest'

// De balk onderin de app: voor een gewone gebruiker "je proef loopt af" (laatste 5 dagen), voor de manager van een gratis
// agent-proef "je teamproef loopt af of is afgelopen" (laatste 5 dagen en de coulance), voor niemand anders iets.

type Rij = Record<string, unknown>
const { db, auth, stand, gedekt } = vi.hoisted(() => ({
  db: { approved_users: [] as Rij[] },
  auth: vi.fn(),
  stand: vi.fn(),
  gedekt: vi.fn(),
}))

function bouwer() {
  const filters: ((r: Rij) => boolean)[] = []
  const b: Record<string, unknown> = {}
  b.select = () => b
  b.eq = (k: string, v: unknown) => { filters.push(r => r[k] === v); return b }
  b.maybeSingle = () => Promise.resolve({ data: db.approved_users.find(r => filters.every(f => f(r))) ?? null, error: null })
  return b
}

vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ from: bouwer }) }))
vi.mock('@clerk/nextjs/server', () => ({ auth }))
vi.mock('@/lib/teamAccess', () => ({ isTeamCovered: gedekt }))
vi.mock('@/lib/teamActivatie', () => ({ leesActivatieStand: stand }))

const { GET } = await import('./route')

const nu = Date.now()
const dagen = (d: number) => new Date(nu + d * 86_400_000).toISOString()
const manager = (o: Rij = {}) => { db.approved_users = [{ user_id: 'u1', is_active: true, trial_start: dagen(-10), paid_at: null, expires_at: null, command_manager: true, ...o }] }
const proef = (staat: string, dagenTot: number) => ({ kanActiveren: true, proef: { einde: dagen(0), toegangTot: dagen(10), dagen: dagenTot, staat } })

beforeEach(() => {
  db.approved_users = []
  auth.mockReset(); stand.mockReset(); gedekt.mockReset()
  auth.mockResolvedValue({ userId: 'u1' })
  gedekt.mockResolvedValue(false)
  stand.mockResolvedValue(null)
})

describe('trial-status voor een gewone gebruiker', () => {
  it('geeft de resterende dagen in de laatste 5 dagen van de proef', async () => {
    db.approved_users = [{ user_id: 'u1', is_active: true, trial_start: dagen(-27), paid_at: null, expires_at: null, command_manager: false }]
    expect(await (await GET()).json()).toEqual({ dagenOver: 3 })
  })
  it('geeft niets eerder in de proef', async () => {
    db.approved_users = [{ user_id: 'u1', is_active: true, trial_start: dagen(-10), paid_at: null, expires_at: null, command_manager: false }]
    expect(await (await GET()).json()).toEqual({ dagenOver: null })
  })
  it('geeft niets aan een teamlid, een gedeactiveerd account of iemand die niet is ingelogd', async () => {
    db.approved_users = [{ user_id: 'u1', is_active: true, trial_start: dagen(-27), paid_at: null, expires_at: null, command_manager: false }]
    gedekt.mockResolvedValue(true)
    expect(await (await GET()).json()).toEqual({ dagenOver: null })
    db.approved_users[0].is_active = false
    expect(await (await GET()).json()).toEqual({ dagenOver: null })
    auth.mockResolvedValue({ userId: null })
    expect((await GET()).status).toBe(401)
  })
})

describe('trial-status voor de manager van een agent-proef', () => {
  it('geeft de teamproef in de laatste 5 dagen', async () => {
    manager()
    stand.mockResolvedValue(proef('bijna', 3))
    const d = await (await GET()).json()
    expect(d.dagenOver).toBeNull()
    expect(d.teamProef).toMatchObject({ staat: 'bijna', dagen: 3 })
  })
  it('geeft de teamproef in de coulance, met tot wanneer het team toegang houdt', async () => {
    manager()
    stand.mockResolvedValue(proef('coulance', 7))
    const d = await (await GET()).json()
    expect(d.teamProef).toMatchObject({ staat: 'coulance', dagen: 7 })
    expect(d.teamProef.toegangTot).toBeTypeOf('string')
  })
  it('geeft niets eerder in de proef, en niets als het team al is geblokkeerd (hij landt dan op zijn accountpagina)', async () => {
    manager()
    stand.mockResolvedValue(proef('loopt', 20))
    expect(await (await GET()).json()).toEqual({ dagenOver: null })
    stand.mockResolvedValue(proef('verlopen', 0))
    expect(await (await GET()).json()).toEqual({ dagenOver: null })
  })
  it('geeft niets aan een manager die niet kan activeren (geen proef, bijvoorbeeld een betalend team)', async () => {
    manager()
    stand.mockResolvedValue({ kanActiveren: false, proef: null })
    expect(await (await GET()).json()).toEqual({ dagenOver: null })
    stand.mockResolvedValue(null)
    expect(await (await GET()).json()).toEqual({ dagenOver: null })
  })
  it('raakt de proefstatus van een gewone gebruiker niet aan (de teamstand wordt dan niet eens opgehaald)', async () => {
    db.approved_users = [{ user_id: 'u1', is_active: true, trial_start: dagen(-27), paid_at: null, expires_at: null, command_manager: false }]
    await GET()
    expect(stand).not.toHaveBeenCalled()
  })
})
