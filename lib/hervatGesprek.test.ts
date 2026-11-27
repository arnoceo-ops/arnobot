import { describe, it, expect } from 'vitest'
import { bepaalHervatting, zonderDatum, HERVAT_TEKST, MAX_RIJEN } from './hervatGesprek'

const NU = new Date('2026-11-27T10:00:00Z').getTime()
const rij = (urenGeleden: number, naam: string) => ({ question: `vraag ${naam}`, answer: `antwoord ${naam}`, created_at: new Date(NU - urenGeleden * 3_600_000).toISOString() })

describe('bepaalHervatting', () => {
  it('doet niets bij een doorlopend gesprek of zonder berichten', () => {
    expect(bepaalHervatting([rij(1, 'c'), rij(20, 'b'), rij(60, 'a')], NU)).toBeNull()
    expect(bepaalHervatting([], NU)).toBeNull()
  })

  it('geeft bij het eerste bericht na de stilte het hele eerdere gesprek mee, met datum per bericht', () => {
    const h = bepaalHervatting([rij(96, 'b'), rij(97, 'a')], NU)!
    expect(h.kaal.map(b => b.content)).toEqual(['vraag a', 'antwoord a', 'vraag b', 'antwoord b'])
    expect(h.gedateerd[0].content).toBe('[App: geschreven op maandag 23 november 2026]\nvraag a')
    expect(h.gedateerd[1].content).toBe('antwoord a')
    expect(h.vraagRegel).toContain('nieuw bericht van vandaag, vrijdag 27 november 2026')
    expect(h.vraagRegel).toContain('maandag 23 november 2026, 4 dagen eerder')
  })

  it('houdt ook op latere beurten het oude deel mee, gedateerd', () => {
    const h = bepaalHervatting([rij(0.1, 'nieuw'), rij(96, 'oud')], NU)!
    expect(h.gedateerd.map(b => zonderDatum(b.content))).toEqual(['vraag oud', 'antwoord oud', 'vraag nieuw', 'antwoord nieuw'])
    expect(h.gedateerd[2].content).toContain('vrijdag 27 november 2026')
    expect(h.vraagRegel).toBe('[App: geschreven op vrijdag 27 november 2026, vandaag]')
  })

  it('gebruikt de Nederlandse datum, niet die van de server', () => {
    const h = bepaalHervatting([{ question: 'v', answer: 'a', created_at: '2026-11-22T23:30:00Z' }], NU)!
    expect(h.gedateerd[0].content).toContain('maandag 23 november 2026')
  })

  it('kantelt boven de 48 uur, niet erop', () => {
    expect(bepaalHervatting([rij(48, 'a')], NU)).toBeNull()
    expect(bepaalHervatting([rij(48.01, 'a')], NU)).not.toBeNull()
  })

  it('neemt niet meer beurten mee dan de limiet en slaat een beurt zonder antwoord over', () => {
    const veel = Array.from({ length: MAX_RIJEN + 5 }, (_, i) => rij(100 + i, String(i)))
    expect(bepaalHervatting(veel, NU)!.kaal).toHaveLength(MAX_RIJEN * 2)
    expect(bepaalHervatting([{ ...rij(90, 'leeg'), answer: '' }, rij(91, 'goed')], NU)!.kaal).toHaveLength(2)
  })
})

describe('HERVAT_TEKST', () => {
  it('bevat geen streepjes als leesteken', () => {
    expect(HERVAT_TEKST).not.toMatch(/[–—]/)
  })
})
