import { describe, expect, it } from 'vitest'
import {
  brutoVanNetto, eersteBetalingOpTijd, kwalificatie, levertTegoedOp, maandNettoCent, tegoedNettoCent,
  tegoedStatus, verrekening, type BetaaldePeriode,
} from './referralRegels'

const basicJaar = (k: 'particulier' | 'zakelijk') => maandNettoCent('basis', 'jaarlijks', k)

describe('bedrag', () => {
  it('alleen Basic per maand levert niets op', () => {
    expect(levertTegoedOp('basis', 'maandelijks')).toBe(false)
    expect(levertTegoedOp('basis', 'jaarlijks')).toBe(true)
    expect(levertTegoedOp('premium', 'maandelijks')).toBe(true)
    expect(levertTegoedOp('team', 'maandelijks')).toBe(true)
  })
  // De vier regels uit de tabel waar Arno op 25-11 akkoord op gaf (aanbrenger en klant op Basic per jaar).
  it.each([
    ['particulier', 'particulier', 1570, 1900],
    ['zakelijk', 'particulier', 1570, 1900],
    ['particulier', 'zakelijk', 1570, 1900],
    ['zakelijk', 'zakelijk', 1900, 2299],
  ] as const)('aanbrenger %s, klant %s', (aanbrenger, klant, netto, bruto) => {
    const t = tegoedNettoCent(basicJaar(klant), basicJaar(aanbrenger))
    expect(t).toBe(netto)
    expect(brutoVanNetto(t)).toBe(bruto)
  })
  it('een particulier krijgt precies zijn getoonde maandprijs terug, ook bij Pro', () => {
    expect(brutoVanNetto(maandNettoCent('premium', 'jaarlijks', 'particulier'))).toBe(3900)
    expect(brutoVanNetto(maandNettoCent('premium', 'maandelijks', 'particulier'))).toBe(5900)
    expect(brutoVanNetto(maandNettoCent('basis', 'maandelijks', 'particulier'))).toBe(2900)
  })
  it('nooit meer dan de maandprijs van de aanbrenger', () => {
    expect(tegoedNettoCent(maandNettoCent('premium', 'maandelijks', 'zakelijk'), basicJaar('zakelijk'))).toBe(1900)
  })
})

describe('verrekening', () => {
  it('past het hele saldo in de betaling', () => {
    expect(verrekening(1570, 2900)).toEqual({ brutoCent: 1900, verbruiktNettoCent: 1570 })
  })
  it('neemt niet meer dan de betaling en laat de rest staan', () => {
    expect(verrekening(4000, 2900)).toEqual({ brutoCent: 2900, verbruiktNettoCent: 2397 })
  })
  it('doet niets zonder saldo', () => {
    expect(verrekening(0, 2900)).toEqual({ brutoCent: 0, verbruiktNettoCent: 0 })
  })
})

describe('op tijd afsluiten', () => {
  const proefEinde = '2026-12-24T12:00:00Z'
  it('tot en met 15 dagen na de proef', () => {
    expect(eersteBetalingOpTijd('2027-01-08T22:00:00Z', proefEinde)).toBe(true)
    expect(eersteBetalingOpTijd('2027-01-09T09:00:00Z', proefEinde)).toBe(false)
  })
  it('teamproef: 10 dagen', () => {
    expect(eersteBetalingOpTijd('2027-01-03T12:00:00Z', proefEinde, true)).toBe(true)
    expect(eersteBetalingOpTijd('2027-01-04T12:00:00Z', proefEinde, true)).toBe(false)
  })
})

function maand(start: string, einde: string, extra: Partial<BetaaldePeriode> = {}): BetaaldePeriode {
  return { plan: 'premium', cyclus: 'maandelijks', klantType: 'particulier', periodeStart: start, periodeEinde: einde, betaaldAt: start, geldig: true, maandNettoCent: 4876, ...extra }
}
const drie = [
  maand('2027-01-01T00:00:00Z', '2027-02-01T00:00:00Z'),
  maand('2027-02-01T00:00:00Z', '2027-03-01T00:00:00Z'),
  maand('2027-03-01T00:00:00Z', '2027-04-01T00:00:00Z'),
]

