import { describe, it, expect } from 'vitest'
import { amsterdamMaandStart, overMaandPlafond, VOICE_MAAND_PLAFOND_TEKENS } from './voiceLimiet'

describe('amsterdamMaandStart', () => {
  it('geeft in de winter 00:00 Amsterdamse tijd (23:00 UTC de dag ervoor)', () => {
    expect(amsterdamMaandStart(new Date('2026-11-19T12:00:00Z'))).toBe('2026-10-31T23:00:00.000Z')
  })
  it('geeft in de zomer 00:00 Amsterdamse tijd (22:00 UTC de dag ervoor)', () => {
    expect(amsterdamMaandStart(new Date('2026-07-15T12:00:00Z'))).toBe('2026-06-30T22:00:00.000Z')
  })
  it('rekent een tijdstip net na middernacht Amsterdam nog tot de nieuwe maand', () => {
    expect(amsterdamMaandStart(new Date('2026-11-30T23:30:00Z'))).toBe('2026-11-30T23:00:00.000Z')
  })
})

describe('overMaandPlafond', () => {
  it('laat toe tot precies het plafond en remt daarboven', () => {
    expect(overMaandPlafond(VOICE_MAAND_PLAFOND_TEKENS - 900, 900)).toBe(false)
    expect(overMaandPlafond(VOICE_MAAND_PLAFOND_TEKENS - 900, 901)).toBe(true)
  })
})
