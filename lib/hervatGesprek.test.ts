import { describe, it, expect } from 'vitest'
import { bepaalHervatting, bouwHervatTekst } from './hervatGesprek'

const NU = new Date('2026-11-27T10:00:00Z').getTime()
const rij = (urenGeleden: number, naam: string) => ({ question: `vraag ${naam}`, answer: `antwoord ${naam}`, created_at: new Date(NU - urenGeleden * 3_600_000).toISOString() })
const inhoud = (h: { content: string }[]) => h.map(b => b.content)

describe('bepaalHervatting', () => {
  it('doet niets bij een doorlopend gesprek', () => {
    expect(bepaalHervatting([rij(1, 'c'), rij(20, 'b'), rij(60, 'a')], NU)).toBeNull()
  })

  it('doet niets zonder opgeslagen berichten', () => {
    expect(bepaalHervatting([], NU)).toBeNull()
  })

  it('geeft bij het eerste bericht na de stilte geen geschiedenis mee', () => {
    const h = bepaalHervatting([rij(72, 'oud2'), rij(73, 'oud1')], NU)
    expect(h?.historie).toEqual([])
    expect(h?.laatsteVoorStilte).toBe(rij(72, 'oud2').created_at)
  })

  it('houdt de oude berichten ook op latere beurten weg, de nieuwe gaan in volgorde mee', () => {
    const h = bepaalHervatting([rij(0.1, 'nieuw2'), rij(0.5, 'nieuw1'), rij(72, 'oud')], NU)
    expect(inhoud(h!.historie)).toEqual(['vraag nieuw1', 'antwoord nieuw1', 'vraag nieuw2', 'antwoord nieuw2'])
    expect(h!.historie.map(b => b.role)).toEqual(['user', 'assistant', 'user', 'assistant'])
  })

  it('kiest de laatste stilte als er meerdere zijn', () => {
    const h = bepaalHervatting([rij(1, 'c'), rij(100, 'b'), rij(300, 'a')], NU)
    expect(inhoud(h!.historie)).toEqual(['vraag c', 'antwoord c'])
  })

  it('kantelt boven de 48 uur, niet erop', () => {
    expect(bepaalHervatting([rij(48, 'a')], NU)).toBeNull()
    expect(bepaalHervatting([rij(48.01, 'a')], NU)).not.toBeNull()
  })

  it('slaat een beurt zonder antwoord over, want een leeg bericht weigert de API', () => {
    const h = bepaalHervatting([{ ...rij(1, 'leeg'), answer: '' }, rij(2, 'goed'), rij(90, 'oud')], NU)
    expect(inhoud(h!.historie)).toEqual(['vraag goed', 'antwoord goed'])
  })
})

describe('bouwHervatTekst', () => {
  it('zegt dat het eerdere deel niet zichtbaar is en gebruikt geen streepjes', () => {
    const t = bouwHervatTekst('24 november (3 dagen geleden)', 'Offerte')
    expect(t).toContain('jij ziet die berichten niet')
    expect(t).toContain('Onderwerp van toen: Offerte')
    expect(t).not.toMatch(/[–—]/)
  })
  it('laat het onderwerp weg als dat onbekend is', () => {
    expect(bouwHervatTekst('24 november', '')).not.toContain('Onderwerp van toen')
  })
})
