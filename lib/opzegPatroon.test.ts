import { describe, expect, it } from 'vitest'
import { opzegRegel, isOpzegOnderwerp } from './opzegPatroon'

const NIET = ['Offerte voor artikelmodellering', 'Prijsopgave tweede gebruiker', 'Functieprofiel opstellen']
const WEL = ['Klant wil abonnement opzeggen', 'Klant heeft opgezegd, terugwinnen', 'Renewal email na opzegging']

describe('opzegPatroon', () => {
  it('herkent opzeggen en laat andere onderwerpen met rust', () => {
    expect(isOpzegOnderwerp('klant heeft opgezegd')).toBe(true)
    expect(isOpzegOnderwerp('hij wil niet verlengen')).toBe(true)
    expect(isOpzegOnderwerp('klant wilde weggaan')).toBe(true)
    expect(isOpzegOnderwerp('maak een offerte voor een tweede gebruiker')).toBe(false)
    expect(isOpzegOnderwerp(null)).toBe(false)
  })

  it('geeft niets voor vragen die niet over een opzegging gaan', () => {
    expect(opzegRegel('hoe pak ik een koude acquisitie aan?', [], WEL)).toBe('')
  })

  it('geeft de oorzaakvraag bij een opzegging, zonder herhaling onder de drempel', () => {
    const r = opzegRegel('klant wil opzeggen, wat nu?', [], [...NIET, WEL[0]])
    expect(r).toContain('OORZAAK VOOR GEVOLG')
    expect(r).not.toContain('HERHALING')
  })

  it('voegt herhaling toe vanaf drie eerdere gesprekken over opzeggers', () => {
    const r = opzegRegel('nog een klant heeft opgezegd', [], [...WEL, ...NIET])
    expect(r).toContain('OORZAAK VOOR GEVOLG')
    expect(r).toContain('HERHALING (3 van de laatste 6')
  })

  it('pakt ook een opzegging uit de laatste berichten op', () => {
    expect(opzegRegel('ja, maak maar', [{ content: 'de klant heeft opgezegd' }], [])).toContain('OORZAAK')
  })

  it('bevat geen streepjes als leesteken', () => {
    expect(opzegRegel('klant zegt op, opzegging', [], WEL)).not.toMatch(/[—–]/)
  })
})
