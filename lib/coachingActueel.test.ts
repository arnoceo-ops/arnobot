import { describe, expect, it } from 'vitest'
import { coachingIsActueel } from './coachingActueel'

const DOC = '2026-11-10T10:00:00.000Z'
const OUDER = '2026-11-09T10:00:00.000Z'
const NIEUWER = '2026-11-10T11:00:00.000Z'

describe('coachingIsActueel', () => {
  it('nooit actueel zonder advies', () => {
    expect(coachingIsActueel(null, OUDER, OUDER)).toBe(false)
    expect(coachingIsActueel(undefined, null, null)).toBe(false)
  })

  it('actueel als niets nieuwer is dan het advies', () => {
    expect(coachingIsActueel(DOC, OUDER, OUDER)).toBe(true)
    expect(coachingIsActueel(DOC, null, null)).toBe(true)
    expect(coachingIsActueel(DOC, DOC, DOC)).toBe(true)
  })

  it('niet actueel bij een nieuwer gesprek of een nieuwere analyse', () => {
    expect(coachingIsActueel(DOC, NIEUWER, OUDER)).toBe(false)
    expect(coachingIsActueel(DOC, OUDER, NIEUWER)).toBe(false)
  })

  it('ongeldige datum telt als niet actueel', () => {
    expect(coachingIsActueel('geen-datum', OUDER, OUDER)).toBe(false)
  })
})
