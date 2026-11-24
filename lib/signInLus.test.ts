import { describe, expect, it } from 'vitest'
import { isTerugNaAutoStart, SIGNIN_LUS_VENSTER_MS } from './signInLus'

const nu = 1_800_000_000_000

describe('isTerugNaAutoStart', () => {
  it('is false zonder eerdere automatische start (eerste bezoek blijft ongewijzigd)', () => {
    expect(isTerugNaAutoStart(null, nu)).toBe(false)
  })
  it('is true bij een terugkeer kort na de automatische start', () => {
    expect(isTerugNaAutoStart(String(nu - 5_000), nu)).toBe(true)
  })
  it('is false na het venster (bijvoorbeeld uitloggen en later opnieuw inloggen)', () => {
    expect(isTerugNaAutoStart(String(nu - SIGNIN_LUS_VENSTER_MS - 1), nu)).toBe(false)
  })
  it('is false bij onzin of een tijdstip in de toekomst', () => {
    expect(isTerugNaAutoStart('abc', nu)).toBe(false)
    expect(isTerugNaAutoStart(String(nu + 60_000), nu)).toBe(false)
  })
})
