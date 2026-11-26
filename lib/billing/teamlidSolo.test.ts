import { describe, it, expect, vi, beforeEach } from 'vitest'

// Bewijst wat er gebeurt als iemand met een eigen abonnement of proef een teamuitnodiging accepteert:
// de incasso stopt zonder restitutie, een lopende proef vervalt, en een mislukte stop breekt niets.

type Rij = Record<string, unknown>
const { db, notify, stopMollie, referral } = vi.hoisted(() => ({
  db: { approved_users: [] as Rij[], arnobot_subscriptions: [] as Rij[], arnobot_referral_acties: [] as Rij[] },
  referral: { meeloop: true, teksten: {} as Record<string, string> },
  notify: vi.fn(),
  stopMollie: vi.fn(),
}))

function bouwer(tabel: 'approved_users' | 'arnobot_subscriptions' | 'arnobot_referral_acties') {
  const filters: ((r: Rij) => boolean)[] = []
  let op: 'select' | 'update' = 'select'
  let waarden: Rij = {}
  const b: Record<string, unknown> = {}
  const uitvoer = () => {
    const raak = db[tabel].filter(r => filters.every(f => f(r)))
    if (op === 'update') { raak.forEach(r => Object.assign(r, waarden)); return { data: raak, error: null } }
    return { data: raak, error: null }
  }
  b.select = () => b
  b.eq = (k: string, v: unknown) => { filters.push(r => r[k] === v); return b }
  b.order = () => b
  b.limit = () => b
  b.update = (w: Rij) => { op = 'update'; waarden = w; return b }
  b.maybeSingle = () => Promise.resolve({ data: (uitvoer().data as Rij[])[0] ?? null, error: null })
  b.then = (ok: (v: unknown) => unknown) => Promise.resolve(uitvoer()).then(ok)
  return b
}

vi.mock('./db', () => ({ billingDb: { from: bouwer } }))
vi.mock('./verwerking', () => ({ stopMollieAbonnement: stopMollie }))
vi.mock('@/lib/cron-notify', () => ({ notifyTelegram: notify }))
vi.mock('./referralTeksten', () => ({ TERUGSTORT_OMSCHRIJVING: referral.teksten }))
vi.mock('./referralStand', () => ({ get MEELOOP() { return referral.meeloop } }))

const { stopSoloBijJoin, restantNaarRato } = await import('./teamlidSolo')

const nu = new Date('2026-11-15T12:00:00Z')
const dagenGeleden = (d: number) => new Date(nu.getTime() - d * 86_400_000).toISOString()
const dagenVooruit = (d: number) => new Date(nu.getTime() + d * 86_400_000).toISOString()

function zet(o: { user?: Rij; sub?: Rij | null } = {}) {
  db.approved_users = [{ user_id: 'u1', voornaam: 'Jan', email: 'jan@x.nl', paid_at: null, expires_at: null, trial_start: dagenGeleden(5), ...o.user }]
  db.arnobot_subscriptions = o.sub === null ? [] : o.sub ? [{ id: 's1', user_id: 'u1', status: 'active', plan: 'basis', cyclus: 'maandelijks', periode_einde: dagenVooruit(12), mollie_subscription_id: 'sub_1', ...o.sub }] : []
}

beforeEach(() => {
  notify.mockReset(); stopMollie.mockReset()
  stopMollie.mockResolvedValue(true)
})

