/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Het gedeelde slot in de terugbetaling door de beheerder en in de herroeping. Eerst het belangrijkste: zonder uitgevoerde
// SQL doen beide precies wat ze deden.

const h = vi.hoisted(() => ({
  betalingen: [] as any[],
  acties: [] as any[],
  actiesFout: null as any,
  slot: null as any,
  /** De betaalrij zoals zij bij opnieuw lezen is (na een slot waarvan het antwoord verloren ging). */
  vers: null as any,
  versFout: false,
  bevraagd: [] as string[],
  betaalTerug: vi.fn(),
  markeer: vi.fn(),
  verwerk: vi.fn(),
  log: vi.fn(),
  tg: vi.fn(),
}))

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => ({ value: 'sleutel' }) }) }))
vi.mock('@/lib/adminAuth', () => ({ adminKeyMatches: () => true }))
vi.mock('./db', () => ({
  billingDb: {
    from(tabel: string) {
      h.bevraagd.push(tabel)
      const uit = () => tabel === 'arnobot_referral_acties'
        ? { data: h.actiesFout ? null : h.acties, error: h.actiesFout }
        : { data: tabel === 'arnobot_payments' ? h.betalingen.map(b => ({ ...b })) : [], error: null }
      let id: unknown
      const q: any = {
        select: () => q, eq: (k: string, v: unknown) => { if (k === 'id') id = v; return q }, in: () => q, is: () => q, order: () => q, limit: () => q, returns: () => q,
        maybeSingle: async () => {
          if (tabel === 'arnobot_subscriptions') return { data: { id: 's1', klant_type: 'particulier', bedrag_cent: 5900, status: 'active' } }
          if (tabel === 'arnobot_payments' && h.versFout) return { data: null, error: { message: 'time-out' } }
          return { data: h.vers ?? h.betalingen.find(b => b.id === id) ?? null, error: null }
        },
        then: (ok: any) => ok(uit()),
      }
      return q
    },
    rpc: async (naam: string, p: any) => {
      expect(naam).toBe('referral_voor_terugbetaling')
      expect(p).toEqual({ p_user: 'user_gewoon', p_betaling: expect.any(String) })
      if (h.slot instanceof Error) throw h.slot
      return h.slot
    },
  },
}))
vi.mock('./mollie', async origineel => ({
  MollieError: (await origineel<typeof import('./mollie')>()).MollieError,
  betaalTerug: h.betaalTerug,
  mollieIngeschakeld: () => true,
}))
vi.mock('./verwerking', () => ({ markeerTerugbetaald: h.markeer, verwerkMolliebetaling: h.verwerk }))
vi.mock('./mails', () => ({ verstuurBillingMail: vi.fn() }))
vi.mock('./wie', () => ({ wieIs: vi.fn(async (id: string) => id) }))
vi.mock('@/lib/adminLog', () => ({ logAdminActie: h.log }))
vi.mock('@/lib/cron-notify', () => ({ notifyTelegram: h.tg }))

import { POST } from '@/app/api/admin/refund/route'
import { voerHerroepingUit, zoekHerroepbaar } from './herroeping'

const nu = new Date('2026-11-10T12:00:00Z')
const betaling = (extra: any = {}) => ({
  id: 'p1', user_id: 'user_gewoon', subscription_id: 's1', mollie_payment_id: 'tr_1', soort: 'eerste', status: 'paid', bedrag_cent: 5900,
  btw_cent: 1024, terugbetaald_cent: 0, teruggeboekt_cent: 0, betaald_at: '2026-11-05T10:00:00Z', terugbetaling_verwerkt_at: null, ...extra,
})
const GEEN_SQL = { data: null, error: { code: 'PGRST202', message: 'Could not find the function public.referral_voor_terugbetaling(p_betaling, p_user) in the schema cache' } }
const ok = (extra: any = {}) => ({ data: { ok: true, referral_refund_cent: 0, vrijgegeven_cent: 0, onderweg_cent: 0, vast_cent: 0, ...extra }, error: null })
const adminTerug = async (body: any = { userId: 'user_gewoon', bevestigNaBedenktijd: true }) => {
  const r = await POST(new Request('https://x/api/admin/refund', { method: 'POST', body: JSON.stringify(body) }) as any)
  return { status: r.status, body: await r.json() }
}

