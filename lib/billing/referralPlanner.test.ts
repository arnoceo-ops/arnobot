/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// De planner, de nacontrole en de uitvoerronde, met een nagemaakte Mollie. De breukplekken uit
// docs/REFERRAL_BOUWPLAN_R3.md bij B2, B3a en B4.

const h = vi.hoisted(() => ({
  db: null as any,
  /** Tabellen die niet bestaan, en tabellen die een andere fout geven. */
  zonder: [] as string[],
  stuk: [] as string[],
  mp: {} as Record<string, any>,
  refunds: [] as any[],
  posts: [] as any[],
  mollieStuk: false,
  telegram: [] as string[],
  telegramStuk: false,
  gemeld: new Set<string>(),
  teksten: {} as Record<string, string>,
  seats: 3,
}))

const keten = (tabel: string, fout: any) => {
  const q: any = {}
  for (const m of ['select', 'order', 'limit', 'returns', 'range', 'eq', 'in', 'not', 'update', 'insert']) q[m] = () => q
  q.maybeSingle = async () => ({ data: null, error: fout })
  q.then = (ok: any) => ok({ data: null, error: fout })
  return q
}
vi.mock('./db', () => ({
  billingDb: {
    from(tabel: string) {
      if (h.zonder.includes(tabel)) return keten(tabel, { code: 'PGRST205', message: `Could not find the table 'public.${tabel}' in the schema cache` })
      if (h.stuk.includes(tabel)) return keten(tabel, { message: 'time-out' })
      return h.db.from(tabel)
    },
    rpc: (naam: string, p: any) => h.db.rpc(naam, p),
  },
}))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('./teamFacturatie', () => ({ huidigSeats: vi.fn(async () => h.seats) }))
vi.mock('./referralTeksten', () => ({ TERUGSTORT_OMSCHRIJVING: h.teksten }))
vi.mock('./mollie', async origineel => ({
  MollieError: (await origineel<typeof import('./mollie')>()).MollieError,
  mollieIngeschakeld: () => true,
  haalBetaling: vi.fn(async (id: string) => {
    if (h.mollieStuk) throw new Error('mollie plat')
    return { status: 'paid', ...h.mp[id] }
  }),
  lijstBetalingTerugbetalingen: vi.fn(async (id: string) => {
    if (h.mollieStuk) throw new Error('mollie plat')
    return h.refunds.filter(r => r.paymentId === id).map(r => ({ ...r }))
  }),
  betaalTerug: vi.fn(async (inv: any) => {
    h.posts.push(inv)
    const r = { id: `re_${h.refunds.length + 1}`, paymentId: inv.betalingId, status: 'pending', amount: { currency: 'EUR', value: (inv.brutoCent / 100).toFixed(2) }, metadata: inv.metadata, createdAt: new Date().toISOString() }
    h.refunds.push(r)
    return { id: r.id, status: r.status }
  }),
}))
vi.mock('./wie', () => ({ wieIs: vi.fn(async (id: string) => id) }))
vi.mock('@/lib/cron-notify', () => ({ notifyTelegram: vi.fn(async (t: string) => { if (h.telegramStuk) return false; h.telegram.push(t); return true }), notifyCronFailure: vi.fn() }))
vi.mock('@/lib/capaciteit', () => ({ nieuwMelden: vi.fn(async (sleutel: string) => (h.gemeld.has(sleutel) ? false : (h.gemeld.add(sleutel), true))) }))
vi.mock('@/lib/cronRun', () => ({ registreerCronRun: (_pad: string, handler: any) => handler }))

import { maakKetenDb } from './referralNepKeten'
import { planReferral, kiesVoordeel, isVerlenging, MAX_VRIJGAVEN_PER_DOEL } from './referralPlanner'
import { draaiNacontrole, portieVanVandaag, NACONTROLE_DAGEN } from './referralNacontrole'
import { draaiReferralUitvoeren } from './referralUitvoeren'
import { verwerkOpenTerugstortingen } from './referralTerugstorten'
import { isVolledigTerugbetaald } from './terugbetaling'
import { berekenBedrag, type Cyclus, type KlantType, type Plan } from './prijzen'
import { metJaarKorting } from './referralRegels'
import { saldoVan } from './referralSaldo'
import { MANUAL_TEST_USER_ID } from '@/lib/internalTestAccounts'
import { GET } from '@/app/api/cron/referral-uitvoeren/route'

const NU = new Date('2027-09-01T06:00:00.000Z')
const DAG = 24 * 60 * 60 * 1000
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const REF = uuid(900)
const OMSCHRIJVINGEN = { voordeel_jaar: 'a', voordeel_maand: 'b', tegoed_terugstorten: 'c' }
const dag = (d: string) => `${d}T10:00:00.000Z`

const gebruiker = (user_id: string, extra: any = {}) => ({
  user_id, email: `${user_id}@voorbeeld.nl`, voornaam: user_id, trial_start: dag('2027-01-01'), trial_reactivated_at: null, eerste_proef_start: null,
  ooit_teamlid_at: null, expires_at: null, paid_at: null, command_manager: false, sd_attribution_method: null, lifetime_sinds: null, gratis_sinds: null, ...extra,
})
const SUB: Record<string, number> = { aanbrenger: 1, klant: 2 }
const prijs = (plan: Plan, cyclus: Cyclus, klant: KlantType) => {
  const b = berekenBedrag(plan, cyclus, klant)
  return { bedrag_cent: b.brutoCent, btw_cent: b.btwCent }
}
const sub = (user_id: string, extra: any = {}) => {
  const r = { plan: 'premium', cyclus: 'maandelijks', klant_type: 'particulier', ...extra }
  return {
    id: uuid(SUB[user_id]), user_id, status: 'active', created_at: dag('2027-01-05'), updated_at: dag('2027-01-05'), periode_start: dag('2027-08-01'),
    periode_einde: dag('2027-10-01'), mollie_customer_id: `cst_${user_id}`, ...prijs(r.plan, r.cyclus, r.klant_type), ...r,
  }
}
let nummer = 0
/** Een betaalde periode van een maand (of een jaar). */
const bet = (user_id: string, van: string, tot: string, extra: any = {}) => {
  const r = { plan: 'premium', cyclus: 'maandelijks', klant_type: 'particulier', ...extra }
  const n = ++nummer
  return {
    id: uuid(100 + n), user_id, subscription_id: uuid(SUB[user_id]), mollie_payment_id: `tr_${user_id}${n}`, soort: 'herhaling', status: 'paid',
    ...prijs(r.plan, r.cyclus, r.klant_type), terugbetaald_cent: 0, teruggeboekt_cent: 0, referral_refund_cent: 0, betaald_at: dag(van),
    verwerkt_at: dag(van), terugbetaling_verwerkt_at: null, moneybird_factuur_id: null, periode_start: dag(van), periode_einde: dag(tot), ...r,
  }
}
const MAANDEN: [string, string][] = [['2027-02-01', '2027-03-01'], ['2027-03-01', '2027-04-01'], ['2027-04-01', '2027-05-01'], ['2027-05-01', '2027-06-01'], ['2027-06-01', '2027-07-01'], ['2027-07-01', '2027-08-01']]
const maanden = (user_id: string, aantal: number, extra: any = {}) => MAANDEN.slice(0, aantal).map(([van, tot], i) => bet(user_id, van, tot, { soort: i ? 'herhaling' : 'eerste', ...extra }))
const jaarbet = (user_id: string, van = '2027-05-01', extra: any = {}) => bet(user_id, van, van.replace('2027', '2028'), { cyclus: 'jaarlijks', ...extra })
const referral = (extra: any = {}) => ({ id: REF, referrer_user_id: 'aanbrenger', referred_user_id: 'klant', created_at: dag('2027-01-01'), referred_discount: null, status: 'signed_up', ...extra })
let regelNr = 0
const regel = (soort: string, ref: string, netto_cent: number | null, extra: any = {}) => ({
  id: uuid(500 + ++regelNr), created_at: dag('2027-03-15'), event_key: `${soort === 'toekenning' ? 'uitkomst' : soort}:${ref}`, meeloop: false, soort, referral_id: ref,
  // Standaard rust een toekenning op de bronbetaling die zaai klaarzet. Wie zelf bron_ids geeft, doet dat voor 'klant'.
  aanbrenger_user_id: 'aanbrenger', klant_user_id: 'bron_ids' in extra ? 'klant' : 'bronklant', netto_cent, reden: 'drempel gehaald', klant_maand_netto_cent: 1900, hoort_bij: null, actie_id: null,
  bron_ids: soort === 'toekenning' ? ['tr_bron'] : null, ...extra,
})
/** De betaling van een nieuwe gebruiker waar een toekenning op rust. */
const bronBetaling = (extra: any = {}) => ({
  id: uuid(99), user_id: 'bronklant', subscription_id: null, mollie_payment_id: 'tr_bron', soort: 'eerste', status: 'paid', bedrag_cent: 22800, btw_cent: 3957,
  terugbetaald_cent: 0, teruggeboekt_cent: 0, referral_refund_cent: 0, betaald_at: dag('2027-02-01'), verwerkt_at: dag('2027-02-01'), terugbetaling_verwerkt_at: null,
  moneybird_factuur_id: null, plan: 'basis', cyclus: 'jaarlijks', klant_type: 'zakelijk', periode_start: dag('2027-02-01'), periode_einde: dag('2028-02-01'), ...extra,
})

