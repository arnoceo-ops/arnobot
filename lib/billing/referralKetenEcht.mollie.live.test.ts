/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { chromium, type Browser } from 'playwright'

// KETENPROEF met het ECHTE grootboek (REFERRAL_GROOTBOEK_ECHT): echte code, testdatabase arnobot-test, Mollie testmodus.
// De omschrijvingen zijn de vastgestelde uit referralTeksten.ts. De webhookcode wordt rechtstreeks aangeroepen.
// Mail en Telegram worden alleen opgevangen.
//   RUN_LIVE_KETEN_ECHT=true node --env-file=.env.testomgeving node_modules/vitest/vitest.mjs run lib/billing/referralKetenEcht.mollie.live.test.ts
const LIVE = process.env.RUN_LIVE_KETEN_ECHT === 'true'
const TESTDATABASE = 'https://slvrlofthwmoyoyxfqbi.supabase.co'
const VERBODEN = ['TELEGRAM_BOT_TOKEN', 'RESEND_API_KEY', 'MONEYBIRD_API_TOKEN', 'MONEYBIRD_OOK_IN_TESTMODUS', 'CLERK_SECRET_KEY']

const opgevangen = vi.hoisted(() => ({ mails: [] as string[], telegram: [] as string[] }))
vi.mock('@/lib/mail', () => ({
  verstuurMail: async (m: { subject: string }) => { opgevangen.mails.push(m.subject); return { data: { id: 'proef' }, error: null } },
  telMail: async () => {},
}))
vi.mock('@/lib/cron-notify', () => ({
  notifyTelegram: async (t: string) => { opgevangen.telegram.push(t); return true },
  notifyCronFailure: async (naam: string, e: unknown) => { opgevangen.telegram.push(`cron ${naam}: ${String(e)}`) },
}))

const DAG = 24 * 60 * 60 * 1000
const meld = (stap: string, uitkomst: unknown) => console.log(`ECHT ${stap}: ${JSON.stringify(uitkomst)}`)
const wacht = (ms: number) => new Promise(r => setTimeout(r, ms))

let browser: Browser

