/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// De terugstortmachine met een nagemaakte Mollie: elke breukplek uit de fouttabel in docs/REFERRAL_BOUWPLAN_R3.md (B0).

const h = vi.hoisted(() => ({
  db: null as any,
  /** Laat een databasewijziging mislukken. */
  faalUpdate: null as null | ((patch: any) => boolean),
  tabelWeg: false,
  telegram: [] as string[],
  telegramStuk: false,
  wieStuk: false,
  mollie: {
    refunds: [] as any[],
    posts: [] as any[],
    /** Wat de eerstvolgende aanroepen van betaalTerug doen. */
    plan: [] as ({ fout: number | 'timeout'; uitgevoerd?: boolean } | { status: string })[],
    sleutels: new Map<string, { op: number; antwoord: any }>(),
    klok: 0,
    betaling: {} as any,
    lijstStuk: false,
    zonderMetadata: false,
  },
}))

vi.mock('./db', () => ({
  billingDb: {
    from(tabel: string) {
      if (h.tabelWeg) {
        const q: any = { select: () => q, eq: () => q, in: () => q, order: () => q, limit: () => q, then: (ok: any) => ok({ data: null, error: { code: 'PGRST205', message: `Could not find the table 'public.${tabel}' in the schema cache` } }) }
        return q
      }
      const q = h.db.from(tabel)
      const update = q.update
      q.update = (patch: any) => {
        if (!h.faalUpdate?.(patch)) return update(patch)
        const stuk: any = { eq: () => stuk, select: () => stuk, then: (ok: any) => ok({ data: null, error: { message: 'verbinding weg' } }) }
        return stuk
      }
      return q
    },
    rpc: (naam: string, p: any) => h.db.rpc(naam, p),
  },
}))
vi.mock('./mollie', async origineel => {
  const echt = await origineel<typeof import('./mollie')>()
  const m = h.mollie
  return {
    MollieError: echt.MollieError,
    mollieIngeschakeld: () => true,
    haalBetaling: vi.fn(async () => ({ status: 'paid', ...m.betaling })),
    lijstBetalingTerugbetalingen: vi.fn(async (id: string) => {
      if (m.lijstStuk) throw new Error('mollie plat')
      return m.refunds.filter(r => r.paymentId === id).map(r => (m.zonderMetadata ? { ...r, metadata: undefined } : { ...r }))
    }),
    betaalTerug: vi.fn(async (inv: any) => {
      m.posts.push(inv)
      // Zoals Mollie: dezelfde sleutel geeft alleen binnen een uur hetzelfde antwoord.
      const eerder = m.sleutels.get(inv.idempotencyKey)
      if (eerder && m.klok - eerder.op < 60 * 60 * 1000) return eerder.antwoord
      const stap = m.plan.shift() ?? { status: 'pending' }
      const voerUit = (status: string) => {
        const r = {
          id: `re_${m.refunds.length + 1}`, paymentId: inv.betalingId, status, createdAt: new Date(m.klok).toISOString(),
          amount: { currency: 'EUR', value: (inv.brutoCent / 100).toFixed(2) }, metadata: inv.metadata,
        }
        m.refunds.push(r)
        m.sleutels.set(inv.idempotencyKey, { op: m.klok, antwoord: { id: r.id, status } })
        return { id: r.id, status }
      }
      if ('status' in stap) return voerUit(stap.status)
      if (stap.uitgevoerd) voerUit('pending')
      m.sleutels.delete(inv.idempotencyKey)
      if (stap.fout === 'timeout') throw new Error('The operation was aborted due to timeout')
      throw new echt.MollieError(stap.fout, `fout ${stap.fout}`)
    }),
  }
})
vi.mock('@/lib/cron-notify', () => ({ notifyTelegram: vi.fn(async (t: string) => { if (h.telegramStuk) return false; h.telegram.push(t); return true }) }))
vi.mock('./wie', () => ({ wieIs: vi.fn(async (id: string) => { if (h.wieStuk) throw new Error('clerk plat'); return id }) }))

