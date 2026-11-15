import { describe, it, expect, vi, beforeEach } from 'vitest'

// Bewijst het zelf activeren van een team zonder echte database of betaalprovider: wie mag, wat er wordt
// opgeslagen, en dat een dubbele klik of een al geactiveerd team nooit een tweede factuur oplevert.

type Rij = Record<string, unknown>
const { db, notify, logActie, maakKlant, maakFactuur } = vi.hoisted(() => ({
  db: {} as Record<string, Rij[]>,
  notify: vi.fn(),
  logActie: vi.fn(),
  maakKlant: vi.fn(),
  maakFactuur: vi.fn(),
}))

// Minimale in-memory database met de ketenmethodes die lib/teamActivatie.ts gebruikt.
function bouwer(tabel: string) {
  const filters: ((r: Rij) => boolean)[] = []
  let op: 'select' | 'update' | 'upsert' | 'delete' = 'select'
  let waarden: Rij = {}
  let head = false
  let max = Infinity
  let volgorde: string | null = null
  const rijen = () => (db[tabel] ??= [])
  const uitvoer = () => {
    const raak = rijen().filter(r => filters.every(f => f(r)))
    if (op === 'update') { raak.forEach(r => Object.assign(r, waarden)); return { data: raak, error: null, count: raak.length } }
    if (op === 'upsert') {
      const sleutel = 'user_id' in waarden ? 'user_id' : 'id'
      const bestaand = rijen().find(r => r[sleutel] === waarden[sleutel])
      if (bestaand) Object.assign(bestaand, waarden); else rijen().push({ ...waarden })
      return { data: null, error: null, count: null }
    }
    if (op === 'delete') { db[tabel] = rijen().filter(r => !raak.includes(r)); return { data: null, error: null, count: null } }
    let uit = [...raak]
    if (volgorde) uit.sort((a, b) => String(b[volgorde!]).localeCompare(String(a[volgorde!])))
    uit = uit.slice(0, max)
    return { data: head ? null : uit, error: null, count: raak.length }
  }
  const b: Record<string, unknown> = {}
  b.select = (_k?: string, o?: { head?: boolean }) => { head = !!o?.head; return b }
  b.eq = (k: string, v: unknown) => { filters.push(r => r[k] === v); return b }
  b.is = (k: string, v: null) => { filters.push(r => (r[k] ?? null) === v); return b }
  b.in = (k: string, v: unknown[]) => { filters.push(r => v.includes(r[k])); return b }
  b.order = (k: string) => { volgorde = k; return b }
  b.limit = (n: number) => { max = n; return b }
  b.returns = () => b
  b.update = (w: Rij) => { op = 'update'; waarden = w; return b }
  b.upsert = (w: Rij) => { op = 'upsert'; waarden = w; return b }
  b.delete = () => { op = 'delete'; return b }
  // Zoals PostgREST: bij meer dan één rij geeft maybeSingle een fout en geen data.
  b.maybeSingle = () => {
    const rijen = (uitvoer().data as Rij[] | null) ?? []
    return Promise.resolve(rijen.length > 1 ? { data: null, error: { message: 'meerdere rijen' } } : { data: rijen[0] ?? null, error: null })
  }
  b.then = (ok: (v: unknown) => unknown) => Promise.resolve(uitvoer()).then(ok)
  return b
}

vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ from: bouwer }) }))
vi.mock('@/lib/cron-notify', () => ({ notifyTelegram: notify }))
vi.mock('@/lib/adminLog', () => ({ logAdminActie: logActie }))
vi.mock('@/lib/billing/mollie', () => ({ klantBestaat: vi.fn(async () => true), maakKlant }))
vi.mock('@/lib/billing/teamFacturatie', () => ({
  berekenReguliereBedrag: (seats: number) => ({ nettoCent: seats * 4900, btwCent: Math.round(seats * 4900 * 0.21), brutoCent: Math.round(seats * 4900 * 1.21) }),
  huidigSeats: async (_t: string, min: number) => Math.max(min, 4),
  maakTeamFactuur: maakFactuur,
}))