describe('drempel per maand', () => {
  it('drie maanden betaald én verstreken', () => {
    expect(kwalificatie(drie, new Date('2027-03-31T00:00:00Z'))).toBeNull()
    expect(kwalificatie(drie, new Date('2027-04-01T00:00:00Z'))?.periode).toBe(drie[2])
  })
  it('een onderbreking tot 14 dagen mag, langer begint opnieuw', () => {
    const kort = [drie[0], drie[1], maand('2027-03-15T00:00:00Z', '2027-04-15T00:00:00Z')]
    const lang = [drie[0], drie[1], maand('2027-03-16T00:00:00Z', '2027-04-16T00:00:00Z')]
    expect(kwalificatie(kort, new Date('2027-05-01T00:00:00Z'))).not.toBeNull()
    expect(kwalificatie(lang, new Date('2027-05-01T00:00:00Z'))).toBeNull()
  })
  it('een teruggeboekte maand telt niet', () => {
    expect(kwalificatie([drie[0], { ...drie[1], geldig: false }, drie[2]], new Date('2027-05-01T00:00:00Z'))).toBeNull()
  })
  it('maanden Basic per maand tellen niet mee', () => {
    const basic = drie.map(p => ({ ...p, plan: 'basis' as const }))
    expect(kwalificatie(basic, new Date('2027-05-01T00:00:00Z'))).toBeNull()
  })
})

describe('drempel per jaar', () => {
  const jaar = (klantType: 'particulier' | 'zakelijk') =>
    maand('2027-01-01T10:00:00Z', '2028-01-01T10:00:00Z', { plan: 'basis', cyclus: 'jaarlijks', klantType, betaaldAt: '2027-01-01T10:00:00Z' })
  it('zakelijk direct na betaling', () => {
    expect(kwalificatie([jaar('zakelijk')], new Date('2027-01-01T11:00:00Z'))).not.toBeNull()
  })
  it('particulier pas na de 14 dagen bedenktijd', () => {
    expect(kwalificatie([jaar('particulier')], new Date('2027-01-15T22:00:00Z'))).toBeNull()
    expect(kwalificatie([jaar('particulier')], new Date('2027-01-16T09:00:00Z'))).not.toBeNull()
  })
  it('van Basic per maand naar jaar telt alsnog', () => {
    const eerst = maand('2026-12-01T00:00:00Z', '2027-01-01T00:00:00Z', { plan: 'basis' })
    expect(kwalificatie([eerst, jaar('zakelijk')], new Date('2027-01-02T00:00:00Z'))?.periode.cyclus).toBe('jaarlijks')
  })
})

describe('wanneer vervalt het tegoed van de aanbrenger', () => {
  const nu = new Date('2027-06-20T00:00:00Z')
  it('lopend abonnement, ook na opzegging: actief', () => {
    expect(tegoedStatus({ loopt: true, laatsteEindeAt: null }, nu)).toBe('actief')
  })
  it('na het einde 14 dagen stil, daarna weg', () => {
    expect(tegoedStatus({ loopt: false, laatsteEindeAt: '2027-06-07T00:00:00Z' }, nu)).toBe('wacht')
    expect(tegoedStatus({ loopt: false, laatsteEindeAt: '2027-06-05T00:00:00Z' }, nu)).toBe('vervallen')
  })
  it('geblokkeerd team: stil, na 30 dagen weg', () => {
    expect(tegoedStatus({ loopt: true, laatsteEindeAt: null, geblokkeerdSindsAt: '2027-06-01T00:00:00Z' }, nu)).toBe('wacht')
    expect(tegoedStatus({ loopt: true, laatsteEindeAt: null, geblokkeerdSindsAt: '2027-05-01T00:00:00Z' }, nu)).toBe('vervallen')
  })
  it('gewoon teamlid geworden: weg', () => {
    expect(tegoedStatus({ loopt: false, laatsteEindeAt: null, isGewoonTeamlid: true }, nu)).toBe('vervallen')
  })
  it('nooit betaald: wacht tot de termijn voorbij is', () => {
    expect(tegoedStatus({ loopt: false, laatsteEindeAt: null, eersteBetalingUiterlijkAt: '2027-07-01T00:00:00Z' }, nu)).toBe('wacht')
    expect(tegoedStatus({ loopt: false, laatsteEindeAt: null, eersteBetalingUiterlijkAt: '2027-06-01T00:00:00Z' }, nu)).toBe('vervallen')
  })
})