import { maakNepDb } from './referralNepDb'
import { creditnotaStap, reserveerTerugstorting, verwerkOpenTerugstortingen, voerTerugstortingUit } from './referralTerugstorten'
import { betaalTerug, haalBetaling, lijstBetalingTerugbetalingen } from './mollie'
import { MANUAL_TEST_USER_ID } from '@/lib/internalTestAccounts'

const A = '11111111-1111-4111-8111-111111111111'
const B = '22222222-2222-4222-8222-222222222222'
const PAY = '33333333-3333-4333-8333-333333333333'
const TR = 'tr_verlenging'
const UUR = 60 * 60 * 1000
const DAG = 24 * UUR
/** Tien dagen na de betaling: de wachttijd van zeven dagen is voorbij. */
const NU = new Date('2030-01-11T10:00:00.000Z')
const later = (ms: number) => new Date(NU.getTime() + ms)

const betaling = (extra: any = {}) => ({
  id: PAY, user_id: 'user_a', mollie_payment_id: TR, soort: 'herhaling', status: 'paid', bedrag_cent: 5900, btw_cent: 1024,
  terugbetaald_cent: 0, teruggeboekt_cent: 0, referral_refund_cent: 0, betaald_at: '2030-01-01T10:00:00.000Z',
  terugbetaling_verwerkt_at: null, moneybird_factuur_id: null, ...extra,
})

const db = () => h.db
const actie = (id = A) => db().actie(id)
const geboekt = async () => (await db().betaling(PAY)).referral_refund_cent
const posts = () => h.mollie.posts.length
const echteRefunds = () => h.mollie.refunds.filter(r => r.status !== 'failed' && r.status !== 'canceled')
/** Een volgende cronrun: de claim is verlopen en bij Mollie is zoveel tijd verstreken. */
async function draai(na = 0, id = A) {
  await db().verloopClaims()
  h.mollie.klok = NU.getTime() + na
  return voerTerugstortingUit(id, later(na))
}
async function zaai(extra: any = {}, tegoed = 1000) {
  await db().zaai(betaling(extra), tegoed)
}
const reservering = (gegevens: any = { omschrijving: 'Testomschrijving' }, extra: any = {}) => db().zetReservering(A, gegevens, extra)
const vreemde = (extra: any = {}) => ({ id: 're_vreemd', paymentId: TR, status: 'pending', amount: { currency: 'EUR', value: '5.00' }, createdAt: NU.toISOString(), ...extra })

beforeEach(async () => {
  vi.clearAllMocks()
  vi.stubEnv('REFERRAL_TERUGSTORTEN', 'true')
  vi.stubEnv('REFERRAL_CREDITNOTA', '')
  h.db ??= maakNepDb()
  h.faalUpdate = null
  h.tabelWeg = false
  h.telegram.length = 0
  h.telegramStuk = false
  h.wieStuk = false
  Object.assign(h.mollie, { refunds: [], posts: [], plan: [], sleutels: new Map(), klok: NU.getTime(), betaling: {}, lijstStuk: false, zonderMetadata: false })
  await zaai()
})
afterEach(() => vi.unstubAllEnvs())