async function zaai(extra: Record<string, any[]> = {}) {
  await h.db.zaai({
    arnobot_referrals: [referral()],
    approved_users: [gebruiker('aanbrenger'), gebruiker('klant')],
    arnobot_subscriptions: [sub('aanbrenger'), sub('klant', { plan: 'basis' })],
    arnobot_referral_grootboek: [], arnobot_referral_acties: [], arnobot_team_members: [], arnobot_teams: [],
    arnobot_team_facturen: [], arnobot_admin_log: [],
    ...extra,
    arnobot_payments: [...(extra.arnobot_payments ?? []), bronBetaling()],
  })
}

const plan = (nu = NU) => planReferral(nu, { uitvoeren: true, omschrijvingen: OMSCHRIJVINGEN })
const droog = (nu = NU) => planReferral(nu, { uitvoeren: false, omschrijvingen: OMSCHRIJVINGEN })
const acties = () => h.db.alle('arnobot_referral_acties') as Promise<any[]>
const grootboek = () => h.db.alle('arnobot_referral_grootboek') as Promise<any[]>
const betaalrij = async (id: string) => ((await h.db.alle('arnobot_payments')) as any[]).find(b => b.id === id)
const kort = async () => (await acties()).map(a => [a.soort, a.doel_id, a.bruto_cent])
const eigenSaldo = async (wie = 'aanbrenger') => saldoVan((await grootboek()).filter(r => !r.meeloop && r.aanbrenger_user_id === wie)).beschikbaarCent
/** De uitvoerronde van de machine, tot Mollie alles heeft uitgevoerd. */
async function voerAllesUit() {
  await verwerkOpenTerugstortingen(NU)
  h.refunds.forEach(r => { r.status = 'refunded' })
  for (const a of await acties()) if (a.bezig_tot) await h.db.wijzig('arnobot_referral_acties', a.id, { bezig_tot: null })
  await verwerkOpenTerugstortingen(NU)
}

beforeEach(async () => {
  vi.clearAllMocks()
  vi.stubEnv('REFERRAL_TERUGSTORTEN', 'true')
  vi.stubEnv('REFERRAL_TEGOED_VERREKENEN', 'true')
  vi.stubEnv('REFERRAL_CREDITNOTA', '')
  vi.stubEnv('CRON_SECRET', 's')
  h.db ??= maakKetenDb()
  Object.assign(h, { zonder: [], stuk: [], mp: {}, refunds: [], posts: [], mollieStuk: false, telegramStuk: false })
  h.telegram.length = 0
  h.gemeld.clear()
  Object.keys(h.teksten).forEach(k => delete h.teksten[k])
  await zaai()
})
afterEach(() => vi.unstubAllEnvs())

describe('B3a: de vierde betaalde maand gratis, via terugstorten', () => {
  it('reserveert de hele vierde betaling, en niets anders', async () => {
    const p = maanden('klant', 5, { plan: 'basis' })
    await zaai({ arnobot_payments: p })
    const r = await plan()
    expect(r.voornemens).toMatchObject([{ soort: 'voordeel_maand', stand: 'gereserveerd', betalingId: p[3].id, brutoCent: p[3].bedrag_cent }])
    expect(await kort()).toEqual([['voordeel_maand', p[3].id, p[3].bedrag_cent]])
    // De webhook en de billing-cron zien dit nooit als een volledige terugbetaling: het abonnement blijft.
    expect(isVolledigTerugbetaald(await betaalrij(p[3].id), p[3].bedrag_cent)).toBe(false)
  })
  it('twee runs na elkaar en tegelijk geven een actie', async () => {
    await zaai({ arnobot_payments: maanden('klant', 4, { plan: 'basis' }) })
    await Promise.all([plan(), plan()])
    await plan()
    expect(await acties()).toHaveLength(1)
  })
  it('de hele keten: een terugbetaling, de vierde maand telt nog en er komt geen tweede', async () => {
    const p = maanden('klant', 4, { plan: 'basis' })
    await zaai({ arnobot_payments: p })
    await plan()
    await voerAllesUit()
    expect((await acties())[0]).toMatchObject({ status: 'bevestigd', credit_status: 'nodig' })
    await plan()
    await voerAllesUit()
    expect(h.posts).toHaveLength(1)
  })
  it.each([
    ['drie maanden is nog niets', () => maanden('klant', 3)],
    ['een gat van meer dan 14 dagen begint opnieuw', () => [...maanden('klant', 3), bet('klant', '2027-05-20', '2027-06-20')]],
    ['een teruggeboekte derde maand telt niet', () => maanden('klant', 4).map((b, i) => (i === 2 ? { ...b, teruggeboekt_cent: 100 } : b))],
    ['de eerste betaling te laat na de proef', () => MAANDEN.slice(1, 5).map(([v, t], i) => bet('klant', v, t, { soort: i ? 'herhaling' : 'eerste' }))],
  ])('%s', async (_n, betalingen) => {
    await zaai({ arnobot_payments: betalingen() })
    expect((await plan()).voornemens).toEqual([])
    expect(await acties()).toEqual([])
  })
  it('pas zeven dagen na de betaling', async () => {
    const p = maanden('klant', 4)
    await zaai({ arnobot_payments: p })
    const r = await plan(new Date(Date.parse(p[3].betaald_at) + 7 * DAG - 1000))
    expect(r.voornemens).toMatchObject([{ stand: 'wacht' }])
    expect(await acties()).toEqual([])
  })
  it.each([
    ['met de hand op betaald', { approved_users: [gebruiker('aanbrenger'), gebruiker('klant')], arnobot_admin_log: [{ actie: 'betaald_gezet', doel_user_id: 'klant' }] }],
    ['aanmelddatum onbekend', { arnobot_referrals: [referral({ created_at: null })], approved_users: [gebruiker('aanbrenger'), gebruiker('klant', { trial_start: null })] }],
    ['een betaling zonder vastgelegde periode', {}],
    ['de klant is teammanager', { arnobot_teams: [{ id: uuid(800), manager_id: 'klant', name: 't', min_seats: 3, cyclus: 'maandelijks', geblokkeerd_at: null, stopt_op: null, volgende_factuurdatum: null }] }],
  ] as [string, any][])('onzeker (%s): niets vanzelf, wel zichtbaar', async (naam, extra) => {
    const p = maanden('klant', 4)
    if (naam === 'een betaling zonder vastgelegde periode') p.push(bet('klant', '2027-01-06', '2027-02-01', { soort: 'eerste', periode_start: null, periode_einde: null, cyclus: null, plan: null, klant_type: null }))
    await zaai({ arnobot_payments: p, ...extra })
    expect((await plan()).voornemens).toMatchObject([{ soort: 'voordeel_maand', stand: 'niet-automatisch' }])
    expect(await acties()).toEqual([])
  })
  it.each([
    ['het voordeel is al als jaarkorting gebruikt', { arnobot_referrals: [referral({ referred_discount: 39 })] }],
    ['wederzijdse verwijzing', { arnobot_referrals: [referral(), referral({ id: uuid(901), referrer_user_id: 'klant', referred_user_id: 'aanbrenger' })] }],
    ['testaccount', { arnobot_referrals: [referral({ referrer_user_id: MANUAL_TEST_USER_ID })] }],
    ['met de hand ingeboekt', { arnobot_referral_acties: [{ id: uuid(950), soort: 'voordeel_maand', user_id: 'klant', referral_id: REF, doel_soort: 'betaling', doel_id: `handmatig:${REF}`, bruto_cent: 100, netto_cent: 83, status: 'bevestigd', gegevens: {} }] }],
  ] as [string, any][])('%s: niets', async (_n, extra) => {
    await zaai({ arnobot_payments: maanden('klant', 4), ...extra })
    expect((await plan()).voornemens).toEqual([])
  })
})

