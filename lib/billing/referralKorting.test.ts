/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from 'vitest'

// De referral fee op de eerste jaarbetaling: het bedrag en wie er recht op heeft. Database nagemaakt.
const h = vi.hoisted(() => ({ referral: null as any, betalingen: [] as any[], gebruiker: null as any, fout: null as any, abonnement: null as any }))

vi.mock('./db', () => ({
  billingDb: {
    from(tabel: string) {
      const uit = () => ({
        data: tabel === 'arnobot_referrals' ? h.referral : tabel === 'arnobot_payments' ? h.betalingen : tabel === 'arnobot_subscriptions' ? h.abonnement : h.gebruiker,
        error: h.fout,
      })
      const q: any = { select: () => q, eq: () => q, limit: () => q, returns: () => q, maybeSingle: async () => uit(), then: (res: any) => Promise.resolve(uit()).then(res) }
      return q
    },
  },
}))

import { heeftRechtOpJaarkorting, redenGeenZelfCorrectie } from './referralKorting'
import { berekenBedrag } from './prijzen'
import { metJaarKorting } from './referralRegels'

describe('bedrag van de eerste jaarbetaling', () => {
  it.each([
    ['premium', 'particulier', 36300, 3300],
    ['basis', 'particulier', 20900, 1900],
    ['premium', 'zakelijk', 43923, 3993],
    ['basis', 'zakelijk', 25289, 2299],
  ] as const)('%s %s', (plan, klant, bruto, korting) => {
    const r = metJaarKorting(berekenBedrag(plan, 'jaarlijks', klant))
    expect(r.bedrag.brutoCent).toBe(bruto)
    expect(r.kortingBrutoCent).toBe(korting)
    expect(r.bedrag.nettoCent + r.bedrag.btwCent).toBe(bruto)
  })
  it('zakelijk: netto precies een maand minder', () => {
    expect(metJaarKorting(berekenBedrag('premium', 'jaarlijks', 'zakelijk')).bedrag.nettoCent).toBe(36300)
  })
})

describe('zelf omzetten naar zakelijk', () => {
  const eerste = (bedrag_cent: number) => ({ status: 'paid', soort: 'eerste', plan: 'basis', cyclus: 'jaarlijks', klant_type: 'particulier', bedrag_cent })
  beforeEach(() => { h.betalingen = []; h.fout = null; h.abonnement = null })
  const proJaar = (bedrag_cent: number) => ({ ...eerste(bedrag_cent), plan: 'premium' })
  it('oude Pro-jaarbetaling met fee blijft herkend nu de prijslijst lager is', async () => {
    h.abonnement = { plan: 'premium', cyclus: 'jaarlijks', klant_type: 'particulier', bedrag_cent: 46800 }
    h.betalingen = [proJaar(42900)]
    expect(await redenGeenZelfCorrectie('s')).toBe('referral_fee')
  })
  it('oude volle Pro-jaarbetaling is geen fee', async () => {
    h.abonnement = { plan: 'premium', cyclus: 'jaarlijks', klant_type: 'particulier', bedrag_cent: 46800 }
    h.betalingen = [proJaar(46800)]
    expect(await redenGeenZelfCorrectie('s')).toBeNull()
  })
  it('nieuwe volle Pro-jaarbetaling is geen fee', async () => {
    h.abonnement = { plan: 'premium', cyclus: 'jaarlijks', klant_type: 'particulier', bedrag_cent: 39600 }
    h.betalingen = [proJaar(39600)]
    expect(await redenGeenZelfCorrectie('s')).toBeNull()
  })
  it('volle prijs: mag', async () => {
    h.betalingen = [eerste(22800)]
    expect(await redenGeenZelfCorrectie('s')).toBeNull()
  })
  it('referral fee op de eerste betaling blokkeert, ook na een upgrade', async () => {
    h.betalingen = [eerste(20900), { status: 'paid', soort: 'upgrade', bedrag_cent: 24000 }]
    expect(await redenGeenZelfCorrectie('s')).toBe('referral_fee')
  })
  it('na een upgrade zonder referral fee: ook niet zelf, en niet de referralmelding', async () => {
    h.betalingen = [eerste(22800), { status: 'paid', soort: 'upgrade', bedrag_cent: 24000 }]
    expect(await redenGeenZelfCorrectie('s')).toBe('upgrade')
  })
  it.each(['open', 'pending'])('lopende upgradebetaling (%s) blokkeert ook', async status => {
    h.betalingen = [eerste(22800), { status, soort: 'upgrade', bedrag_cent: 24000 }]
    expect(await redenGeenZelfCorrectie('s')).toBe('upgrade')
  })
  it.each(['failed', 'canceled', 'expired'])('mislukte upgrade (%s) telt niet', async status => {
    h.betalingen = [eerste(22800), { status, soort: 'upgrade', bedrag_cent: 24000 }]
    expect(await redenGeenZelfCorrectie('s')).toBeNull()
  })
  it('betaling van vóór de momentopname: mag', async () => {
    h.betalingen = [{ status: 'paid', soort: 'eerste', bedrag_cent: 100 }]
    expect(await redenGeenZelfCorrectie('s')).toBeNull()
  })
  it('databasefout laat de correctie niet door', async () => {
    h.fout = { message: 'stuk' }
    await expect(redenGeenZelfCorrectie('s')).rejects.toThrow()
  })
})

