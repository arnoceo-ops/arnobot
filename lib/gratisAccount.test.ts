import { describe, expect, it } from 'vitest'
import { isGratisAccount, type GratisKenmerken } from './gratisAccount'

const datum = '2027-01-01T00:00:00.000Z'

describe('gratis account', () => {
  it('alleen het kenmerk telt, ook bij BETAALD', () => {
    expect(isGratisAccount({ gratis_sinds: datum, paid_at: datum } as GratisKenmerken)).toBe(true)
  })
  it.each([
    ['zonder kenmerk, ook zonder proefstart en met einddatum', { trial_start: null, expires_at: datum, paid_at: null }],
    ['voordat de kolom bestaat', {}],
    ['Lifetime', { gratis_sinds: datum, lifetime_sinds: datum }],
  ])('%s is niet gratis', (_naam, g) => {
    expect(isGratisAccount(g as GratisKenmerken)).toBe(false)
  })
})