describe('schakelaar', () => {
  it.each(['', 'false', 'TRUE', '1', 'ja', ' true'])('"%s" is uit: niets reserveren, niets claimen, geen Mollie', async waarde => {
    vi.stubEnv('REFERRAL_TERUGSTORTEN', waarde)
    expect(await reserveerTerugstorting({ actieId: B, userId: 'user_a', betalingId: PAY, omschrijving: 'x', soort: 'tegoed_terugstorten' })).toEqual({ stand: 'uit' })
    expect(await geboekt()).toBe(0)
    await reservering()
    const voor = await actie()
    expect(await draai()).toBe('zou-doen')
    expect(await actie()).toEqual(voor)
    expect(posts()).toBe(0)
    expect(haalBetaling).not.toHaveBeenCalled()
    expect(lijstBetalingTerugbetalingen).not.toHaveBeenCalled()
  })
  it('uit terwijl er al iets verstuurd is: gewoon afhandelen', async () => {
    await reservering()
    await draai()
    vi.stubEnv('REFERRAL_TERUGSTORTEN', '')
    h.mollie.refunds[0].status = 'refunded'
    expect(await draai(DAG)).toBe('bevestigd')
  })
  it('uit na een onbekende uitkomst: wat bij Mollie staat wordt overgenomen', async () => {
    await reservering()
    h.mollie.plan = [{ fout: 'timeout', uitgevoerd: true }]
    await draai()
    vi.stubEnv('REFERRAL_TERUGSTORTEN', '')
    expect(await draai(2 * UUR)).toBe('verzonden')
    expect(posts()).toBe(1)
  })
  it('uit na een onbekende uitkomst en niets gevonden: niet opnieuw versturen en niet vrijgeven', async () => {
    await reservering()
    h.mollie.plan = [{ fout: 'timeout' }]
    await draai()
    vi.stubEnv('REFERRAL_TERUGSTORTEN', '')
    expect(await draai(2 * UUR)).toBe('schakelaar-uit')
    expect(posts()).toBe(1)
    expect((await actie()).status).toBe('bezig')
    expect(await geboekt()).toBe(1210)
  })
  it('uit bij een geclaimde actie waarvan niets verstuurd is: terug naar gereserveerd', async () => {
    await reservering()
    await db().wijzigActie(A, { status: 'bezig' })
    vi.stubEnv('REFERRAL_TERUGSTORTEN', '')
    expect(await draai()).toBe('schakelaar-uit')
    expect(await actie()).toMatchObject({ status: 'gereserveerd', bezig_tot: null })
    expect(posts()).toBe(0)
  })
})

describe('de gewone weg', () => {
  it('stap 1: reserveren, versturen met kenmerk, pas bij refunded bevestigen', async () => {
    expect(await reserveerTerugstorting({ actieId: A, userId: 'user_a', betalingId: PAY, omschrijving: ' Testomschrijving ', soort: 'tegoed_terugstorten' }))
      .toEqual({ stand: 'gereserveerd', brutoCent: 1210, nettoCent: 1000, bestaand: false })
    expect(await geboekt()).toBe(1210)
    expect(await draai()).toBe('verzonden')
    expect(h.mollie.posts[0]).toEqual({ betalingId: TR, brutoCent: 1210, omschrijving: 'Testomschrijving', idempotencyKey: `referral-${A}`, metadata: { referralActie: A } })
    expect(await actie()).toMatchObject({ status: 'verzonden', mollie_refund_id: 're_1', credit_status: 'nvt', bezig_tot: null })
    for (const status of ['pending', 'processing']) {
      h.mollie.refunds[0].status = status
      expect(await draai(DAG)).toBe('verzonden')
    }
    h.mollie.refunds[0].status = 'refunded'
    expect(await draai(2 * DAG)).toBe('bevestigd')
    expect(await actie()).toMatchObject({ status: 'bevestigd', credit_status: 'nodig' })
    expect(await draai(3 * DAG)).toBe('niets-te-doen')
    expect(posts()).toBe(1)
    expect(await geboekt()).toBe(1210)
    expect(h.telegram).toEqual([])
  })
  it('wacht tot zeven dagen na de betaling', async () => {
    await zaai({ betaald_at: new Date(NU.getTime() - 7 * DAG + 1000).toISOString() })
    await reservering()
    expect(await draai()).toBe('wacht-7-dagen')
    expect((await actie()).status).toBe('gereserveerd')
    expect(posts()).toBe(0)
    expect(await draai(2000)).toBe('verzonden')
  })
  it('twee runs tegelijk versturen een keer', async () => {
    await reservering()
    const uit = await Promise.all([voerTerugstortingUit(A, NU), voerTerugstortingUit(A, NU)])
    expect(uit.sort()).toEqual(['niet-geclaimd', 'verzonden'])
    expect(posts()).toBe(1)
  })
  it('een testaccount krijgt niets', async () => {
    expect(await reserveerTerugstorting({ actieId: B, userId: MANUAL_TEST_USER_ID, betalingId: PAY, omschrijving: 'x', soort: 'tegoed_terugstorten' }))
      .toEqual({ stand: 'geweigerd', reden: 'testaccount' })
    await zaai({ user_id: MANUAL_TEST_USER_ID })
    await reservering()
    expect(await draai()).toBe('testaccount')
    expect(posts()).toBe(0)
  })
  it('zonder omschrijving wordt er niet gereserveerd en niet verstuurd', async () => {
    expect(await reserveerTerugstorting({ actieId: B, userId: 'user_a', betalingId: PAY, omschrijving: '  ', soort: 'tegoed_terugstorten' }))
      .toEqual({ stand: 'geweigerd', reden: 'omschrijving_ontbreekt' })
    await reservering({})
    expect(await draai()).toBe('vastgelopen')
    expect(posts()).toBe(0)
    expect(await geboekt()).toBe(0)
  })
})

