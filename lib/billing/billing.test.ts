import { describe, expect, it } from 'vitest'
import { centenNaarMollie, mollieNaarCenten } from './geld'
import { berekenBedrag, getoondBedragEuro } from './prijzen'
import {
  abonnementNaEerstebetaling,
  abonnementVoorVerlenging,
  contractEinde,
  eersteperiodeEinde,
  herinneringenDue,
  moetMollieAbonnementNuStoppen,
  opzeggingIngaat,
  toegangTot,
  voegMaandenToe,
} from './perioden'
import { isKvkFormaat, isNlBtwFormaat, normaliseerBtwNummer } from './btwNummer'

const d = (s: string) => new Date(s)

describe('geld', () => {
  it('zet centen om naar Mollie-notatie en terug', () => {
    expect(centenNaarMollie(2900)).toBe('29.00')
    expect(centenNaarMollie(5)).toBe('0.05')
    expect(centenNaarMollie(46800)).toBe('468.00')
    expect(mollieNaarCenten('29.00')).toBe(2900)
    expect(mollieNaarCenten('0.05')).toBe(5)
  })
  it('weigert ongeldige bedragen', () => {
    expect(() => centenNaarMollie(-1)).toThrow()
    expect(() => centenNaarMollie(1.5)).toThrow()
    expect(() => mollieNaarCenten('29')).toThrow()
  })
})

describe('prijzen en btw', () => {
  it('gebruikt de getoonde prijzen uit kostenTarieven', () => {
    expect(getoondBedragEuro('basis', 'maandelijks')).toBe(29)
    expect(getoondBedragEuro('basis', 'jaarlijks')).toBe(228)
    expect(getoondBedragEuro('premium', 'maandelijks')).toBe(59)
    expect(getoondBedragEuro('premium', 'jaarlijks')).toBe(468)
  })
  it('particulier betaalt precies het getoonde bedrag, btw zit erin', () => {
    const b = berekenBedrag('premium', 'jaarlijks', 'particulier')
    expect(b.brutoCent).toBe(46800)
    expect(b.nettoCent + b.btwCent).toBe(46800)
    expect(b.nettoCent).toBe(38678)
  })
  it('zakelijk betaalt het getoonde bedrag plus 21%', () => {
    const b = berekenBedrag('premium', 'jaarlijks', 'zakelijk')
    expect(b.nettoCent).toBe(46800)
    expect(b.btwCent).toBe(9828)
    expect(b.brutoCent).toBe(56628)
  })
  it('bruto is altijd netto plus btw', () => {
    for (const plan of ['basis', 'premium'] as const)
      for (const cyclus of ['maandelijks', 'jaarlijks'] as const)
        for (const klant of ['particulier', 'zakelijk'] as const) {
          const b = berekenBedrag(plan, cyclus, klant)
          expect(b.nettoCent + b.btwCent).toBe(b.brutoCent)
        }
  })
})