describe('B2: jaarkorting na maand naar jaar', () => {
  const verwacht = async (p: any[], brutoCent: number) => {
    await zaai({ arnobot_payments: p })
    const r = await plan()
    expect(r.voornemens).toMatchObject([{ soort: 'voordeel_jaar', stand: 'gereserveerd', brutoCent }])
    return r
  }
  const vol = berekenBedrag('premium', 'jaarlijks', 'particulier').brutoCent
  it.each([1, 2, 3])('%i maand(en) en dan jaar via overstappen: een twaalfde terug', async n => {
    await verwacht([...maanden('klant', n), jaarbet('klant', MAANDEN[n][0])], Math.round(vol / 12))
  })
  it('ook via opzeggen en opnieuw afrekenen per jaar', async () => {
    await verwacht([...maanden('klant', 2), jaarbet('klant', '2027-06-15', { soort: 'eerste' })], Math.round(vol / 12))
  })
  it('vier maanden op rij en dan jaar: de gratis maand, niet de jaarkorting', async () => {
    const p = [...maanden('klant', 4), jaarbet('klant', '2027-06-01')]
    await zaai({ arnobot_payments: p })
    expect((await plan()).voornemens).toMatchObject([{ soort: 'voordeel_maand', betalingId: p[3].id }])
    expect(await acties()).toHaveLength(1)
  })
  it('vier maanden die niet op rij stonden: niet besloten, dus niets', async () => {
    const p = [bet('klant', '2027-01-10', '2027-02-10', { soort: 'eerste' }), bet('klant', '2027-02-10', '2027-03-10'), bet('klant', '2027-04-15', '2027-05-15'), bet('klant', '2027-05-15', '2027-06-15'), jaarbet('klant', '2027-06-15')]
    await zaai({ arnobot_payments: p })
    expect((await plan()).voornemens).toMatchObject([{ soort: 'voordeel_jaar', stand: 'niet-automatisch' }])
    expect(await acties()).toEqual([])
  })
  it('meteen per jaar of al met korting afgerekend: niets', async () => {
    await zaai({ arnobot_payments: [jaarbet('klant', '2027-02-01', { soort: 'eerste' })] })
    expect((await plan()).voornemens).toEqual([])
    const metKorting = metJaarKorting(berekenBedrag('premium', 'jaarlijks', 'particulier')).bedrag.brutoCent
    expect(kiesVoordeel({ betalingen: [...maanden('klant', 1), jaarbet('klant', '2027-03-01', { bedrag_cent: metKorting })] as any },
      { periodes: [{ plan: 'premium', cyclus: 'maandelijks', klantType: 'particulier', periodeStart: dag('2027-02-01'), periodeEinde: dag('2027-03-01'), betaaldAt: dag('2027-02-01'), geldig: true, maandNettoCent: 1 }] })).toBeNull()
  })
  it('alleen de eerste staande jaarbetaling', async () => {
    const eerste = jaarbet('klant', '2027-03-01')
    const tweede = jaarbet('klant', '2027-08-01', { soort: 'eerste' })
    const p = [...maanden('klant', 1), eerste, tweede]
    await zaai({ arnobot_payments: p })
    expect((await droog()).voornemens).toMatchObject([{ betalingId: eerste.id }])
  })
  it('na herroeping van de eerste jaarbetaling is de volgende de eerste staande', async () => {
    const weg = jaarbet('klant', '2027-03-01', { terugbetaling_verwerkt_at: dag('2027-03-05') })
    const opnieuw = jaarbet('klant', '2027-03-10', { soort: 'eerste' })
    await zaai({ arnobot_payments: [...maanden('klant', 1), weg, opnieuw] })
    expect((await droog()).voornemens).toMatchObject([{ betalingId: opnieuw.id }])
  })
  it('na twee keer vrijgeven probeert de planner het niet nog eens', async () => {
    const p = [...maanden('klant', 2), jaarbet('klant', '2027-04-01')]
    await zaai({ arnobot_payments: p })
    for (let i = 0; i < MAX_VRIJGAVEN_PER_DOEL; i++) {
      await plan()
      const open = (await acties()).find(a => a.status === 'gereserveerd')!
      await h.db.rpc('referral_vrijgeven', { p_actie: open.id, p_van: 'gereserveerd', p_eind: 'vrijgegeven', p_reden: 'test' })
    }
    expect((await plan()).voornemens).toMatchObject([{ stand: 'niet-automatisch' }])
    expect(await acties()).toHaveLength(MAX_VRIJGAVEN_PER_DOEL)
  })
})

describe('schakelaar en droogloop', () => {
  beforeEach(() => zaai({ arnobot_payments: maanden('klant', 4) }))
  const nietsVastgelegd = async () => {
    expect(await acties()).toEqual([])
    expect(await grootboek()).toEqual([])
    expect(h.posts).toEqual([])
  }
  it.each(['', 'TRUE', '1'])('"%s" is uit: tonen wat er zou gebeuren, niets reserveren', async waarde => {
    vi.stubEnv('REFERRAL_TERUGSTORTEN', waarde)
    const r = await plan()
    expect(r.uitvoeren).toBe(false)
    expect(r.voornemens).toMatchObject([{ stand: 'klaar' }])
    await nietsVastgelegd()
  })
  it('de droogloop schrijft niets, ook met de schakelaar aan', async () => {
    expect((await droog()).voornemens).toMatchObject([{ stand: 'klaar' }])
    await nietsVastgelegd()
  })
  it('zonder vastgestelde klanttekst wordt er niets gereserveerd', async () => {
    const r = await planReferral(NU, { uitvoeren: true })
    expect(r.voornemens).toMatchObject([{ stand: 'niet-automatisch', reden: expect.stringContaining('omschrijving') }])
    await nietsVastgelegd()
  })
  it('zonder de SQL werkt de droogloop en wordt er niets uitgevoerd', async () => {
    h.zonder = ['arnobot_referral_acties', 'arnobot_referral_grootboek']
    const r = await plan()
    expect(r).toMatchObject({ sqlOntbreekt: true, uitvoeren: false, fouten: [] })
    expect(r.voornemens).toHaveLength(1)
  })
  it('een databasefout geeft geen half plan', async () => {
    h.stuk = ['arnobot_referral_acties']
    await expect(plan()).rejects.toThrow('time-out')
  })
})

