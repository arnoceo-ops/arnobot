import { describe, it, expect } from 'vitest'
import { voerToolUit, CHAT_REKENTOOLS } from '@/lib/rekenTool'

// Alle bedragen hier zijn verzonnen.
const prijs = (i: unknown) => voerToolUit('prijswijziging', i)
const btw = (i: unknown) => voerToolUit('prijzen_vergelijken', i)
const deel = (i: unknown) => voerToolUit('deel_van_totaal', i)

describe('prijswijziging', () => {
  const uit = prijs({ omzet: 500000, wijziging_procent: -10, marge_procent: 30 }).content

  it('het verschil tussen wel en niet doorvoeren is het hele omzetbedrag', () => {
    expect(uit).toContain('de verlaging doorvoeren kost 50000 marge vergeleken met niet doorvoeren')
  })

  it('houdt de vier gevallen ten opzichte van vandaag uit elkaar', () => {
    expect(uit).toContain('Vandaag: marge 150000, dat is 30% van de omzet.')
    expect(uit).toMatch(/A\. [^\n]*-50000 marge, marge 100000, dat is 22\.22%/)
    expect(uit).toMatch(/B\. [^\n]*-15000 marge, marge 135000, dat is 30%/)
    expect(uit).toMatch(/C\. [^\n]*gelijk aan vandaag/)
    expect(uit).toMatch(/D\. [^\n]*\+35000 marge, marge 185000, dat is 37%/)
  })

  it('het verschil tussen de keuzes is bij beide kostengevallen gelijk (A tegen C, B tegen D)', () => {
    expect(100000 - 150000).toBe(-50000)
    expect(135000 - 185000).toBe(-50000)
  })

  it('verhoging levert op', () => {
    expect(prijs({ omzet: 200000, wijziging_procent: 5, marge_procent: 20 }).content).toContain('de verhoging doorvoeren levert 10000 marge meer op')
  })

  it('alleen een bedrag: geen geval met meebewegende kosten', () => {
    const r = prijs({ wijziging_bedrag: -8000, marge_procent: 25 }).content
    expect(r).toContain('kost 8000 marge')
    expect(r).not.toContain('B. ')
  })

  it('zonder marge toch het verschil tussen de keuzes', () => {
    expect(prijs({ omzet: 1000, wijziging_procent: -10 }).content).toContain('kost 100 marge')
  })

  it('weigert onduidelijke invoer', () => {
    expect(prijs({ omzet: 100 }).isError).toBe(true)
    expect(prijs({ omzet: 100, wijziging_procent: -5, wijziging_bedrag: -5 }).isError).toBe(true)
    expect(prijs({ wijziging_procent: -5 }).isError).toBe(true)
    expect(prijs({ omzet: 100, wijziging_bedrag: -100 }).isError).toBe(true)
    expect(prijs({ omzet: '100', wijziging_procent: -5 }).isError).toBe(true)
  })
})

describe('prijzen_vergelijken', () => {
  it('rekent inclusief om voor het vergelijken', () => {
    const r = btw({ btw_procent: 21, btw_procent_bron: 'aanname', prijzen: [
      { naam: 'winkelprijs', bedrag: 121, btw: 'inclusief' }, { naam: 'onze prijs', bedrag: 105, btw: 'exclusief' },
    ] }).content
    expect(r).toContain('winkelprijs: 100 exclusief btw, 121 inclusief btw')
    expect(r).toContain('onze prijs is 5 hoger dan winkelprijs')
    expect(r).toContain('moet onze prijs 4.76% omlaag')
    expect(r).toContain('AANNAME')
  })

  it('onbekende basis geeft beide uitkomsten en geen vergelijking', () => {
    const r = btw({ btw_procent: 21, btw_procent_bron: 'gebruiker', prijzen: [
      { naam: 'a', bedrag: 121, btw: 'onbekend' }, { naam: 'b', bedrag: 90, btw: 'exclusief' },
    ] }).content
    expect(r).toContain('Als dit inclusief is: 100 exclusief')
    expect(r).not.toContain('Verschillen op dezelfde basis')
  })

  it('weigert ongeldige invoer', () => {
    expect(btw({ btw_procent: 21, prijzen: [{ naam: 'a', bedrag: 1, btw: 'inclusief' }] }).isError).toBe(true)
    expect(btw({ prijzen: [] }).isError).toBe(true)
  })
})

describe('deel_van_totaal', () => {
  const basis = { totaal_nu: 900, totaal_vorig: 1000, deel_nu: 450, deel_vorig: 300, periode: 'gelijk' }

  it('deel zit in het totaal: rekent de anderen uit en verbiedt de dubbele telling', () => {
    const r = deel({ ...basis, deel_in_totaal: 'ja' }).content
    expect(r).toContain('totaal zonder dit deel: -250')
    expect(r).toContain('Het deel maakt 150 van de daling van de anderen (250) goed, niet alles')
  })

  it('deel maakt alles goed', () => {
    const r = deel({ ...basis, totaal_nu: 1040, deel_in_totaal: 'ja' }).content
    expect(r).toContain('helemaal goed en houdt 40 over')
  })

  it('onbekend noemt beide en geeft geen oordeel vooraf', () => {
    const r = deel({ ...basis, deel_in_totaal: 'onbekend', periode: 'lopend_tegen_heel_jaar' }).content
    expect(r).toContain('Als het erin zit:')
    expect(r).toContain('Samen met dit deel: +50')
    expect(r).toContain('nog geen daling of verlies')
  })

  it('weigert ongeldige invoer', () => {
    expect(deel({ ...basis }).isError).toBe(true)
  })
})

describe('registratie', () => {
  it('de drie geldtools zitten in de chatlijst', () => {
    const namen = CHAT_REKENTOOLS.map(t => t.name)
    for (const n of ['prijswijziging', 'prijzen_vergelijken', 'deel_van_totaal']) expect(namen).toContain(n)
  })
})
