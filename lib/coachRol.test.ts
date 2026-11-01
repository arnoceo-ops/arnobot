import { describe, it, expect } from 'vitest'
import { coachRolTrigger, coachRolRegels, adviesRegels } from './coachRol'

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

describe('adviesRegels', () => {
  const h = [{ content: 'a' }, { content: 'b' }]
  it('vraagt eerst het feit bij een vraag over frequentie', () => {
    expect(adviesRegels('Hoe vaak moet ik die huddle doen?')).toContain('voordat je een vast aantal')
  })
  it('laat meebuigen alleen met een vraag, en alleen vanaf het tweede bericht', () => {
    const q = 'Elke dag Arno? Dat voelt niet goed, 2x per week vind ik al heel wat'
    expect(adviesRegels(q, h)).toContain('Meebuigen mag')
    expect(adviesRegels(q)).not.toContain('Meebuigen mag')
    expect(adviesRegels('Dat voelt goed, bedankt', h)).toBe('')
  })
  it('signaleert een organisatiepatroon één keer', () => {
    const q = 'er is een over de schutting cultuur en afdelingen werken als eilandjes'
    expect(adviesRegels(q, h)).toContain('structuur en cultuur')
    expect(adviesRegels(q, [{ content: 'Wil je naast de oplossing ook naar de structuur en cultuur kijken?' }])).toBe('')
  })
  it('laat de actieopvolging niet vallen', () => {
    expect(adviesRegels('[Actieopvolging vorige sessie: actie was "x", status: ingepland] hoi')).toContain('actieopvolging')
    expect(adviesRegels('ok', [{ content: '[Actieopvolging vorige sessie: actie was "x"] hoi' }, { content: 'y' }])).toBe('')
  })
  it('geeft niets bij een gewone vraag', () => {
    expect(adviesRegels('Mijn klant dreigt weg te gaan, hoe ga ik het gesprek in?')).toBe('')
  })
})