describe('B4: verrekenen bij de verlenging', () => {
  /** De aanbrenger betaalt zelf per maand; het tegoed is op 15 maart toegekend. */
  const metTegoed = async (netto: number | null = 1900, extra: Record<string, any[]> = {}, betalingen = maanden('aanbrenger', 6)) => {
    await zaai({ arnobot_payments: betalingen, arnobot_referral_grootboek: [regel('toekenning', 'r1', netto)], arnobot_referrals: [], ...extra })
    return betalingen
  }
  it('de eerste verlenging na de toekenning, nooit een eerdere betaling', async () => {
    const p = await metTegoed()
    const r = await plan()
    expect(r.voornemens).toMatchObject([{ soort: 'tegoed_terugstorten', stand: 'gereserveerd', betalingId: p[2].id, brutoCent: 2299, nettoCent: 1900 }])
    expect(await eigenSaldo()).toBe(0)
    await plan()
    expect(await acties()).toHaveLength(1)
  })
  it('wat niet past gaat op de volgende, oudste eerst', async () => {
    const p = await metTegoed(7000)
    await plan()
    expect((await acties()).map(a => [a.doel_id, a.netto_cent])).toEqual([[p[2].id, 4876], [p[3].id, 2124]])
  })
  it('twee runs tegelijk geven niet meer dan het saldo', async () => {
    await metTegoed(7000)
    await Promise.all([plan(), plan()])
    expect((await acties()).reduce((s, a) => s + a.netto_cent, 0)).toBe(7000)
  })
  it('nooit een upgrade of de allereerste betaling; een nieuwe eerste betaling alleen als die aansluit', () => {
    const oud = bet('aanbrenger', '2027-01-01', '2027-02-01', { soort: 'eerste' })
    const aansluitend = bet('aanbrenger', '2027-02-15', '2027-03-15', { soort: 'eerste' })
    const later = bet('aanbrenger', '2027-06-01', '2027-07-01', { soort: 'eerste' })
    const upgrade = bet('aanbrenger', '2027-02-10', '2027-03-01', { soort: 'upgrade' })
    const alle = [oud, aansluitend, later, upgrade] as any[]
    expect(alle.map(b => isVerlenging(b, alle))).toEqual([false, true, false, false])
    expect(isVerlenging({ ...aansluitend, soort: 'verlenging' } as any, alle)).toBe(true)
    expect(isVerlenging({ ...aansluitend, terugbetaling_verwerkt_at: 'x' } as any, alle)).toBe(false)
  })
  it.each([
    ['een open vraag over verval', 'wacht', { arnobot_referral_grootboek: [regel('toekenning', 'r1', 1900), regel('handwerk', 'r1', 0, { event_key: 'verval-handwerk:r1' })] }],
    ['een gratis account', 'wacht', { approved_users: [gebruiker('aanbrenger', { gratis_sinds: dag('2027-04-01') })] }],
    ['abonnement afgelopen', 'wacht', { arnobot_subscriptions: [sub('aanbrenger', { status: 'ended', periode_einde: dag('2027-08-25') })] }],
    ['een lopende bijbetaling', 'wacht', { arnobot_payments: [...maanden('aanbrenger', 6), bet('aanbrenger', '2027-08-20', '2027-09-01', { soort: 'upgrade', status: 'pending' })] }],
    ['een eigen team', 'niet-automatisch', { arnobot_teams: [{ id: uuid(800), manager_id: 'aanbrenger', name: 't', min_seats: 3, cyclus: 'maandelijks', geblokkeerd_at: null, stopt_op: null, volgende_factuurdatum: '2027-10-01' }] }],
  ] as [string, string, any][])('niet bij %s', async (_n, stand, extra) => {
    await metTegoed(1900, extra)
    const r = await plan()
    expect(r.voornemens).toMatchObject([{ stand }])
    expect(await acties()).toEqual([])
  })
  it('tegoed dat lijkt te vervallen: eerst de grootboekcontrole', async () => {
    await metTegoed(1900, {
      arnobot_referrals: [referral()], arnobot_referral_grootboek: [regel('toekenning', REF, 1900)],
      arnobot_subscriptions: [sub('aanbrenger', { status: 'ended', periode_einde: dag('2027-04-01') }), sub('aanbrenger', { id: uuid(3), created_at: dag('2027-07-01') })],
    })
    expect((await plan()).voornemens).toMatchObject([{ stand: 'wacht', reden: expect.stringContaining('vervallen') }])
  })
  it('een toekenning zonder bedrag krijgt het laagste van beide maandprijzen, pas als er verrekend wordt', async () => {
    await metTegoed(null)
    await droog()
    expect(await grootboek()).toHaveLength(1)
    await plan()
    const g = await grootboek()
    expect(g.find(r => r.soort === 'vaststelling')).toMatchObject({ netto_cent: 1900 })
    expect(await acties()).toMatchObject([{ netto_cent: 1900 }])
  })
  it('zonder betaling om op te verrekenen wordt er niets vastgesteld', async () => {
    await metTegoed(null, {}, maanden('aanbrenger', 1))
    await plan()
    expect(await grootboek()).toHaveLength(1)
  })
  it('meeloopregels: de droogloop rekent erop en zegt dat; uitvoeren gebruikt ze nooit', async () => {
    await metTegoed(1900, { arnobot_referral_grootboek: [regel('toekenning', 'r1', 1900, { meeloop: true })] })
    const d = await droog()
    expect(d.opMeeloop).toBe(true)
    expect(d.voornemens).toMatchObject([{ stand: 'klaar', opMeeloop: true, brutoCent: 2299 }])
    const r = await plan()
    expect(r).toMatchObject({ opMeeloop: false, voornemens: [] })
    expect(await acties()).toEqual([])
  })
  it('eerst het eigen voordeel, dan tegoed over de rest van dezelfde betaling', async () => {
    const p = [...maanden('aanbrenger', 2), jaarbet('aanbrenger', '2027-04-01')]
    await zaai({
      arnobot_payments: p, arnobot_subscriptions: [sub('aanbrenger', { cyclus: 'jaarlijks', periode_einde: dag('2028-04-01') })],
      arnobot_referrals: [referral({ referrer_user_id: 'klant', referred_user_id: 'aanbrenger' })], approved_users: [gebruiker('aanbrenger'), gebruiker('klant')],
      arnobot_referral_grootboek: [regel('toekenning', 'r1', 1900)],
    })
    await plan()
    const korting = Math.round(p[2].bedrag_cent / 12)
    expect(await kort()).toEqual([['voordeel_jaar', p[2].id, korting], ['tegoed_terugstorten', p[2].id, 2299]])
    expect((await betaalrij(p[2].id)).referral_refund_cent).toBe(korting + 2299)
  })
  it('kan het eigen voordeel niet vanzelf, dan komt er op die betaling geen tegoed', async () => {
    const p = [...maanden('aanbrenger', 2), jaarbet('aanbrenger', '2027-04-01')]
    await zaai({
      arnobot_payments: p, arnobot_subscriptions: [sub('aanbrenger', { cyclus: 'jaarlijks', periode_einde: dag('2028-04-01') })],
      arnobot_referrals: [referral({ referrer_user_id: 'klant', referred_user_id: 'aanbrenger', created_at: null })],
      approved_users: [gebruiker('aanbrenger', { trial_start: null }), gebruiker('klant')], arnobot_referral_grootboek: [regel('toekenning', 'r1', 1900)],
    })
    await plan()
    expect((await acties()).filter(a => a.doel_id === p[2].id)).toEqual([])
  })
})

describe('B4: aanbrenger die teamlid werd', () => {
  const teamlid = async (toekenningen: number[], betalingen = maanden('aanbrenger', 3, { plan: 'basis' }), extra: Record<string, any[]> = {}) => {
    await zaai({
      arnobot_payments: betalingen, arnobot_referrals: [],
      arnobot_subscriptions: [sub('aanbrenger', { plan: 'basis', status: 'ended', periode_einde: dag('2027-05-01') })],
      arnobot_team_members: [{ team_id: uuid(801), user_id: 'aanbrenger', role: 'member' }],
      arnobot_referral_grootboek: toekenningen.map((n, i) => regel('toekenning', `r${i}`, n, { created_at: dag(`2027-06-0${i + 1}`) })), ...extra,
    })
    return betalingen
  }
  const basisNetto = berekenBedrag('basis', 'maandelijks', 'particulier').nettoCent
  const basisBruto = berekenBedrag('basis', 'maandelijks', 'particulier').brutoCent

  it('nieuwste eerst, een actie per betaling, ook over betalingen van voor de toekenning', async () => {
    const p = await teamlid([basisNetto, basisNetto])
    await plan()
    expect(await kort()).toEqual([['tegoed_terugstorten', p[2].id, basisBruto], ['tegoed_terugstorten', p[1].id, basisBruto]])
  })
  it('per toekenning nooit meer dan zijn laatst betaalde maandprijs, ook niet bij een volgende run', async () => {
    const p = await teamlid([4876, 1000])
    await plan(); await voerAllesUit(); await plan()
    expect((await acties()).reduce((s, a) => s + a.netto_cent, 0)).toBe(basisNetto + 1000)
    expect((await acties()).map(a => a.doel_id)).not.toContain(p[0].id)
  })
  it('nooit meer dan Mollie nog kan terugstorten', async () => {
    const p = await teamlid([basisNetto])
    h.mp[p[2].mollie_payment_id] = { amountRemaining: { currency: 'EUR', value: '5.00' } }
    await plan()
    expect((await acties())[0]).toMatchObject({ doel_id: p[2].id, bruto_cent: 500 })
  })
  it('wat nergens in past vervalt pas als alles bevestigd is', async () => {
    const p = await teamlid([basisNetto, basisNetto], maanden('aanbrenger', 1, { plan: 'basis' }))
    await plan()
    await plan()
    expect((await grootboek()).filter(r => r.soort === 'verval')).toEqual([])
    await voerAllesUit()
    h.mp[p[0].mollie_payment_id] = { amountRemaining: { currency: 'EUR', value: '0.00' } }
    const r = await plan()
    expect(r.voornemens).toMatchObject([{ soort: 'verval_teamlid', nettoCent: basisNetto }])
    expect((await grootboek()).filter(r => r.soort === 'verval').map(r => r.netto_cent)).toEqual([-basisNetto])
    expect(await eigenSaldo()).toBe(0)
  })
  it.each([
    ['er nog ruimte is op een betaling met een actie', async (p: any[]) => { h.mp[p[0].mollie_payment_id] = {}; await h.db.wijzig('arnobot_payments', p[0].id, { bedrag_cent: 99999 }); h.refunds.length = 0 }],
    ['Mollie niet te lezen is', async () => { await h.db.voegToe('arnobot_payments', bet('aanbrenger', '2027-04-01', '2027-05-01', { plan: 'basis' })); h.mollieStuk = true }],
    ['iets ooit is vrijgegeven', async () => { await h.db.voegToe('arnobot_referral_acties', { id: uuid(960), soort: 'tegoed_terugstorten', user_id: 'aanbrenger', referral_id: null, doel_soort: 'betaling', doel_id: uuid(999), bruto_cent: 1, netto_cent: 1, status: 'vrijgegeven', gegevens: {} }) }],
  ])('er vervalt niets zolang %s', async (_n, opzet) => {
    const p = await teamlid([basisNetto, basisNetto], maanden('aanbrenger', 1, { plan: 'basis' }))
    await plan()
    await voerAllesUit()
    await opzet(p)
    await plan()
    expect((await grootboek()).filter(r => r.soort === 'verval')).toEqual([])
  })
  it('zonder vastgestelde klanttekst kan er niets terug, en dan vervalt er ook niets definitief', async () => {
    const p = await teamlid([basisNetto], maanden('aanbrenger', 1, { plan: 'basis' }))
    await h.db.wijzig('arnobot_payments', p[0].id, { referral_refund_cent: p[0].bedrag_cent, terugbetaald_cent: p[0].bedrag_cent })
    const r = await planReferral(NU, { uitvoeren: true })
    expect(r.voornemens).toMatchObject([{ soort: 'verval_teamlid' }])
    expect(await grootboek()).toHaveLength(1)
  })
  it('de droogloop laat zien dat er iets zou vervallen en boekt niets', async () => {
    const p = await teamlid([basisNetto], maanden('aanbrenger', 1, { plan: 'basis' }), {})
    await h.db.wijzig('arnobot_payments', p[0].id, { referral_refund_cent: p[0].bedrag_cent, terugbetaald_cent: p[0].bedrag_cent })
    const r = await droog()
    expect(r.voornemens).toMatchObject([{ soort: 'verval_teamlid', stand: 'vervalt' }])
    expect(await grootboek()).toHaveLength(1)
  })
})

