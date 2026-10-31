import { describe, it, expect } from 'vitest'
import { verdachteTellingen, feitenRegel } from './feitenControle'

const bron = ['Financiering = deels uit vaste huur van 3 huurders. De overige dekking komt uit verhuur aan losse huurders en evenementen.']

describe('verdachteTellingen', () => {
  it('vangt de vier inkomstenbronnen van Thijs', () => {
    expect(verdachteTellingen('De exploitatie draait op vier inkomstenbronnen: drie vaste huurders en incidentele verhuur.', bron)).toEqual(['vier'])
  })
  it('laat een getal uit het gesprek met rust, ook als cijfer of woord', () => {
    expect(verdachteTellingen('Die drie huurders dekken de helft.', bron)).toEqual([])
    expect(verdachteTellingen('Die 3 huurders dekken de helft.', bron)).toEqual([])
  })
  it('negeert percentages, bedragen en tijdseenheden', () => {
    expect(verdachteTellingen('Je haalt 50% en 40 euro en 5 weken.', bron)).toEqual([])
  })
  it('negeert woorden die geen aantal zijn', () => {
    expect(verdachteTellingen('Een heel andere zaak, het is een mooi plan.', bron)).toEqual([])
  })
})

describe('feitenRegel', () => {
  it('komt alleen bij een bericht met veel feiten', () => {
    expect(feitenRegel('Hoe ga ik het gesprek in?')).toBe('')
    expect(feitenRegel('Kosten zijn 40.000 en de huurders betalen 20.000')).toContain('FEITEN TERUGGEVEN')
    expect(feitenRegel('x'.repeat(400))).toContain('FEITEN TERUGGEVEN')
  })
  it('bevat geen streepjes als leesteken', () => {
    expect(feitenRegel('x'.repeat(400))).not.toMatch(/[—–]/)
  })
})
