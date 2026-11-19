import { describe, expect, it } from 'vitest'
import { isOngelezen } from './coachingGelezen'

const DOC = '2026-11-19T10:00:00.000Z'

describe('isOngelezen', () => {
  it('niet zonder document', () => {
    expect(isOngelezen(null, null)).toBe(false)
    expect(isOngelezen(undefined, DOC)).toBe(false)
  })

  it('ongelezen zonder leesmoment, ook bij een eerste document', () => {
    expect(isOngelezen(DOC, null)).toBe(true)
    expect(isOngelezen(DOC, undefined)).toBe(true)
  })

  it('ongelezen als het document nieuwer is dan het leesmoment', () => {
    expect(isOngelezen(DOC, '2026-11-19T09:59:59.000Z')).toBe(true)
  })

  it('gelezen op of na het moment van schrijven', () => {
    expect(isOngelezen(DOC, DOC)).toBe(false)
    expect(isOngelezen(DOC, '2026-11-19T10:00:01.000Z')).toBe(false)
  })

  it('een onleesbare datum geldt niet als ongelezen document zonder updated_at, maar wel bij een kapot leesmoment', () => {
    expect(isOngelezen('geen datum', null)).toBe(false)
    expect(isOngelezen(DOC, 'geen datum')).toBe(true)
  })
})
