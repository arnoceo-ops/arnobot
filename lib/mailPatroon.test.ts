import { describe, it, expect } from 'vitest'
import { mailChatSignaal, mailAnalyseBlok, mailCoachingBlok, MAIL_CHAT_DREMPEL, MAIL_COACHING_DREMPEL } from './mailPatroon'

describe('mailChatSignaal', () => {
  it('zegt niets onder de drempel van 3 gesprekken', () => {
    expect(mailChatSignaal(0, 10)).toBe('')
    expect(mailChatSignaal(MAIL_CHAT_DREMPEL - 1, 10)).toBe('')
  })
  it('geeft vanaf 3 gesprekken het signaal, met de boodschap over spreken en zien', () => {
    const s = mailChatSignaal(MAIL_CHAT_DREMPEL, 12)
    expect(s).toContain('3 van de laatste 12 gesprekken')
    expect(s).toContain('spreken en zien')
    expect(s).toContain('tekstschrijver')
  })
  it('zegt het één keer en laat het rusten als er niet om een mail wordt gevraagd', () => {
    const s = mailChatSignaal(4, 10)
    expect(s).toContain('één keer')
    expect(s).toContain('herhaal het dan niet')
    expect(s).toContain('laat dit dan rusten')
  })
  it('beweert nergens dat ArnoBot geen LLM is', () => {
    expect(mailChatSignaal(5, 10)).not.toMatch(/geen LLM|geen taalmodel/i)
  })
})

describe('mailAnalyseBlok en mailCoachingBlok', () => {
  it('doen niets onder de drempel van 5 gesprekken', () => {
    expect(mailAnalyseBlok(MAIL_COACHING_DREMPEL - 1, 20)).toBe('')
    expect(mailCoachingBlok(MAIL_COACHING_DREMPEL - 1, 20)).toBe('')
  })
  it('geven vanaf 5 gesprekken het patroon mee', () => {
    expect(mailAnalyseBlok(5, 20)).toContain('5 van deze 20 gesprekken')
    expect(mailCoachingBlok(5, 20)).toContain('onder pijlar actie')
    expect(mailCoachingBlok(5, 20)).toContain('zonder tijdslimiet')
  })
  it('bevatten geen streepjes als leesteken', () => {
    for (const s of [mailChatSignaal(5, 10), mailAnalyseBlok(5, 10), mailCoachingBlok(5, 10)]) {
      expect(s).not.toMatch(/[—–]/)
    }
  })
})
