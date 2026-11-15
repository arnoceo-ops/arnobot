import { describe, it, expect, vi, beforeEach } from 'vitest'

// Wie mag zelf een abonnement opzeggen? Een gewoon teamlid heeft er geen, tenzij hij er zelf een heeft afgenomen
// (bijvoorbeeld omdat zijn team geblokkeerd was). Een manager en een gewone gebruiker blijven kunnen opzeggen.

type Rij = Record<string, unknown>
const { db, auth, eigen, mail, meld, zeg } = vi.hoisted(() => ({
  db: { approved_users: [] as Rij[], arnobot_team_members: [] as Rij[] },
  auth: vi.fn(),
  eigen: vi.fn(),
  mail: vi.fn(),
  meld: vi.fn(),
  zeg: vi.fn(),
}))

type Tabel = keyof typeof db
function bouwer(tabel: Tabel) {
  const filters: ((r: Rij) => boolean)[] = []
  let op: 'select' | 'update' = 'select'
  let waarden: Rij = {}
  let head = false
  const uitvoer = () => {
    const raak = db[tabel].filter(r => filters.every(f => f(r)))
    if (op === 'update') { raak.forEach(r => Object.assign(r, waarden)); return { data: raak, error: null, count: raak.length } }
    return { data: head ? null : raak, error: null, count: raak.length }
  }
  const b: Record<string, unknown> = {}
  b.select = (_k?: string, o?: { head?: boolean }) => { head = !!o?.head; return b }
  b.eq = (k: string, v: unknown) => { filters.push(r => r[k] === v); return b }
  b.update = (w: Rij) => { op = 'update'; waarden = w; return b }
  b.maybeSingle = () => Promise.resolve({ data: (uitvoer().data as Rij[] | null)?.[0] ?? null, error: null })
  b.then = (ok: (v: unknown) => unknown) => Promise.resolve(uitvoer()).then(ok)
  return b
}

vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ from: bouwer }) }))
vi.mock('@clerk/nextjs/server', () => ({ auth }))
vi.mock('@/lib/mail', () => ({ verstuurMailZacht: mail }))
vi.mock('@/lib/billing/opzeggen', () => ({ meldOpzegging: meld }))
vi.mock('@/lib/billing/soloNaarTeam', () => ({ soloStoptVoorTeam: vi.fn(async () => null) }))
vi.mock('@/lib/teamLid', () => ({ heeftEigenAbonnement: eigen }))
vi.mock('@/lib/teamOpzegging', () => ({ zegTeamOp: zeg }))

const { POST } = await import('./route')

beforeEach(() => {
  db.approved_users = [{ user_id: 'u1', voornaam: 'Jan', email: 'jan@x.nl', cancelled_at: null }]
  db.arnobot_team_members = []
  auth.mockReset(); eigen.mockReset(); mail.mockReset(); meld.mockReset(); zeg.mockReset()
  zeg.mockResolvedValue({ ok: true, teamNaam: 'Team Een', stoptOp: '2026-12-15' })
  auth.mockResolvedValue({ userId: 'u1' })
  eigen.mockResolvedValue(false)
  meld.mockResolvedValue(null)
  mail.mockResolvedValue(undefined)
})

