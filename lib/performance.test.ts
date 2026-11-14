import { describe, it, expect } from 'vitest'
import { beoordeelSnelheid, snelheidScore, meetSnelheid, SNELHEID_GRENZEN, SNELHEID_KLEUR } from './performance'

describe('beoordeelSnelheid', () => {
  it('houdt de gemeten basis (gemiddeld 668 ms, p95 1657 ms) groen', () => {
    expect(beoordeelSnelheid({ gemiddeldMs: 668, p95Ms: 1657 })).toBe('goed')
  })
  it('is onder druk boven de eerste grens, op gemiddelde of op p95', () => {
    expect(beoordeelSnelheid({ gemiddeldMs: 1300, p95Ms: 1800 })).toBe('onder_druk')
    expect(beoordeelSnelheid({ gemiddeldMs: 700, p95Ms: 2600 })).toBe('onder_druk')
  })
  it('is laag boven de tweede grens, op gemiddelde of op p95', () => {
    expect(beoordeelSnelheid({ gemiddeldMs: 2600, p95Ms: 3000 })).toBe('laag')
    expect(beoordeelSnelheid({ gemiddeldMs: 800, p95Ms: 4500 })).toBe('laag')
  })
  it('de grens zelf telt nog als goed (strikt erboven)', () => {
    expect(beoordeelSnelheid({ gemiddeldMs: SNELHEID_GRENZEN.onderDruk.gemiddeldMs, p95Ms: SNELHEID_GRENZEN.onderDruk.p95Ms })).toBe('goed')
    expect(beoordeelSnelheid({ gemiddeldMs: SNELHEID_GRENZEN.laag.gemiddeldMs, p95Ms: null })).toBe('onder_druk')
  })
  it('werkt met alleen een gemiddelde (meting van het laatste uur)', () => {
    expect(beoordeelSnelheid({ gemiddeldMs: 900, p95Ms: null })).toBe('goed')
    expect(beoordeelSnelheid({ gemiddeldMs: 1500, p95Ms: null })).toBe('onder_druk')
    expect(beoordeelSnelheid({ gemiddeldMs: 3000, p95Ms: null })).toBe('laag')
  })
  it('is onbekend zonder meting', () => {
    expect(beoordeelSnelheid({ gemiddeldMs: null, p95Ms: null })).toBe('onbekend')
  })
  it('geeft elk niveau een eigen kleur', () => {
    expect(new Set(Object.values(SNELHEID_KLEUR)).size).toBe(4)
  })
})

describe('snelheidScore', () => {
  it('is 100 bij 1000 ms of sneller en 0 bij 5000 ms of trager', () => {
    expect(snelheidScore({ gemiddeldMs: null, p95Ms: 800 })).toBe(100)
    expect(snelheidScore({ gemiddeldMs: null, p95Ms: 1000 })).toBe(100)
    expect(snelheidScore({ gemiddeldMs: null, p95Ms: 5000 })).toBe(0)
    expect(snelheidScore({ gemiddeldMs: null, p95Ms: 9000 })).toBe(0)
  })
  it('daalt lineair ertussen en valt terug op het gemiddelde zonder p95', () => {
    expect(snelheidScore({ gemiddeldMs: null, p95Ms: 3000 })).toBe(50)
    expect(snelheidScore({ gemiddeldMs: 3000, p95Ms: null })).toBe(50)
  })
  it('is 0 zonder meting', () => {
    expect(snelheidScore({ gemiddeldMs: null, p95Ms: null })).toBe(0)
  })
})

describe('meetSnelheid', () => {
  it('berekent gemiddelde en p95 en negeert nullen', () => {
    const m = meetSnelheid([0, 100, 200, 300, -5])
    expect(m.aantal).toBe(3)
    expect(m.gemiddeldMs).toBe(200)
    expect(m.p95Ms).toBe(300)
  })
  it('is leeg zonder geldige metingen', () => {
    expect(meetSnelheid([])).toEqual({ gemiddeldMs: null, p95Ms: null, aantal: 0 })
    expect(meetSnelheid([0, 0])).toEqual({ gemiddeldMs: null, p95Ms: null, aantal: 0 })
  })
})