describe('perioden', () => {
  it('klemt maandrekening op het einde van de maand', () => {
    expect(voegMaandenToe(d('2026-01-31T10:00:00Z'), 1).toISOString()).toBe('2026-02-28T10:00:00.000Z')
    expect(voegMaandenToe(d('2028-01-31T10:00:00Z'), 1).toISOString()).toBe('2028-02-29T10:00:00.000Z')
    expect(voegMaandenToe(d('2026-12-15T10:00:00Z'), 1).toISOString()).toBe('2027-01-15T10:00:00.000Z')
    expect(voegMaandenToe(d('2026-03-15T10:00:00Z'), -1).toISOString()).toBe('2026-02-15T10:00:00.000Z')
  })
  it('eerste periode en toegang met respijt', () => {
    const start = d('2026-10-10T12:00:00Z')
    expect(eersteperiodeEinde(start, 'maandelijks').toISOString()).toBe('2026-11-10T12:00:00.000Z')
    expect(eersteperiodeEinde(start, 'jaarlijks').toISOString()).toBe('2027-10-10T12:00:00.000Z')
    expect(toegangTot(d('2026-11-10T12:00:00Z')).toISOString()).toBe('2026-11-13T12:00:00.000Z')
  })
  it('particulier heeft een contracteinde van 12 maanden, zakelijk niet', () => {
    const start = d('2026-10-10T12:00:00Z')
    expect(contractEinde(start, 'particulier')?.toISOString()).toBe('2027-10-10T12:00:00.000Z')
    expect(contractEinde(start, 'zakelijk')).toBeNull()
  })

  describe('abonnement na de eerste betaling', () => {
    const start = d('2026-10-10T12:00:00Z')
    it('particulier maandelijks: nog 11 maanden, starend over een maand', () => {
      const p = abonnementNaEerstebetaling(start, 'maandelijks', 'particulier')
      expect(p.interval).toBe('1 month')
      expect(p.times).toBe(11)
      expect(p.startDatum?.toISOString()).toBe('2026-11-10T12:00:00.000Z')
    })
    it('particulier jaarlijks: geen abonnement', () => {
      expect(abonnementNaEerstebetaling(start, 'jaarlijks', 'particulier').interval).toBeNull()
    })
    it('zakelijk: doorlopend per maand of per jaar', () => {
      const m = abonnementNaEerstebetaling(start, 'maandelijks', 'zakelijk')
      expect(m.interval).toBe('1 month')
      expect(m.times).toBeNull()
      const j = abonnementNaEerstebetaling(start, 'jaarlijks', 'zakelijk')
      expect(j.interval).toBe('12 months')
      expect(j.startDatum?.toISOString()).toBe('2027-10-10T12:00:00.000Z')
    })
    it('maandelijks particulier betaalt in totaal precies 12 keer', () => {
      const p = abonnementNaEerstebetaling(start, 'maandelijks', 'particulier')
      expect(1 + (p.times ?? 0)).toBe(12)
    })
  })

  it('verlenging start op het contracteinde', () => {
    const einde = d('2027-10-10T12:00:00Z')
    expect(abonnementVoorVerlenging(einde, 'maandelijks')).toMatchObject({ times: 12, interval: '1 month' })
    expect(abonnementVoorVerlenging(einde, 'jaarlijks')).toMatchObject({ times: 1, interval: '12 months' })
    expect(abonnementVoorVerlenging(einde, 'jaarlijks').startDatum?.toISOString()).toBe(einde.toISOString())
  })

  describe('opzegging (voorwaarden artikel 7)', () => {
    const einde = d('2026-12-10T12:00:00Z')
    it('particulier: altijd einde lopende periode', () => {
      expect(opzeggingIngaat(d('2026-12-09T12:00:00Z'), einde, 'maandelijks', 'particulier').toISOString()).toBe(einde.toISOString())
    })
    it('zakelijk op tijd (minstens een maand vooraf): einde lopende periode', () => {
      expect(opzeggingIngaat(d('2026-11-09T12:00:00Z'), einde, 'maandelijks', 'zakelijk').toISOString()).toBe(einde.toISOString())
      expect(opzeggingIngaat(d('2026-11-10T12:00:00Z'), einde, 'maandelijks', 'zakelijk').toISOString()).toBe(einde.toISOString())
    })
    it('zakelijk te laat: nog een periode erbij', () => {
      expect(opzeggingIngaat(d('2026-11-20T12:00:00Z'), einde, 'maandelijks', 'zakelijk').toISOString()).toBe('2027-01-10T12:00:00.000Z')
      expect(opzeggingIngaat(d('2026-11-20T12:00:00Z'), einde, 'jaarlijks', 'zakelijk').toISOString()).toBe('2027-12-10T12:00:00.000Z')
    })
    it('Mollie-abonnement stopt pas als de laatste verschuldigde betaling binnen is', () => {
      const ingaat = d('2027-01-10T12:00:00Z')
      expect(moetMollieAbonnementNuStoppen(d('2026-12-10T12:00:00Z'), ingaat)).toBe(false)
      expect(moetMollieAbonnementNuStoppen(d('2027-01-10T12:00:00Z'), ingaat)).toBe(true)
    })
  })

  describe('herinneringen', () => {
    const einde = d('2027-10-10T12:00:00Z')
    const geen = { dertig: false, zeven: false }
    it('niets ver vóór het einde', () => {
      expect(herinneringenDue(d('2027-08-01T12:00:00Z'), einde, geen)).toEqual({ dertig: false, zeven: false })
    })
    it('30 dagen mail binnen 30 dagen, eenmalig', () => {
      expect(herinneringenDue(d('2027-09-15T12:00:00Z'), einde, geen)).toEqual({ dertig: true, zeven: false })
      expect(herinneringenDue(d('2027-09-15T12:00:00Z'), einde, { dertig: true, zeven: false })).toEqual({ dertig: false, zeven: false })
    })
    it('7 dagen mail binnen een week, en geen 30-dagenmail meer erbij', () => {
      expect(herinneringenDue(d('2027-10-05T12:00:00Z'), einde, geen)).toEqual({ dertig: false, zeven: true })
    })
    it('na het einde niets meer', () => {
      expect(herinneringenDue(d('2027-10-11T12:00:00Z'), einde, geen)).toEqual({ dertig: false, zeven: false })
    })
  })
})

describe('btw- en kvk-nummer', () => {
  it('normaliseert en herkent een Nederlands btw-nummer', () => {
    expect(normaliseerBtwNummer('nl 1234.56.789 b01')).toBe('NL123456789B01')
    expect(isNlBtwFormaat('NL123456789B01')).toBe(true)
    expect(isNlBtwFormaat('nl123456789b01')).toBe(true)
  })
  it('weigert buitenlandse of kapotte nummers', () => {
    expect(isNlBtwFormaat('DE123456789')).toBe(false)
    expect(isNlBtwFormaat('NL12345678B01')).toBe(false)
    expect(isNlBtwFormaat('')).toBe(false)
  })
  it('kvk heeft 8 cijfers', () => {
    expect(isKvkFormaat('42184446')).toBe(true)
    expect(isKvkFormaat('4218 4446')).toBe(true)
    expect(isKvkFormaat('1234567')).toBe(false)
    expect(isKvkFormaat('abcdefgh')).toBe(false)
  })
})
