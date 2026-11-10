import { describe, expect, it } from 'vitest'
import { corrigeerBouwsteen, type GroeibalansClassificatie } from './groeibalans'

const SPAR: GroeibalansClassificatie = { tonen: true, state: 'groeikans', bouwsteen: 'sparsessies', advies: 'Oefen een lastig gesprek.', scenario: { persona: 'cfo', weerstand: 'stevig' } }

describe('corrigeerBouwsteen', () => {
  it('wijst naar analyses als er vanaf 5 gesprekken nog geen analyse is', () => {
    const r = corrigeerBouwsteen(SPAR, { gesprekken: 6, sparsessies: 0, analyses: 0, coaching: 0 })
    expect(r).toEqual({ tonen: true, state: 'groeikans', bouwsteen: 'analyses' })
  })
  it('wijst naar coaching als er wel een analyse is maar nog geen coaching (de testgebruiker: 16, 0, 1, 0)', () => {
    const r = corrigeerBouwsteen(SPAR, { gesprekken: 16, sparsessies: 0, analyses: 1, coaching: 0 })
    expect(r).toMatchObject({ bouwsteen: 'coaching' })
    expect(r).not.toHaveProperty('advies')
    expect(r).not.toHaveProperty('scenario')
  })
  it('laat sparren staan onder 5 gesprekken, of als analyse en coaching al gebruikt zijn', () => {
    expect(corrigeerBouwsteen(SPAR, { gesprekken: 4, sparsessies: 0, analyses: 0, coaching: 0 })).toBe(SPAR)
    expect(corrigeerBouwsteen(SPAR, { gesprekken: 12, sparsessies: 0, analyses: 2, coaching: 1 })).toBe(SPAR)
  })
  it('raakt andere bouwstenen en tonen false niet aan', () => {
    const coach: GroeibalansClassificatie = { tonen: true, state: 'neutraal', bouwsteen: 'coaching' }
    expect(corrigeerBouwsteen(coach, { gesprekken: 9, sparsessies: 0, analyses: 0, coaching: 0 })).toBe(coach)
    expect(corrigeerBouwsteen({ tonen: false }, { gesprekken: 9, sparsessies: 0, analyses: 0, coaching: 0 })).toEqual({ tonen: false })
  })
})
