import { describe, it, expect } from 'vitest'
import { voerToolUit } from '@/lib/rekenTool'
import { maakTabelStaat, kruisControle } from '@/lib/tabelTool'

// Verzonnen tabel, zelfde structuur als het dashboard waarop het misging (heel jaar en YTD naast elkaar).
const TABEL = {
  kolommen: ['This Year', 'Last Year', 'Δ TY-LY', 'Last Year YTD', 'Δ TY-LY YTD'],
  rijen: [
    { label: 'Anna Bakker', waarden: [1800000, 1700000, 100000, 1500000, 300000] },
    { label: 'Bram Smit', waarden: [2500000, 3100000, -600000, 2800000, -300000] },
    { label: 'Carla Vos', waarden: [3900000, 5000000, -1100000, 4750000, -850000] },
    { label: 'Dirk Mulder', waarden: [1200000, 1250000, -50000, 1000000, 200000] },
    { label: 'Frans Kok', waarden: [900000, 1500000, -600000, 1300000, -400000] },
  ],
  totaal: [10300000, 12550000, -2250000, 11350000, -1050000],
}

function metTabel() {
  const staat = maakTabelStaat()
  const r = voerToolUit('schrijf_tabel_over', TABEL, staat)
  return { staat, r }
}

describe('tabelTool', () => {
  it('slaat een geldige tabel op en meldt geen afwijkingen', () => {
    const { r } = metTabel()
    expect(r.isError).toBe(false)
    expect(r.content).toContain('5 rijen')
    expect(r.content).not.toContain('KRUISCONTROLE')
  })

  it('vraagt hoogstens één keer om opnieuw te lezen: een blijvende afwijking wordt daarna niet meer gemeld', () => {
    const fout = { ...TABEL, rijen: TABEL.rijen.map(r => (r.label === 'Carla Vos' ? { ...r, waarden: [3900000, 5000000, -1100000, 4750000, -580000] } : r)) }
    const staat = maakTabelStaat()
    expect(voerToolUit('schrijf_tabel_over', fout, staat).content).toContain('KRUISCONTROLE')
    const tweede = voerToolUit('schrijf_tabel_over', fout, staat)
    expect(tweede.isError).toBe(false)
    expect(tweede.content).not.toContain('KRUISCONTROLE')
    expect(tweede.content).not.toContain('rij "Carla Vos"')
  })

  it('kruiscontrole vangt een verkeerd overgeschreven cel', () => {
    const fout = { ...TABEL, rijen: TABEL.rijen.map(r => (r.label === 'Carla Vos' ? { ...r, waarden: [3900000, 5000000, -1100000, 4750000, -580000] } : r)) }
    const staat = maakTabelStaat()
    const r = voerToolUit('schrijf_tabel_over', fout, staat)
    expect(r.content).toContain('KRUISCONTROLE')
    expect(r.content).toContain('Carla Vos')
    expect(kruisControle({ ...fout, totaal: null }).length).toBeGreaterThan(0)
  })

  it('kruiscontrole tolereert afrondingsverschil van 1', () => {
    const afgerond = { ...TABEL, rijen: TABEL.rijen.map(r => (r.label === 'Bram Smit' ? { ...r, waarden: [2500000, 3100000, -600001, 2800000, -300000] } : r)) }
    expect(kruisControle({ ...afgerond, totaal: null })).toEqual([])
  })

  it('rangorde geeft de grootste daler in de gevraagde kolom, niet in een andere', () => {
    const { staat } = metTabel()
    const ytd = voerToolUit('tabel_vraag', { bewerking: 'rangorde', kolom: 'Δ TY-LY YTD', richting: 'laagste', aantal: 2 }, staat)
    expect(ytd.content).toMatch(/1\. Carla Vos: -850000\n2\. Frans Kok: -400000/)
    const jaar = voerToolUit('tabel_vraag', { bewerking: 'rangorde', kolom: 'Δ TY-LY', richting: 'laagste', aantal: 2 }, staat)
    expect(jaar.content).toMatch(/1\. Carla Vos: -1100000\n2\. (Bram Smit|Frans Kok): -600000/)
  })

  it('filter laat zien wie groeit in welke kolom', () => {
    const { staat } = metTabel()
    const jaar = voerToolUit('tabel_vraag', { bewerking: 'filter', kolom: 'Δ TY-LY', teken: 'positief' }, staat)
    expect(jaar.content).toContain('1 van 5')
    expect(jaar.content).toContain('Anna Bakker')
    expect(jaar.content).not.toContain('Dirk Mulder')
    const ytd = voerToolUit('tabel_vraag', { bewerking: 'filter', kolom: 'Δ TY-LY YTD', teken: 'positief' }, staat)
    expect(ytd.content).toContain('2 van 5')
    expect(ytd.content).toContain('Dirk Mulder')
  })

  it('aandeel, groei en waarde rekenen op de gevraagde kolom', () => {
    const { staat } = metTabel()
    expect(voerToolUit('tabel_vraag', { bewerking: 'aandeel', kolom: 'This Year', rij: 'Anna' }, staat).content).toContain('17.48%')
    expect(voerToolUit('tabel_vraag', { bewerking: 'groei', kolom: 'This Year', kolom_b: 'Last Year', rij: 'Anna Bakker' }, staat).content).toContain('5.88%')
    expect(voerToolUit('tabel_vraag', { bewerking: 'waarde', kolom: 'Last Year YTD', rij: 'Dirk Mulder' }, staat).content).toContain('1000000')
  })

  it('weigert een kolom die niet exact bestaat en noemt de geldige kolommen', () => {
    const { staat } = metTabel()
    const r = voerToolUit('tabel_vraag', { bewerking: 'rangorde', kolom: 'YTD' }, staat)
    expect(r.isError).toBe(true)
    expect(r.content).toContain('"Δ TY-LY YTD"')
  })

  it('weigert een vraag zonder overgeschreven tabel, en een foute invoer', () => {
    expect(voerToolUit('tabel_vraag', { bewerking: 'rangorde', kolom: 'x' }, maakTabelStaat()).isError).toBe(true)
    expect(voerToolUit('schrijf_tabel_over', { kolommen: ['a', 'a'], rijen: [{ label: 'x', waarden: [1, 2] }] }, maakTabelStaat()).isError).toBe(true)
    expect(voerToolUit('schrijf_tabel_over', { kolommen: ['a', 'b'], rijen: [{ label: 'x', waarden: [1] }] }, maakTabelStaat()).isError).toBe(true)
    expect(voerToolUit('schrijf_tabel_over', { kolommen: ['a'], rijen: [{ label: 'x', waarden: ['1'] }] }, maakTabelStaat()).isError).toBe(true)
  })

  it('de staat is per verzoek: een nieuwe staat kent de tabel niet', () => {
    metTabel()
    expect(voerToolUit('tabel_vraag', { bewerking: 'rangorde', kolom: 'This Year' }, maakTabelStaat()).isError).toBe(true)
  })
})
