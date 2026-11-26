/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi } from 'vitest'

// De pure regels van het fundament: gratis periodes in de maandtelling, rest en saldo uit grootboekregels, verval op
// de rest en mijlpalen zonder teruggedraaide toekenningen.

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))
vi.mock('./db', () => ({ billingDb: {} }))
vi.mock('./teamFacturatie', () => ({ huidigSeats: vi.fn() }))

import { gratisVierdeMaand, kwalificatie, telMaanden, verrekening, type BetaaldePeriode } from './referralRegels'
import { isTeruggedraaid, restVanToekenning, saldoVan, verdeelVerrekening, vervalBedrag, type SaldoRegel } from './referralSaldo'
import { maandReeks } from './referralSignalen'
import { nieuweMijlpalen } from './referralGrootboek'
import { beoordeelReferral, type AanbrengerFeiten, type KlantFeiten } from './referralBeoordeling'

const periode = (start: string, einde: string) => ({ periodeStart: `${start}T10:00:00.000Z`, periodeEinde: `${einde}T10:00:00.000Z` })
const maand = (start: string, einde: string, extra: Partial<BetaaldePeriode> = {}): BetaaldePeriode => ({
  plan: 'premium', cyclus: 'maandelijks', klantType: 'particulier', ...periode(start, einde), betaaldAt: `${start}T10:00:00.000Z`,
  geldig: true, maandNettoCent: 4876, bronId: `tr_${start}`, ...extra,
})
const jan = maand('2027-01-01', '2027-02-01')
const feb = maand('2027-02-01', '2027-03-01')
const mrt = maand('2027-03-01', '2027-04-01')
const apr = maand('2027-04-01', '2027-05-01')
const mei = maand('2027-05-01', '2027-06-01')
const NU = new Date('2027-08-01T00:00:00Z')
const gratisMrt = periode('2027-03-01', '2027-04-01')

describe('gratis periode in de maandtelling', () => {
  const reeksen = (r: { reeks: number; nieuw: boolean }[]) => r.map(m => [m.reeks, m.nieuw])
  const gratis = (g: { periodeStart: string; periodeEinde: string }) => ({ ...g, gratis: true })

  it('overbrugt de overgeslagen maand zonder zelf te tellen', () => {
    expect(reeksen(telMaanden([jan, feb, gratis(gratisMrt), apr]))).toEqual([[1, true], [2, true], [2, false], [3, true]])
    // Zonder de gratis periode begint de reeks opnieuw.
    expect(telMaanden([jan, feb, apr]).at(-1)!.reeks).toBe(1)
  })
  it('twee gratis maanden achter elkaar breken de reeks ook niet', () => {
    expect(telMaanden([jan, gratis(periode('2027-02-01', '2027-03-01')), gratis(gratisMrt), apr]).at(-1)!.reeks).toBe(2)
  })
  it('herstelt een onderbreking niet die er al vóór zat', () => {
    // Na januari zit er twee maanden niets; de gratis periode begint pas in april.
    expect(telMaanden([jan, gratis(periode('2027-04-01', '2027-05-01')), mei]).at(-1)!.reeks).toBe(1)
  })
  it('na de gratis periode mag er nog 14 dagen tussen zitten, niet meer', () => {
    expect(telMaanden([jan, feb, gratis(gratisMrt), maand('2027-04-15', '2027-05-15')]).at(-1)!.reeks).toBe(3)
    expect(telMaanden([jan, feb, gratis(gratisMrt), maand('2027-04-16', '2027-05-16')]).at(-1)!.reeks).toBe(1)
  })
  it('een gratis periode vooraan telt niet mee', () => {
    expect(telMaanden([gratis(periode('2026-12-01', '2027-01-01')), jan]).map(m => m.reeks)).toEqual([0, 1])
  })
  it('komt de incasso toch binnen voor een gratis maand, dan telt die betaalde maand gewoon', () => {
    expect(telMaanden([jan, feb, gratis(gratisMrt), mrt]).at(-1)).toMatchObject({ reeks: 3, nieuw: true })
  })
  it('een dubbele betaling telt nog steeds niet dubbel', () => {
    expect(telMaanden([jan, { ...jan }, gratis(periode('2027-02-01', '2027-03-01')), mrt]).at(-1)!.reeks).toBe(2)
  })
  it('de drempel: gehaald over een gratis maand heen, en nooit op de gratis maand zelf', () => {
    expect(kwalificatie([jan, feb, apr], NU)).toBeNull()
    expect(kwalificatie([jan, feb, apr], NU, [gratisMrt])?.periode).toBe(apr)
    expect(kwalificatie([jan, feb], NU, [gratisMrt])).toBeNull()
    expect(kwalificatie([jan, feb, apr], new Date('2027-04-20T00:00:00Z'), [gratisMrt])).toBeNull()
  })
  it('de vierde maand en het signaal slaan de gratis periode over', () => {
    expect(gratisVierdeMaand([jan, feb, apr, mei], [gratisMrt])).toBe(mei)
    expect(gratisVierdeMaand([jan, feb, apr], [gratisMrt])).toBeNull()
    const rij = (p: BetaaldePeriode) => ({
      status: 'paid', cyclus: 'maandelijks', periode_start: p.periodeStart, periode_einde: p.periodeEinde, bedrag_cent: 5900,
      terugbetaald_cent: 0, teruggeboekt_cent: 0, terugbetaling_verwerkt_at: null,
    }) as any
    expect(maandReeks([jan, feb, apr].map(rij), [gratisMrt])).toEqual({ reeks: 3, eerderGehaald: false })
    // Na de derde maand komt de gratis maand: het signaal is dan al geweest.
    expect(maandReeks([jan, feb, mrt].map(rij), [periode('2027-04-01', '2027-05-01')])).toEqual({ reeks: 3, eerderGehaald: true })
  })
})

