import { describe, it, expect, vi, beforeEach } from 'vitest'

// Bewijst de opzegregel voor Team: de einddatum volgens artikel 7, intrekken tot de dag ervoor, het stoppen op de
// einddatum (blokkeren en facturatie uit), en dat een late betaling een gestopt team niet weer openzet.

type Rij = Record<string, unknown>
const { db, notify, logActie } = vi.hoisted(() => ({
  db: { arnobot_team_members: [] as Rij[], arnobot_teams: [] as Rij[], approved_users: [] as Rij[], arnobot_team_facturen: [] as Rij[] },
  notify: vi.fn(),
  logActie: vi.fn(),
}))

type Tabel = keyof typeof db
function bouwer(tabel: Tabel) {
  const filters: ((r: Rij) => boolean)[] = []
  let op: 'select' | 'update' = 'select'
  let waarden: Rij = {}
  let terug = false
  const uitvoer = () => {
    const raak = db[tabel].filter(r => filters.every(f => f(r)))
    if (op === 'update') { raak.forEach(r => Object.assign(r, waarden)); return { data: terug ? raak : null, error: null } }
    return { data: raak, error: null }
  }
  const b: Record<string, unknown> = {}
  b.select = () => { terug = true; return b }
  b.eq = (k: string, v: unknown) => { filters.push(r => r[k] === v); return b }
  b.is = (k: string, v: null) => { filters.push(r => (r[k] ?? null) === v); return b }
  b.lte = (k: string, v: string) => { filters.push(r => r[k] != null && String(r[k]) <= v); return b }
  b.lt = (k: string, v: string) => { filters.push(r => r[k] != null && String(r[k]) < v); return b }
  b.not = (k: string, o: string, v: unknown) => {
    if (o === 'is') filters.push(r => (r[k] ?? null) !== v)
    else if (o === 'in') { const ids = String(v).replace(/[()]/g, '').split(','); filters.push(r => !ids.includes(String(r[k]))) }
    return b
  }
  b.returns = () => b
  b.update = (w: Rij) => { op = 'update'; waarden = w; terug = false; return b }
  b.maybeSingle = () => Promise.resolve({ data: (uitvoer().data as Rij[] | null)?.[0] ?? null, error: null })
  b.then = (ok: (v: unknown) => unknown) => Promise.resolve(uitvoer()).then(ok)
  return b
}

vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ from: bouwer }) }))
vi.mock('@/lib/cron-notify', () => ({ notifyTelegram: notify }))
vi.mock('@/lib/adminLog', () => ({ logAdminActie: logActie }))

const { berekenTeamStop, zegTeamOp, trekTeamOpzeggingIn, stopOpgezegdeTeams, ontblokkeerNaBetaling } = await import('./teamOpzegging')
const { TEST_TEAM_ID } = await import('./internalTestAccounts')

const d = (s: string) => new Date(`${s}T12:00:00Z`)
const dag = (x: Date | null) => x?.toISOString().slice(0, 10) ?? null
const team = (o: Rij = {}): Rij => ({ id: 't1', name: 'Team Een', manager_id: 'm1', min_seats: 3, cyclus: 'maandelijks', volgende_factuurdatum: '2026-12-15', geblokkeerd_at: null, stopt_op: null, ...o })

beforeEach(() => {
  db.arnobot_team_members = [{ user_id: 'm1', team_id: 't1', role: 'manager' }, { user_id: 'l1', team_id: 't1', role: 'member' }]
  db.arnobot_teams = [team()]
  db.approved_users = [{ user_id: 'm1', cancelled_at: '2026-11-15T10:00:00Z' }]
  db.arnobot_team_facturen = []
  notify.mockReset(); logActie.mockReset()
})

describe('berekenTeamStop (artikel 7: een maand opzegtermijn)', () => {
  it('stopt aan het einde van de lopende periode als er minstens een maand voor zit', () => {
    expect(dag(berekenTeamStop(team() as never, d('2026-11-10')))).toBe('2026-12-15')
    expect(dag(berekenTeamStop(team() as never, d('2026-11-15')))).toBe('2026-12-15')
  })
  it('loopt een periode door als de opzegging te laat komt', () => {
    expect(dag(berekenTeamStop(team() as never, d('2026-11-20')))).toBe('2027-01-15')
  })
  it('kent jaarlijkse teams: een jaar erbij bij een te late opzegging', () => {
    const jaar = team({ cyclus: 'jaarlijks', volgende_factuurdatum: '2027-06-01' }) as never
    expect(dag(berekenTeamStop(jaar, d('2026-11-15')))).toBe('2027-06-01')
    expect(dag(berekenTeamStop(jaar, d('2027-05-20')))).toBe('2028-06-01')
  })
  it('geeft null voor een team zonder facturatie (handmatig team)', () => {
    expect(berekenTeamStop(team({ min_seats: null }) as never, d('2026-11-10'))).toBeNull()
    expect(berekenTeamStop(team({ volgende_factuurdatum: null }) as never, d('2026-11-10'))).toBeNull()
    expect(berekenTeamStop(team({ cyclus: null }) as never, d('2026-11-10'))).toBeNull()
  })
  it('geeft nooit een datum in het verleden: de dag erna is het vroegste', () => {
    expect(dag(berekenTeamStop(team({ volgende_factuurdatum: '2026-10-01' }) as never, d('2026-11-10')))).toBe('2026-11-11')
  })
})