process.env.MOLLIE_API_KEY = 'test_abc'
const { valideerActivatie, activeerTeam, leesActivatieStand, leesLidVanGeblokkeerdTeam } = await import('./teamActivatie')
const { TEST_PROEF_TEAM_ID } = await import('./internalTestAccounts')

const dagenGeleden = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString()
const formulier = { seats: 5, cyclus: 'jaarlijks', bedrijfsnaam: 'Voorbeeld BV', kvkNummer: '12345678', btwNummer: 'NL123456789B01', straat: 'Kerkstraat 1', postcode: '1234 AB', plaats: 'Utrecht' }

function zet(o: { manager?: Rij; team?: Rij } = {}) {
  db.approved_users = [{ user_id: 'm1', email: 'm1@x.nl', trial_start: dagenGeleden(10), expires_at: null, paid_at: null, sd_attribution_method: 'link', ...o.manager }]
  db.arnobot_teams = [{ id: 't1', name: 'Team Een', manager_id: 'm1', min_seats: null, cyclus: null, volgende_factuurdatum: null, geblokkeerd_at: null, ...o.team }]
  db.arnobot_team_members = [{ team_id: 't1', user_id: 'm1', role: 'manager' }, { team_id: 't1', user_id: 'l1', role: 'member' }]
  db.arnobot_team_facturen = []
  db.arnobot_billing_customers = []
}

beforeEach(() => {
  for (const k of Object.keys(db)) delete db[k]
  notify.mockReset(); logActie.mockReset(); maakKlant.mockReset(); maakFactuur.mockReset()
  maakKlant.mockResolvedValue({ id: 'cst_1' })
  maakFactuur.mockImplementation(async (team: Rij) => { db.arnobot_team_facturen.push({ team_id: team.id, status: 'open', bedrag_cent: 1, mollie_payment_link_url: 'https://pay.test/abc', created_at: new Date().toISOString() }) })
})

describe('valideerActivatie', () => {
  it('accepteert een geldige invoer', async () => {
    const r = await valideerActivatie(formulier)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.waarde).toMatchObject({ seats: 5, cyclus: 'jaarlijks', zakelijk: { kvk: '12345678', postcode: '1234 AB' } })
  })
  it.each([
    ['te weinig gebruikers', { seats: 2 }],
    ['geen geheel getal', { seats: 3.5 }],
    ['te veel gebruikers', { seats: 501 }],
    ['onbekende betaalwijze', { cyclus: 'wekelijks' }],
    ['ongeldig KvK', { kvkNummer: '123' }],
  ])('weigert %s', async (_n, afwijking) => {
    expect((await valideerActivatie({ ...formulier, ...afwijking })).ok).toBe(false)
  })
  it('weigert lege invoer', async () => {
    expect((await valideerActivatie(null)).ok).toBe(false)
  })
})

