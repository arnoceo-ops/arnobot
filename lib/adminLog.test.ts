import { describe, it, expect } from 'vitest'
import { beschrijfDetails, ACTIE_LABEL } from './adminLog'

describe('beschrijfDetails', () => {
  it('toont oud en nieuw', () => {
    expect(beschrijfDetails({ oud: { plan: 'basis' }, nieuw: { plan: 'premium' } })).toBe('plan: basis → premium')
  })
  it('toont alleen de nieuwe waarde zonder oud', () => {
    expect(beschrijfDetails({ nieuw: { plan: 'premium' } })).toBe('plan: premium')
  })
  it('maakt van leeg, booleans en datums leesbare tekst', () => {
    expect(beschrijfDetails({
      oud: { paid_at: null, is_active: false, expires_at: '2026-12-01T00:00:00.000Z' },
      nieuw: { paid_at: '2026-11-14T10:00:00.000Z', is_active: true, expires_at: '2027-01-01T00:00:00.000Z' },
    })).toBe('paid_at: leeg → 2026-11-14, is_active: nee → ja, expires_at: 2026-12-01 → 2027-01-01')
  })
  it('voegt extra velden toe', () => {
    expect(beschrijfDetails({ extra: { bedrag_cent: 5900 } })).toBe('bedrag_cent: 5900')
  })
  it('geeft een lege tekst bij niets', () => {
    expect(beschrijfDetails(null)).toBe('')
    expect(beschrijfDetails({})).toBe('')
  })
})

describe('ACTIE_LABEL', () => {
  it('heeft een label voor elke actie', () => {
    expect(Object.values(ACTIE_LABEL).every(l => l.length > 0)).toBe(true)
  })
})