describe('nacontrole en terugdraaien', () => {
  const bron = () => bet('klant', '2027-02-01', '2027-03-01', { soort: 'eerste' })
  const klaar = async (b = bron(), meeloop = true, extra: Record<string, any[]> = {}) => {
    await zaai({ arnobot_payments: [b], arnobot_referral_grootboek: [regel('toekenning', 'r1', 1900, { meeloop, bron_ids: [b.mollie_payment_id] })], ...extra })
    return b
  }
  const terugbetaling = (b: any, status = 'refunded', cent = b.bedrag_cent) => ({ id: 're_x', paymentId: b.mollie_payment_id, status, amount: { currency: 'EUR', value: (cent / 100).toFixed(2) } })
  const draai = (meeloop = true) => draaiNacontrole(NU, { meeloop })
  const soorten = async () => (await grootboek()).map(r => [r.soort, r.netto_cent])

  it('uitgevoerde volledige terugbetaling: terugdraaien, een keer', async () => {
    const b = await klaar()
    h.refunds.push(terugbetaling(b))
    expect((await draai()).geboekt).toMatchObject([{ soort: 'terugdraaiing', netto_cent: -1900, meeloop: true }])
    expect((await draai()).geboekt).toEqual([])
    expect(await soorten()).toEqual([['toekenning', 1900], ['terugdraaiing', -1900]])
  })
  it.each(['pending', 'processing', 'queued', 'failed'])('een terugbetaling met status %s wordt niet geboekt', async status => {
    const b = await klaar()
    h.refunds.push(terugbetaling(b, status))
    await draai()
    expect(await soorten()).toEqual([['toekenning', 1900]])
  })
  it('een chargeback die de webhook miste, ook na een al verwerkte terugbetaling', async () => {
    const b = await klaar({ ...bron(), terugbetaling_verwerkt_at: dag('2027-02-02') })
    h.mp[b.mollie_payment_id] = { amountChargedBack: { currency: 'EUR', value: '59.00' } }
    await draai()
    expect(await soorten()).toEqual([['toekenning', 1900], ['terugdraaiing', -1900]])
  })
  it('een gedeeltelijke terugbetaling draait niets terug, wel een melding', async () => {
    const b = await klaar()
    h.refunds.push(terugbetaling(b, 'refunded', 1000))
    const r = await draai()
    expect(r.meldingen.map(m => m.sleutel)).toEqual(['deels:r1'])
    expect(await soorten()).toHaveLength(1)
  })
  it('alleen ons eigen referralbedrag terug is geen terugdraaiing en geen melding', async () => {
    const b = await klaar({ ...bron(), referral_refund_cent: 1000, terugbetaald_cent: 1000 })
    h.refunds.push(terugbetaling(b, 'refunded', 1000))
    expect(await draai()).toMatchObject({ geboekt: [], meldingen: [] })
  })
  it('staat de betaling weer, dan herstel; daarna opnieuw terugdraaien kan', async () => {
    const b = await klaar()
    h.mp[b.mollie_payment_id] = { amountChargedBack: { currency: 'EUR', value: '59.00' } }
    await draai()
    delete h.mp[b.mollie_payment_id]
    await draai()
    expect(await soorten()).toEqual([['toekenning', 1900], ['terugdraaiing', -1900], ['herstel', 1900]])
    h.refunds.push(terugbetaling(b))
    await draai()
    expect((await soorten()).at(-1)).toEqual(['terugdraaiing', -1900])
  })
  it('geen herstel zolang er iets loopt of Mollie niet te lezen is', async () => {
    const b = await klaar()
    h.refunds.push(terugbetaling(b))
    await draai()
    h.refunds[0].status = 'pending'
    await draai()
    h.mollieStuk = true
    expect((await draai()).fouten).toHaveLength(1)
    expect(await soorten()).toHaveLength(2)
  })
  it('vervallen terwijl het teruggedraaid was: herstel brengt het niet terug', async () => {
    const b = await klaar()
    h.refunds.push(terugbetaling(b))
    await draai()
    await h.db.voegToe('arnobot_referral_grootboek', regel('verval', 'r1', 0, { meeloop: true }))
    h.refunds.length = 0
    await draai()
    expect(saldoVan((await grootboek()) as any).beschikbaarCent).toBe(0)
    expect((await grootboek()).some(r => r.event_key === 'verval:r1:herstel:1')).toBe(true)
  })
  it.each([
    ['voor het verrekenen', 'geen'], ['terwijl de verrekening openstaat', 'gereserveerd'], ['na het verrekenen', 'bevestigd'],
  ])('echte regels, terugdraaien %s', async (_n, moment) => {
    const eigen = maanden('aanbrenger', 6)
    const b = bron()
    await zaai({ arnobot_payments: [b, ...eigen], arnobot_referrals: [], arnobot_referral_grootboek: [regel('toekenning', 'r1', 1900, { bron_ids: [b.mollie_payment_id] })] })
    if (moment !== 'geen') await plan()
    if (moment === 'bevestigd') await voerAllesUit()
    h.refunds.push(terugbetaling(b))
    const r = await draai(false)
    expect(r.fouten).toEqual([])
    expect(r.vrijgegeven).toHaveLength(moment === 'gereserveerd' ? 1 : 0)
    const rest = (await grootboek()).filter(x => !x.meeloop).reduce((s, x) => s + x.netto_cent, 0)
    // Al gebruikt: een schuld van het gebruikte bedrag. Anders precies nul.
    expect(rest).toBe(moment === 'bevestigd' ? -1900 : 0)
    await plan()
    expect((await acties()).filter(a => a.status === 'gereserveerd')).toEqual([])
  })
  it('in de meeloopstand geeft een terugdraaiing nooit een echte reservering vrij', async () => {
    const eigen = maanden('aanbrenger', 6)
    const b = bron()
    await zaai({ arnobot_payments: [b, ...eigen], arnobot_referrals: [], arnobot_referral_grootboek: [regel('toekenning', 'r1', 1900), regel('toekenning', 'r1', 1900, { meeloop: true, bron_ids: [b.mollie_payment_id], id: uuid(970) })] })
    await plan()
    h.refunds.push(terugbetaling(b))
    expect((await draai()).vrijgegeven).toEqual([])
    expect((await acties())[0].status).toBe('gereserveerd')
  })

  const verrekend = async () => {
    const eigen = maanden('aanbrenger', 6)
    await zaai({ arnobot_payments: eigen, arnobot_referrals: [], arnobot_referral_grootboek: [regel('toekenning', 'r1', 1900)] })
    await plan()
    await voerAllesUit()
    const doel = eigen[2]
    h.refunds.push({ id: 're_rest', paymentId: doel.mollie_payment_id, status: 'refunded', amount: { currency: 'EUR', value: ((doel.bedrag_cent - 2299) / 100).toFixed(2) } })
    return doel
  }
  it('de aanbrenger kreeg de betaling met tegoed helemaal terug: het tegoed komt terug', async () => {
    await verrekend()
    const r = await draai(false)
    expect(r.ongedaan).toHaveLength(1)
    expect(await eigenSaldo()).toBe(1900)
    expect((await acties())[0].status).toBe('ongedaan')
    expect((await draai(false)).ongedaan).toEqual([])
  })
  it('chargeback na ons deelbedrag: alleen melden, mogelijk meer dan 100 procent', async () => {
    const doel = await verrekend()
    h.mp[doel.mollie_payment_id] = { amountChargedBack: { currency: 'EUR', value: '59.00' } }
    const r = await draai(false)
    expect(r.ongedaan).toEqual([])
    expect(r.meldingen.some(m => m.tekst.includes('meer dan 100 procent'))).toBe(true)
    expect(await eigenSaldo()).toBe(0)
  })
  it('na 400 dagen niet meer, en zonder bron_ids een melding', async () => {
    const b = bron()
    await zaai({ arnobot_payments: [b], arnobot_referral_grootboek: [
      regel('toekenning', 'oud', 1, { meeloop: true, bron_ids: [b.mollie_payment_id], created_at: new Date(NU.getTime() - (NACONTROLE_DAGEN + 1) * DAG).toISOString() }),
      regel('toekenning', 'zonder', 1, { meeloop: true, id: uuid(971), bron_ids: null }),
    ] })
    const r = await draai()
    expect(r.gecontroleerd).toBe(0)
    expect(r.meldingen.map(m => m.sleutel)).toEqual(['geen-bron:zonder'])
  })
  it('in porties komt alles aan de beurt', () => {
    const lijst = Array.from({ length: 23 }, (_, i) => i)
    const gezien = new Set([0, 1, 2].flatMap(d => portieVanVandaag(lijst, new Date(NU.getTime() + d * DAG), 10)))
    expect(gezien.size).toBe(23)
    expect(portieVanVandaag(lijst, NU, 50)).toEqual(lijst)
  })
  it('zonder de SQL doet de nacontrole niets', async () => {
    h.zonder = ['arnobot_referral_acties']
    expect(await draai()).toMatchObject({ sqlOntbreekt: true, gecontroleerd: 0, geboekt: [] })
  })
})

