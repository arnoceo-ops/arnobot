/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from 'vitest'

// De referral fee op de eerste jaarbetaling: het bedrag en wie er recht op heeft. Database nagemaakt.
const h = vi.hoisted(() => ({ referral: null as any, betalingen: [] as any[], gebruiker: null as any, fout: null as any }))

vi.mock('./db', () => ({
  billingDb: {
    from(tabel: string) {
      const uit = () => ({
        data: tabel === 'arnobot_referrals' ? h.referral : tabel === 'arnobot_payments' ? h.betalingen : h.gebruiker,
        error: h.fout,
      })
      const q: any = { select: () => q, eq: () => q, returns: () => q, maybeSingle: async () => uit(), then: (res: any) => Promise.resolve(uit()).then(res) }
      return q
    },
  },
}))

import { heeftRechtOpJaarkorting } from './referralKorting'
import { berekenBedrag } from './prijzen'
import { metJaarKorting } from './referralRegels'

describe('bedrag van de eerste jaarbetaling', () => {
  it.each([
    ['premium', 'particulier', 42900, 3900],
    ['basis', 'particulier', 20900, 1900],
    ['premium', 'zakelijk', 51909, 4719],
    ['basis', 'zakelijk', 25289, 2299],
  ] as const)('%s %s', (plan, klant, bruto, korting) => {
    const r = metJaarKorting(berekenBedrag(plan, 'jaarlijks', klant))
    expect(r.bedrag.brutoCent).toBe(bruto)
    expect(r.kortingBrutoCent).toBe(korting)
    expect(r.bedrag.nettoCent + r.bedrag.btwCent).toBe(bruto)
  })
  it('zakelijk: netto precies een maand minder', () => {
    expect(metJaarKorting(berekenBedrag('premium', 'jaarlijks', 'zakelijk')).bedrag.nettoCent).toBe(42900)
  })
})

describe('wie krijgt de korting', () => {
  const nu = new Date('2026-12-20T12:00:00Z')
  beforeEach(() => {
    h.referral = { id: 'r1' }; h.betalingen = []; h.gebruiker = { trial_start: '2026-11-24T19:46:00Z' }; h.fout = null
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
  it('een databasefout wordt niet stil de volle prijs', async () => {
    h.fout = { message: 'stuk' }
    await expect(heeftRechtOpJaarkorting('u', nu)).rejects.toThrow()
  })
})
