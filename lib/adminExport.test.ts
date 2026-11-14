import { describe, it, expect } from 'vitest'
import { schoneZoekterm, filterLogs } from './adminExport'

describe('schoneZoekterm', () => {
  it('laat een gewone zoekterm ongemoeid', () => {
    expect(schoneZoekterm('prijs verhogen')).toBe('prijs verhogen')
  })
  it('haalt filtersyntax en wildcards weg', () => {
    expect(schoneZoekterm('a,b)(c"d%e*f\\g')).toBe('a b c d e f g')
  })
  it('kan een filter niet verbreden of breken', () => {
    expect(schoneZoekterm('x),answer.ilike.*')).not.toMatch(/[,()*]/)
  })
  it('trimt, vouwt spaties samen en kapt af op 100 tekens', () => {
    expect(schoneZoekterm('  a   b  ')).toBe('a b')
    expect(schoneZoekterm('x'.repeat(300))).toHaveLength(100)
  })
  it('geeft leeg bij niets', () => {
    expect(schoneZoekterm(null)).toBe('')
    expect(schoneZoekterm(undefined)).toBe('')
    expect(schoneZoekterm('  ')).toBe('')
  })
})

describe('filterLogs', () => {
  const rijen = [
    { question: 'Hoe verhoog ik mijn prijs?', answer: 'Begin bij waarde.', feedback: 'pos' },
    { question: 'Klant zegt nee', answer: 'Vraag door op het bezwaar.', feedback: 'neg' },
    { question: 'Hallo', answer: 'Dag.', feedback: null },
  ]
  it('geeft alles terug zonder filters', () => {
    expect(filterLogs(rijen, {})).toHaveLength(3)
  })
  it('zoekt hoofdletterongevoelig in vraag en antwoord', () => {
    expect(filterLogs(rijen, { q: 'PRIJS' })).toHaveLength(1)
    expect(filterLogs(rijen, { q: 'bezwaar' })).toHaveLength(1)
  })
  it('filtert op beoordeeld en op alleen negatief', () => {
    expect(filterLogs(rijen, { fb: 'alle' })).toHaveLength(2)
    expect(filterLogs(rijen, { fb: 'neg' })).toHaveLength(1)
  })
  it('combineert zoeken en duimpje', () => {
    expect(filterLogs(rijen, { fb: 'neg', q: 'prijs' })).toHaveLength(0)
    expect(filterLogs(rijen, { fb: 'alle', q: 'prijs' })).toHaveLength(1)
  })
  it('een zoekterm met alleen speciale tekens filtert niet', () => {
    expect(filterLogs(rijen, { q: '%*' })).toHaveLength(3)
  })
})