describe('de cron referral-uitvoeren', () => {
  beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(NU) })
  afterEach(() => { vi.useRealTimers() })
  const roep = () => GET(new Request('https://x', { headers: { authorization: 'Bearer s' } }) as any)
  const antwoord = async () => (await roep()).json()
  it('zonder geheim geen toegang', async () => {
    expect((await GET(new Request('https://x') as any)).status).toBe(401)
  })
  it('zonder de SQL gebeurt er niets, ook met de schakelaar aan', async () => {
    h.zonder = ['arnobot_referral_acties']
    expect(await antwoord()).toMatchObject({ ok: true, overgeslagen: 'sql ontbreekt' })
    expect(h.telegram).toEqual([])
  })
  it('schakelaar uit: niets reserveren en niets versturen', async () => {
    vi.stubEnv('REFERRAL_TERUGSTORTEN', '')
    await zaai({ arnobot_payments: maanden('klant', 4) })
    Object.assign(h.teksten, OMSCHRIJVINGEN)
    expect(await antwoord()).toMatchObject({ ok: true, gereserveerd: 0, uitgevoerd: 0, fouten: 0 })
    expect(await acties()).toEqual([])
    expect(h.posts).toEqual([])
  })
  it('schakelaar aan: reserveren, versturen en melden', async () => {
    await zaai({ arnobot_payments: maanden('klant', 4) })
    Object.assign(h.teksten, OMSCHRIJVINGEN)
    expect(await antwoord()).toMatchObject({ ok: true, gereserveerd: 1, uitgevoerd: 1, fouten: 0 })
    expect(h.posts).toHaveLength(1)
    expect(h.telegram.join()).toContain('Gereserveerd')
  })
  it('staat terugstorten uit terwijl er iets openstaat, en creditnota nodig: een keer per week gemeld', async () => {
    vi.stubEnv('REFERRAL_TERUGSTORTEN', '')
    const p = maanden('klant', 2)
    await zaai({ arnobot_payments: p, arnobot_referral_acties: [
      { id: uuid(980), soort: 'voordeel_maand', user_id: 'klant', referral_id: REF, doel_soort: 'betaling', doel_id: p[0].id, bruto_cent: 100, netto_cent: 83, status: 'gereserveerd', gegevens: {}, credit_status: 'nvt' },
      { id: uuid(981), soort: 'tegoed_terugstorten', user_id: 'klant', referral_id: null, doel_soort: 'betaling', doel_id: p[1].id, bruto_cent: 100, netto_cent: 83, status: 'bevestigd', gegevens: {}, credit_status: 'nodig' },
    ] })
    await roep()
    await roep()
    expect(h.telegram.filter(t => t.includes('staat uit terwijl'))).toHaveLength(1)
    expect(h.telegram.filter(t => t.includes('creditnota'))).toHaveLength(1)
  })
  it('een fout in de nacontrole houdt het terugstorten niet tegen en wordt gemeld', async () => {
    await zaai({ arnobot_payments: maanden('klant', 4) })
    Object.assign(h.teksten, OMSCHRIJVINGEN)
    h.stuk = ['arnobot_referral_grootboek']
    const uit = await antwoord()
    expect(uit.fouten).toBeGreaterThan(0)
    expect(h.telegram.join()).toContain('Niet gelukt')
  })
  it('komt de melding niet aan, dan telt de run als mislukt', async () => {
    await zaai({ arnobot_payments: maanden('klant', 4) })
    Object.assign(h.teksten, OMSCHRIJVINGEN)
    h.telegramStuk = true
    expect((await roep()).status).toBe(500)
  })
  it('de ronde zelf geeft dezelfde samenvatting terug', async () => {
    expect(await draaiReferralUitvoeren(NU)).toMatchObject({ gereserveerd: 0, fouten: 0, meldingMislukt: false })
  })
})

// ── Bevindingen uit de tweede onafhankelijke controle ──

const eur = (cent: number) => ({ currency: 'EUR', value: (cent / 100).toFixed(2) })
const echteSom = async () => (await grootboek()).filter(r => !r.meeloop).reduce((s, r) => s + (r.netto_cent ?? 0), 0)
async function weerVrij() {
  for (const a of await acties()) if (a.bezig_tot) await h.db.wijzig('arnobot_referral_acties', a.id, { bezig_tot: null })
}

describe('F1: een teruggedraaide toekenning wordt nooit meer uitbetaald', () => {
  const opzet = async () => {
    const eigen = maanden('aanbrenger', 6)
    const klant = maanden('klant', 3)
    await zaai({ arnobot_payments: [...eigen, ...klant], arnobot_referrals: [], arnobot_referral_grootboek: [regel('toekenning', 'r1', 1900, { bron_ids: klant.map(b => b.mollie_payment_id) })] })
    await plan()
    expect((await acties()).map(a => a.status)).toEqual(['gereserveerd'])
    h.mp[klant[2].mollie_payment_id] = { amountChargedBack: eur(1000) }
  }
  const zonderVrijgave = async (taak: () => Promise<unknown>) => {
    const echt = h.db.rpc
    h.db.rpc = (n: string, p: any) => (n === 'referral_vrijgeven' || n === 'referral_geef_teruggedraaid_vrij' ? Promise.resolve({ data: null, error: { message: 'time-out' } }) : echt(n, p))
    try { return await taak() } finally { h.db.rpc = echt }
  }
  it('mislukt het vrijgeven, dan probeert elke volgende run het opnieuw', async () => {
    await opzet()
    await zonderVrijgave(() => draaiNacontrole(NU, { meeloop: false }))
    const r = await draaiNacontrole(NU, { meeloop: false })
    expect(r.vrijgegeven).toHaveLength(1)
    expect(await echteSom()).toBe(0)
  })
  it('vrijgeven hangt niet aan de portie of de 400 dagen', async () => {
    await opzet()
    await zonderVrijgave(() => draaiNacontrole(NU, { meeloop: false }))
    const r = await draaiNacontrole(new Date(NU.getTime() + 500 * DAG), { meeloop: false })
    expect(r.vrijgegeven).toHaveLength(1)
  })
  it('ook als de nacontrole niet meer draait verstuurt de machine niets', async () => {
    await opzet()
    await zonderVrijgave(() => draaiNacontrole(NU, { meeloop: false }))
    // De bron staat intussen weer, maar de terugdraaiing staat nog: dan nog steeds niet.
    h.mp = {}
    await verwerkOpenTerugstortingen(NU)
    expect(h.posts).toEqual([])
    expect((await acties()).map(a => a.status)).toEqual(['vrijgegeven'])
    expect(await echteSom()).toBe(0)
  })
  it('met een eerdere poging met onbekende uitkomst: vastgelopen, niet vrijgegeven', async () => {
    await opzet()
    const [a] = await acties()
    await h.db.wijzig('arnobot_referral_acties', a.id, { status: 'bezig', gegevens: { ...a.gegevens, post_geprobeerd_at: NU.toISOString() } })
    await zonderVrijgave(() => draaiNacontrole(NU, { meeloop: false }))
    await draaiNacontrole(NU, { meeloop: false })
    expect((await acties())[0].status).toBe('bezig')
    await verwerkOpenTerugstortingen(NU)
    expect(h.posts).toEqual([])
    expect((await acties())[0].status).toBe('vastgelopen')
  })
  it('de terugdraaiing valt tussen de laatste controle en het versturen: de database houdt het tegen', async () => {
    await opzet()
    h.mp = {}
    const echt = h.db.rpc
    h.db.rpc = async (n: string, p: any) => {
      if (n === 'referral_markeer_versturen') await echt('referral_boek', { p_regel: { soort: 'terugdraaiing', referral_id: 'r1', reden: 't' } })
      return echt(n, p)
    }
    try { await verwerkOpenTerugstortingen(NU) } finally { h.db.rpc = echt }
    expect(h.posts).toEqual([])
  })
})

