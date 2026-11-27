import { describe, it, expect, vi, beforeEach } from 'vitest'

// Bewijst het joinen van een team zonder echte database, met de grens van 25 leden en de Telegram-meldingen
// voor Arno: eenmalig vanaf 20 leden, en als iemand wordt geweigerd omdat het team vol is.

type Rij = Record<string, unknown>
const { db, notify, nieuwMelden, auth, stopSolo } = vi.hoisted(() => ({
  db: { arnobot_teams: [] as Rij[], arnobot_team_members: [] as Rij[], approved_users: [] as Rij[] },
  notify: vi.fn(),
  nieuwMelden: vi.fn(),
  auth: vi.fn(),
  stopSolo: vi.fn(),
}))

function bouwer(tabel: 'arnobot_teams' | 'arnobot_team_members' | 'approved_users') {
  const filters: ((r: Rij) => boolean)[] = []
  let op: 'select' | 'insert' | 'update' = 'select'
  let waarden: Rij = {}
  let head = false
  const b: Record<string, unknown> = {}
  const uitvoer = () => {
    const raak = db[tabel].filter(r => filters.every(f => f(r)))
    if (op === 'insert') { db[tabel].push({ ...waarden }); return { data: null, error: null, count: null } }
    if (op === 'update') { raak.forEach(r => Object.assign(r, waarden)); return { data: null, error: null, count: null } }
    return { data: head ? null : raak, error: null, count: raak.length }
  }
  b.select = (_k?: string, o?: { head?: boolean }) => { head = !!o?.head; return b }
  b.eq = (k: string, v: unknown) => { filters.push(r => r[k] === v); return b }
  b.neq = (k: string, v: unknown) => { filters.push(r => r[k] !== v); return b }
  b.insert = (w: Rij) => { op = 'insert'; waarden = w; return b }
  b.update = (w: Rij) => { op = 'update'; waarden = w; return b }
  b.single = () => { const r = (uitvoer().data as Rij[] | null) ?? []; return Promise.resolve(r.length ? { data: r[0], error: null } : { data: null, error: { message: 'geen rij' } }) }
  b.then = (ok: (v: unknown) => unknown) => Promise.resolve(uitvoer()).then(ok)
  return b
}

vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ from: bouwer }) }))
vi.mock('@clerk/nextjs/server', () => ({ auth }))
vi.mock('@/lib/teamAccess', () => ({ clearIndividueelGebruik: vi.fn(async () => {}) }))
vi.mock('@/lib/capaciteit', () => ({ nieuwMelden }))
vi.mock('@/lib/billing/teamlidSolo', () => ({ stopSoloBijJoin: stopSolo }))
vi.mock('@/lib/cron-notify', () => ({ notifyTelegram: notify }))

const { POST, GET } = await import('./route')
const { TEST_TEAM_ID } = await import('@/lib/internalTestAccounts')

const aanroep = (code = 'abc') => POST(new Request('https://www.arno.bot/api/bot/team/join', { method: 'POST', body: JSON.stringify({ invite_code: code }) }))
const vulTeam = (aantal: number, id = 't1', extra: Rij = {}) => {
  db.arnobot_teams = [{ id, name: 'Team Een', niveau: 'premium', invite_code: 'abc', manager_id: 'u0', ...extra }]
  db.arnobot_team_members = Array.from({ length: aantal }, (_, i) => ({ team_id: id, user_id: `u${i}`, role: i === 0 ? 'manager' : 'member' }))
}

beforeEach(() => {
  db.arnobot_teams = []; db.arnobot_team_members = []; db.approved_users = [{ user_id: 'nieuw', plan: 'basis' }]
  notify.mockReset(); nieuwMelden.mockReset(); auth.mockReset(); stopSolo.mockReset()
  stopSolo.mockResolvedValue({ abonnement: 'geen', proefBeeindigd: false, handmatigBetaald: false })
  nieuwMelden.mockResolvedValue(true)
  auth.mockResolvedValue({ userId: 'nieuw' })
})

