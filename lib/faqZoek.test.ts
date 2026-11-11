import React from 'react'
import { describe, it, expect } from 'vitest'
import { normaliseerZoekterm, platteTekst, matchtZoekopdracht } from './faqZoek'

describe('faqZoek', () => {
  it('normaliseert accenten, hoofdletters en spaties', () => {
    expect(normaliseerZoekterm('  Geïndexeerd   CAFÉ ')).toBe('geindexeerd cafe')
  })

  it('haalt tekst uit JSX', () => {
    const node = React.createElement(React.Fragment, null, 'Nee. ', React.createElement('a', { href: '/x' }, 'privacyverklaring'))
    expect(platteTekst(node)).toContain('privacyverklaring')
  })

  it('matcht op vraag en antwoord, alle woorden vereist', () => {
    expect(matchtZoekopdracht('opzeggen', 'Hoe zeg ik op?', 'Via de accountpagina')).toBe(false)
    expect(matchtZoekopdracht('account', 'Hoe zeg ik op?', 'Via de accountpagina')).toBe(true)
    expect(matchtZoekopdracht('account proefperiode', 'Hoe zeg ik op?', 'Via de accountpagina')).toBe(false)
  })

  it('lege zoekopdracht matcht alles', () => {
    expect(matchtZoekopdracht('  ', 'a', 'b')).toBe(true)
  })

  it('negeert accenten bij het zoeken', () => {
    expect(matchtZoekopdracht('geindexeerd', 'Zijn gedeelde gesprekken openbaar?', 'kunnen worden geïndexeerd')).toBe(true)
  })
})