describe('fouttabel: na reserveren, vóór versturen', () => {
  it('Mollie niet te lezen: de reservering blijft en de volgende run hervat bij het kijken', async () => {
    await reservering()
    h.mollie.lijstStuk = true
    await expect(draai()).rejects.toThrow('mollie plat')
    expect(await geboekt()).toBe(1210)
    expect(posts()).toBe(0)
    h.mollie.lijstStuk = false
    expect(await draai(DAG)).toBe('verzonden')
    expect(posts()).toBe(1)
  })
  it('lukt het vastleggen van de poging niet, dan wordt er niet verstuurd', async () => {
    await reservering()
    h.faalUpdate = p => !!p.gegevens?.post_geprobeerd_at
    await expect(draai()).rejects.toThrow('verbinding weg')
    expect(posts()).toBe(0)
    h.faalUpdate = null
    expect(await draai(DAG)).toBe('verzonden')
    expect(posts()).toBe(1)
  })
  it('de claim houdt een tweede run tegen zolang hij loopt', async () => {
    await reservering()
    h.mollie.plan = [{ fout: 'timeout' }]
    expect(await draai()).toBe('onbekend')
    expect(await voerTerugstortingUit(A, NU)).toBe('niet-geclaimd')
    expect(posts()).toBe(1)
  })
})

describe('fouttabel: time-out of onbekend antwoord bij het versturen', () => {
  it('niet vrijgeven', async () => {
    await reservering()
    h.mollie.plan = [{ fout: 'timeout' }]
    expect(await draai()).toBe('onbekend')
    expect(await actie()).toMatchObject({ status: 'bezig', pogingen: 1 })
    expect(await geboekt()).toBe(1210)
  })
  it('wel uitgevoerd, nieuwe poging na meer dan een uur: gevonden in de lijst, niet nog eens', async () => {
    await reservering()
    h.mollie.plan = [{ fout: 'timeout', uitgevoerd: true }]
    await draai()
    expect(await draai(25 * UUR)).toBe('verzonden')
    expect(posts()).toBe(1)
    expect(echteRefunds()).toHaveLength(1)
  })
  it('niet uitgevoerd, nieuwe poging na meer dan een uur: precies een terugbetaling', async () => {
    await reservering()
    h.mollie.plan = [{ fout: 'timeout' }]
    await draai()
    expect(await draai(25 * UUR)).toBe('verzonden')
    expect(posts()).toBe(2)
    expect(echteRefunds()).toHaveLength(1)
    expect(new Set(h.mollie.posts.map(p => p.idempotencyKey)).size).toBe(1)
  })
  it('geeft de lijst de metadata niet terug, dan nooit een tweede keer: vastgelopen met de reservering erop', async () => {
    await reservering()
    h.mollie.zonderMetadata = true
    h.mollie.plan = [{ fout: 'timeout', uitgevoerd: true }]
    await draai()
    expect(await draai(25 * UUR)).toBe('vastgelopen')
    expect(posts()).toBe(1)
    expect(echteRefunds()).toHaveLength(1)
    expect(await geboekt()).toBe(1210)
    expect(h.telegram.join()).toContain('vastgelopen')
    expect(await draai(50 * UUR)).toBe('niets-te-doen')
  })
  it.each([409, 429, 500, 503, 408])('Mollie %i: niet vrijgeven', async status => {
    await reservering()
    h.mollie.plan = [{ fout: status }]
    expect(await draai()).toBe(status === 429 ? 'later-opnieuw' : 'onbekend')
    expect(await geboekt()).toBe(1210)
    expect((await actie()).status).toBe(status === 429 ? 'gereserveerd' : 'bezig')
    expect(await draai(DAG)).toBe('verzonden')
    expect(echteRefunds()).toHaveLength(1)
  })
  it('429 na een onbekende poging laat de actie op bezig', async () => {
    await reservering()
    h.mollie.plan = [{ fout: 'timeout' }, { fout: 429 }]
    await draai()
    expect(await draai(DAG)).toBe('onbekend')
    expect(await actie()).toMatchObject({ status: 'bezig', pogingen: 1 })
  })
  it('blijft het onduidelijk, dan na vijf pogingen vastgelopen en niet vrijgegeven', async () => {
    await reservering()
    h.mollie.plan = Array.from({ length: 10 }, () => ({ fout: 500 as const }))
    for (let i = 0; i < 5; i++) expect(await draai(i * DAG)).toBe('onbekend')
    expect(await draai(6 * DAG)).toBe('vastgelopen')
    expect(posts()).toBe(5)
    expect(await geboekt()).toBe(1210)
  })
})