describe('team joinen', () => {
  it('voegt het lid toe en zet zijn plan op het niveau van het team', async () => {
    vulTeam(3)
    const res = await aanroep()
    expect(res.status).toBe(200)
    expect(db.arnobot_team_members.some(m => m.user_id === 'nieuw' && m.role === 'member')).toBe(true)
    expect(db.approved_users[0].plan).toBe('premium')
  })

  it('stopt na het joinen het eigen abonnement en de eigen proef van het nieuwe lid', async () => {
    vulTeam(3)
    await aanroep()
    expect(stopSolo).toHaveBeenCalledOnce()
    expect(stopSolo).toHaveBeenCalledWith('nieuw', 'Team Een')
  })

  it('stopt niets als joinen niet lukt (team vol, ongeldige code of al lid)', async () => {
    vulTeam(26)
    await aanroep()
    vulTeam(3)
    await aanroep('fout')
    db.arnobot_team_members.push({ team_id: 't1', user_id: 'nieuw', role: 'member' })
    await aanroep()
    expect(stopSolo).not.toHaveBeenCalled()
  })

  it('weigert een geblokkeerd team: het nieuwe lid raakt zijn eigen abonnement niet kwijt', async () => {
    vulTeam(3, 't1', { geblokkeerd_at: '2026-11-10T00:00:00Z' })
    const res = await aanroep()
    expect(res.status).toBe(409)
    expect((await res.json()).error).toContain('niet actief')
    expect(stopSolo).not.toHaveBeenCalled()
    expect(db.arnobot_team_members.some(m => m.user_id === 'nieuw')).toBe(false)
    expect(db.approved_users[0].plan).toBe('basis')
  })

  it('weigert een opgezegd team dat binnenkort stopt, ook als het nog niet is geblokkeerd', async () => {
    vulTeam(3, 't1', { stopt_op: '2026-12-25' })
    expect((await aanroep()).status).toBe(409)
    expect(stopSolo).not.toHaveBeenCalled()
  })

  it('laat de uitnodigingspagina vooraf weten dat het team niet actief is', async () => {
    vulTeam(3, 't1', { geblokkeerd_at: '2026-11-10T00:00:00Z' })
    const d = await (await GET(new Request('https://www.arno.bot/api/bot/team/join?code=abc'))).json()
    expect(d).toMatchObject({ teamName: 'Team Een', nietActief: true })
    vulTeam(3)
    expect(await (await GET(new Request('https://www.arno.bot/api/bot/team/join?code=abc'))).json()).toEqual({ teamName: 'Team Een' })
  })

  it('geeft geen melding onder de 20 leden', async () => {
    vulTeam(19) // manager plus 18, met het nieuwe lid 19 teamleden
    await aanroep()
    expect(notify).not.toHaveBeenCalled()
  })

  it('meldt Arno wanneer het team 20 leden bereikt', async () => {
    vulTeam(20) // manager plus 19, met het nieuwe lid 20 teamleden
    await aanroep()
    expect(notify).toHaveBeenCalledOnce()
    expect(notify.mock.calls[0][0]).toContain('20 van maximaal 25')
    expect(nieuwMelden).toHaveBeenCalledWith('teamgrens:bijna:t1', 'mijlpaal')
  })

  it('meldt niet opnieuw als die melding al is gedaan (dubbele-meldingsbeveiliging)', async () => {
    nieuwMelden.mockResolvedValue(false)
    vulTeam(21)
    await aanroep()
    expect(notify).not.toHaveBeenCalled()
  })

  it('de manager telt niet mee: het 25e teamlid kan er nog bij', async () => {
    vulTeam(25) // manager plus 24
    expect((await aanroep()).status).toBe(200)
    expect(db.arnobot_team_members).toHaveLength(26)
  })

  it('weigert het 26e teamlid, meldt Arno en laat het team ongemoeid', async () => {
    vulTeam(26)
    const res = await aanroep()
    expect(res.status).toBe(400)
    expect((await res.json()).error).toContain('maximaal 25')
    expect(db.arnobot_team_members).toHaveLength(26)
    expect(notify).toHaveBeenCalledOnce()
    expect(notify.mock.calls[0][0]).toContain('is vol')
    expect(nieuwMelden).toHaveBeenCalledWith('teamgrens:vol:t1', 'waarschuwing')
  })

  it('geeft voor een testteam nooit een melding', async () => {
    vulTeam(19, TEST_TEAM_ID)
    await aanroep()
    vulTeam(26, TEST_TEAM_ID)
    await aanroep()
    expect(notify).not.toHaveBeenCalled()
  })

  it('laat een mislukte Telegram-melding het joinen niet breken', async () => {
    notify.mockRejectedValue(new Error('telegram down'))
    vulTeam(19)
    const res = await aanroep()
    expect(res.status).toBe(200)
    expect(db.arnobot_team_members.some(m => m.user_id === 'nieuw')).toBe(true)
  })

  it('weigert een ongeldige code en iemand die al lid is', async () => {
    vulTeam(3)
    expect((await aanroep('fout')).status).toBe(404)
    db.arnobot_team_members.push({ team_id: 't1', user_id: 'nieuw', role: 'member' })
    expect((await aanroep()).status).toBe(400)
  })
})
