import { describe, it, expect } from 'vitest'
import { herstartStatus, type HerstartVelden } from './herstart'

const NU = new Date('2026-10-24T12:00:00Z').getTime()
const dagenTerug = (d: number) => new Date(NU - d * 86400000).toISOString()

function user(o: Partial<HerstartVelden>): HerstartVelden {
  return { is_active: false, deactivated_at: null, winback_sent_at: null, trial_reactivated_at: null, trial_start: null, ...o }
}

describe('herstartStatus', () => {
  it('actief blijft actief', () => {
    expect(herstartStatus(user({ is_active: true }), NU)).toBe('active')
  })
  it('zonder einddatum niet in aanmerking', () => {
    expect(herstartStatus(user({}), NU)).toBe('not_eligible')
  })
  it('winback binnen vijf dagen na de mail', () => {
    expect(herstartStatus(user({ deactivated_at: dagenTerug(17), winback_sent_at: dagenTerug(2) }), NU)).toBe('winback')
  })
  it('te laat na de winback, maar voor 201 dagen', () => {
    expect(herstartStatus(user({ deactivated_at: dagenTerug(60), winback_sent_at: dagenTerug(40) }), NU)).toBe('too_late')
  })
  it('na 201 dagen alsnog een tweede proefperiode', () => {
    expect(herstartStatus(user({ deactivated_at: dagenTerug(210), winback_sent_at: dagenTerug(190) }), NU)).toBe('second_trial')
  })
  it('na twee proefperiodes binnen twaalf maanden alleen betaald', () => {
    expect(herstartStatus(user({ deactivated_at: dagenTerug(30), trial_reactivated_at: dagenTerug(70) }), NU)).toBe('paid_only')
    expect(herstartStatus(user({ deactivated_at: dagenTerug(364), trial_reactivated_at: dagenTerug(400) }), NU)).toBe('paid_only')
  })
  it('na twaalf maanden weer een gratis proefperiode', () => {
    expect(herstartStatus(user({ deactivated_at: dagenTerug(366), trial_reactivated_at: dagenTerug(400) }), NU)).toBe('second_trial')
  })
})