describe('zegTeamOp', () => {
  it('zet de einddatum, logt het en laat de rest van het team ongemoeid', async () => {
    const r = await zegTeamOp('m1', d('2026-11-10'))
    expect(r).toEqual({ ok: true, teamNaam: 'Team Een', stoptOp: '2026-12-15' })
    expect(db.arnobot_teams[0]).toMatchObject({ stopt_op: '2026-12-15', geblokkeerd_at: null, volgende_factuurdatum: '2026-12-15' })
    expect(logActie).toHaveBeenCalledWith(expect.objectContaining({ actie: 'team_opgezegd', doelTeamId: 't1' }))
  })
  it('weigert een tweede opzegging', async () => {
    await zegTeamOp('m1', d('2026-11-10'))
    expect(await zegTeamOp('m1', d('2026-11-11'))).toMatchObject({ ok: false, status: 409 })
  })
  it('weigert iemand die geen team beheert', async () => {
    expect(await zegTeamOp('l1', d('2026-11-10'))).toMatchObject({ ok: false, status: 404 })
  })
  it('geeft bij een team zonder facturatie geen einddatum en wijzigt niets (alleen een melding aan Arno)', async () => {
    db.arnobot_teams = [team({ min_seats: null })]
    expect(await zegTeamOp('m1', d('2026-11-10'))).toEqual({ ok: true, teamNaam: 'Team Een', stoptOp: null })
    expect(db.arnobot_teams[0].stopt_op).toBeNull()
  })
})

describe('trekTeamOpzeggingIn', () => {
  it('trekt in tot en met de dag voor de einddatum en haalt de opzegmarkering van het account weg', async () => {
    db.arnobot_teams = [team({ stopt_op: '2026-12-15' })]
    expect(await trekTeamOpzeggingIn('m1', d('2026-12-14'))).toEqual({ ok: true })
    expect(db.arnobot_teams[0].stopt_op).toBeNull()
    expect(db.approved_users[0].cancelled_at).toBeNull()
    expect(notify).toHaveBeenCalledOnce()
  })
  it('weigert op de einddatum zelf en daarna', async () => {
    db.arnobot_teams = [team({ stopt_op: '2026-12-15' })]
    expect(await trekTeamOpzeggingIn('m1', d('2026-12-15'))).toMatchObject({ ok: false, status: 409 })
    expect(await trekTeamOpzeggingIn('m1', d('2026-12-20'))).toMatchObject({ ok: false, status: 409 })
    expect(db.arnobot_teams[0].stopt_op).toBe('2026-12-15')
  })
  it('weigert een team dat niet is opgezegd en iemand die geen manager is', async () => {
    expect(await trekTeamOpzeggingIn('m1', d('2026-12-01'))).toMatchObject({ ok: false, status: 409 })
    expect(await trekTeamOpzeggingIn('l1', d('2026-12-01'))).toMatchObject({ ok: false, status: 404 })
  })
})

