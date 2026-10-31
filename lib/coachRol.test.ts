import { describe, it, expect } from 'vitest'
import { coachRolTrigger, coachRolRegels } from './coachRol'

const analyse = { analyse_text: 'Je benoemt het verwarren met het doen.', created_at: '2026-08-13T08:29:06Z' }
const basis = { reset: false, project: false, eerste: true, heeftCoaching: false, laatsteAnalyse: null, analyseDatum: '13 augustus 2026' }

describe('coachRolTrigger', () => {
  it('herkent de reset van Thijs', () => {
    expect(coachRolTrigger('We starten een nieuw project. Kennis en ervaring van voorgaande inhoudelijke sessies kun je niet gebruiken.').reset).toBe(true)
    expect(coachRolTrigger('Vergeet het hele verleden en begin opnieuw').reset).toBe(true)
  })
  it('herkent projectassistentie alleen in het eerste bericht', () => {
    const q = 'Geef een duidelijke samenvatting van dit project en omschrijf welke informatie je nog nodig hebt'
    expect(coachRolTrigger(q).project).toBe(true)
    expect(coachRolTrigger(q, [{ content: 'x' }, { content: 'y' }]).project).toBe(false)
  })
  it('laat een gewone salesvraag met rust', () => {
    const t = coachRolTrigger('Mijn grootste klant dreigt weg te gaan, hoe ga ik het gesprek in?')
    expect(t.reset).toBe(false)
    expect(t.project).toBe(false)
  })
})

describe('coachRolRegels', () => {
  it('geeft niets zonder reset of projectassistentie', () => {
    expect(coachRolRegels({ ...basis, laatsteAnalyse: analyse, heeftCoaching: true })).toBe('')
  })
  it('zet bij een reset de profielvraag en de analyse met datum en jaar in de prompt', () => {
    const t = coachRolRegels({ ...basis, reset: true, laatsteAnalyse: analyse })
    expect(t).toContain('profiel nog klopt')
    expect(t).toContain('13 augustus 2026')
    expect(t).toContain('geen actuele stand van zaken')
  })
  it('bevat geen streepjes als leesteken', () => {
    const t = coachRolRegels({ ...basis, reset: true, project: true, laatsteAnalyse: analyse })
    expect(t).not.toMatch(/[—–]/)
  })
})