describe('F2: tegoed gaat pas uit met positief bewijs dat de bronbetaling staat', () => {
  type Soort = 'mollie-fout' | 'pending-refund' | 'db-terugbetaling-verwerkt' | 'chargeback' | 'deels-terug' | 'onbekende-amountRefunded' | 'status-open' | 'geen-bron-ids' | 'bron-onbekend'
  const SOORTEN: Soort[] = ['mollie-fout', 'pending-refund', 'db-terugbetaling-verwerkt', 'chargeback', 'deels-terug', 'onbekende-amountRefunded', 'status-open', 'geen-bron-ids', 'bron-onbekend']
  const mollieNep = async () => (await import('./mollie')).haalBetaling as any
  async function opzet() {
    const eigen = maanden('aanbrenger', 6)
    const klant = maanden('klant', 3)
    await zaai({ arnobot_payments: [...eigen, ...klant], arnobot_referrals: [], arnobot_referral_grootboek: [regel('toekenning', 'r1', 1900, { bron_ids: klant.map(b => b.mollie_payment_id) })] })
    return klant
  }
  /** Maakt de derde bronbetaling onbewijsbaar. Geeft terug hoe dat weer te herstellen is. */
  async function verstoor(soort: Soort, klant: any[]): Promise<() => Promise<void>> {
    const b = klant[2]
    const nep = await mollieNep()
    const origineel = nep.getMockImplementation()
    const grootboekRij = (await grootboek()).find(r => r.soort === 'toekenning')!
    if (soort === 'mollie-fout') nep.mockImplementation(async (id: string) => { if (id === b.mollie_payment_id) throw new Error('503'); return origineel(id) })
    if (soort === 'pending-refund') h.refunds.push({ id: 're_k', paymentId: b.mollie_payment_id, status: 'pending', amount: eur(b.bedrag_cent) })
    if (soort === 'deels-terug') h.refunds.push({ id: 're_k', paymentId: b.mollie_payment_id, status: 'refunded', amount: eur(500) })
    if (soort === 'chargeback') h.mp[b.mollie_payment_id] = { amountChargedBack: eur(1000) }
    if (soort === 'onbekende-amountRefunded') h.mp[b.mollie_payment_id] = { amountRefunded: eur(500) }
    if (soort === 'status-open') h.mp[b.mollie_payment_id] = { status: 'open' }
    if (soort === 'db-terugbetaling-verwerkt') await h.db.wijzig('arnobot_payments', b.id, { terugbetaling_verwerkt_at: dag('2027-08-01') })
    if (soort === 'geen-bron-ids') await h.db.wijzig('arnobot_referral_grootboek', grootboekRij.id, { bron_ids: null })
    if (soort === 'bron-onbekend') await h.db.wijzig('arnobot_referral_grootboek', grootboekRij.id, { bron_ids: ['tr_bestaatniet'] })
    return async () => {
      nep.mockImplementation(origineel)
      h.refunds = h.refunds.filter(r => r.id !== 're_k')
      delete h.mp[b.mollie_payment_id]
    }
  }
  it.each(SOORTEN)('vóór het reserveren (%s): niets reserveren, wel zichtbaar', async soort => {
    const herstel = await verstoor(soort, await opzet())
    const r = await plan()
    await herstel()
    expect(await acties()).toEqual([])
    expect(r.voornemens).toMatchObject([{ stand: 'wacht', bronNietBewezen: true }])
  })
  it.each(SOORTEN)('vóór het versturen (%s): niets versturen, de reservering blijft wachten', async soort => {
    const klant = await opzet()
    await plan()
    expect(await acties()).toHaveLength(1)
    const herstel = await verstoor(soort, klant)
    await verwerkOpenTerugstortingen(NU)
    await herstel()
    expect(h.posts).toEqual([])
    expect((await acties())[0].status).toBe('gereserveerd')
  })
  it('bewezen en dan pas versturen; ons eigen referralgeld op de bron telt niet als onbekend', async () => {
    const klant = await opzet()
    h.refunds.push({ id: 're_ons', paymentId: klant[0].mollie_payment_id, status: 'refunded', amount: eur(100), metadata: { referralActie: uuid(990) } })
    await h.db.voegToe('arnobot_referral_acties', { id: uuid(990), soort: 'voordeel_maand', user_id: 'klant', referral_id: uuid(991), doel_soort: 'betaling', doel_id: klant[0].id, bruto_cent: 100, netto_cent: 83, status: 'bevestigd', gegevens: {} })
    await h.db.wijzig('arnobot_payments', klant[0].id, { referral_refund_cent: 100, terugbetaald_cent: 100 })
    await plan()
    await verwerkOpenTerugstortingen(NU)
    expect(h.posts).toHaveLength(1)
  })
  it('ook zonder nacontrole en na meer dan 400 dagen', async () => {
    const klant = await opzet()
    await plan()
    h.mp[klant[2].mollie_payment_id] = { amountChargedBack: eur(1000) }
    await verwerkOpenTerugstortingen(new Date(NU.getTime() + 500 * DAG))
    expect(h.posts).toEqual([])
  })
  it('lang wachten wordt elke week aan de eigenaar gemeld', async () => {
    const klant = await opzet()
    await plan()
    h.mp[klant[2].mollie_payment_id] = { amountChargedBack: eur(1000) }
    const dagen = async (n: number) => { await weerVrij(); await verwerkOpenTerugstortingen(new Date(NU.getTime() + n * DAG)) }
    const meldingen = () => h.telegram.filter(t => t.includes('wacht op bewijs')).length
    await dagen(0); await dagen(6)
    expect(meldingen()).toBe(0)
    await dagen(8); await dagen(9)
    expect(meldingen()).toBe(1)
    await dagen(16)
    expect(meldingen()).toBe(2)
  })
  it('met een onbekende eerdere poging blijft de beheerderknop niet eeuwig geweigerd', async () => {
    const klant = await opzet()
    await plan()
    const [a] = await acties()
    await h.db.wijzig('arnobot_referral_acties', a.id, { status: 'bezig', gegevens: { ...a.gegevens, post_geprobeerd_at: NU.toISOString() } })
    h.mp[klant[2].mollie_payment_id] = { amountChargedBack: eur(1000) }
    for (let i = 0; i < 6; i++) { await weerVrij(); await verwerkOpenTerugstortingen(new Date(NU.getTime() + i * DAG)) }
    expect((await acties())[0].status).toBe('vastgelopen')
    expect(h.posts).toEqual([])
  })
  it('een onbewezen oudste toekenning wordt niet overgeslagen: dan gaat er niets', async () => {
    const eigen = maanden('aanbrenger', 6)
    await zaai({ arnobot_payments: eigen, arnobot_referrals: [], arnobot_referral_grootboek: [
      regel('toekenning', 'oud', 1900, { bron_ids: null, klant_user_id: 'bronklant', created_at: dag('2027-03-10') }), regel('toekenning', 'goed', 1900, { id: uuid(972) }),
    ] })
    await plan()
    expect(await acties()).toEqual([])
  })
  it('de cron meldt een onbewezen bron een keer per week', async () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(NU)
    const klant = await opzet()
    Object.assign(h.teksten, OMSCHRIJVINGEN)
    h.mp[klant[2].mollie_payment_id] = { amountChargedBack: eur(1000) }
    for (let i = 0; i < 2; i++) await GET(new Request('https://x', { headers: { authorization: 'Bearer s' } }) as any)
    vi.useRealTimers()
    expect(h.telegram.join('\n').split('bron niet bewezen').length - 1).toBe(1)
  })

  describe('hetzelfde voor het voordeel van de nieuwe gebruiker', () => {
    it.each(['pending-refund', 'chargeback', 'mollie-fout'] as Soort[])('een van de drie maanden ervoor is niet bewezen (%s): niets', async soort => {
      const p = maanden('klant', 4)
      await zaai({ arnobot_payments: p })
      const nep = await mollieNep()
      const origineel = nep.getMockImplementation()
      if (soort === 'mollie-fout') nep.mockImplementation(async (id: string) => { if (id === p[1].mollie_payment_id) throw new Error('503'); return origineel(id) })
      if (soort === 'pending-refund') h.refunds.push({ id: 're_k', paymentId: p[1].mollie_payment_id, status: 'pending', amount: eur(p[1].bedrag_cent) })
      if (soort === 'chargeback') h.mp[p[1].mollie_payment_id] = { amountChargedBack: eur(1000) }
      const r = await plan()
      nep.mockImplementation(origineel)
      expect(await acties()).toEqual([])
      expect(r.voornemens).toMatchObject([{ soort: 'voordeel_maand', stand: 'wacht', bronNietBewezen: true }])
    })
    it('het gaat na het reserveren mis: niet versturen', async () => {
      const p = [...maanden('klant', 2), jaarbet('klant', '2027-04-01')]
      await zaai({ arnobot_payments: p })
      await plan()
      expect((await acties())[0].gegevens.bronnen).toEqual([p[0].mollie_payment_id, p[1].mollie_payment_id])
      h.mp[p[0].mollie_payment_id] = { amountChargedBack: eur(1000) }
      await verwerkOpenTerugstortingen(NU)
      expect(h.posts).toEqual([])
    })
  })
})