describe('stopOpgezegdeTeams', () => {
  it('blokkeert een team op de einddatum en zet de facturatie uit', async () => {
    db.arnobot_teams = [team({ stopt_op: '2026-12-15' })]
    const gestopt = await stopOpgezegdeTeams('2026-12-15', d('2026-12-15'))
    expect(gestopt).toEqual(['Team Een'])
    expect(db.arnobot_teams[0].geblokkeerd_at).toBeTypeOf('string')
    expect(db.arnobot_teams[0].volgende_factuurdatum).toBeNull()
    expect(db.arnobot_teams[0].stopt_op).toBe('2026-12-15') // blijft bewaard als spoor
    expect(logActie).toHaveBeenCalledWith(expect.objectContaining({ actie: 'team_gestopt' }))
    expect(notify.mock.calls[0][0]).toContain('Team gestopt na opzegging')
  })
  it('doet dat maar één keer (idempotent)', async () => {
    db.arnobot_teams = [team({ stopt_op: '2026-12-15' })]
    await stopOpgezegdeTeams('2026-12-15', d('2026-12-15'))
    notify.mockReset()
    expect(await stopOpgezegdeTeams('2026-12-16', d('2026-12-16'))).toEqual([])
    expect(notify).not.toHaveBeenCalled()
  })
  it('laat een team met een einddatum in de toekomst of zonder opzegging met rust', async () => {
    db.arnobot_teams = [team({ stopt_op: '2026-12-15' }), team({ id: 't2', name: 'Team Twee' })]
    expect(await stopOpgezegdeTeams('2026-12-14', d('2026-12-14'))).toEqual([])
    expect(db.arnobot_teams.every(t => t.geblokkeerd_at === null && t.volgende_factuurdatum === '2026-12-15')).toBe(true)
  })
  it('zet de facturatie ook uit bij een team dat al door te late betaling was geblokkeerd, en behoudt die blokkadedatum', async () => {
    db.arnobot_teams = [team({ stopt_op: '2026-12-15', geblokkeerd_at: '2026-12-01T00:00:00Z' })]
    expect(await stopOpgezegdeTeams('2026-12-15', d('2026-12-15'))).toEqual(['Team Een'])
    expect(db.arnobot_teams[0]).toMatchObject({ geblokkeerd_at: '2026-12-01T00:00:00Z', volgende_factuurdatum: null })
  })
  it('raakt een intern testteam nooit aan', async () => {
    db.arnobot_teams = [team({ id: TEST_TEAM_ID, stopt_op: '2026-12-15' })]
    expect(await stopOpgezegdeTeams('2026-12-15', d('2026-12-15'))).toEqual([])
    expect(db.arnobot_teams[0].geblokkeerd_at).toBeNull()
  })
})

describe('ontblokkeerNaBetaling', () => {
  it('heft de blokkade op na een betaling', async () => {
    db.arnobot_teams = [team({ geblokkeerd_at: '2026-12-01T00:00:00Z' })]
    expect(await ontblokkeerNaBetaling('t1', '2026-12-10')).toBe(true)
    expect(db.arnobot_teams[0].geblokkeerd_at).toBeNull()
  })
  it('laat een gestopt team geblokkeerd, ook bij een late betaling van een oude factuur', async () => {
    db.arnobot_teams = [team({ geblokkeerd_at: '2026-12-15T00:00:00Z', stopt_op: '2026-12-15' })]
    expect(await ontblokkeerNaBetaling('t1', '2026-12-20')).toBe(false)
    expect(db.arnobot_teams[0].geblokkeerd_at).toBe('2026-12-15T00:00:00Z')
  })
  it('laat een blokkade die Arno zelf zette staan en meldt dat', async () => {
    db.arnobot_teams = [team({ geblokkeerd_at: '2026-12-01T00:00:00Z', geblokkeerd_handmatig: true })]
    expect(await ontblokkeerNaBetaling('t1', '2026-12-10')).toBe(false)
    expect(db.arnobot_teams[0].geblokkeerd_at).toBe('2026-12-01T00:00:00Z')
    expect(notify).toHaveBeenCalledTimes(1)
  })
  it('laat de blokkade staan zolang een andere factuur over de grens open staat', async () => {
    db.arnobot_teams = [team({ geblokkeerd_at: '2026-12-01T00:00:00Z' })]
    db.arnobot_team_facturen = [{ id: 'oud', team_id: 't1', status: 'open', created_at: '2026-10-01T05:10:00Z' }]
    expect(await ontblokkeerNaBetaling('t1', '2026-12-10')).toBe(false)
    expect(db.arnobot_teams[0].geblokkeerd_at).toBe('2026-12-01T00:00:00Z')
  })
  it('een recente open factuur houdt het opheffen niet tegen, de grens is 44 dagen', async () => {
    db.arnobot_teams = [team({ geblokkeerd_at: '2026-12-01T00:00:00Z' })]
    // 10-12 min 44 dagen is 27-10: een factuur van 28-10 is 43 dagen oud.
    db.arnobot_team_facturen = [{ id: 'nieuw', team_id: 't1', status: 'open', created_at: '2026-10-28T05:10:00Z' }]
    expect(await ontblokkeerNaBetaling('t1', '2026-12-10')).toBe(true)
    db.arnobot_teams = [team({ geblokkeerd_at: '2026-12-01T00:00:00Z' })]
    db.arnobot_team_facturen = [{ id: 'grens', team_id: 't1', status: 'open', created_at: '2026-10-27T05:10:00Z' }]
    expect(await ontblokkeerNaBetaling('t1', '2026-12-10')).toBe(false)
  })
  it('heft de blokkade wel op als de einddatum nog in de toekomst ligt', async () => {
    db.arnobot_teams = [team({ geblokkeerd_at: '2026-12-01T00:00:00Z', stopt_op: '2027-01-15' })]
    expect(await ontblokkeerNaBetaling('t1', '2026-12-10')).toBe(true)
  })
})
