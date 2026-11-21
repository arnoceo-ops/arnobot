import { describe, expect, it } from 'vitest'
import { maakVerbruik, telOp, verbruikKostenUsd, telTool } from './chatVerbruik'

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

describe('telTool', () => {
  it('bewaart naam en ingekorte invoer, en markeert een fout', () => {
    const v = maakVerbruik()
    telTool(v, 'tabel_vraag', { bewerking: 'groei', kolom: 'Δ TY-LY YTD' }, false)
    telTool(v, 'bereken', { expressies: ['x'.repeat(1000)] }, true)
    expect(v.tools?.[0]).toEqual({ naam: 'tabel_vraag', invoer: '{"bewerking":"groei","kolom":"Δ TY-LY YTD"}' })
    expect(v.tools?.[1].invoer.length).toBe(300)
    expect(v.tools?.[1].fout).toBe(true)
  })
  it('bewaart van een overgeschreven tabel alleen het aantal rijen en de kolomkoppen, nooit de namen of waarden', () => {
    const v = maakVerbruik()
    telTool(v, 'schrijf_tabel_over', { kolommen: ['This Year', 'Last Year'], rijen: [{ label: 'Jan Jansen', waarden: [1, 2] }, { label: 'Piet', waarden: [3, 4] }] }, false)
    expect(v.tools?.[0].invoer).toBe('2 rijen, kolommen: This Year | Last Year')
    expect(JSON.stringify(v)).not.toContain('Jansen')
  })
  it('bewaart hooguit 20 aanroepen', () => {
    const v = maakVerbruik()
    for (let i = 0; i < 30; i++) telTool(v, 'bereken', {}, false)
    expect(v.tools?.length).toBe(20)
  })
})