describe('leesActivatieStand', () => {
  it('geeft null voor iemand die geen team beheert', async () => {
    zet()
    expect(await leesActivatieStand('l1')).toBeNull()
  })
  it('vindt het juiste team ook als de manager op twee teams als manager_id staat (testaccount met Team Apex)', async () => {
    zet()
    db.arnobot_teams.push({ id: 't-apex', name: 'Team Apex', manager_id: 'm1', min_seats: null, cyclus: null, volgende_factuurdatum: null, geblokkeerd_at: null })
    const s = await leesActivatieStand('m1')
    expect(s).toMatchObject({ teamId: 't1', teamNaam: 'Team Een', kanActiveren: true })
  })
  it('toont een lopende agent-proef als activeerbaar met de resterende dagen', async () => {
    zet()
    const s = await leesActivatieStand('m1')
    expect(s).toMatchObject({ kanActiveren: true, geactiveerd: false, geblokkeerd: false, ledenAantal: 2 })
    expect(s?.proef).toMatchObject({ staat: 'loopt', dagen: 20 })
  })
  it('toont een afgelopen proef als verlopen en geblokkeerd', async () => {
    zet({ manager: { trial_start: dagenGeleden(45) }, team: { geblokkeerd_at: dagenGeleden(5) } })
    const s = await leesActivatieStand('m1')
    expect(s).toMatchObject({ kanActiveren: true, geblokkeerd: true })
    expect(s?.proef?.staat).toBe('verlopen')
  })
  it('toont dag 30 tot 40 als coulance: het team heeft nog toegang en weet tot wanneer', async () => {
    zet({ manager: { trial_start: dagenGeleden(33) } })
    const s = await leesActivatieStand('m1')
    expect(s).toMatchObject({ kanActiveren: true, geblokkeerd: false })
    expect(s?.proef).toMatchObject({ staat: 'coulance', dagen: 7 })
    expect(Math.round((new Date(s!.proef!.toegangTot).getTime() - new Date(s!.proef!.einde).getTime()) / 86_400_000)).toBe(10)
  })
  it('laat een manager zonder agent-link niet zelf activeren (handmatige route)', async () => {
    zet({ manager: { sd_attribution_method: null } })
    expect((await leesActivatieStand('m1'))?.kanActiveren).toBe(false)
  })
  it('laat een betalende manager niet zelf activeren', async () => {
    zet({ manager: { paid_at: dagenGeleden(3) } })
    expect((await leesActivatieStand('m1'))?.kanActiveren).toBe(false)
  })
  it('toont bij een geactiveerd team met open factuur de betaallink', async () => {
    zet({ team: { min_seats: 5, cyclus: 'maandelijks' } })
    db.arnobot_team_facturen = [{ team_id: 't1', status: 'open', bedrag_cent: 29645, mollie_payment_link_url: 'https://pay.test/x', created_at: dagenGeleden(1) }]
    const s = await leesActivatieStand('m1')
    expect(s).toMatchObject({ geactiveerd: true, kanActiveren: false, openFactuur: { bedragCent: 29645, betaalLink: 'https://pay.test/x' } })
  })
})

