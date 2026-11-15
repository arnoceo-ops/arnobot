import { describe, it, expect, vi, beforeEach } from 'vitest'

// Pint de regels vast waarmee API-routes beslissen of iemand nog toegang heeft: gelijk aan de toegangspoort (proxy.ts).
// Een foutieve uitkomst sluit betalende gebruikers buiten, dus elk soort gebruiker staat hier apart.

type Rij = Record<string, unknown>
const { db, fout } = vi.hoisted(() => ({
  db: { approved_users: [] as Rij[], arnobot_team_members: [] as Rij[] },
  fout: { aan: false, gooi: false },
}))

type Tabel = keyof typeof db
function bouwer(tabel: Tabel) {
  const filters: ((r: Rij) => boolean)[] = []
  const b: Record<string, unknown> = {}
  b.select = () => b
  b.eq = (k: string, v: unknown) => { filters.push(r => r[k] === v); return b }
  b.maybeSingle = () => {
    if (fout.gooi) throw new Error('db weg')
    if (fout.aan) return Promise.resolve({ data: null, error: { message: 'fout' } })
    return Promise.resolve({ data: db[tabel].find(r => filters.every(f => f(r))) ?? null, error: null })
  }
  return b
}
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ from: bouwer }) }))

const { heeftToegangNu } = await import('./toegangNu')

const nu = new Date('2026-11-15T12:00:00Z')
const dagen = (d: number) => new Date(nu.getTime() + d * 86_400_000).toISOString()
const zet = (o: Rij = {}, lid?: { role: string; geblokkeerd: boolean }) => {
  db.approved_users = [{ user_id: 'u1', is_active: true, expires_at: null, paid_at: null, trial_start: dagen(-10), command_manager: false, ...o }]
  db.arnobot_team_members = lid ? [{ user_id: 'u1', role: lid.role, arnobot_teams: { geblokkeerd_at: lid.geblokkeerd ? dagen(-1) : null } }] : []
}

beforeEach(() => { fout.aan = false; fout.gooi = false })

describe('heeftToegangNu: eigen toegang', () => {
  it('laat iemand in zijn proef binnen', async () => {
    zet({ trial_start: dagen(-10) })
    expect(await heeftToegangNu('u1', nu)).toBe(true)
  })
  it('sluit iemand met een afgelopen proef buiten', async () => {
    zet({ trial_start: dagen(-45) })
    expect(await heeftToegangNu('u1', nu)).toBe(false)
  })
  it('laat een betalende gebruiker binnen, ook zonder einddatum (onbeperkt)', async () => {
    zet({ trial_start: dagen(-200), paid_at: dagen(-100) })
    expect(await heeftToegangNu('u1', nu)).toBe(true)
  })
  it('een gezette einddatum is bindend: in het verleden is geen toegang, in de toekomst wel', async () => {
    zet({ trial_start: dagen(-200), paid_at: dagen(-100), expires_at: dagen(-1) })
    expect(await heeftToegangNu('u1', nu)).toBe(false)
    zet({ trial_start: dagen(-200), paid_at: dagen(-100), expires_at: dagen(20) })
    expect(await heeftToegangNu('u1', nu)).toBe(true)
  })
  it('sluit een gedeactiveerd account buiten, ook met een geldige einddatum', async () => {
    zet({ is_active: false, expires_at: dagen(20) })
    expect(await heeftToegangNu('u1', nu)).toBe(false)
  })
})

describe('heeftToegangNu: via een team', () => {
  const verlopen = { trial_start: dagen(-200) }
  it('laat een lid van een actief team binnen, ook met een verlopen eigen proef', async () => {
    zet(verlopen, { role: 'member', geblokkeerd: false })
    expect(await heeftToegangNu('u1', nu)).toBe(true)
  })
  it('sluit een lid van een geblokkeerd team buiten', async () => {
    zet(verlopen, { role: 'member', geblokkeerd: true })
    expect(await heeftToegangNu('u1', nu)).toBe(false)
  })
  it('laat een lid van een geblokkeerd team binnen als zijn eigen toegang nog geldt', async () => {
    zet({ trial_start: dagen(-200), paid_at: dagen(-5), expires_at: dagen(20) }, { role: 'member', geblokkeerd: true })
    expect(await heeftToegangNu('u1', nu)).toBe(true)
  })
  it('laat een manager van een actief team binnen en sluit die van een geblokkeerd team buiten', async () => {
    zet({ ...verlopen, command_manager: true }, { role: 'manager', geblokkeerd: false })
    expect(await heeftToegangNu('u1', nu)).toBe(true)
    zet({ ...verlopen, command_manager: true }, { role: 'manager', geblokkeerd: true })
    expect(await heeftToegangNu('u1', nu)).toBe(false)
  })
  it('laat een command_manager zonder team binnen (zoals de toegangspoort)', async () => {
    zet({ ...verlopen, command_manager: true })
    expect(await heeftToegangNu('u1', nu)).toBe(true)
  })
  it('sluit iemand met een verlopen proef zonder team buiten', async () => {
    zet(verlopen)
    expect(await heeftToegangNu('u1', nu)).toBe(false)
  })
})

describe('heeftToegangNu: onbekend en storing', () => {
  it('laat iemand zonder rij in approved_users door (gedrag van voor deze controle)', async () => {
    db.approved_users = []; db.arnobot_team_members = []
    expect(await heeftToegangNu('onbekend', nu)).toBe(true)
  })
  it('faalt open bij een databasefout of een uitzondering: betalende gebruikers worden nooit buitengesloten door een storing', async () => {
    zet({ trial_start: dagen(-45) })
    fout.aan = true
    expect(await heeftToegangNu('u1', nu)).toBe(true)
    fout.aan = false; fout.gooi = true
    expect(await heeftToegangNu('u1', nu)).toBe(true)
  })
})
