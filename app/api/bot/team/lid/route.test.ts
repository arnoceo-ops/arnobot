import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Een manager verwijdert een lid uit zijn team: het lidmaatschap verdwijnt en het plan van het lid wordt gelijk aan
// zijn eigen abonnement (lib/teamLid.ts). Een mislukte planherstel breekt het verwijderen niet.

type Rij = Record<string, unknown>
const { db, auth, herstel } = vi.hoisted(() => ({
  db: { arnobot_team_members: [] as Rij[] },
  auth: vi.fn(),
  herstel: vi.fn(),
}))

function bouwer() {
  const filters: ((r: Rij) => boolean)[] = []
  let op: 'select' | 'delete' = 'select'
  const b: Record<string, unknown> = {}
  const uitvoer = () => {
    const raak = db.arnobot_team_members.filter(r => filters.every(f => f(r)))
    if (op === 'delete') { db.arnobot_team_members = db.arnobot_team_members.filter(r => !raak.includes(r)); return { data: raak, error: null } }
    return { data: raak, error: null }
  }
  b.select = () => b
  b.eq = (k: string, v: unknown) => { filters.push(r => r[k] === v); return b }
  b.neq = (k: string, v: unknown) => { filters.push(r => r[k] !== v); return b }
  b.delete = () => { op = 'delete'; return b }
  b.single = () => { const r = (uitvoer().data as Rij[]) ?? []; return Promise.resolve(r.length ? { data: r[0], error: null } : { data: null, error: { message: 'geen rij' } }) }
  b.then = (ok: (v: unknown) => unknown) => Promise.resolve(uitvoer()).then(ok)
  return b
}

vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ from: bouwer }) }))
vi.mock('@clerk/nextjs/server', () => ({ auth, clerkClient: vi.fn() }))
vi.mock('@/lib/teamLid', () => ({ herstelPlanNaVerwijderen: herstel }))

const { DELETE } = await import('./route')
const verwijder = (userId: string) => DELETE(new NextRequest(`https://www.arno.bot/api/bot/team/lid?userId=${userId}`, { method: 'DELETE' }))

beforeEach(() => {
  db.arnobot_team_members = [
    { team_id: 't1', user_id: 'm1', role: 'manager' },
    { team_id: 't1', user_id: 'l1', role: 'member' },
    { team_id: 't2', user_id: 'l2', role: 'member' },
  ]
  auth.mockReset(); herstel.mockReset()
  auth.mockResolvedValue({ userId: 'm1' })
  herstel.mockResolvedValue('plan_gezet')
})

describe('lid verwijderen', () => {
  it('verwijdert het lidmaatschap en zet daarna het plan gelijk aan zijn eigen abonnement', async () => {
    const res = await verwijder('l1')
    expect(res.status).toBe(200)
    expect(db.arnobot_team_members.some(m => m.user_id === 'l1')).toBe(false)
    expect(herstel).toHaveBeenCalledWith('l1')
  })

  it('laat verwijderen slagen als het planherstel mislukt', async () => {
    herstel.mockRejectedValue(new Error('db weg'))
    const res = await verwijder('l1')
    expect(res.status).toBe(200)
    expect(db.arnobot_team_members.some(m => m.user_id === 'l1')).toBe(false)
  })

  it('raakt een lid van een ander team niet aan en herstelt dan ook niets', async () => {
    await verwijder('l2')
    expect(db.arnobot_team_members.some(m => m.user_id === 'l2')).toBe(true)
    expect(herstel).not.toHaveBeenCalled()
  })

  it('verwijdert de manager zelf niet', async () => {
    const res = await verwijder('m1')
    expect(res.status).toBe(400)
    expect(herstel).not.toHaveBeenCalled()
  })

  it('weigert iemand die geen manager is', async () => {
    auth.mockResolvedValue({ userId: 'l1' })
    expect((await verwijder('l2')).status).toBe(403)
    expect(herstel).not.toHaveBeenCalled()
  })
})
