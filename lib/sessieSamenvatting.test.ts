import { describe, it, expect } from 'vitest'
import { samenvattingParams, feitenParams, gebruikersBron, GEBRUIKER_BRON_REGEL } from '@/lib/sessieSamenvatting'
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
  it('feiten en samenvatting hebben de bronregel: ARNO is nooit een bron van feiten', () => {
    expect(String(feitenParams('x').system)).toContain(GEBRUIKER_BRON_REGEL)
    expect(String(samenvattingParams('x').system)).toContain(GEBRUIKER_BRON_REGEL)
  })
  it('gebruikt Sonnet 5.5 met eigen denkruimte, en Haiku alleen als terugval', () => {
    expect(samenvattingParams('x')).toMatchObject({ model: 'claude-sonnet-5-5', output_config: { effort: 'low' } })
    expect(samenvattingParams('x').max_tokens).toBeGreaterThan(300)
    expect(samenvattingParams('x', true)).toMatchObject({ model: 'claude-haiku-4-5-20251001', max_tokens: 300 })
    expect(samenvattingParams('x', true)).not.toHaveProperty('thinking')
  })
  it('gebruikersBron houdt gebruikersbeurten volledig en kort ARNO in', () => {
    const lang = 'A'.repeat(150) + 'MIDDEN'.repeat(100) + 'Z'.repeat(250)
    const t = gebruikersBron([{ role: 'user', content: lang }, { role: 'arno', content: lang }])
    expect(t).toContain(`GEBRUIKER: ${lang}`)
    expect(t).toContain('ARNO (ingekort, alleen context): ' + 'A'.repeat(150) + ' [...] ' + 'Z'.repeat(250))
    expect(t.split('MIDDEN').length - 1).toBe(100)
  })
  it('samenvattingprompt heeft streepjesregel en zet het gesprek in <gesprek>-tags', () => {
    const p = samenvattingParams('GEBRUIKER: hoi')
    expect(String(p.system)).toContain('streepje')
    expect(JSON.stringify(p.messages)).toContain('<gesprek>')
  })
})