describe('fouttabel: duidelijke weigering (4xx) en niets in de lijst', () => {
  it('niets verplaatst: terug naar gereserveerd, na drie keer vrijgegeven en vastgelopen met melding', async () => {
    await reservering()
    h.mollie.plan = [{ fout: 422 }, { fout: 422 }, { fout: 400 }]
    for (const keer of [1, 2]) {
      expect(await draai(keer * DAG)).toBe('later-opnieuw')
      expect(await actie()).toMatchObject({ status: 'gereserveerd', pogingen: keer, bezig_tot: null })
      expect((await actie()).gegevens.post_geprobeerd_at).toBeUndefined()
      expect(await geboekt()).toBe(1210)
    }
    expect(await draai(3 * DAG)).toBe('vastgelopen')
    expect(await geboekt()).toBe(0)
    expect(await actie()).toMatchObject({ status: 'vastgelopen', gegevens: { boeking_teruggezet: true } })
    expect(h.telegram).toHaveLength(1)
    expect(await draai(4 * DAG)).toBe('niets-te-doen')
    expect(posts()).toBe(3)
  })
  it('weigering terwijl onze terugbetaling toch in de lijst staat: overnemen', async () => {
    await reservering()
    h.mollie.plan = [{ fout: 422, uitgevoerd: true }]
    expect(await draai()).toBe('verzonden')
    expect(echteRefunds()).toHaveLength(1)
  })
  it('weigering na een onbekende poging bewijst niets: niet vrijgeven', async () => {
    await reservering()
    h.mollie.plan = [{ fout: 'timeout' }, ...Array.from({ length: 9 }, () => ({ fout: 422 as const }))]
    await draai()
    for (let i = 1; i < 5; i++) expect(await draai(i * DAG)).toBe('onbekend')
    expect(await draai(6 * DAG)).toBe('vastgelopen')
    expect(await geboekt()).toBe(1210)
  })
})

describe('fouttabel: na versturen, vóór vastleggen', () => {
  it('teruggevonden via de metadata, ook na meer dan een uur', async () => {
    await reservering()
    h.faalUpdate = p => p.status === 'verzonden'
    await expect(draai()).rejects.toThrow('verbinding weg')
    expect((await actie()).status).toBe('bezig')
    h.faalUpdate = null
    expect(await draai(3 * UUR)).toBe('verzonden')
    expect(await actie()).toMatchObject({ mollie_refund_id: 're_1' })
    expect(posts()).toBe(1)
  })
  it('intussen al uitbetaald: meteen bevestigd', async () => {
    await reservering()
    h.faalUpdate = p => p.status === 'verzonden'
    await expect(draai()).rejects.toThrow()
    h.faalUpdate = null
    h.mollie.refunds[0].status = 'refunded'
    expect(await draai(DAG)).toBe('bevestigd')
    expect(posts()).toBe(1)
  })
})

