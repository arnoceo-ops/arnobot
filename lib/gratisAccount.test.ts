import { describe, expect, it } from 'vitest'
import { isGratisAccount } from './gratisAccount'

const datum = '2027-01-01T00:00:00.000Z'

describe('gratis account', () => {
  it.each([
    ['knop GRATIS', { paid_at: null, trial_start: null, expires_at: datum }],
    ['GRATIS en daarna de intake afgerond', { paid_at: null, trial_start: datum, expires_at: datum }],
    ['met de hand zonder proef', { paid_at: null, trial_start: null, expires_at: null }],
  ])('%s is gratis', (_naam, g) => {
    expect(isGratisAccount(g)).toBe(true)
  })
  it.each([
    ['gewone proef', { paid_at: null, trial_start: datum, expires_at: null }],
    ['betaald na GRATIS', { paid_at: datum, trial_start: null, expires_at: datum }],
    ['met de hand op BETAALD', { paid_at: datum, trial_start: datum, expires_at: null }],
    ['verlengde teamproef', { paid_at: null, trial_start: datum, expires_at: datum, command_manager: true, sd_attribution_method: 'link' }],
    ['Lifetime', { paid_at: null, trial_start: null, expires_at: datum, lifetime_sinds: datum }],
  ])('%s is niet gratis', (_naam, g) => {
    expect(isGratisAccount(g)).toBe(false)
  })
})