describe('wie krijgt de korting', () => {
  const nu = new Date('2026-12-20T12:00:00Z')
  beforeEach(() => {
    h.referral = { id: 'r1', created_at: '2026-11-24T19:46:00Z' }; h.betalingen = []; h.gebruiker = { trial_start: '2026-11-24T19:46:00Z' }; h.fout = null
  })
  it('aangebracht, nog niet betaald, binnen de termijn', async () => {
    expect(await heeftRechtOpJaarkorting('u', nu)).toBe(true)
  })
  it('niet aangebracht', async () => {
    h.referral = null
    expect(await heeftRechtOpJaarkorting('u', nu)).toBe(false)
  })
  it('heeft al eens betaald', async () => {
    h.betalingen = [{ terugbetaling_verwerkt_at: null, teruggeboekt_cent: 0 }]
    expect(await heeftRechtOpJaarkorting('u', nu)).toBe(false)
  })
  it('na een herroeping mag het opnieuw', async () => {
    h.betalingen = [{ terugbetaling_verwerkt_at: '2026-12-10T00:00:00Z', teruggeboekt_cent: 0 }]
    expect(await heeftRechtOpJaarkorting('u', nu)).toBe(true)
  })
  it('na de proef plus 15 dagen niet meer', async () => {
    expect(await heeftRechtOpJaarkorting('u', new Date('2027-01-12T12:00:00Z'))).toBe(false)
  })
  it('tweede proefperiode: de eerste termijn telt', async () => {
    h.gebruiker = { trial_start: '2027-02-01T00:00:00Z', trial_reactivated_at: '2027-02-01T00:00:00Z', eerste_proef_start: '2026-11-24T19:46:00Z' }
    expect(await heeftRechtOpJaarkorting('u', new Date('2027-02-05T12:00:00Z'))).toBe(false)
  })
  it('herstart zonder bewaarde eerste proef: de aanmelding telt', async () => {
    h.gebruiker = { trial_start: '2027-02-01T00:00:00Z', trial_reactivated_at: '2027-02-01T00:00:00Z' }
    expect(await heeftRechtOpJaarkorting('u', new Date('2027-02-05T12:00:00Z'))).toBe(false)
    expect(await heeftRechtOpJaarkorting('u', nu)).toBe(true)
  })
  it('intake later afgerond dan de aanmelding: de proef telt vanaf de intake', async () => {
    h.gebruiker = { trial_start: '2026-12-05T10:00:00Z' }
    // Aanmelding plus 45 dagen is 8 januari, de proef plus 15 loopt tot 19 januari.
    expect(await heeftRechtOpJaarkorting('u', new Date('2027-01-18T12:00:00Z'))).toBe(true)
  })
  it('een databasefout wordt niet stil de volle prijs', async () => {
    h.fout = { message: 'stuk' }
    await expect(heeftRechtOpJaarkorting('u', nu)).rejects.toThrow()
  })
})