describe('fouttabel: later failed of canceled', () => {
  it.each(['failed', 'canceled'])('%s: vrijgeven en melden', async status => {
    await reservering()
    await draai()
    h.mollie.refunds[0].status = status
    expect(await draai(DAG)).toBe('vrijgegeven')
    expect((await actie()).status).toBe('vrijgegeven')
    expect(await geboekt()).toBe(0)
    expect(h.telegram).toHaveLength(1)
    expect(posts()).toBe(1)
  })
  it('mislukt terwijl er intussen anders is terugbetaald: melding over nabetalen', async () => {
    await reservering()
    await draai()
    h.mollie.refunds[0].status = 'failed'
    await db().wijzigBetaling(PAY, { terugbetaling_verwerkt_at: NU.toISOString() })
    await draai(DAG)
    expect(h.telegram[0]).toContain('nabetalen')
  })
  it('een verstuurde terugbetaling die uit de lijst verdwijnt: niet vrijgeven, na vijf keer vastgelopen', async () => {
    await reservering()
    await draai()
    h.mollie.refunds = []
    for (let i = 1; i < 5; i++) expect(await draai(i * DAG)).toBe('onbekend')
    expect(await draai(6 * DAG)).toBe('vastgelopen')
    expect(await geboekt()).toBe(1210)
    expect(posts()).toBe(1)
  })
})

describe('fouttabel: queued', () => {
  it('wachten, en na zeven dagen een keer melden', async () => {
    await reservering()
    h.mollie.plan = [{ status: 'queued' }]
    expect(await draai()).toBe('verzonden')
    expect(await draai(6 * DAG)).toBe('verzonden')
    expect(h.telegram).toHaveLength(0)
    expect(await draai(8 * DAG)).toBe('verzonden')
    expect(await draai(9 * DAG)).toBe('verzonden')
    expect(h.telegram).toHaveLength(1)
    expect(h.telegram[0]).toContain('wachtrij')
    expect(await geboekt()).toBe(1210)
  })
})

describe('stap 4: onbekende terugbetaling of iets dat terugloopt', () => {
  const verwachtVrij = async () => {
    expect(await draai()).toBe('vrijgegeven')
    expect(posts()).toBe(0)
    expect(await geboekt()).toBe(0)
  }
  it('een terugbetaling die wij niet kennen', async () => {
    await reservering()
    h.mollie.refunds.push(vreemde())
    await verwachtVrij()
  })
  it('een mislukte vreemde terugbetaling houdt niets tegen', async () => {
    await reservering()
    h.mollie.refunds.push(vreemde({ status: 'failed' }))
    expect(await draai()).toBe('verzonden')
  })
  it('chargeback volgens Mollie', async () => {
    await reservering()
    h.mollie.betaling = { amountChargedBack: { currency: 'EUR', value: '59.00' } }
    await verwachtVrij()
  })
  it('chargeback volgens onze database', async () => {
    await reservering()
    await db().wijzigBetaling(PAY, { teruggeboekt_cent: 5900 })
    await verwachtVrij()
  })
  it('bij Mollie is niet genoeg over', async () => {
    await reservering()
    h.mollie.betaling = { amountRemaining: { currency: 'EUR', value: '12.09' } }
    await verwachtVrij()
  })
  it('de beheerder betaalde intussen terug: vrijgeven met melding over nabetalen', async () => {
    await reservering()
    await db().wijzigBetaling(PAY, { terugbetaling_verwerkt_at: NU.toISOString() })
    await verwachtVrij()
    expect(h.telegram[0]).toContain('nabetalen')
  })
  it('hetzelfde bezwaar na een onbekende poging: niet vrijgeven', async () => {
    await reservering()
    h.mollie.plan = [{ fout: 'timeout' }]
    await draai()
    h.mollie.betaling = { amountChargedBack: { currency: 'EUR', value: '59.00' } }
    expect(await draai(DAG)).toBe('vastgelopen')
    expect(await geboekt()).toBe(1210)
  })
  it('de terugbetaling van een andere actie op dezelfde betaling is geen onbekende', async () => {
    await db().zetReservering(B, {}, { soort: 'voordeel_maand', referral_id: 'r1', status: 'bevestigd', mollie_refund_id: 're_ander' })
    await reservering()
    h.mollie.refunds.push(vreemde({ id: 're_ander', status: 'refunded', metadata: { referralActie: B }, amount: { currency: 'EUR', value: '12.10' } }))
    expect(await draai()).toBe('verzonden')
    expect(posts()).toBe(1)
  })
  it('twee lopende terugbetalingen met ons kenmerk: vastgelopen', async () => {
    await reservering()
    for (const id of ['re_x', 're_y']) h.mollie.refunds.push(vreemde({ id, metadata: { referralActie: A }, amount: { currency: 'EUR', value: '12.10' } }))
    expect(await draai()).toBe('vastgelopen')
    expect(posts()).toBe(0)
    expect(h.telegram[0]).toContain('dubbel')
  })
  it('ons kenmerk met een ander bedrag: vastgelopen', async () => {
    await reservering()
    h.mollie.refunds.push(vreemde({ metadata: JSON.stringify({ referralActie: A }) }))
    expect(await draai()).toBe('vastgelopen')
    expect(posts()).toBe(0)
    expect(await geboekt()).toBe(1210)
  })
})

