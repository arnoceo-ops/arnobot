import { describe, it, expect } from 'vitest'
import { mailChatSignaal, mailAnalyseBlok, mailCoachingBlok, mailConceptRegel, MAIL_CHAT_DREMPEL, MAIL_COACHING_DREMPEL } from './mailPatroon'

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

describe('mailConceptRegel', () => {
  it('komt mee als de vraag over een mail of bericht aan een klant gaat', () => {
    expect(mailConceptRegel('Kun je een follow-up mail schrijven?')).toContain('CONCEPTTEKST VOOR EEN KLANT')
    expect(mailConceptRegel('Ik wil een nieuwsbrief sturen')).toContain('haakjes')
    expect(mailConceptRegel('Schrijf een bericht aan mijn klant')).toContain('kort gesprek')
  })
  it('komt mee bij een vervolgvraag zonder het woord mail als het gesprek erover ging', () => {
    expect(mailConceptRegel('Schrijf hem maar', [{ content: 'Kun je een mail schrijven voor een prospect?' }, { content: 'Wat wil je bereiken?' }])).not.toBe('')
  })
  it('komt NIET mee bij vragen die niet over een mail gaan, zodat de persona daar niet verandert', () => {
    expect(mailConceptRegel('Een klant zegt dat ons aanbod 15% te duur is. Hoe ga ik daarmee om?')).toBe('')
    expect(mailConceptRegel('Mijn pipeline is leeg en ik weet niet waar ik moet beginnen.')).toBe('')
    expect(mailConceptRegel('Hoe doe ik een debrief na een verloren deal?')).toBe('')
  })
  it('verbiedt een verzonnen tijdsaanduiding en vraagt om een voorstel voor een gesprek', () => {
    const r = mailConceptRegel('mail')
    expect(r).toContain('vorige week')
    expect(r).toContain('voorstel voor een kort gesprek')
    expect(r).not.toMatch(/[—–]/)
  })
})
