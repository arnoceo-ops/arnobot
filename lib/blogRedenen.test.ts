import { describe, it, expect } from 'vitest'
import { leesRedenen } from './blogRedenen'

describe('leesRedenen', () => {
  it('leest een JSON-lijst met het juiste aantal regels', () => {
    expect(leesRedenen('["Past bij je prijsgesprek.", "Gaat over opvolgen na een offerte."]', 2))
      .toEqual(['Past bij je prijsgesprek.', 'Gaat over opvolgen na een offerte.'])
  })
  it('vindt de lijst ook als het model er tekst omheen zet', () => {
    expect(leesRedenen('Hier: ["Een zin."] klaar', 1)).toEqual(['Een zin.'])
  })
  it('geeft niets bij een verkeerd aantal, ongeldige JSON of geen lijst', () => {
    expect(leesRedenen('["Een."]', 2)).toEqual([])
    expect(leesRedenen('geen json', 1)).toEqual([])
    expect(leesRedenen('["kapot', 1)).toEqual([])
  })
  it('haalt streepjes weg en kort te lange zinnen in', () => {
    expect(leesRedenen('["Dit past — echt goed."]', 1)).toEqual(['Dit past , echt goed.'])
    expect(leesRedenen(JSON.stringify(['x'.repeat(500)]), 1)[0].length).toBe(140)
  })
  it('maakt van een niet-tekstwaarde een lege regel', () => {
    expect(leesRedenen('[1]', 1)).toEqual([''])
  })
})
