import { describe, expect, it } from 'vitest'
import { nieuweCoachingZeker } from './coachingActueel'

const NU = new Date('2026-11-20T10:00:00.000Z').getTime()
const OUD = { updated_at: '2026-11-10T10:00:00.000Z', used_session_ids: ['a', 'b'] }
const RECENT = { updated_at: '2026-11-19T10:00:00.000Z', used_session_ids: ['a', 'b'] }

describe('nieuweCoachingZeker', () => {
  it('altijd zeker zonder eerder advies', () => {
    expect(nieuweCoachingZeker(null, [], NU)).toBe(true)
  })

  it('zeker bij 3 nieuwe gesprekken en minstens 48 uur', () => {
    expect(nieuweCoachingZeker(OUD, ['e', 'd', 'c', 'b', 'a'], NU)).toBe(true)
  })

  it('niet zeker bij minder dan 3 nieuwe gesprekken, hoe oud het advies ook is', () => {
    expect(nieuweCoachingZeker(OUD, ['c', 'b', 'a'], NU)).toBe(false)
  })

  it('niet zeker binnen 48 uur', () => {
    expect(nieuweCoachingZeker(RECENT, ['e', 'd', 'c'], NU)).toBe(false)
  })

  it('telt alleen de nieuwste 50 gesprekken', () => {
    const ids = [...Array.from({ length: 50 }, () => 'a'), 'c', 'd', 'e']
    expect(nieuweCoachingZeker(OUD, ids, NU)).toBe(false)
  })
})