describe('opzeggen', () => {
  it('weigert een gewoon teamlid zonder eigen abonnement', async () => {
    db.arnobot_team_members = [{ user_id: 'u1', team_id: 't1', role: 'member' }]
    const res = await POST()
    expect(res.status).toBe(400)
    expect((await res.json()).error).toContain('geen eigen abonnement')
    expect(db.approved_users[0].cancelled_at).toBeNull()
  })

  it('laat een teamlid dat zelf een abonnement heeft afgenomen dat wel opzeggen', async () => {
    db.arnobot_team_members = [{ user_id: 'u1', team_id: 't1', role: 'member' }]
    eigen.mockResolvedValue(true)
    const res = await POST()
    expect(res.status).toBe(200)
    expect(db.approved_users[0].cancelled_at).toBeTypeOf('string')
    expect(meld).toHaveBeenCalledWith('u1')
  })

  it('laat een manager opzeggen, zonder te vragen naar een eigen abonnement', async () => {
    db.arnobot_team_members = [{ user_id: 'u1', team_id: 't1', role: 'manager' }]
    const res = await POST()
    expect(res.status).toBe(200)
    expect((await res.json()).isManager).toBe(true)
    expect(eigen).not.toHaveBeenCalled()
  })

  it('geeft een manager de einddatum van zijn team terug en meldt die aan Arno', async () => {
    db.arnobot_team_members = [{ user_id: 'u1', team_id: 't1', role: 'manager' }]
    const res = await POST()
    const d = await res.json()
    expect(zeg).toHaveBeenCalledWith('u1')
    expect(d.team_stopt_op).toBe('2026-12-15')
    expect(d.eindigt_op).toBe('2026-12-15T00:00:00.000Z')
    const arnoMail = mail.mock.calls.map(c => c[0]).find(m => m.to === 'arno@arno.bot')
    expect(arnoMail.html).toContain('het team stopt op')
  })

  it('de mail aan Arno spreekt zichzelf niet tegen: bij een automatisch verwerkt team geen waarschuwing om de leden zelf te beëindigen', async () => {
    db.arnobot_team_members = [{ user_id: 'u1', team_id: 't1', role: 'manager' }]
    await POST()
    const html = mail.mock.calls.map(c => c[0]).find(m => m.to === 'arno@arno.bot').html as string
    expect(html).toContain('Team met 1 lid.')
    expect(html).toContain('Geen actie nodig')
    expect(html).not.toContain('moet je ook hun toegang zelf beëindigen')
  })

  it('bij een team zonder facturatie (geen einddatum) blijft de waarschuwing voor Arno staan, met het goede meervoud', async () => {
    zeg.mockResolvedValue({ ok: true, teamNaam: 'Team Een', stoptOp: null })
    db.arnobot_team_members = [{ user_id: 'u1', team_id: 't1', role: 'manager' }, { user_id: 'l1', team_id: 't1', role: 'member' }, { user_id: 'l2', team_id: 't1', role: 'member' }]
    await POST()
    const html = mail.mock.calls.map(c => c[0]).find(m => m.to === 'arno@arno.bot').html as string
    expect(html).toContain('met 3 leden')
    expect(html).toContain('moet je ook hun toegang zelf beëindigen')
  })

  it('de bevestiging aan de manager noemt de einddatum van het team, die aan een gewone gebruiker niet', async () => {
    db.arnobot_team_members = [{ user_id: 'u1', team_id: 't1', role: 'manager' }]
    await POST()
    const teamMail = mail.mock.calls.map(c => c[0]).find(m => m.to === 'jan@x.nl').html as string
    expect(teamMail).toContain('Je team stopt op 15 december 2026')
    expect(teamMail).not.toContain('einde van de lopende betaalperiode')

    mail.mockReset(); mail.mockResolvedValue(undefined); zeg.mockReset()
    db.arnobot_team_members = []
    db.approved_users[0].cancelled_at = null
    await POST()
    const soloMail = mail.mock.calls.map(c => c[0]).find(m => m.to === 'jan@x.nl').html as string
    expect(soloMail).toContain('einde van de lopende betaalperiode')
    expect(soloMail).not.toContain('Je team stopt')
  })

  it('legt niets vast als de opzegregel van het team weigert (bijvoorbeeld al opgezegd)', async () => {
    db.arnobot_team_members = [{ user_id: 'u1', team_id: 't1', role: 'manager' }]
    zeg.mockResolvedValue({ ok: false, status: 409, fout: 'Dit team is al opgezegd' })
    const res = await POST()
    expect(res.status).toBe(409)
    expect(db.approved_users[0].cancelled_at).toBeNull()
    expect(mail).not.toHaveBeenCalled()
  })

  it('raakt de teamopzegging niet aan voor een gewone gebruiker of een lid met een eigen abonnement', async () => {
    await POST()
    db.approved_users[0].cancelled_at = null
    db.arnobot_team_members = [{ user_id: 'u1', team_id: 't1', role: 'member' }]
    eigen.mockResolvedValue(true)
    await POST()
    expect(zeg).not.toHaveBeenCalled()
  })

  it('laat een gewone gebruiker opzeggen', async () => {
    const res = await POST()
    expect(res.status).toBe(200)
  })

  it('weigert iemand die al heeft opgezegd', async () => {
    db.approved_users[0].cancelled_at = '2026-11-01T00:00:00Z'
    expect((await POST()).status).toBe(400)
  })
})