describe('de betalingen onder een toekenning', () => {
  it('per maand zijn het de drie maanden die samen de drempel halen', () => {
    expect(kwalificatie([jan, feb, mrt, apr], NU)!.bronnen).toEqual([jan, feb, mrt])
    expect(kwalificatie([jan, feb, apr], NU, [gratisMrt])!.bronnen).toEqual([jan, feb, apr])
    // Een eerdere, onderbroken maand hoort er niet bij.
    const los = maand('2026-10-01', '2026-11-01')
    expect(kwalificatie([los, jan, feb, mrt], NU)!.bronnen).toEqual([jan, feb, mrt])
  })
  it('per jaar is het alleen de jaarbetaling', () => {
    const jaar = maand('2027-04-01', '2028-04-01', { cyclus: 'jaarlijks', klantType: 'zakelijk', bronId: 'tr_jaar' })
    expect(kwalificatie([jan, jaar], NU)!.bronnen).toEqual([jaar])
  })
  it('komen mee in de beoordeling', () => {
    const klant: KlantFeiten = {
      aangemeldAt: '2026-12-20T10:00:00.000Z', proefEindeAt: '2027-01-19T10:00:00.000Z', betaalMomenten: [{ at: jan.betaaldAt, team: false }],
      periodes: [jan, feb, apr], gratisPeriodes: [gratisMrt], handmatigBetaald: false, ooitMetDeHandBetaald: false,
      proefMogelijkVerlengd: false, bijbetalingLoopt: false,
    }
    const aanbrenger: AanbrengerFeiten = {
      stand: { loopt: true, laatsteEindeAt: null },
      historie: { dekking: [{ start: '2026-12-01T00:00:00Z', einde: null, team: false }], eersteUiterlijk: { solo: null, team: null } },
      handmatigBetaald: false, historieOnvolledig: false, maandNettoCent: 4876, bijbetalingLoopt: false,
    }
    expect(beoordeelReferral(klant, aanbrenger, NU)).toMatchObject({ uitkomst: 'toekennen', bronIds: [jan.bronId, feb.bronId, apr.bronId] })
    expect(beoordeelReferral({ ...klant, gratisPeriodes: [] }, aanbrenger, NU)).toMatchObject({ uitkomst: 'wacht' })
  })
})

describe('een rest van 1 cent', () => {
  it('telt als verbruikt', () => {
    // 22,98 bruto dekt 18,99 netto van 19,00: de cent die door afronding overblijft gaat mee.
    expect(verrekening(1900, 2298)).toEqual({ brutoCent: 2298, verbruiktNettoCent: 1900 })
    expect(verrekening(2, 1)).toEqual({ brutoCent: 1, verbruiktNettoCent: 2 })
  })
  it('twee cent blijft gewoon staan', () => {
    expect(verrekening(1900, 2297)).toEqual({ brutoCent: 2297, verbruiktNettoCent: 1898 })
  })
})

