import { describe, it, expect } from 'vitest'
import { beoordeelKennisbank } from '@/lib/kennisbankControle'

describe('beoordeelKennisbank', () => {
  it('geeft geen problemen bij een gezonde kennisbank', () => {
    expect(beoordeelKennisbank({ totaal: 1538, zonderEmbedding: 0, kandidaten: [100, 100, 100] })).toEqual([])
  })
  it('meldt te weinig kandidaten (de ivfflat-fout van 2026-11-01)', () => {
    const p = beoordeelKennisbank({ totaal: 1538, zonderEmbedding: 0, kandidaten: [4, 15, 100] })
    expect(p).toHaveLength(1)
    expect(p[0]).toContain('te weinig kandidaten')
  })
  it('meldt een gewiste kennisbank en fragmenten zonder embedding', () => {
    const p = beoordeelKennisbank({ totaal: 300, zonderEmbedding: 2, kandidaten: [100, 100, 100] })
    expect(p).toHaveLength(2)
  })
  it('een zoekstap die mislukt (0 kandidaten) telt als probleem', () => {
    expect(beoordeelKennisbank({ totaal: 1538, zonderEmbedding: 0, kandidaten: [0, 100, 100] })).toHaveLength(1)
  })
})