beforeEach(() => {
  vi.clearAllMocks()
  Object.assign(h, { betalingen: [betaling()], acties: [], actiesFout: null, slot: GEEN_SQL, vers: null, versFout: false, bevraagd: [] })
  h.betaalTerug.mockResolvedValue({ id: 're_1' })
  h.markeer.mockResolvedValue(true)
  h.tg.mockResolvedValue(true)
})

describe('zonder uitgevoerde SQL: precies als voorheen', () => {
  // Rij zoals nu (kolom met 0) en rij van voor de fundament-SQL (kolom bestaat niet).
  it.each([[{ referral_refund_cent: 0 }], [{}]])('beheerder, rij %j: het volle bedrag, dezelfde aanroep, geen extra vraag naar acties', async extra => {
    h.betalingen = [betaling(extra)]
    expect(await adminTerug()).toEqual({ status: 200, body: { ok: true, refundId: 're_1', bedragCent: 5900 } })
    expect(h.betaalTerug).toHaveBeenCalledExactlyOnceWith({ betalingId: 'tr_1', brutoCent: 5900, omschrijving: 'Terugbetaling binnen bedenktijd ArnoBot', idempotencyKey: 'refund-p1' })
    expect(h.markeer).toHaveBeenCalledWith('p1')
    expect(h.verwerk).toHaveBeenCalledWith('tr_1')
    expect(h.bevraagd).not.toContain('arnobot_referral_acties')
    expect(h.tg).not.toHaveBeenCalled()
  })
  it.each([[{ referral_refund_cent: 0 }], [{}]])('herroeping, rij %j: het volle bedrag, geen melding', async extra => {
    h.betalingen = [betaling(extra)]
    expect(await voerHerroepingUit('user_gewoon', nu)).toEqual({ ok: true, soort: 'eerste', bedragCent: 5900, proef: false })
    expect(h.betaalTerug).toHaveBeenCalledExactlyOnceWith({ betalingId: 'tr_1', brutoCent: 5900, omschrijving: 'Herroeping binnen bedenktijd ArnoBot', idempotencyKey: 'herroeping-p1' })
    expect(h.bevraagd).not.toContain('arnobot_referral_acties')
    expect(h.tg).not.toHaveBeenCalled()
  })
  it('ook als de databaselaag de Postgres-code geeft', async () => {
    h.slot = { data: null, error: { code: '42883', message: 'function public.referral_voor_terugbetaling(p_user => unknown) does not exist' } }
    expect((await adminTerug()).status).toBe(200)
  })
  it('al eerder met de hand verrekend (referral_refund_cent boven 0) en geen actietabel: het restant, zoals nu', async () => {
    h.betalingen = [betaling({ referral_refund_cent: 900, terugbetaald_cent: 900 })]
    h.actiesFout = { code: 'PGRST205', message: "Could not find the table 'public.arnobot_referral_acties' in the schema cache" }
    expect((await adminTerug()).body.bedragCent).toBe(5000)
    expect(await voerHerroepingUit('user_gewoon', nu)).toMatchObject({ ok: true, bedragCent: 5000 })
    expect(h.tg).not.toHaveBeenCalled()
  })
})