describe('activeerTeam', () => {
  const invoer = async () => { const r = await valideerActivatie(formulier); if (!r.ok) throw new Error(r.fout); return r.waarde }

  it('zet facturatie aan, deblokkeert, bewaart bedrijfsgegevens en maakt één factuur met betaallink', async () => {
    zet({ manager: { trial_start: dagenGeleden(45) }, team: { geblokkeerd_at: dagenGeleden(5) } })
    const r = await activeerTeam('m1', await invoer())
    expect(r).toMatchObject({ ok: true, seats: 5, betaalLink: 'https://pay.test/abc' })
    expect(db.arnobot_teams[0]).toMatchObject({ min_seats: 5, cyclus: 'jaarlijks', geblokkeerd_at: null })
    expect(db.arnobot_billing_customers[0]).toMatchObject({ user_id: 'm1', mollie_customer_id: 'cst_1', klant_type: 'zakelijk', bedrijfsnaam: 'Voorbeeld BV', btw_nummer: 'NL123456789B01' })
    expect(maakFactuur).toHaveBeenCalledOnce()
    const [team, factuur] = maakFactuur.mock.calls[0]
    expect(team.id).toBe('t1')
    expect(factuur).toMatchObject({ soort: 'regulier', seats: 5, zonderBoekhouding: false })
    // jaarlijks: de periode loopt een jaar
    expect(Math.round((factuur.periodeEinde.getTime() - factuur.periodeStart.getTime()) / 86_400_000)).toBeGreaterThanOrEqual(365)
    expect(logActie).toHaveBeenCalledWith(expect.objectContaining({ actie: 'team_geactiveerd', doelTeamId: 't1', details: { nieuw: { cyclus: 'jaarlijks', gebruikers: 5, bedrijf: 'Voorbeeld BV' } } }))
    expect(notify).toHaveBeenCalledOnce()
  })

  it('een tweede aanroep na de eerste wordt door de standcontrole geweigerd', async () => {
    zet()
    const i = await invoer()
    await activeerTeam('m1', i)
    expect(await activeerTeam('m1', i)).toMatchObject({ ok: false, status: 409 })
    expect(maakFactuur).toHaveBeenCalledOnce()
  })

  it('daarna is het team geen proef meer: de stand toont geactiveerd en niet meer activeerbaar', async () => {
    zet()
    await activeerTeam('m1', await invoer())
    expect(await leesActivatieStand('m1')).toMatchObject({ geactiveerd: true, kanActiveren: false })
  })

  it('maakt bij twee gelijktijdige aanroepen (dubbele klik) maar één factuur', async () => {
    zet()
    const i = await invoer()
    const [a, b] = await Promise.all([activeerTeam('m1', i), activeerTeam('m1', i)])
    expect([a.ok, b.ok].filter(Boolean)).toHaveLength(1)
    expect([a, b].find(r => !r.ok)).toMatchObject({ ok: false, status: 409 })
    expect(maakFactuur).toHaveBeenCalledOnce()
  })

  it('weigert iemand die geen team beheert', async () => {
    zet()
    expect(await activeerTeam('l1', await invoer())).toMatchObject({ ok: false, status: 404 })
    expect(maakFactuur).not.toHaveBeenCalled()
  })

  it('weigert een manager zonder agent-proef en laat het team ongemoeid', async () => {
    zet({ manager: { sd_attribution_method: null } })
    expect(await activeerTeam('m1', await invoer())).toMatchObject({ ok: false, status: 409 })
    expect(db.arnobot_teams[0].min_seats).toBeNull()
    expect(maakFactuur).not.toHaveBeenCalled()
  })

  it('maakt voor het interne testteam geen boekhoudfactuur', async () => {
    zet({ team: { id: TEST_PROEF_TEAM_ID } })
    db.arnobot_team_members = [{ team_id: TEST_PROEF_TEAM_ID, user_id: 'm1', role: 'manager' }]
    await activeerTeam('m1', await invoer())
    expect(maakFactuur.mock.calls[0][1]).toMatchObject({ zonderBoekhouding: true })
  })

  it('hergebruikt een bestaande Mollie-klant in plaats van een nieuwe aan te maken', async () => {
    zet()
    db.arnobot_billing_customers = [{ user_id: 'm1', mollie_customer_id: 'cst_oud', klant_type: 'particulier' }]
    await activeerTeam('m1', await invoer())
    expect(maakKlant).not.toHaveBeenCalled()
    expect(db.arnobot_billing_customers[0]).toMatchObject({ mollie_customer_id: 'cst_oud', klant_type: 'zakelijk' })
  })
})

describe('leesLidVanGeblokkeerdTeam', () => {
  const lidRij = (teamRij: Rij) => { db.arnobot_team_members = [{ user_id: 'l1', role: 'member', arnobot_teams: teamRij }, { user_id: 'm1', role: 'manager', arnobot_teams: teamRij }] }
  it('herkent een lid van een geblokkeerd team', async () => {
    lidRij({ name: 'Team Een', geblokkeerd_at: dagenGeleden(1) })
    expect(await leesLidVanGeblokkeerdTeam('l1')).toEqual({ teamNaam: 'Team Een' })
  })
  it('geeft null voor een lid van een actief team en voor de manager zelf', async () => {
    lidRij({ name: 'Team Een', geblokkeerd_at: null })
    expect(await leesLidVanGeblokkeerdTeam('l1')).toBeNull()
    lidRij({ name: 'Team Een', geblokkeerd_at: dagenGeleden(1) })
    expect(await leesLidVanGeblokkeerdTeam('m1')).toBeNull()
  })
})
