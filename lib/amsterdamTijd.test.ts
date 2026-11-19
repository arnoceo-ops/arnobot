import { describe, it, expect } from 'vitest'
import { amsterdamDagStart, amsterdamDatum, dagenInMaand, dagenTussen, datumPlusDagen, isDatum } from './amsterdamTijd'

describe('amsterdamDagStart', () => {
  it('begint de dag in de winter om 23:00 UTC de dag ervoor en in de zomer om 22:00', () => {
    expect(amsterdamDagStart('2026-01-15')).toBe('2026-01-14T23:00:00.000Z')
    expect(amsterdamDagStart('2026-07-01')).toBe('2026-06-30T22:00:00.000Z')
  })
  it('klopt op de dagen dat de klok verzet wordt', () => {
    // 29 maart 2026: om 02:00 gaat de klok naar 03:00, middernacht is nog winter
    expect(amsterdamDagStart('2026-03-29')).toBe('2026-03-28T23:00:00.000Z')
    expect(amsterdamDagStart('2026-03-30')).toBe('2026-03-29T22:00:00.000Z')
    // 25 oktober 2026: om 03:00 gaat de klok terug naar 02:00, middernacht is nog zomer
    expect(amsterdamDagStart('2026-10-25')).toBe('2026-10-24T22:00:00.000Z')
    expect(amsterdamDagStart('2026-10-26')).toBe('2026-10-25T23:00:00.000Z')
  })
})

describe('amsterdamDatum', () => {
  it('geeft de Amsterdamse kalenderdag rond middernacht', () => {
    expect(amsterdamDatum(new Date('2026-11-30T22:30:00Z'))).toBe('2026-11-30')
    expect(amsterdamDatum(new Date('2026-11-30T23:30:00Z'))).toBe('2026-12-01')
  })
})

describe('datumhulp', () => {
  it('telt dagen op en af over maand- en jaargrenzen', () => {
    expect(datumPlusDagen('2026-12-31', 1)).toBe('2027-01-01')
    expect(datumPlusDagen('2026-03-01', -1)).toBe('2026-02-28')
    expect(datumPlusDagen('2026-11-19', -30)).toBe('2026-10-20')
  })
  it('telt het aantal dagen van een periode inclusief begin en einde', () => {
    expect(dagenTussen('2026-11-01', '2026-11-30')).toBe(30)
    expect(dagenTussen('2026-11-19', '2026-11-19')).toBe(1)
    expect(dagenTussen('2026-12-30', '2027-01-02')).toBe(4)
  })
  it('kent de lengte van een maand', () => {
    expect(dagenInMaand(2026, 2)).toBe(28)
    expect(dagenInMaand(2028, 2)).toBe(29)
    expect(dagenInMaand(2026, 11)).toBe(30)
  })
  it('herkent geldige datums en weigert de rest', () => {
    expect(isDatum('2026-11-19')).toBe(true)
    expect(isDatum('2026-13-01')).toBe(false)
    expect(isDatum('2026-02-31')).toBe(false)
    expect(isDatum('19-11-2026')).toBe(false)
    expect(isDatum(null)).toBe(false)
  })
})