describe('alle openstaande acties', () => {
  it('zonder uitgevoerde SQL gebeurt er niets', async () => {
    h.tabelWeg = true
    expect(await verwerkOpenTerugstortingen(NU)).toEqual({ sqlOntbreekt: true, uitkomsten: [], fouten: [] })
    expect(posts()).toBe(0)
  })
  it('verwerkt wat openstaat en meldt een fout per actie', async () => {
    await reservering()
    expect((await verwerkOpenTerugstortingen(NU)).uitkomsten).toEqual([{ actieId: A, uitkomst: 'verzonden' }])
    h.mollie.lijstStuk = true
    await db().verloopClaims()
    const ronde = await verwerkOpenTerugstortingen(NU)
    expect(ronde.fouten).toHaveLength(1)
    expect(betaalTerug).toHaveBeenCalledTimes(1)
  })
})

describe('creditnota: aparte stap, nog niet gebouwd', () => {
  const bevestigd = async () => {
    await reservering()
    await db().wijzigActie(A, { status: 'bevestigd', credit_status: 'nodig' })
    return actie()
  }
  it('uit: niets, ook bij andere waarden dan true', async () => {
    const a = await bevestigd()
    for (const waarde of ['', 'TRUE', '1']) {
      vi.stubEnv('REFERRAL_CREDITNOTA', waarde)
      expect(await creditnotaStap(a)).toBe('uit')
    }
    expect((await actie()).credit_status).toBe('nodig')
  })
  it('aan: wachten op een echte factuur, testmodus overslaan, en verder nog niets', async () => {
    vi.stubEnv('REFERRAL_CREDITNOTA', 'true')
    for (const factuur of [null, 'bezig']) {
      const a = await bevestigd().catch(() => actie())
      await db().wijzigBetaling(PAY, { moneybird_factuur_id: factuur })
      expect(await creditnotaStap(a)).toBe('wacht-op-factuur')
    }
    await db().wijzigBetaling(PAY, { moneybird_factuur_id: '123' })
    expect(await creditnotaStap(await actie())).toBe('niet-gebouwd')
    expect((await actie()).credit_status).toBe('nodig')
    await db().wijzigBetaling(PAY, { moneybird_factuur_id: 'testmodus' })
    expect(await creditnotaStap(await actie())).toBe('geen-factuur-testmodus')
    expect((await actie()).credit_status).toBe('nvt')
    expect(await creditnotaStap(await actie())).toBe('niet-nodig')
  })
})