/** Pas na de controles worden de env-schakelaars gezet en de app-modules geladen (MEELOOP wordt bij het laden bepaald). */
async function omgeving() {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL !== TESTDATABASE) throw new Error('STOP: dit is niet de testdatabase arnobot-test.')
  const key = process.env.MOLLIE_API_KEY ?? ''
  if (!key.startsWith('test_')) throw new Error('STOP: alleen met een Mollie test_-sleutel.')
  const geladen = VERBODEN.filter(n => !!process.env[n])
  if (geladen.length) throw new Error(`STOP: deze instellingen horen niet in de testomgeving: ${geladen.join(', ')}`)
  process.env.MOLLIE_TEST_WEBHOOK_URL = 'https://example.com/arnobot-testwebhook'
  process.env.REFERRAL_GROOTBOEK_ECHT = 'true'
  process.env.REFERRAL_TERUGSTORTEN = 'true'
  process.env.REFERRAL_TEGOED_VERREKENEN = 'true'
  process.env.HERROEPING_OPEN = 'true'

  const { billingDb } = await import('./db')
  const m = await import('./mollie')
  const { POST: webhook } = await import('@/app/api/webhooks/mollie/route')
  const planner = await import('./referralPlanner')
  const machine = await import('./referralTerugstorten')
  const grootboek = await import('./referralGrootboek')
  const nacontrole = await import('./referralNacontrole')
  const herroeping = await import('./herroeping')
  const teamFacturatie = await import('./teamFacturatie')
  const teamBetalingen = await import('./teamBetalingen')
  const { TERUGSTORT_OMSCHRIJVING } = await import('./referralTeksten')
  const { berekenBedrag } = await import('./prijzen')
  expect(grootboek.MEELOOP).toBe(false)
  expect(m.MOLLIE_WEBHOOK_URL).toBe('https://example.com/arnobot-testwebhook')

  const ruw = async (pad: string, init?: RequestInit) => {
    const r = await fetch(`https://api.mollie.com/v2${pad}`, { ...init, headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' } })
    return { status: r.status, json: (await r.json().catch(() => null)) as any }
  }
  const moet = async <T>(wat: string, vraag: PromiseLike<{ data: T; error: { message: string } | null }>) => {
    const r = await vraag
    if (r.error) throw new Error(`${wat}: ${r.error.message}`)
    return r.data
  }
  const roepWebhook = async (id: string) =>
    (await webhook(new Request('https://proef.invalid/api/webhooks/mollie', { method: 'POST', body: `id=${id}` }) as any)).status
  const testpagina = async (url: string, keuze: string) => {
    const pagina = await browser.newPage()
    await pagina.goto(url, { waitUntil: 'networkidle' })
    // Een betaallink begint bij de keuze van de betaalmethode.
    if (await pagina.$('button[value=ideal]')) {
      await pagina.click('button[value=ideal]')
      await pagina.click('button[value=ideal_INGBNL2A]')
    }
    await pagina.check(keuze)
    await pagina.click('button:has-text("Ga verder"), button:has-text("Continue")')
    await pagina.waitForLoadState('networkidle')
    await pagina.close()
  }

  const merk = () => `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`
  const gebruiker = async (id: string, proefStart: string) => {
    await moet('gebruiker', billingDb.from('approved_users').insert({ user_id: id, email: `${id}@example.com`, voornaam: 'Proef', trial_start: proefStart }))
    return id
  }
  type Wie = { userId: string; mollieKlant: string; sub: any; brutoCent: number; teller: number }
  const metAbonnement = async (userId: string, cyclus: 'maandelijks' | 'jaarlijks', klantType: 'particulier' | 'zakelijk', maandenTerug: number): Promise<Wie> => {
    const mollieKlant = (await m.maakKlant({ naam: 'Proef Keten', email: 'proef@example.com', userId })).id
    const mandaat = await ruw(`/customers/${mollieKlant}/mandates`, { method: 'POST', body: JSON.stringify({ method: 'directdebit', consumerName: 'Proef Keten', consumerAccount: 'NL55INGB0000000000' }) })
    expect(mandaat.status).toBe(201)
    const einde = new Date(); einde.setUTCMonth(einde.getUTCMonth() - maandenTerug)
    const begin = new Date(einde); begin.setUTCMonth(begin.getUTCMonth() - 1)
    const bedrag = berekenBedrag('basis', cyclus, klantType)
    const sub = await moet('abonnement', billingDb.from('arnobot_subscriptions').insert({
      user_id: userId, plan: 'basis', cyclus, klant_type: klantType, status: 'active', bedrag_cent: bedrag.brutoCent, btw_cent: bedrag.btwCent,
      mollie_customer_id: mollieKlant, periode_start: begin.toISOString(), periode_einde: einde.toISOString(), created_at: begin.toISOString(),
    }).select('*').single())
    return { userId, mollieKlant, sub, brutoCent: bedrag.brutoCent, teller: 0 }
  }
  const betaal = async (wie: Wie, brutoCent = wie.brutoCent) => {
    const naam = `${wie.userId}-${++wie.teller}`
    const p = await m.maakLosseHerhaalBetaling({ klantId: wie.mollieKlant, brutoCent, omschrijving: `Keten echt ${naam}`, metadata: { subscriptionRowId: wie.sub.id }, idempotencyKey: `echt-${naam}`.slice(-64) })
    let stand = (await ruw(`/payments/${p.id}`)).json
    await testpagina(stand._links.changePaymentState.href, 'input[name=final_state][value=paid]')
    for (let i = 0; i < 20 && stand.status !== 'paid'; i++) { await wacht(1500); stand = (await ruw(`/payments/${p.id}`)).json }
    expect(stand.status).toBe('paid')
    expect(await roepWebhook(p.id)).toBe(200)
    // Betaalmomenten van Mollie zijn op de seconde: zo staan opeenvolgende gebeurtenissen ook echt na elkaar.
    await wacht(2000)
    return (await moet('betaalrij', billingDb.from('arnobot_payments').select('*').eq('mollie_payment_id', p.id).single())) as any
  }
  const terugboeken = async (betaling: any) => {
    const stand = (await ruw(`/payments/${betaling.mollie_payment_id}`)).json
    await testpagina(stand._links.changePaymentState.href, 'input[name=action][value=create-chargeback]')
    let bedrag = '0.00'
    for (let i = 0; i < 20 && bedrag === '0.00'; i++) { await wacht(1500); bedrag = (await ruw(`/payments/${betaling.mollie_payment_id}`)).json.amountChargedBack?.value ?? '0.00' }
    expect(bedrag).not.toBe('0.00')
    expect(await roepWebhook(betaling.mollie_payment_id)).toBe(200)
  }
  /** Een aangebrachte klant die per jaar zakelijk betaalt: die kwalificeert meteen. */
  const nieuweKlant = async (aanbrengerId: string) => {
    const tag = merk()
    const aangemeld = new Date(Date.now() - 10 * DAG).toISOString()
    const id = await gebruiker(`user_keten_echt_klant_${tag}`, aangemeld)
    const referral = (await moet('referral', billingDb.from('arnobot_referrals')
      .insert({ referrer_user_id: aanbrengerId, referred_user_id: id, code_used: `ECHT-${tag}`, created_at: aangemeld }).select('*').single())) as any
    const wie = await metAbonnement(id, 'jaarlijks', 'zakelijk', 0)
    return { wie, referral }
  }
  const aanbrengerMetAbonnement = async () => {
    const id = await gebruiker(`user_keten_echt_aanbrenger_${merk()}`, new Date(Date.now() - 100 * DAG).toISOString())
    return metAbonnement(id, 'maandelijks', 'particulier', 2)
  }

  const nieuwTeam = async (managerId: string) =>
    (await moet('team', billingDb.from('arnobot_teams').insert({ name: `Proefteam ${merk()}`, manager_id: managerId, min_seats: 3, cyclus: 'maandelijks' }).select('*').single())) as any
  /** Een reguliere maandfactuur van zoveel maanden terug, betaald via een echte betaallink en verwerkt door de teamwebhookcode. */
  const betaalTeamFactuur = async (teamId: string, maandenTerug: number, brutoCent = 20000) => {
    const dag = (terug: number) => { const d = new Date(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - terug); return d }
    const rij = (await moet('teamfactuur', billingDb.from('arnobot_team_facturen').insert({
      team_id: teamId, periode_start: dag(maandenTerug).toISOString().slice(0, 10), periode_einde: dag(maandenTerug - 1).toISOString().slice(0, 10),
      cyclus: 'maandelijks', soort: 'regulier', seats_aantal: 3, bedrag_cent: brutoCent, btw_cent: Math.round(brutoCent - brutoCent / 1.21), status: 'open',
      created_at: dag(maandenTerug).toISOString(),
    }).select('*').single())) as any
    const link = await m.maakBetaalLink({
      brutoCent, omschrijving: `Keten echt team ${merk()}`, redirectUrl: 'https://example.com/terug',
      webhookUrl: 'https://example.com/arnobot-testwebhook', idempotencyKey: `echt-team-${rij.id}`.slice(-64),
    })
    await moet('betaallink', billingDb.from('arnobot_team_facturen').update({ mollie_payment_link_id: link.id, mollie_payment_link_url: link.url }).eq('id', rij.id))
    await testpagina(link.url, 'input[name=final_state][value=paid]')
    let uitkomst = 'niets'
    for (let i = 0; i < 20 && uitkomst === 'niets'; i++) { await wacht(1500); uitkomst = await teamFacturatie.verwerkTeamBetaling(link.id, rij.id) }
    expect(uitkomst).toBe('betaald')
    await wacht(2000)
    return (await moet('teamfactuurrij', billingDb.from('arnobot_team_facturen').select('*').eq('id', rij.id).single())) as any
  }

  const later = () => new Date(Date.now() + 8 * DAG)
  const boekGrootboek = async () => {
    const run = await grootboek.draaiGrootboek(new Date(), { schrijf: true })
    expect(run.fouten).toEqual([])
    return run
  }
  const plan = async (userId: string) => {
    const ronde = await planner.planReferral(later(), { uitvoeren: true })
    expect(ronde.fouten).toEqual([])
    return ronde.voornemens.filter(v => v.userId === userId)
  }
  const verstuur = async () => expect((await machine.verwerkOpenTerugstortingen(later())).fouten).toEqual([])
  const regels = async (aanbrengerId: string) => (await moet('regels', billingDb.from('arnobot_referral_grootboek').select('*').eq('aanbrenger_user_id', aanbrengerId).order('created_at'))) as any[]

  return {
    billingDb, m, ruw, moet, grootboek, nacontrole, machine, herroeping, TERUGSTORT_OMSCHRIJVING, berekenBedrag, later, roepWebhook,
    nieuwTeam, betaalTeamFactuur, teamFacturatie, teamBetalingen,
    gebruiker, metAbonnement, betaal, terugboeken, nieuweKlant, aanbrengerMetAbonnement, boekGrootboek, plan, verstuur, regels, merk,
  }
}

describe.skipIf(!LIVE)('ketenproef met het echte grootboek (testmodus, testdatabase)', () => {
  beforeAll(async () => { browser = await chromium.launch() })
  afterAll(async () => { await browser?.close() })

  it('zelf boeken, verrekenen, terugboeking wordt schuld, volgend tegoed lost haar af, daarna weer uitbetalen', { timeout: 900_000 }, async () => {
    const o = await omgeving()
    const a = await o.aanbrengerMetAbonnement()

    const k1 = await o.nieuweKlant(a.userId)
    const bron1 = await o.betaal(k1.wie)
    await o.boekGrootboek()
    const na1 = await o.regels(a.userId)
    expect(na1.map(r => [r.soort, r.netto_cent, r.meeloop])).toEqual([['toekenning', 1900, false]])
    expect(na1[0].bron_ids).toEqual([bron1.mollie_payment_id])
    expect(Date.parse(na1[0].verdiend_at)).toBe(Date.parse(bron1.betaald_at))

    // Nog een ronde boekt niets dubbel.
    await o.boekGrootboek()
    expect(await o.regels(a.userId)).toHaveLength(1)

    const verlenging1 = await o.betaal(a)
    const plan1 = await o.plan(a.userId)
    expect(plan1.filter(v => v.stand === 'gereserveerd').map(v => [v.betalingId, v.brutoCent])).toEqual([[verlenging1.id, 2299]])
    await o.verstuur()
    const refunds1 = await o.ruw(`/payments/${verlenging1.mollie_payment_id}/refunds`)
    const refund = refunds1.json._embedded.refunds[0]
    expect([refund.amount.value, refund.description]).toEqual(['22.99', o.TERUGSTORT_OMSCHRIJVING.tegoed_terugstorten])
    meld('1 geboekt en verrekend', { regels: (await o.regels(a.userId)).map(r => `${r.soort} ${r.netto_cent}`), omschrijving: refund.description })

    await o.terugboeken(bron1)
    // Zonder meegegeven stand: de nacontrole volgt nu zelf de echte stand.
    const controle = await o.nacontrole.draaiNacontrole(o.later())
    expect(controle.meeloop).toBe(false)
    expect(controle.geboekt.filter(r => r.referral_id === k1.referral.id).map(r => [r.soort, r.netto_cent])).toEqual([['terugdraaiing', -1900]])

    const k2 = await o.nieuweKlant(a.userId)
    await o.betaal(k2.wie)
    await o.boekGrootboek()
    const verlenging2 = await o.betaal(a)
    const plan2 = await o.plan(a.userId)
    expect(plan2.filter(v => v.stand === 'gereserveerd')).toHaveLength(0)
    meld('2 schuld eet het volgende tegoed', { voornemens: plan2.map(v => `${v.stand} ${v.reden}`) })

    const k3 = await o.nieuweKlant(a.userId)
    await o.betaal(k3.wie)
    await o.boekGrootboek()
    const verlenging3 = await o.betaal(a)
    const plan3 = await o.plan(a.userId)
    // De tweede verlenging viel voor het derde tegoed: daar gaat niets op.
    expect(plan3.filter(v => v.stand === 'gereserveerd').map(v => [v.betalingId, v.brutoCent])).toEqual([[verlenging3.id, 2299]])
    await o.verstuur()
    expect(await o.m.lijstBetalingTerugbetalingen(verlenging2.mollie_payment_id)).toHaveLength(0)
    expect(await o.m.lijstBetalingTerugbetalingen(verlenging3.mollie_payment_id)).toHaveLength(1)
    const sub = (await o.moet('abonnement', o.billingDb.from('arnobot_subscriptions').select('*').eq('id', a.sub.id).single())) as any
    expect(sub.status).toBe('active')
    meld('3 daarna weer uitbetaald', { regels: (await o.regels(a.userId)).map(r => `${r.soort} ${r.netto_cent}`), abonnement: sub.status })
  })

  it('aanbrenger wordt gewoon teamlid: teruggestort over zijn eigen laatste betaling', { timeout: 600_000 }, async () => {
    const o = await omgeving()
    const a = await o.aanbrengerMetAbonnement()
    const eigen1 = await o.betaal(a)
    const eigen2 = await o.betaal(a)
    const k = await o.nieuweKlant(a.userId)
    await o.betaal(k.wie)

    // Hij gaat als gewoon lid in een team van iemand anders: zijn eigen abonnement is afgelopen.
    const manager = await o.gebruiker(`user_keten_echt_manager_${o.merk()}`, new Date(Date.now() - 100 * DAG).toISOString())
    const team = (await o.moet('team', o.billingDb.from('arnobot_teams').insert({ name: `Proefteam ${o.merk()}`, manager_id: manager }).select('*').single())) as any
    await o.moet('teamlid', o.billingDb.from('arnobot_team_members').insert({ team_id: team.id, user_id: a.userId, role: 'member' }))
    await o.moet('abonnement stoppen', o.billingDb.from('arnobot_subscriptions').update({ status: 'ended', periode_einde: new Date(Date.now() - DAG).toISOString() }).eq('id', a.sub.id))

    await o.boekGrootboek()
    const regel = (await o.regels(a.userId)).find(r => r.soort === 'toekenning')
    expect(regel?.reden).toContain('teamlid')
    const voornemens = await o.plan(a.userId)
    meld('4 teamlid', { regel: `${regel.netto_cent} ${regel.reden}`, voornemens: voornemens.map(v => `${v.soort} ${v.stand} ${v.brutoCent} ${v.betalingId === eigen2.id ? 'laatste' : v.betalingId === eigen1.id ? 'eerdere' : ''} ${v.reden}`) })
    expect(voornemens.filter(v => v.stand === 'gereserveerd').map(v => [v.betalingId, v.brutoCent])).toEqual([[eigen2.id, 2299]])
    await o.verstuur()
    expect((await o.m.lijstBetalingTerugbetalingen(eigen2.mollie_payment_id)).map((r: any) => r.amount.value)).toEqual(['22.99'])
    expect(await o.m.lijstBetalingTerugbetalingen(eigen1.mollie_payment_id)).toHaveLength(0)
    expect((await o.plan(a.userId)).filter(v => v.stand === 'gereserveerd' || v.stand === 'vervalt')).toHaveLength(0)
  })

  it('een handmatige toekenning krijgt haar betalingskenmerken en wordt tot en met Mollie uitbetaald', { timeout: 600_000 }, async () => {
    const o = await omgeving()
    const a = await o.aanbrengerMetAbonnement()
    const k = await o.nieuweKlant(a.userId)
    // Zoals een besluit van voor de drempel: wel toegekend, zonder betalingskenmerken.
    await o.moet('handmatig', o.billingDb.rpc('referral_boek', { p_regel: {
      soort: 'toekenning', referral_id: k.referral.id, aanbrenger_user_id: a.userId, klant_user_id: k.wie.userId,
      netto_cent: 1900, klant_maand_netto_cent: 1900, reden: 'handmatig besluit: proef',
    } }))
    const bron = await o.betaal(k.wie)
    await o.boekGrootboek()
    expect((await o.regels(a.userId))[0].bron_ids).toEqual([bron.mollie_payment_id])
    const verlenging = await o.betaal(a)
    expect((await o.plan(a.userId)).filter(v => v.stand === 'gereserveerd').map(v => v.betalingId)).toEqual([verlenging.id])
    await o.verstuur()
    expect((await o.m.lijstBetalingTerugbetalingen(verlenging.mollie_payment_id)).map((r: any) => r.amount.value)).toEqual(['22.99'])
    meld('6 handmatige toekenning', { bron_ids: 1, terugbetaald: '22.99' })
  })

  it('teams: tegoed op de teamfactuur van de aanbrenger en de gratis maand van een aangebracht team', { timeout: 900_000 }, async () => {
    const o = await omgeving()
    const refundsVan = async (f: any) => (await o.m.lijstBetalingTerugbetalingen(f.mollie_payment_id)).map((r: any) => [r.amount.value, r.description])
    const factuurNu = async (id: string) => (await o.moet('factuur', o.billingDb.from('arnobot_team_facturen').select('*').eq('id', id).single())) as any
    const manager = (soort: string) => o.gebruiker(`user_keten_echt_team_${soort}_${o.merk()}`, new Date(Date.now() - 100 * DAG).toISOString())

    // De aanbrenger betaalt een team: de eerste factuur telt niet als verlenging, de volgende wel.
    const aanbrenger = await manager('aanbrenger')
    const team = await o.nieuwTeam(aanbrenger)
    const eerste = await o.betaalTeamFactuur(team.id, 2)
    const k = await o.nieuweKlant(aanbrenger)
    await o.betaal(k.wie)
    await o.boekGrootboek()
    const verlenging = await o.betaalTeamFactuur(team.id, 1)
    const plan1 = await o.plan(aanbrenger)
    expect(plan1.filter(v => v.stand === 'gereserveerd').map(v => [v.betalingId, v.brutoCent])).toEqual([[verlenging.id, 2299]])
    await o.verstuur()
    expect(await refundsVan(verlenging)).toEqual([['22.99', o.TERUGSTORT_OMSCHRIJVING.tegoed_terugstorten]])
    expect(await refundsVan(eerste)).toEqual([])
    meld('7 tegoed op teamfactuur', { plan: plan1.map(v => `${v.stand} ${v.brutoCent} ${v.reden}`) })

    // Een aangebracht team: de vierde maandfactuur op rij gaat terug, tot de maandprijs bij de start.
    const klantManager = await o.gebruiker(`user_keten_echt_team_klant_${o.merk()}`, new Date(Date.now() - 10 * DAG).toISOString())
    const werver = await manager('werver')
    const referral = (await o.moet('referral', o.billingDb.from('arnobot_referrals').insert({
      referrer_user_id: werver, referred_user_id: klantManager, code_used: `ECHT-T-${o.merk()}`, created_at: new Date(Date.now() - 10 * DAG).toISOString(),
    }).select('*').single())) as any
    const klantTeam = await o.nieuwTeam(klantManager)
    const facturen: any[] = []
    for (const [terug, bedrag] of [[4, 20000], [3, 20000], [2, 30000], [1, 30000]]) facturen.push(await o.betaalTeamFactuur(klantTeam.id, terug, bedrag))
    const plan2 = await o.plan(klantManager)
    meld('8 aangebracht team', { plan: plan2.map(v => `${v.soort} ${v.stand} ${v.brutoCent} ${v.reden}`) })
    expect(plan2.filter(v => v.stand === 'gereserveerd').map(v => [v.soort, v.betalingId, v.brutoCent])).toEqual([['voordeel_maand', facturen[3].id, 20000]])
    await o.verstuur()
    expect(await refundsVan(facturen[3])).toEqual([['200.00', o.TERUGSTORT_OMSCHRIJVING.voordeel_maand]])

    // De teamwebhookcode en de nacontroles zien ons eigen referralgeld nooit als terugbetaling van de factuur.
    for (const f of [verlenging, facturen[3]]) await o.teamFacturatie.verwerkTeamBetaling(f.mollie_payment_link_id, f.id)
    const controle = await o.nacontrole.draaiNacontrole(o.later())
    expect(controle.geboekt.filter(r => r.referral_id === k.referral.id || r.referral_id === referral.id)).toEqual([])
    const na = [await factuurNu(verlenging.id), await factuurNu(facturen[3].id)]
    expect(na.map(f => [f.status, f.referral_refund_cent, f.reversed_at])).toEqual([['paid', 2299, null], ['paid', 20000, null]])
    await o.verstuur()
    expect((await o.plan(klantManager)).filter(v => v.stand === 'gereserveerd')).toHaveLength(0)
    const acties = (await o.moet('acties', o.billingDb.from('arnobot_referral_acties').select('*').in('user_id', [aanbrenger, klantManager]))) as any[]
    meld('9 daarna', { acties: acties.map(a => `${a.soort} ${a.doel_soort} ${a.status}`), terugbetaald: na.map(f => f.terugbetaald_cent) })
    expect(acties.map(a => a.doel_soort)).toEqual(['teamfactuur', 'teamfactuur'])
  })

  it.each([
    ['nog niet verstuurd', false],
    ['al verstuurd', true],
  ])('herroeping terwijl de jaarkorting %s is: samen nooit meer dan de betaling', { timeout: 600_000 }, async (_naam, verstuurd) => {
    const o = await omgeving()
    const aanbrenger = await o.gebruiker(`user_keten_echt_h_aanbrenger_${o.merk()}`, new Date(Date.now() - 100 * DAG).toISOString())
    const aangemeld = new Date(Date.now() - 10 * DAG).toISOString()
    const klant = await o.gebruiker(`user_keten_echt_h_klant_${o.merk()}`, aangemeld)
    await o.moet('referral', o.billingDb.from('arnobot_referrals').insert({ referrer_user_id: aanbrenger, referred_user_id: klant, code_used: `ECHT-H-${o.merk()}`, created_at: aangemeld }))
    const wie = await o.metAbonnement(klant, 'maandelijks', 'particulier', 1)
    await o.betaal(wie)
    const jaar = o.berekenBedrag('basis', 'jaarlijks', 'particulier')
    await o.moet('naar jaar', o.billingDb.from('arnobot_subscriptions').update({ cyclus: 'jaarlijks', bedrag_cent: jaar.brutoCent, btw_cent: jaar.btwCent }).eq('id', wie.sub.id))
    const jaarbetaling = await o.betaal(wie, jaar.brutoCent)

    const voornemens = await o.plan(klant)
    expect(voornemens.filter(v => v.stand === 'gereserveerd').map(v => [v.soort, v.brutoCent])).toEqual([['voordeel_jaar', 1900]])
    if (verstuurd) await o.verstuur()
    // De herroeping geldt voor een eerste betaling: de rij krijgt dat soort.
    await o.moet('soort eerste', o.billingDb.from('arnobot_payments').update({ soort: 'eerste' }).eq('id', jaarbetaling.id))

    const uitkomst = await o.herroeping.voerHerroepingUit(klant)
    const refunds = await o.m.lijstBetalingTerugbetalingen(jaarbetaling.mollie_payment_id)
    const acties = (await o.moet('acties', o.billingDb.from('arnobot_referral_acties').select('*').eq('user_id', klant))) as any[]
    await o.verstuur()
    const naRonde = await o.m.lijstBetalingTerugbetalingen(jaarbetaling.mollie_payment_id)
    const bedragen = refunds.map((r: any) => r.amount.value).sort()
    meld(`5 herroeping ${_naam}`, { uitkomst, terugbetalingen: bedragen, acties: acties.map(x => x.status), telegram: opgevangen.telegram.slice(-2).map(t => t.split('\n')[0]) })
    expect(bedragen).toEqual(verstuurd ? ['19.00', '209.00'] : ['228.00'])
    expect(naRonde).toHaveLength(refunds.length)
    expect(acties.map(x => x.status)).toEqual([verstuurd ? 'verzonden' : 'vrijgegeven'])
  })
})