describe('stopSoloBijJoin', () => {
  it('stopt de incasso van een betalend lid, laat de betaalperiode uitlopen en meldt Arno', async () => {
    zet({ user: { paid_at: dagenGeleden(18), expires_at: dagenVooruit(12), trial_start: dagenGeleden(60) }, sub: {} })
    const r = await stopSoloBijJoin('u1', 'Team Een', nu)
    expect(r).toMatchObject({ abonnement: 'gestopt', omschrijving: 'Basic maandelijks', proefBeeindigd: false })
    expect(stopMollie).toHaveBeenCalledOnce()
    expect(db.arnobot_subscriptions[0]).toMatchObject({ status: 'cancelled', opzegging_ingaat_at: db.arnobot_subscriptions[0].periode_einde })
    // geen restitutie en de toegang blijft zoals de betaalperiode: expires_at wordt niet aangeraakt
    expect(db.approved_users[0].expires_at).toBe(dagenVooruit(12))
    expect(notify.mock.calls[0][0]).toContain('geen restitutie')
    expect(notify.mock.calls[0][0]).toContain('Team Een')
  })

  it('laat een lopende proef vervallen, ook de resterende dagen', async () => {
    zet({ sub: null })
    const r = await stopSoloBijJoin('u1', 'Team Een', nu)
    expect(r).toMatchObject({ abonnement: 'geen', proefBeeindigd: true })
    expect(db.approved_users[0].expires_at).toBe(nu.toISOString())
    expect(notify.mock.calls[0][0]).toContain('resterende dagen vervallen')
  })

  it('doet niets en meldt niets bij iemand zonder abonnement en met een afgelopen proef', async () => {
    zet({ user: { trial_start: dagenGeleden(45) }, sub: null })
    const r = await stopSoloBijJoin('u1', 'Team Een', nu)
    expect(r).toEqual({ abonnement: 'geen', proefBeeindigd: false, handmatigBetaald: false })
    expect(notify).not.toHaveBeenCalled()
    expect(db.approved_users[0].expires_at).toBeNull()
  })

  it('markeert het abonnement niet als gestopt als Mollie de stop niet bevestigt, en meldt dat', async () => {
    stopMollie.mockResolvedValue(false)
    zet({ user: { paid_at: dagenGeleden(18), expires_at: dagenVooruit(12), trial_start: dagenGeleden(60) }, sub: {} })
    const r = await stopSoloBijJoin('u1', 'Team Een', nu)
    expect(r.abonnement).toBe('mislukt')
    expect(db.arnobot_subscriptions[0].status).toBe('active')
    expect(notify.mock.calls[0][0]).toContain('STOPPEN MISLUKT')
  })

  it('beëindigt een gezette einddatum niet (alleen een proef zonder betaling of einddatum)', async () => {
    zet({ user: { expires_at: dagenVooruit(20) }, sub: null })
    const r = await stopSoloBijJoin('u1', 'Team Een', nu)
    expect(r.proefBeeindigd).toBe(false)
    expect(db.approved_users[0].expires_at).toBe(dagenVooruit(20))
  })

  it('meldt een handmatig betaald lid zonder online abonnement, zonder iets te stoppen', async () => {
    zet({ user: { paid_at: dagenGeleden(100), trial_start: dagenGeleden(200) }, sub: null })
    const r = await stopSoloBijJoin('u1', 'Team Een', nu)
    expect(r).toMatchObject({ abonnement: 'geen', handmatigBetaald: true })
    expect(stopMollie).not.toHaveBeenCalled()
    expect(notify.mock.calls[0][0]).toContain('handmatig betaald')
  })

  it('raakt een intern testaccount nooit aan', async () => {
    const { MANUAL_TEST_USER_ID } = await import('@/lib/internalTestAccounts')
    db.approved_users = [{ user_id: MANUAL_TEST_USER_ID, trial_start: dagenGeleden(5) }]
    const r = await stopSoloBijJoin(MANUAL_TEST_USER_ID, 'Team Een', nu)
    expect(r.proefBeeindigd).toBe(false)
    expect(db.approved_users[0].expires_at).toBeUndefined()
  })

  it('gooit nooit een fout door: joinen mag hier niet op mislukken', async () => {
    zet({ user: { paid_at: dagenGeleden(18), expires_at: dagenVooruit(12), trial_start: dagenGeleden(60) }, sub: {} })
    stopMollie.mockRejectedValue(new Error('mollie down'))
    const r = await stopSoloBijJoin('u1', 'Team Een', nu)
    expect(r.abonnement).toBe('mislukt')
  })
})