let teller = 0
const regel = (soort: string, referral_id: string, netto_cent: number | null, extra: Partial<SaldoRegel> = {}): SaldoRegel => ({
  soort, referral_id, netto_cent, created_at: new Date(Date.UTC(2027, 0, 1) + ++teller * 1000).toISOString(), ...extra,
})

describe('rest per toekenning en saldo', () => {
  it('toekenning, vaststelling en alle mutaties die erop slaan', () => {
    const r = [regel('toekenning', 'a', null), regel('vaststelling', 'a', 1900), regel('verrekening', 'a', -500, { hoort_bij: 'a' }),
      regel('vrijgave', 'a', 200, { hoort_bij: 'a' }), regel('toekenning', 'b', 1000), regel('handwerk', 'a', 0)]
    expect(restVanToekenning(r, 'a')).toBe(1600)
    expect(restVanToekenning(r, 'b')).toBe(1000)
    expect(saldoVan(r)).toMatchObject({ beschikbaarCent: 2600, schuldCent: 0 })
  })
  it('hoort_bij gaat vóór referral_id', () => {
    const r = [regel('toekenning', 'a', 1000), regel('toekenning', 'b', 1000), regel('verrekening', 'b', -300, { hoort_bij: 'a' })]
    expect([restVanToekenning(r, 'a'), restVanToekenning(r, 'b')]).toEqual([700, 1000])
  })
  it('een toekenning zonder bedrag telt niet mee tot de vaststelling', () => {
    expect(saldoVan([regel('toekenning', 'a', null)]).beschikbaarCent).toBe(0)
  })
  it('oudste eerst', () => {
    const r = [regel('toekenning', 'oud', 1000), regel('toekenning', 'nieuw', 1000)]
    expect(verdeelVerrekening(r, 1500)).toEqual([{ referralId: 'oud', nettoCent: 1000 }, { referralId: 'nieuw', nettoCent: 500 }])
    expect(() => verdeelVerrekening(r, 2001)).toThrow()
  })
  it('een schuld na gebruik gaat er eerst af', () => {
    const r = [regel('toekenning', 'a', 1000), regel('toekenning', 'b', 1000), regel('verrekening', 'a', -1000, { hoort_bij: 'a' }),
      regel('terugdraaiing', 'a', -1000, { hoort_bij: 'a' }), regel('toekenning', 'c', 1500)]
    expect(saldoVan(r)).toMatchObject({ beschikbaarCent: 1500, schuldCent: 1000 })
    expect(verdeelVerrekening(r, 1500)).toEqual([{ referralId: 'c', nettoCent: 1500 }])
  })
  it('is de schuld groter dan het tegoed, dan is er niets en nooit iets negatiefs', () => {
    const r = [regel('toekenning', 'a', 1000), regel('verrekening', 'a', -1000, { hoort_bij: 'a' }), regel('terugdraaiing', 'a', -1000, { hoort_bij: 'a' }),
      regel('toekenning', 'b', 400)]
    expect(saldoVan(r)).toMatchObject({ beschikbaarCent: 0, schuldCent: 1000 })
  })
})

describe('verval op de rest', () => {
  it('na deelverbruik vervalt alleen wat er nog is', () => {
    const r = [regel('toekenning', 'a', 1900), regel('verrekening', 'a', -1500, { hoort_bij: 'a' })]
    expect(vervalBedrag(r, 'a')).toBe(-400)
    expect(saldoVan([...r, regel('verval', 'a', vervalBedrag(r, 'a'))]).beschikbaarCent).toBe(0)
  })
  it('alles gebruikt of in schuld: 0, nooit een positief of extra negatief bedrag', () => {
    const op = [regel('toekenning', 'a', 1900), regel('verrekening', 'a', -1900, { hoort_bij: 'a' })]
    expect(vervalBedrag(op, 'a')).toBe(0)
    expect(Object.is(vervalBedrag(op, 'a'), -0)).toBe(false)
    expect(vervalBedrag([...op, regel('terugdraaiing', 'a', -1900, { hoort_bij: 'a' })], 'a')).toBe(0)
  })
})

