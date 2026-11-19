import { describe, it, expect } from 'vitest'
import { nettoOmzetCentInMaand, type BetalingVoorOmzet } from './maandOmzet'

const betaling = (extra: Partial<BetalingVoorOmzet> = {}): BetalingVoorOmzet =>
  ({ bedrag_cent: 46_800, btw_cent: 0, terugbetaald_cent: null, betaald_at: '2026-11-17T10:00:00Z', subscription_id: 's1', ...extra })
const jaar = { id: 's1', cyclus: 'jaarlijks' }
const maand = { id: 's1', cyclus: 'maandelijks' }

describe('nettoOmzetCentInMaand', () => {
  it('spreidt een jaarbetaling over 12 maanden vanaf de maand van betalen, daarvoor en daarna niets', () => {
    expect(nettoOmzetCentInMaand(betaling(), jaar, '2026-10')).toBe(0)
    expect(nettoOmzetCentInMaand(betaling(), jaar, '2026-11')).toBe(3900)
    expect(nettoOmzetCentInMaand(betaling(), jaar, '2027-10')).toBe(3900)
    expect(nettoOmzetCentInMaand(betaling(), jaar, '2027-11')).toBe(0)
  })
  it('rekent een bedrag inclusief btw om naar netto', () => {
    // 468 euro netto plus 21% btw = 566,28
    expect(nettoOmzetCentInMaand(betaling({ bedrag_cent: 56_628, btw_cent: 9_828 }), jaar, '2026-12')).toBeCloseTo(3900, 6)
  })
  it('telt een maandbetaling alleen in de maand van betalen', () => {
    const b = betaling({ bedrag_cent: 5_900 })
    expect(nettoOmzetCentInMaand(b, maand, '2026-11')).toBe(5900)
    expect(nettoOmzetCentInMaand(b, maand, '2026-12')).toBe(0)
  })
  it('haalt een terugbetaling pro rata van de omzet af', () => {
    expect(nettoOmzetCentInMaand(betaling({ terugbetaald_cent: 23_400 }), jaar, '2026-11')).toBe(1950)
    expect(nettoOmzetCentInMaand(betaling({ terugbetaald_cent: 99_999 }), jaar, '2026-11')).toBe(0)
  })
  it('geeft nul zonder betaaldatum of bedrag, en behandelt een onbekend abonnement als maandbetaling', () => {
    expect(nettoOmzetCentInMaand(betaling({ betaald_at: null }), jaar, '2026-11')).toBe(0)
    expect(nettoOmzetCentInMaand(betaling({ bedrag_cent: 0 }), jaar, '2026-11')).toBe(0)
    expect(nettoOmzetCentInMaand(betaling(), undefined, '2026-11')).toBe(46_800)
  })
  it('gebruikt de Amsterdamse maand rond middernacht van de maandwisseling', () => {
    expect(nettoOmzetCentInMaand(betaling({ betaald_at: '2026-11-30T23:30:00Z' }), jaar, '2026-12')).toBe(3900)
    expect(nettoOmzetCentInMaand(betaling({ betaald_at: '2026-11-30T23:30:00Z' }), jaar, '2026-11')).toBe(0)
  })
})
