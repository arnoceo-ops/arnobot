import { describe, it, expect } from 'vitest'
import { samenvattingParams, feitenParams, gebruikersBron, schoonFeiten, GEBRUIKER_BRON_REGEL } from '@/lib/sessieSamenvatting'
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
  it('gebruikersBron geeft van ArnoBot alleen de vraag mee waarop de gebruiker antwoordt', () => {
    const t = gebruikersBron([
      { role: 'user', content: 'Wat vind je van mijn pitch?' },
      { role: 'arno', content: 'Ik vind de structuur solide. De pitch bevat een piramide. Hoeveel verkopers heb je?' },
      { role: 'user', content: 'Zes.' },
      { role: 'arno', content: 'Dan zou ik beginnen met kwalificeren. Wie leest het?' },
    ])
    expect(t).toBe('GEBRUIKER: Wat vind je van mijn pitch?\n\nARNO VROEG (alleen om het antwoord te begrijpen): Hoeveel verkopers heb je?\n\nGEBRUIKER: Zes.')
  })
  it('schoonFeiten bewaart "geen feiten" nooit als feit en laat echte feiten staan', () => {
    expect(schoonFeiten('GEEN')).toBe('')
    expect(schoonFeiten('**GEEN**.')).toBe('')
    expect(schoonFeiten('De gebruiker vraagt mijn mening.\n\n**Geen feiten om uit te halen.**')).toBe('')
    expect(schoonFeiten('Geen aanvullende feiten over de situatie van de gebruiker zijn gedeeld.')).toBe('')
    expect(schoonFeiten('• Gebruiker heeft zes verkopers\n• Geen budget voor training')).toBe('• Gebruiker heeft zes verkopers\n• Geen budget voor training')
  })
  it('samenvattingprompt heeft streepjesregel en zet het gesprek in <gesprek>-tags', () => {
    const p = samenvattingParams('GEBRUIKER: hoi')
    expect(String(p.system)).toContain('streepje')
    expect(JSON.stringify(p.messages)).toContain('<gesprek>')
  })
})
