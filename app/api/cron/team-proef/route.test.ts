import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Bewijst de hele cron zonder echte database: alleen een agent-proef van een manager die via een link
// kwam, niet betaalt en nog geen facturatie heeft wordt aangeraakt. Alles anders blijft ongemoeid.

type Rij = Record<string, unknown>
const { db, notify, nieuwMelden } = vi.hoisted(() => ({
  db: { approved_users: [] as Rij[], arnobot_teams: [] as Rij[] },
  notify: vi.fn(),
  nieuwMelden: vi.fn(),
}))

// Minimale in-memory database met precies de ketenmethodes die de cron gebruikt.
function bouwer(tabel: 'approved_users' | 'arnobot_teams') {
  const filters: ((r: Rij) => boolean)[] = []
  let update: Rij | null = null
  const b: Record<string, unknown> = {}
  b.select = () => b
  b.eq = (k: string, v: unknown) => { filters.push(r => r[k] === v); return b }
  b.neq = (k: string, v: unknown) => { filters.push(r => r[k] !== v); return b }
  b.is = (k: string, v: null) => { filters.push(r => (r[k] ?? null) === v); return b }
  b.in = (k: string, v: unknown[]) => { filters.push(r => v.includes(r[k])); return b }
  b.not = () => b // testaccounts: in deze test staan er geen
  b.update = (waarden: Rij) => { update = waarden; return b }
  b.then = (ok: (v: unknown) => unknown) => {
    const rijen = db[tabel].filter(r => filters.every(f => f(r)))
    if (update) { for (const r of rijen) Object.assign(r, update); return Promise.resolve({ data: null, error: null }).then(ok) }
    return Promise.resolve({ data: rijen, error: null }).then(ok)
  }
  return b
}

vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ from: bouwer }) }))
vi.mock('@/lib/cron-notify', () => ({ notifyTelegram: notify, notifyCronFailure: vi.fn() }))
vi.mock('@/lib/capaciteit', () => ({ nieuwMelden }))
vi.mock('@/lib/adminLog', () => ({ logAdminActie: vi.fn() }))
vi.mock('@/lib/cronRun', () => ({ registreerCronRun: (_pad: string, handler: unknown) => handler }))
process.env.CRON_SECRET = 'geheim'

const { GET } = await import('./route')
const aanroep = (geheim = 'geheim') => GET(new NextRequest('https://www.arno.bot/api/cron/team-proef', { headers: { authorization: `Bearer ${geheim}` } }))

const dagenGeleden = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString()
const manager = (id: string, o: Rij = {}): Rij => ({
  user_id: id, email: `${id}@x.nl`, voornaam: id, trial_start: dagenGeleden(10), expires_at: null, paid_at: null,
  sd_attribution_method: 'link', command_manager: true, ...o,
})
const team = (id: string, managerId: string, o: Rij = {}): Rij => ({ id, name: `Team ${id}`, manager_id: managerId, min_seats: null, geblokkeerd_at: null, ...o })

beforeEach(() => {
  db.approved_users = []
  db.arnobot_teams = []
  notify.mockReset()
  nieuwMelden.mockReset()
  nieuwMelden.mockResolvedValue(true)
})

