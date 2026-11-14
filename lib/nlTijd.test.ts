import { describe, it, expect } from 'vitest'
import { nlDagStartIso, nlDagEindeIso, nlVandaag, nlGisteren } from './nlTijd'

describe('nlDagStartIso', () => {
  it('begint een winterdag om 23:00 UTC de dag ervoor', () => {
    expect(nlDagStartIso('2026-01-15')).toBe('2026-01-14T23:00:00.000Z')
  })
  it('begint een zomerdag om 22:00 UTC de dag ervoor', () => {
    expect(nlDagStartIso('2026-07-15')).toBe('2026-07-14T22:00:00.000Z')
  })
  it('klopt op de dag dat de zomertijd ingaat (29 maart 2026, middernacht is nog wintertijd)', () => {
    expect(nlDagStartIso('2026-03-29')).toBe('2026-03-28T23:00:00.000Z')
    expect(nlDagStartIso('2026-03-30')).toBe('2026-03-29T22:00:00.000Z')
  })
  it('klopt op de dag dat de wintertijd ingaat (25 oktober 2026, middernacht is nog zomertijd)', () => {
    expect(nlDagStartIso('2026-10-25')).toBe('2026-10-24T22:00:00.000Z')
    expect(nlDagStartIso('2026-10-26')).toBe('2026-10-25T23:00:00.000Z')
  })
})

describe('nlDagEindeIso', () => {
  it('is het begin van de volgende dag', () => {
    expect(nlDagEindeIso('2026-01-15')).toBe(nlDagStartIso('2026-01-16'))
  })
  it('geeft een dag van 23 uur bij het ingaan van de zomertijd', () => {
    const uren = (Date.parse(nlDagEindeIso('2026-03-29')) - Date.parse(nlDagStartIso('2026-03-29'))) / 3600000
    expect(uren).toBe(23)
  })
  it('geeft een dag van 25 uur bij het ingaan van de wintertijd', () => {
    const uren = (Date.parse(nlDagEindeIso('2026-10-25')) - Date.parse(nlDagStartIso('2026-10-25'))) / 3600000
    expect(uren).toBe(25)
  })
  it('klopt over een maand- en jaargrens', () => {
    expect(nlDagEindeIso('2026-12-31')).toBe(nlDagStartIso('2027-01-01'))
  })
})

describe('nlVandaag en nlGisteren', () => {
  it('telt een gesprek om 00:30 Nederlandse tijd bij de nieuwe dag, niet bij gisteren', () => {
    // 2026-11-12 23:30 UTC is 00:30 op 13 november in Amsterdam
    expect(nlVandaag(new Date('2026-11-12T23:30:00Z'))).toBe('2026-11-13')
    expect(nlGisteren(new Date('2026-11-12T23:30:00Z'))).toBe('2026-11-12')
  })
  it('gebruikt in de zomer twee uur verschil', () => {
    expect(nlVandaag(new Date('2026-07-14T21:59:00Z'))).toBe('2026-07-14')
    expect(nlVandaag(new Date('2026-07-14T22:00:00Z'))).toBe('2026-07-15')
  })
  it('gisteren klopt over een maandgrens', () => {
    expect(nlGisteren(new Date('2026-12-01T10:00:00Z'))).toBe('2026-11-30')
  })
})

import { nlTijdTekst, nlDatumTekst } from './nlTijd'

describe('nlTijdTekst en nlDatumTekst', () => {
  it('toont een winterse UTC-tijd een uur later', () => {
    expect(nlTijdTekst('2026-11-12T08:03:11Z')).toBe('09:03:11')
  })
  it('toont een zomerse UTC-tijd twee uur later', () => {
    expect(nlTijdTekst('2026-07-14T08:03:11Z')).toBe('10:03:11')
  })
  it('geeft rond middernacht de Nederlandse datum, niet de UTC-datum', () => {
    expect(nlDatumTekst('2026-11-12T23:30:00Z')).toBe('13/11/2026')
    expect(nlTijdTekst('2026-11-12T23:30:00Z')).toBe('00:30:00')
  })
  it('houdt dezelfde datum aan overdag', () => {
    expect(nlDatumTekst('2026-11-12T12:00:00Z')).toBe('12/11/2026')
  })
})