describe('de beheerderknop mag niet blijvend geweigerd worden', () => {
  it('schakelaar uit, onbekende uitkomst en niets gevonden: na vijf keer vastgelopen met melding', async () => {
    await reservering()
    h.mollie.plan = [{ fout: 'timeout' }]
    await draai()
    vi.stubEnv('REFERRAL_TERUGSTORTEN', '')
    for (let i = 1; i < 5; i++) expect(await draai(i * DAG)).toBe('schakelaar-uit')
    expect(await draai(5 * DAG)).toBe('vastgelopen')
    expect((await actie()).status).toBe('vastgelopen')
    expect(await geboekt()).toBe(1210)
    expect(posts()).toBe(1)
    expect(h.telegram).toHaveLength(1)
  })
  it('Mollie blijft niet te lezen: na tien keer vastgelopen, de claim hangt niet eeuwig', async () => {
    await reservering()
    h.mollie.plan = [{ fout: 'timeout' }]
    await draai()
    h.mollie.lijstStuk = true
    for (let i = 1; i < 10; i++) await expect(draai(i * DAG)).rejects.toThrow('mollie plat')
    expect(await draai(10 * DAG)).toBe('vastgelopen')
    expect(await geboekt()).toBe(1210)
    expect(h.telegram).toHaveLength(1)
  })
  it('niet te lezen terwijl er zeker niets verstuurd is: de reservering gaat terug', async () => {
    await reservering()
    h.mollie.lijstStuk = true
    for (let i = 0; i < 9; i++) await expect(draai(i * DAG)).rejects.toThrow('mollie plat')
    expect(await draai(10 * DAG)).toBe('vastgelopen')
    expect(await geboekt()).toBe(0)
  })
  it('een gelukte lezing zet de teller terug', async () => {
    await reservering()
    h.mollie.plan = [{ status: 'pending' }]
    await draai()
    for (let ronde = 0; ronde < 3; ronde++) {
      h.mollie.lijstStuk = true
      for (let i = 0; i < 6; i++) await expect(draai((1 + ronde * 10 + i) * DAG)).rejects.toThrow('mollie plat')
      h.mollie.lijstStuk = false
      expect(await draai((8 + ronde * 10) * DAG)).toBe('verzonden')
    }
  })
  it('queued: elke week opnieuw gemeld', async () => {
    await reservering()
    h.mollie.plan = [{ status: 'queued' }]
    await draai()
    await draai(8 * DAG)
    await draai(10 * DAG)
    expect(h.telegram).toHaveLength(1)
    await draai(16 * DAG)
    expect(h.telegram).toHaveLength(2)
  })
})

describe('een melding gaat niet verloren', () => {
  const loopVast = async () => {
    await reservering()
    h.mollie.refunds.push(vreemde({ id: 're_x', metadata: { referralActie: A }, amount: { currency: 'EUR', value: '1.00' } }))
    return draai()
  }
  const ronde = async (na: number) => { await db().verloopClaims(); return verwerkOpenTerugstortingen(later(na)) }

  it('Telegram faalt: bij elke volgende ronde opnieuw, tot het lukt, daarna niet meer', async () => {
    h.telegramStuk = true
    expect(await loopVast()).toBe('vastgelopen')
    await ronde(DAG)
    expect(h.telegram).toHaveLength(0)
    h.telegramStuk = false
    await ronde(2 * DAG)
    await ronde(3 * DAG)
    expect(h.telegram).toHaveLength(1)
    expect(h.telegram[0]).toContain('vastgelopen')
  })
  it('de naam niet op te zoeken: de melding gaat met het kenmerk', async () => {
    h.wieStuk = true
    expect(await loopVast()).toBe('vastgelopen')
    expect(h.telegram[0]).toContain('user_a')
  })
  it('ook de melding na een vrijgave wordt herhaald', async () => {
    await reservering()
    h.mollie.refunds.push(vreemde())
    h.telegramStuk = true
    expect(await draai()).toBe('vrijgegeven')
    h.telegramStuk = false
    await ronde(DAG)
    expect(h.telegram).toHaveLength(1)
    expect(h.telegram[0]).toContain('niet doorgegaan')
  })
  it('een actie die al lang openstaat wordt elke week genoemd', async () => {
    await reservering()
    await draai()
    await db().wijzigActie(A, { created_at: new Date(NU.getTime() - 15 * DAG).toISOString() })
    await ronde(DAG)
    await ronde(2 * DAG)
    expect(h.telegram.filter(t => t.includes('staat al lang open'))).toHaveLength(1)
    await ronde(9 * DAG)
    expect(h.telegram.filter(t => t.includes('staat al lang open'))).toHaveLength(2)
  })
})
