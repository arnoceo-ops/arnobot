import { describe, expect, it } from 'vitest'
import { heeftAndereTerugbetaling, isVolledigTerugbetaald, restantCent } from './terugbetaling'

describe('terugbetaling met referraltegoed', () => {
  it('zonder tegoed blijft alles zoals het was', () => {
    expect(isVolledigTerugbetaald({ bedrag_cent: 2900 }, 2900)).toBe(true)
    expect(isVolledigTerugbetaald({ bedrag_cent: 2900 }, 1000)).toBe(false)
    expect(restantCent({ bedrag_cent: 2900 })).toBe(2900)
  })
  it('tegoed ter hoogte van het hele maandbedrag beëindigt het abonnement niet', () => {
    expect(isVolledigTerugbetaald({ bedrag_cent: 1900, referral_refund_cent: 1900 }, 1900)).toBe(false)
  })
  it('gedeeltelijk tegoed is geen volledige terugbetaling', () => {
    expect(isVolledigTerugbetaald({ bedrag_cent: 2900, referral_refund_cent: 1900 }, 1900)).toBe(false)
    expect(heeftAndereTerugbetaling({ bedrag_cent: 2900, referral_refund_cent: 1900 }, 1900)).toBe(false)
  })
  it('wordt na het tegoed ook het restant teruggestort, dan is het wel volledig', () => {
    expect(restantCent({ bedrag_cent: 2900, referral_refund_cent: 1900 })).toBe(1000)
    expect(isVolledigTerugbetaald({ bedrag_cent: 2900, referral_refund_cent: 1900 }, 2900)).toBe(true)
  })
})
