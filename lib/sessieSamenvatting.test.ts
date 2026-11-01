import { describe, it, expect } from 'vitest'
import { samenvattingParams, feitenParams } from '@/lib/sessieSamenvatting'
import { RULE_NO_DASH } from '@/lib/systemPrompt'

// Beide schrijvers van arnobot_blog_sessions (session-end en de wees-sessiereparatie) gebruiken
// deze params. Deze test voorkomt dat een van de twee weer zonder deze regels gaat draaien.
describe('sessieSamenvatting', () => {
  it('feitenprompt heeft streepjesregel, Plan-conventie en brondata-regel', () => {
    const p = feitenParams('GEBRUIKER: hoi')
    expect(String(p.system)).toContain(RULE_NO_DASH)
    expect(String(p.system)).toContain('"Plan: "')
    expect(String(p.system)).toContain('brondata')
  })
  it('samenvattingprompt heeft streepjesregel en zet het gesprek in <gesprek>-tags', () => {
    const p = samenvattingParams('GEBRUIKER: hoi')
    expect(String(p.system)).toContain('streepje')
    expect(JSON.stringify(p.messages)).toContain('<gesprek>')
  })
})
