import { describe, expect, it } from 'vitest'
import { maakVerbruik, telOp, verbruikKostenUsd } from './chatVerbruik'

describe('chatVerbruik', () => {
  it('telt meerdere aanroepen van één beurt op', () => {
    const v = maakVerbruik(2)
    telOp(v, { input_tokens: 100, output_tokens: 50, cache_creation_input_tokens: 1000, cache_read_input_tokens: 0 })
    telOp(v, { input_tokens: 20, output_tokens: 10, cache_creation_input_tokens: 0, cache_read_input_tokens: 1000 })
    expect(v).toEqual({ invoer: 120, cache_schrijven: 1000, cache_lezen: 1000, uitvoer: 60, aanroepen: 2, bijlagen: 2 })
  })

  it('een ontbrekende usage telt als aanroep zonder tokens en geeft nooit een fout', () => {
    const v = maakVerbruik()
    telOp(v, undefined)
    telOp(v, null)
    telOp(v, { input_tokens: null, cache_read_input_tokens: undefined })
    expect(v).toEqual({ invoer: 0, cache_schrijven: 0, cache_lezen: 0, uitvoer: 0, aanroepen: 3, bijlagen: 0 })
  })

  it('rekent cache schrijven 1,25 keer en cache lezen 0,1 keer de invoerprijs', () => {
    const v = { invoer: 1_000_000, cache_schrijven: 1_000_000, cache_lezen: 1_000_000, uitvoer: 1_000_000, aanroepen: 1, bijlagen: 0 }
    expect(verbruikKostenUsd(v, 3, 15)).toBeCloseTo(3 + 3.75 + 0.3 + 15, 6)
  })
})
