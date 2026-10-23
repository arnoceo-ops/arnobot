import { describe, it, expect } from 'vitest'
import { stripEmphasisAccents } from './accenten'

describe('stripEmphasisAccents', () => {
  it('haalt nadrukaccenten weg', () => {
    expect(stripEmphasisAccents('Luister wat er écht speelt, zodat het niet wéér uitgesteld wordt. Dát is zó belangrijk én nuttig.'))
      .toBe('Luister wat er echt speelt, zodat het niet weer uitgesteld wordt. Dat is zo belangrijk en nuttig.')
  })
  it('laat één, trema en leenwoorden staan', () => {
    const t = 'Eén vraag, geïdentificeerd, reële ideeën bij het café.'
    expect(stripEmphasisAccents(t)).toBe(t)
  })
  it('behoudt hoofdletters', () => {
    expect(stripEmphasisAccents('Écht waar. DÁT klopt.')).toBe('Echt waar. DAT klopt.')
  })
  it('laat tekst zonder accenten ongemoeid', () => {
    expect(stripEmphasisAccents('Gewoon een zin.')).toBe('Gewoon een zin.')
  })
})