describe('cron/team-proef', () => {
  it('weigert zonder het juiste CRON_SECRET', async () => {
    expect((await aanroep('fout')).status).toBe(401)
  })

  it('blokkeert het team als de proef van 30 dagen voorbij is', async () => {
    db.approved_users = [manager('m1', { trial_start: dagenGeleden(31) })]
    db.arnobot_teams = [team('t1', 'm1')]
    const res = await (await aanroep()).json()
    expect(res.beeindigd).toEqual(['m1'])
    expect(db.arnobot_teams[0].geblokkeerd_at).toBeTypeOf('string')
    expect(notify).toHaveBeenCalledOnce()
    expect(notify.mock.calls[0][0]).toContain('Team t1')
  })

  it('laat een lopende proef met meer dan 5 dagen met rust', async () => {
    db.approved_users = [manager('m1', { trial_start: dagenGeleden(10) })]
    db.arnobot_teams = [team('t1', 'm1')]
    await aanroep()
    expect(db.arnobot_teams[0].geblokkeerd_at).toBeNull()
    expect(notify).not.toHaveBeenCalled()
  })

  it('waarschuwt Arno vijf dagen of minder voor het einde en blokkeert dan nog niet', async () => {
    db.approved_users = [manager('m1', { trial_start: dagenGeleden(26) })]
    db.arnobot_teams = [team('t1', 'm1')]
    const res = await (await aanroep()).json()
    expect(res.gewaarschuwd).toEqual(['m1'])
    expect(db.arnobot_teams[0].geblokkeerd_at).toBeNull()
    expect(notify.mock.calls[0][0]).toContain('loopt over')
  })

  it('waarschuwt niet opnieuw als die melding al is gedaan (dubbele-meldingsbeveiliging)', async () => {
    nieuwMelden.mockResolvedValue(false)
    db.approved_users = [manager('m1', { trial_start: dagenGeleden(26) })]
    db.arnobot_teams = [team('t1', 'm1')]
    await aanroep()
    expect(notify).not.toHaveBeenCalled()
  })

  it('raakt een team met facturatie (min. seats gevuld) nooit aan, ook niet na 30 dagen', async () => {
    db.approved_users = [manager('m1', { trial_start: dagenGeleden(90) })]
    db.arnobot_teams = [team('t1', 'm1', { min_seats: 5 })]
    await aanroep()
    expect(db.arnobot_teams[0].geblokkeerd_at).toBeNull()
    expect(notify).not.toHaveBeenCalled()
  })

  it('raakt een manager die zelf betaalt niet aan', async () => {
    db.approved_users = [manager('m1', { trial_start: dagenGeleden(90), paid_at: dagenGeleden(5) })]
    db.arnobot_teams = [team('t1', 'm1')]
    await aanroep()
    expect(db.arnobot_teams[0].geblokkeerd_at).toBeNull()
  })

  it('raakt een manager die niet via een agent-link kwam niet aan (handmatig of geen agent)', async () => {
    db.approved_users = [manager('m1', { trial_start: dagenGeleden(90), sd_attribution_method: 'manual' }), manager('m2', { trial_start: dagenGeleden(90), sd_attribution_method: null })]
    db.arnobot_teams = [team('t1', 'm1'), team('t2', 'm2')]
    await aanroep()
    expect(db.arnobot_teams.every(t => t.geblokkeerd_at === null)).toBe(true)
  })

  it('een handmatig verlengde einddatum gaat voor op de 30 dagen', async () => {
    db.approved_users = [manager('m1', { trial_start: dagenGeleden(90), expires_at: new Date(Date.now() + 20 * 86_400_000).toISOString() })]
    db.arnobot_teams = [team('t1', 'm1')]
    await aanroep()
    expect(db.arnobot_teams[0].geblokkeerd_at).toBeNull()
    expect(notify).not.toHaveBeenCalled()
  })

  it('een team dat al geblokkeerd is wordt niet opnieuw gemeld', async () => {
    db.approved_users = [manager('m1', { trial_start: dagenGeleden(40) })]
    db.arnobot_teams = [team('t1', 'm1', { geblokkeerd_at: dagenGeleden(2) })]
    const res = await (await aanroep()).json()
    expect(res.beeindigd).toEqual([])
    expect(notify).not.toHaveBeenCalled()
  })

  it('trekt command_manager in bij een verlopen proef zonder team', async () => {
    db.approved_users = [manager('m1', { trial_start: dagenGeleden(35) })]
    const res = await (await aanroep()).json()
    expect(res.beeindigd).toEqual(['m1'])
    expect(db.approved_users[0].command_manager).toBe(false)
    expect(notify.mock.calls[0][0]).toContain('geen team')
  })

  it('draait de volgende dag niet opnieuw voor dezelfde manager zonder team', async () => {
    db.approved_users = [manager('m1', { trial_start: dagenGeleden(35) })]
    await aanroep()
    notify.mockReset()
    await aanroep()
    expect(notify).not.toHaveBeenCalled()
  })
})