describe('restantNaarRato (indicatie voor een eventuele deelrestitutie)', () => {
  const jaar = { cyclus: 'jaarlijks' as const, bedrag_cent: 36_000, periode_start: dagenGeleden(90), periode_einde: dagenVooruit(275) }

  it('rekent de resterende looptijd van een jaarabonnement naar rato uit', () => {
    const r = restantNaarRato(jaar, nu)!
    expect(r.dagen).toBe(275)
    expect(r.maanden).toBe(9)
    expect(r.bedragCent).toBe(Math.round(36_000 * (275 / 365)))
  })
  it('geeft niets voor een maandabonnement', () => {
    expect(restantNaarRato({ ...jaar, cyclus: 'maandelijks' }, nu)).toBeNull()
  })
  it('geeft niets als er minder dan twee maanden over zijn of de periode al voorbij is', () => {
    expect(restantNaarRato({ ...jaar, periode_einde: dagenVooruit(40) }, nu)).toBeNull()
    expect(restantNaarRato({ ...jaar, periode_einde: dagenGeleden(1) }, nu)).toBeNull()
  })
  it('geeft niets zonder periodedatums', () => {
    expect(restantNaarRato({ ...jaar, periode_start: null }, nu)).toBeNull()
    expect(restantNaarRato({ ...jaar, periode_einde: null }, nu)).toBeNull()
  })
})

describe('de Telegram bij een jaarabonnement', () => {
  it('noemt de resterende looptijd en het bedrag naar rato en suggereert een deelrestitutie', async () => {
    zet({ user: { paid_at: dagenGeleden(90), expires_at: dagenVooruit(275), trial_start: dagenGeleden(200) }, sub: { cyclus: 'jaarlijks', bedrag_cent: 36_000, periode_start: dagenGeleden(90), periode_einde: dagenVooruit(275) } })
    const r = await stopSoloBijJoin('u1', 'Team Een', nu)
    expect(r.naarRato).toMatchObject({ maanden: 9, dagen: 275 })
    const tekst = notify.mock.calls[0][0] as string
    expect(tekst).toContain('Nog 9 maanden betaald')
    expect(tekst).toContain('deelrestitutie')
    expect(tekst).toContain('€')
  })
  it('laat dat weg bij een maandabonnement', async () => {
    zet({ user: { paid_at: dagenGeleden(18), expires_at: dagenVooruit(12), trial_start: dagenGeleden(60) }, sub: {} })
    const r = await stopSoloBijJoin('u1', 'Team Een', nu)
    expect(r.naarRato).toBeUndefined()
    expect(notify.mock.calls[0][0]).not.toContain('deelrestitutie')
  })
})

describe('F9: de melding zegt alleen dat het systeem het referraltegoed doet als dat echt zo is', () => {
  const jaarSub = { cyclus: 'jaarlijks', bedrag_cent: 22800, periode_start: dagenGeleden(30), periode_einde: dagenVooruit(335) }
  const meld = async () => {
    zet({ user: { paid_at: dagenGeleden(30), expires_at: dagenVooruit(335), trial_start: dagenGeleden(90) }, sub: jaarSub })
    await stopSoloBijJoin('u1', 'Team Een', nu)
    return notify.mock.calls[0][0] as string
  }
  const alles = () => { vi.stubEnv('REFERRAL_TERUGSTORTEN', 'true')
  vi.stubEnv('REFERRAL_TEGOED_VERREKENEN', 'true'); referral.teksten.tegoed_terugstorten = 'x' }

  beforeEach(() => { referral.meeloop = true; delete referral.teksten.tegoed_terugstorten; vi.stubEnv('REFERRAL_TERUGSTORTEN', '') })

  it('schakelaar en tekst, maar het grootboek loopt nog mee: de gewone waarschuwing', async () => {
    alles()
    const tekst = await meld()
    expect(tekst).toContain('Is er ook referraltegoed, tel het niet dubbel.')
    expect(tekst).not.toContain('stort het systeem zelf')
  })
  it('pas met een echt grootboek erbij zegt hij dat het systeem het doet', async () => {
    alles()
    referral.meeloop = false
    expect(await meld()).toContain('Referraltegoed stort het systeem zelf terug.')
  })
  it('alles uit: als voorheen', async () => {
    referral.meeloop = false
    expect(await meld()).toContain('Is er ook referraltegoed, tel het niet dubbel.')
  })
})