describe('F3: bij een onvolledige voorgeschiedenis vervalt tegoed van een teamlid nooit vanzelf', () => {
  const factuur = (extra: any = {}) => ({
    id: uuid(810), team_id: uuid(800), status: 'paid', soort: 'regulier', cyclus: 'maandelijks', created_at: dag('2027-05-01'), betaald_at: dag('2027-05-02'),
    periode_start: dag('2027-05-01'), periode_einde: dag('2027-06-01'), reversed_at: null, terugbetaald_cent: 0, teruggeboekt_cent: 0, mollie_payment_id: 'tr_team1',
    bedrag_cent: 20000, btw_cent: 3000, seats_aantal: 3, ...extra,
  })
  const oudTeam = { id: uuid(800), manager_id: 'aanbrenger', name: 't', min_seats: 3, cyclus: 'maandelijks', geblokkeerd_at: null, stopt_op: '2027-07-01', volgende_factuurdatum: null }
  const leeg = () => {
    const oud = bet('aanbrenger', '2027-02-01', '2027-03-01', { soort: 'eerste', plan: 'basis' })
    return { ...oud, referral_refund_cent: oud.bedrag_cent }
  }
  const teamlidZonderRuimte = (extra: Record<string, any[]> = {}) => zaai({
    arnobot_payments: [leeg()], arnobot_referrals: [], arnobot_subscriptions: [sub('aanbrenger', { plan: 'basis', status: 'ended', periode_einde: dag('2027-03-01') })],
    arnobot_team_members: [{ team_id: uuid(801), user_id: 'aanbrenger', role: 'member' }], arnobot_referral_grootboek: [regel('toekenning', 'r1', 1900)], ...extra,
  })
  const geenVerval = async () => expect((await grootboek()).filter(r => r.soort === 'verval')).toEqual([])
  const vragen = async () => (await grootboek()).filter(r => String(r.event_key).startsWith('verval-handwerk:'))

  it.each([
    ['ooit met de hand op betaald', { arnobot_admin_log: [{ actie: 'betaald_gezet', doel_user_id: 'aanbrenger' }] }],
    ['als manager een betaalde teamfactuur', { arnobot_teams: [oudTeam], arnobot_team_facturen: [factuur()] }],
    ['als manager een betaalde en later teruggedraaide teamfactuur', { arnobot_teams: [oudTeam], arnobot_team_facturen: [factuur({ status: 'refunded', reversed_at: dag('2027-06-01') })] }],
  ] as [string, any][])('%s: een vraag aan de eigenaar, geen verval, en niet twee keer', async (_n, extra) => {
    await teamlidZonderRuimte(extra)
    const r = await plan()
    await plan()
    await geenVerval()
    expect(await vragen()).toMatchObject([{ soort: 'handwerk', netto_cent: 0, event_key: 'verval-handwerk:r1', meeloop: false }])
    expect(r.voornemens).toMatchObject([{ soort: 'verval_teamlid', stand: 'niet-automatisch' }])
  })
  it('ook een oud-teammanager zonder eigen online betalingen', async () => {
    await teamlidZonderRuimte({ arnobot_payments: [], arnobot_subscriptions: [], arnobot_teams: [oudTeam], arnobot_team_facturen: [factuur()] })
    await plan()
    await geenVerval()
    expect(await vragen()).toHaveLength(1)
  })
  it('na "behouden" komt de vraag niet terug en vervalt er niets', async () => {
    await teamlidZonderRuimte({ arnobot_admin_log: [{ actie: 'betaald_gezet', doel_user_id: 'aanbrenger' }] })
    await plan()
    await h.db.voegToe('arnobot_referral_grootboek', regel('handwerk', 'r1', 0, { event_key: 'verval-behoud:r1:1', id: uuid(973), reden: 'handmatig besluit: houden' }))
    await plan()
    await geenVerval()
    expect(await vragen()).toHaveLength(1)
  })
  it('"behouden" geldt ook als de voorgeschiedenis wel volledig is', async () => {
    await teamlidZonderRuimte()
    await h.db.voegToe('arnobot_referral_grootboek', regel('handwerk', 'r1', 0, { event_key: 'verval-behoud:r1:1', id: uuid(974), reden: 'handmatig besluit: houden' }))
    const r = await plan()
    await geenVerval()
    expect(r.voornemens.filter((v: any) => v.stand === 'vervalt')).toEqual([])
  })
  it('de melding noemt alleen wat echt vervalt, niet wat behouden is', async () => {
    await teamlidZonderRuimte({ arnobot_referral_grootboek: [regel('toekenning', 'r1', 1900), regel('toekenning', 'r2', 1000)] })
    await h.db.voegToe('arnobot_referral_grootboek', regel('handwerk', 'r1', 0, { event_key: 'verval-behoud:r1:1', id: uuid(975), reden: 'handmatig besluit: houden' }))
    const r = await plan()
    expect(r.voornemens).toMatchObject([{ soort: 'verval_teamlid', stand: 'vervalt', nettoCent: 1000 }])
    expect((await grootboek()).filter(x => x.soort === 'verval').map(x => [x.referral_id, x.netto_cent])).toEqual([['r2', -1000]])
  })
  it('de droogloop schrijft geen vraag', async () => {
    await teamlidZonderRuimte({ arnobot_admin_log: [{ actie: 'betaald_gezet', doel_user_id: 'aanbrenger' }] })
    await droog()
    expect(await grootboek()).toHaveLength(1)
  })
  it.each(['gereserveerd', 'bezig', 'verzonden', 'vastgelopen', 'vrijgegeven'])('een voordeelactie (%s) van deze gebruiker: wachten', async status => {
    await teamlidZonderRuimte()
    await h.db.voegToe('arnobot_referral_acties', { id: uuid(992), soort: 'voordeel_maand', user_id: 'aanbrenger', referral_id: uuid(993), doel_soort: 'betaling', doel_id: uuid(994), bruto_cent: 1, netto_cent: 1, status, gegevens: {} })
    const r = await plan()
    await geenVerval()
    expect(await vragen()).toEqual([])
    expect(r.voornemens).toMatchObject([{ soort: 'verval_teamlid', stand: 'wacht' }])
  })
  it('een actie van iemand anders op een van zijn betalingen: wachten', async () => {
    const p = leeg()
    await teamlidZonderRuimte({ arnobot_payments: [p] })
    await h.db.voegToe('arnobot_referral_acties', { id: uuid(995), soort: 'tegoed_terugstorten', user_id: 'iemand', referral_id: null, doel_soort: 'betaling', doel_id: p.id, bruto_cent: 1, netto_cent: 1, status: 'verzonden', gegevens: {} })
    await plan()
    await geenVerval()
  })
})

describe('F5: een gratis account verdient nooit referraltegoed, ook niet als teamlid', () => {
  const gratisTeamlid = (extra: any = {}) => zaai({
    approved_users: [gebruiker('aanbrenger', { gratis_sinds: dag('2027-03-01'), ...extra }), gebruiker('klant')],
    arnobot_payments: maanden('aanbrenger', 2, { plan: 'basis' }), arnobot_referrals: [], arnobot_subscriptions: [sub('aanbrenger', { plan: 'basis', status: 'ended', periode_einde: dag('2027-04-01') })],
    arnobot_team_members: [{ team_id: uuid(801), user_id: 'aanbrenger', role: 'member' }], arnobot_referral_grootboek: [regel('toekenning', 'r1', 1900)],
  })
  it('de planner doet niets', async () => {
    await gratisTeamlid()
    expect((await plan()).voornemens).toMatchObject([{ stand: 'wacht', reden: expect.stringContaining('gratis') }])
    expect(await acties()).toEqual([])
  })
  it('Lifetime gaat voor', async () => {
    await gratisTeamlid({ lifetime_sinds: dag('2027-03-02') })
    await plan()
    expect((await acties()).length).toBeGreaterThan(0)
  })
})