describe('het verdienmoment', () => {
  it('per maand: zodra de derde maand voorbij is, ongeacht wanneer we kijken', () => {
    const later = new Date('2027-09-01T00:00:00Z')
    expect(kwalificatie([jan, feb, mrt], NU)!.verdiendAt).toBe(new Date(mrt.periodeEinde).toISOString())
    expect(kwalificatie([jan, feb, mrt, apr], later)!.verdiendAt).toBe(new Date(mrt.periodeEinde).toISOString())
  })
  it('per maand: een derde maand die pas na afloop betaald is, telt vanaf die betaling', () => {
    const laat = { ...mrt, betaaldAt: '2027-04-09T10:00:00.000Z' }
    expect(kwalificatie([jan, feb, laat], NU)!.verdiendAt).toBe('2027-04-09T10:00:00.000Z')
  })
  it('zakelijk per jaar: bij betaling; particulier: de eerste dag na de bedenktijd, winter en zomer', () => {
    const jaar = (klantType: 'zakelijk' | 'particulier', betaaldAt: string) =>
      maand('2027-01-01', '2028-01-01', { cyclus: 'jaarlijks', klantType, betaaldAt })
    const laterNu = new Date('2027-12-01T00:00:00Z')
    expect(kwalificatie([jaar('zakelijk', '2027-01-01T10:00:00.000Z')], laterNu)!.verdiendAt).toBe('2027-01-01T10:00:00.000Z')
    expect(kwalificatie([jaar('particulier', '2027-01-01T10:00:00.000Z')], laterNu)!.verdiendAt).toBe('2027-01-15T23:00:00.000Z')
    expect(kwalificatie([jaar('particulier', '2027-06-01T10:00:00.000Z')], laterNu)!.verdiendAt).toBe('2027-06-15T22:00:00.000Z')
  })
  it('een later aangemaakte regel verrekent met een verlenging na het verdienen, niet met een eerdere', () => {
    const r = [regel('toekenning', 'a', 1900, { created_at: '2027-08-01T00:00:00.000Z', verdiend_at: '2027-04-01T00:00:00.000Z' })]
    expect(saldoVan(r, { toegekendVoor: '2027-05-01T00:00:00.000Z' }).beschikbaarCent).toBe(1900)
    expect(saldoVan(r, { toegekendVoor: '2027-03-01T00:00:00.000Z' }).beschikbaarCent).toBe(0)
  })
  it('oudste eerst gaat op het verdienmoment', () => {
    const r = [regel('toekenning', 'later-verdiend', 1000, { verdiend_at: '2027-05-01T00:00:00.000Z' }),
      regel('toekenning', 'eerder-verdiend', 1000, { verdiend_at: '2027-04-01T00:00:00.000Z' })]
    expect(verdeelVerrekening(r, 1000)).toEqual([{ referralId: 'eerder-verdiend', nettoCent: 1000 }])
  })
})

describe('mijlpalen', () => {
  const toekenningen = (n: number) => Array.from({ length: n }, (_, i) => ({ soort: 'toekenning', referral_id: `r${i}`, aanbrenger_user_id: 'a' }) as any)
  const op = (soort: string, i: number) => ({ soort, referral_id: `r${i}`, hoort_bij: `r${i}`, aanbrenger_user_id: 'a' }) as any

  it('een teruggedraaide toekenning telt niet mee', () => {
    const alle = toekenningen(50)
    expect(nieuweMijlpalen([...alle, op('terugdraaiing', 3)], [alle[49]])).toEqual([])
    expect(nieuweMijlpalen(toekenningen(51).concat(op('terugdraaiing', 3)), [toekenningen(51)[50]])).toEqual([{ aanbrengerId: 'a', aantal: 50 }])
  })
  it('na herstel telt zij weer mee', () => {
    const alle = toekenningen(50)
    const r = [...alle, op('terugdraaiing', 3), op('herstel', 3)]
    expect(isTeruggedraaid(r, 'r3')).toBe(false)
    expect(nieuweMijlpalen(r, [alle[49]])).toEqual([{ aanbrengerId: 'a', aantal: 50 }])
  })
  it('een nieuwe toekenning die zelf al teruggedraaid is haalt geen mijlpaal', () => {
    const alle = toekenningen(50)
    expect(nieuweMijlpalen([...alle, op('terugdraaiing', 49)], [alle[49]])).toEqual([])
  })
})
