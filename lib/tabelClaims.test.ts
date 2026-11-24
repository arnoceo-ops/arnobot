import { describe, it, expect } from 'vitest'
import { vindOnjuisteSuperlatieven, rangordeTekst } from './tabelClaims'
import type { Tabel } from './tabelTool'

// Marge-kolommen uit het dashboard van 23-11 (verkort, namen vervangen).
const tabel: Tabel = {
  kolommen: ['This Year', 'Δ TY-LY', 'B Margin % TY'],
  rijen: [
    { label: 'A', waarden: [1316023, -716765, 44.1] },
    { label: 'B', waarden: [59, -745087, 61.5] },
    { label: 'C', waarden: [1736042, -578308, 48.3] },
    { label: 'Jessica', waarden: [2305663, 159004, 47.0] },
    { label: 'Mees', waarden: [2216919, -53664, 47.2] },
    { label: 'Patrick', waarden: [2455, -23491, 74.6] },
  ],
  totaal: [22525685, -3272531, 43.1],
}

describe('vindOnjuisteSuperlatieven', () => {
  it('meldt "hoogste marge" als een ander hoger staat', () => {
    const c = vindOnjuisteSuperlatieven('Bruto marge **47,0%**, hoogste van het team. De hoogste marge van het team is jouw sterkste punt.', tabel)
    expect(c.length).toBeGreaterThan(0)
    expect(c[0].kolom).toBe('B Margin % TY')
    expect(c[0].plek).toBe(5)
    expect(c[0].van).toBe(6)
    expect(c[0].topWaarde).toBe(74.6)
  })
  it('gebruikt het getal uit de zin ervoor', () => {
    const c = vindOnjuisteSuperlatieven('Je marge staat op 47,0%. Dat is de hoogste marge van het team.', tabel)
    expect(c).toHaveLength(1)
  })
  it('meldt niets als de bewering klopt', () => {
    expect(vindOnjuisteSuperlatieven('Je marge is 74,6%, de hoogste marge van het team.', tabel)).toEqual([])
  })
  it('meldt niets zonder getal of zonder kolomwoord (twijfel is geen melding)', () => {
    expect(vindOnjuisteSuperlatieven('Je hebt de hoogste marge van het team.', tabel)).toEqual([])
    expect(vindOnjuisteSuperlatieven('Dit is de beste week van het jaar, 47% van je doel.', tabel)).toEqual([])
  })
  it('controleert ook de laagste en bedragen in k', () => {
    const c = vindOnjuisteSuperlatieven('De laagste omzet is 2.305.663 euro.', tabel)
    expect(c).toHaveLength(1)
    expect(c[0].plek).toBe(6)
    expect(vindOnjuisteSuperlatieven('De hoogste omzet van het team is €2.306k.', tabel)).toEqual([])
  })
})

describe('rangordeTekst', () => {
  it('geeft per kolom de top 3 en de laagste, zonder de Totaal-rij', () => {
    const t = rangordeTekst(tabel)
    expect(t).toContain('"B Margin % TY": hoogste Patrick 74.6, B 61.5, C 48.3; laagste A 44.1')
    expect(t).toContain('enige bron')
    expect(t).not.toContain('43.1')
  })
})