describe('een andere databasefout', () => {
  const fouten: [string, any][] = [
    ['time-out', { data: null, error: { message: 'canceling statement due to statement timeout', code: '57014' } }],
    ['geen verbinding', new Error('fetch failed')],
    // 42883 van iets anders binnen de functie mag nooit als "niet geïnstalleerd" tellen.
    ['fout binnen de functie', { data: null, error: { code: '42883', message: 'operator does not exist: uuid = text' } }],
    ['betaling onbekend', { data: { ok: false, reden: 'betaling_onbekend' }, error: null }],
  ]
  it.each(fouten)('beheerder, %s: niets terugbetalen', async (_naam, slot) => {
    h.slot = slot
    expect((await adminTerug()).status).toBe(503)
    expect(h.betaalTerug).not.toHaveBeenCalled()
    expect(h.markeer).not.toHaveBeenCalled()
  })
  it.each(fouten)('herroeping, %s: gaat door met wat er volgens de rij over is, en Arno hoort het', async (_naam, slot) => {
    h.slot = slot
    h.betalingen = [betaling({ referral_refund_cent: 1000 })]
    h.acties = [{ doel_id: 'p1', bruto_cent: 1000, status: 'gereserveerd' }]
    // Niet vrijgegeven, dus nooit meer dan het restant: anders zou er te veel terug kunnen gaan.
    expect(await voerHerroepingUit('user_gewoon', nu)).toMatchObject({ ok: true, bedragCent: 4900 })
    expect(h.betaalTerug).toHaveBeenCalledWith(expect.objectContaining({ brutoCent: 4900 }))
    expect(h.tg).toHaveBeenCalledWith(expect.stringContaining('niet te controleren'))
  })
  it('beheerder: acties niet te lezen terwijl er referralgeld op staat: niets terugbetalen', async () => {
    h.betalingen = [betaling({ referral_refund_cent: 1000 })]
    h.actiesFout = { message: 'time-out' }
    expect((await adminTerug()).status).toBe(503)
    expect(h.betaalTerug).not.toHaveBeenCalled()
  })
})

describe('met openstaande acties', () => {
  const vol = () => {
    h.betalingen = [betaling({ referral_refund_cent: 5900 }), betaling({ id: 'oud', mollie_payment_id: 'tr_oud', betaald_at: '2026-10-05T10:00:00Z' })]
    h.acties = [{ doel_id: 'p1', bruto_cent: 5900, status: 'gereserveerd' }]
    h.slot = ok({ vrijgegeven_cent: 5900 })
  }
  it('beheerder: een volledig gereserveerde nieuwste betaling wordt niet overgeslagen voor een oudere', async () => {
    vol()
    expect((await adminTerug()).body.bedragCent).toBe(5900)
    expect(h.betaalTerug).toHaveBeenCalledWith(expect.objectContaining({ betalingId: 'tr_1', brutoCent: 5900 }))
  })
  it('beheerder: loopt er een terugstorting, dan kort weigeren', async () => {
    vol()
    h.acties = [{ doel_id: 'p1', bruto_cent: 5900, status: 'verzonden' }]
    h.slot = ok({ referral_refund_cent: 5900, onderweg_cent: 5900 })
    expect((await adminTerug()).status).toBe(409)
    expect(h.betaalTerug).not.toHaveBeenCalled()
  })
  it('beheerder: de bevestiging buiten de bedenktijd komt vóór het vrijgeven', async () => {
    h.betalingen = [betaling({ betaald_at: '2020-01-01T00:00:00Z' })]
    h.slot = new Error('had niet aangeroepen mogen worden')
    expect(await adminTerug({ userId: 'user_gewoon' })).toMatchObject({ status: 409, body: { buitenBedenktijd: true } })
  })
  it('beheerder: vastgelopen met de reservering erop: het restant, met melding over nabetalen', async () => {
    h.betalingen = [betaling({ referral_refund_cent: 1000 })]
    h.slot = ok({ referral_refund_cent: 1000, vast_cent: 1000 })
    expect((await adminTerug()).body.bedragCent).toBe(4900)
    expect(h.tg).toHaveBeenCalledWith(expect.stringContaining('10.00'))
  })
  it('herroeping: een gereserveerd bedrag telt niet mee, de klant ziet en krijgt het hele bedrag', async () => {
    vol()
    h.betalingen = [h.betalingen[0]]
    expect((await zoekHerroepbaar('user_gewoon', nu)).herroepbaar?.bedragCent).toBe(5900)
    expect(await voerHerroepingUit('user_gewoon', nu)).toMatchObject({ ok: true, bedragCent: 5900 })
    expect(h.betaalTerug).toHaveBeenCalledWith(expect.objectContaining({ brutoCent: 5900 }))
    expect(h.tg).not.toHaveBeenCalled()
  })
  it.each([['onderweg_cent'], ['vast_cent']])('herroeping met %s: nooit geweigerd, het restant gaat terug en Arno kijkt na', async veld => {
    h.betalingen = [betaling({ referral_refund_cent: 1000 })]
    h.acties = veld === 'onderweg_cent' ? [{ doel_id: 'p1', bruto_cent: 1000, status: 'bezig' }] : []
    h.slot = ok({ referral_refund_cent: 1000, [veld]: 1000 })
    expect(await voerHerroepingUit('user_gewoon', nu)).toMatchObject({ ok: true, bedragCent: 4900 })
    expect(h.tg).toHaveBeenCalledWith(expect.stringContaining('nabetalen'))
  })
})

