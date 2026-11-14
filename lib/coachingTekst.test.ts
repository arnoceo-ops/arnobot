import { describe, it, expect } from 'vitest'
import { ontwikkelpuntTekst, ontwikkelpuntenAlsTekst } from './coachingTekst'

describe('ontwikkelpuntTekst', () => {
  it('leest een object', () => {
    expect(ontwikkelpuntTekst({ tekst: 'Bel eerst', pijlar: 'actie' })).toEqual({ tekst: 'Bel eerst', pijlar: 'actie' })
  })
  it('leest een oude losse string', () => {
    expect(ontwikkelpuntTekst('Bel eerst')).toEqual({ tekst: 'Bel eerst', pijlar: '' })
  })
  it('kan met null en ontbrekende velden omgaan', () => {
    expect(ontwikkelpuntTekst(null)).toEqual({ tekst: '', pijlar: '' })
    expect(ontwikkelpuntTekst({})).toEqual({ tekst: '', pijlar: '' })
  })
})

describe('ontwikkelpuntenAlsTekst', () => {
  it('zet nooit [object Object] of [undefined] in de uitvoer', () => {
    const uit = ontwikkelpuntenAlsTekst([{ tekst: 'A', pijlar: 'mindset' }, 'B oud', { tekst: 'C' }])
    expect(uit).toBe('[mindset] A | B oud | C')
    expect(uit).not.toMatch(/object Object|undefined/)
  })
  it('geeft een lege string bij niets', () => {
    expect(ontwikkelpuntenAlsTekst(null)).toBe('')
    expect(ontwikkelpuntenAlsTekst([])).toBe('')
  })
  it('gebruikt de opgegeven scheiding', () => {
    expect(ontwikkelpuntenAlsTekst(['A', 'B'], ' / ')).toBe('A / B')
  })
})
