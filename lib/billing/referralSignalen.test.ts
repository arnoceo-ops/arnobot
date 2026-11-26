/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from 'vitest'

// De melding dat de vierde maand van een aangebrachte klant gratis hoort te zijn.
const GEEN_TABEL = { code: 'PGRST205', message: "Could not find the table 'public.arnobot_referral_acties' in the schema cache" }
const h = vi.hoisted(() => ({
  referral: null as any, betalingen: [] as any[], fout: null as any, tg: vi.fn(async (_t: string) => {}),
  /** null: de referral-SQL is niet uitgevoerd. */
  acties: null as any[] | null,
  teksten: {} as Record<string, string>,
}))

vi.mock('./referralTeksten', () => ({ TERUGSTORT_OMSCHRIJVING: h.teksten }))

vi.mock('@/lib/cron-notify', () => ({ notifyTelegram: h.tg }))
vi.mock('./wie', () => ({ wieIs: async () => 'Test Klant' }))
vi.mock('./db', () => ({
  billingDb: {
    from(tabel: string) {
      const uit = () => tabel === 'arnobot_referral_acties'
        ? { data: h.acties, error: h.acties ? null : GEEN_TABEL }
        : { data: tabel === 'arnobot_referrals' ? h.referral : h.betalingen, error: h.fout }
      const q: any = { select: () => q, eq: () => q, limit: () => q, returns: () => q, maybeSingle: async () => uit(), then: (res: any) => Promise.resolve(uit()).then(res) }
      return q
    },
  },
}))

import { meldGratisVierdeMaand } from './referralSignalen'

const maand = (m: number, extra: any = {}) => ({
  status: 'paid', cyclus: 'maandelijks', periode_start: `2027-0${m}-01T00:00:00Z`, periode_einde: `2027-0${m + 1}-01T00:00:00Z`,
  bedrag_cent: 5900, terugbetaald_cent: 0, teruggeboekt_cent: 0, terugbetaling_verwerkt_at: null, ...extra,
})
const roep = () => meldGratisVierdeMaand('u', new Date('2027-04-01T00:00:00Z'))

beforeEach(() => {
  h.referral = { id: 'r1' }; h.betalingen = [maand(1), maand(2), maand(3)]; h.fout = null; h.acties = null; h.tg.mockClear()
  delete h.teksten.voordeel_maand
  vi.stubEnv('REFERRAL_TERUGSTORTEN', '')
})

describe('signaal gratis vierde maand', () => {
  it('derde aaneengesloten maand: melding met de datum en zonder Mollie-terugbetaling', async () => {
    await roep()
    expect(h.tg).toHaveBeenCalledTimes(1)
    expect(h.tg.mock.calls[0][0]).toContain('1 april 2027')
    expect(h.tg.mock.calls[0][0]).toContain('NIET via een terugbetaling in Mollie')
  })
  it('tweede en vierde maand: stil', async () => {
    h.betalingen = [maand(1), maand(2)]
    await roep()
    h.betalingen = [maand(1), maand(2), maand(3), maand(4)]
    await roep()
    expect(h.tg).not.toHaveBeenCalled()
  })
  it('voordeel al gebruikt als jaarkorting: stil', async () => {
    h.referral = { id: 'r1', referred_discount: 39 }
    await roep()
    expect(h.tg).not.toHaveBeenCalled()
  })
  it('na een onderbreking opnieuw drie op rij: geen tweede signaal', async () => {
    h.betalingen = [maand(1), maand(2), maand(3), maand(5), maand(6), maand(7)]
    await roep()
    expect(h.tg).not.toHaveBeenCalled()
  })
  it('niet aangebracht: stil', async () => {
    h.referral = null
    await roep()
    expect(h.tg).not.toHaveBeenCalled()
  })
  it('databasefout houdt niets tegen maar wordt gemeld', async () => {
    h.fout = { message: 'stuk' }
    await expect(roep()).resolves.toBeUndefined()
    expect(h.tg.mock.calls[0][0]).toContain('mislukt')
  })
})

describe('niet dubbel zodra het systeem het zelf doet', () => {
  const aan = () => { vi.stubEnv('REFERRAL_TERUGSTORTEN', 'true'); h.teksten.voordeel_maand = 'x'; h.acties = [] }
  const tekst = () => h.tg.mock.calls[0][0]
  it('schakelaar aan, tekst vastgesteld en SQL uitgevoerd: geen verzoek om het met de hand te doen', async () => {
    aan()
    await roep()
    expect(h.tg).toHaveBeenCalledTimes(1)
    expect(tekst()).toContain('NIET met de hand')
    expect(tekst()).not.toContain('bankoverschrijving')
  })
  it.each([
    ['schakelaar uit', () => vi.stubEnv('REFERRAL_TERUGSTORTEN', '')],
    ['geen vastgestelde klanttekst', () => { delete h.teksten.voordeel_maand }],
    ['SQL niet uitgevoerd', () => { h.acties = null }],
  ])('%s: het gewone verzoek blijft', async (_n, uit) => {
    aan(); uit()
    await roep()
    expect(tekst()).toContain('NIET via een terugbetaling in Mollie')
  })
  it.each(['gereserveerd', 'verzonden', 'bevestigd', 'vastgelopen'])('er staat al een voordeel (%s, ook met de hand ingeboekt): stil, ook met de schakelaar uit', async status => {
    h.acties = [{ soort: 'voordeel_maand', status }]
    await roep()
    expect(h.tg).not.toHaveBeenCalled()
  })
  it('een vrijgegeven voordeel of alleen tegoed telt niet', async () => {
    h.acties = [{ soort: 'voordeel_maand', status: 'vrijgegeven' }, { soort: 'tegoed_terugstorten', status: 'bevestigd' }]
    await roep()
    expect(tekst()).toContain('ACTIE')
  })
})