describe('herroepen als referralgeld de hele betaling dekt (wettelijk recht)', () => {
  /** Abonnement en toegang eindigen, zonder terugbetaling bij Mollie, vastgelegd en gemeld. */
  const verwachtBeeindigd = async (id = 'p1') => {
    expect(await voerHerroepingUit('user_gewoon', nu)).toMatchObject({ ok: true, bedragCent: 0, proef: false })
    expect(h.betaalTerug).not.toHaveBeenCalled()
    expect(h.markeer).toHaveBeenCalledExactlyOnceWith(id)
    expect(h.log).toHaveBeenCalledWith(expect.objectContaining({ actie: 'herroeping', details: { extra: expect.objectContaining({ bedrag_cent: 0, zonder_terugbetaling: true }) } }))
    expect(h.tg).toHaveBeenCalledWith(expect.stringContaining('zonder terugbetaling'))
  }

  it('al volledig teruggestort als referralgeld: nog steeds te herroepen', async () => {
    h.betalingen = [betaling({ referral_refund_cent: 5900, terugbetaald_cent: 5900 })]
    h.slot = ok({ referral_refund_cent: 5900 })
    expect((await zoekHerroepbaar('user_gewoon', nu)).herroepbaar).toMatchObject({ soort: 'eerste', bedragCent: 0 })
    await verwachtBeeindigd()
  })
  it.each(['bezig', 'verzonden'])('volledig onderweg (%s)', async status => {
    h.betalingen = [betaling({ referral_refund_cent: 5900 })]
    h.acties = [{ doel_id: 'p1', bruto_cent: 5900, status, gegevens: {} }]
    h.slot = ok({ referral_refund_cent: 5900, onderweg_cent: 5900 })
    await verwachtBeeindigd()
    expect(h.tg).toHaveBeenCalledWith(expect.stringContaining('€59,00'))
  })
  it('de machine claimt tussen het zoeken en het slot', async () => {
    h.betalingen = [betaling({ referral_refund_cent: 5900 })]
    h.acties = [{ doel_id: 'p1', bruto_cent: 5900, status: 'gereserveerd', gegevens: {} }]
    h.slot = ok({ referral_refund_cent: 5900, onderweg_cent: 5900 })
    await verwachtBeeindigd()
  })
  it('slot mislukt en alles is gereserveerd: toch beëindigd, vastgelegd en gemeld', async () => {
    h.betalingen = [betaling({ referral_refund_cent: 5900 })]
    h.acties = [{ doel_id: 'p1', bruto_cent: 5900, status: 'gereserveerd', gegevens: {} }]
    h.slot = { data: null, error: { message: 'time-out' } }
    await verwachtBeeindigd()
    expect(h.tg).toHaveBeenCalledWith(expect.stringContaining('€59,00'))
  })
  it('ook als de acties en de rij niet opnieuw te lezen zijn', async () => {
    h.betalingen = [betaling({ referral_refund_cent: 5900 })]
    h.actiesFout = { message: 'time-out' }
    h.versFout = true
    h.slot = new Error('fetch failed')
    await verwachtBeeindigd()
  })
  it('lukt het beëindigen niet, dan geen succes maar wel een melding', async () => {
    h.betalingen = [betaling({ referral_refund_cent: 5900, terugbetaald_cent: 5900 })]
    h.slot = ok({ referral_refund_cent: 5900 })
    h.markeer.mockResolvedValue(false)
    expect(await voerHerroepingUit('user_gewoon', nu)).toMatchObject({ ok: false, status: 503 })
    expect(h.tg).toHaveBeenCalledWith(expect.stringContaining('niet beëindigd'))
  })
  it('een volledig gedekte upgrade: alleen de upgrade wordt herroepen, nooit het hele abonnement', async () => {
    h.betalingen = [
      betaling(),
      betaling({ id: 'up', mollie_payment_id: 'tr_up', soort: 'upgrade', bedrag_cent: 2000, referral_refund_cent: 2000, terugbetaald_cent: 2000, betaald_at: '2026-11-08T10:00:00Z' }),
    ]
    h.slot = ok({ referral_refund_cent: 2000 })
    expect((await zoekHerroepbaar('user_gewoon', nu)).herroepbaar).toMatchObject({ soort: 'upgrade', bedragCent: 0 })
    await verwachtBeeindigd('up')
  })
  it('mislukt de terugbetaling bij Mollie, dan hoort Arno het', async () => {
    h.betaalTerug.mockRejectedValue(new Error('Mollie 422'))
    await expect(voerHerroepingUit('user_gewoon', nu)).rejects.toThrow('422')
    expect(h.tg).toHaveBeenCalledWith(expect.stringContaining('Herroeping mislukt'))
  })
})

describe('slot onbekend terwijl de vrijgave wel gebeurde', () => {
  it('de rij wordt opnieuw gelezen: de klant krijgt het hele bedrag', async () => {
    h.betalingen = [betaling({ referral_refund_cent: 1000 })]
    h.acties = [{ doel_id: 'p1', bruto_cent: 1000, status: 'gereserveerd', gegevens: {} }]
    // Het antwoord van het slot ging verloren; in de database is de reservering al terug.
    h.vers = betaling({ referral_refund_cent: 0 })
    h.slot = new Error('fetch failed')
    expect(await voerHerroepingUit('user_gewoon', nu)).toMatchObject({ ok: true, bedragCent: 5900 })
    expect(h.tg).toHaveBeenCalledWith(expect.stringContaining('niet te controleren'))
  })
})

describe('beheerderknop bij een vastgelopen bedrag', () => {
  const vast = (cent: number) => {
    h.betalingen = [betaling({ referral_refund_cent: cent }), betaling({ id: 'oud', mollie_payment_id: 'tr_oud', betaald_at: '2026-10-05T10:00:00Z' })]
    h.acties = [{ doel_id: 'p1', bruto_cent: cent, status: 'vastgelopen', gegevens: {} }]
    h.slot = ok({ referral_refund_cent: cent, vast_cent: cent })
  }
  it('dekt het de hele betaling: geen oudere betaling pakken, 404 met melding', async () => {
    vast(5900)
    expect((await adminTerug()).status).toBe(404)
    expect(h.betaalTerug).not.toHaveBeenCalled()
    expect(h.tg).toHaveBeenCalledWith(expect.stringContaining('59.00'))
  })
})

describe('betaalTerug bij Mollie', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })
  const verstuur = async (extra: any) => {
    const nepFetch = vi.fn(async () => new Response(JSON.stringify({ id: 're_1', status: 'pending' }), { status: 201 }))
    vi.stubGlobal('fetch', nepFetch)
    vi.stubEnv('MOLLIE_API_KEY', 'test_nep')
    const echt = await vi.importActual<typeof import('./mollie')>('./mollie')
    await echt.betaalTerug({ betalingId: 'tr_1', brutoCent: 1210, omschrijving: 'o', idempotencyKey: 'k', ...extra })
    return JSON.parse((nepFetch.mock.calls[0] as any)[1].body)
  }
  it('zonder metadata is de aanvraag precies als voorheen', async () => {
    expect(await verstuur({})).toEqual({ amount: { currency: 'EUR', value: '12.10' }, description: 'o' })
  })
  it('met metadata gaat het kenmerk mee', async () => {
    expect(await verstuur({ metadata: { referralActie: 'a1' } })).toEqual({ amount: { currency: 'EUR', value: '12.10' }, description: 'o', metadata: { referralActie: 'a1' } })
  })
})
