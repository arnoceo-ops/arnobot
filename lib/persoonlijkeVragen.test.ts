import { describe, it, expect } from 'vitest'
import { lijktPersoonlijk } from './persoonlijkeVragen'

describe('lijktPersoonlijk (poort in de spraakroute)', () => {
  it.each([
    'Ben je failliet?',
    'maar bij de KVK staat toch echt dat arno bv failliet is',
    'Hoeveel verdien jij eigenlijk?',
    'Hoe oud ben je?',
    'Waar woon je?',
    'Heb je kinderen?',
    'Heb jij ooit een rechtszaak gehad?',
    'Wat heb je eigenlijk echt gepresteerd?',
    'Waar ben je het meest trots op?',
    'Ben je ooit getrouwd geweest?',
    'Is jouw bedrijf ooit failliet gegaan?',
  ])('vangt: %s', vraag => {
    expect(lijktPersoonlijk(vraag)).toBe(true)
  })

  it.each([
    'Ik ben bang dat mijn bedrijf failliet gaat, wat vind je?',
    'Mijn klant is failliet, hoe ga ik om met de openstaande factuur?',
    'Mijn collega is ziek en ik moet zijn klanten overnemen',
    'Hoe bepaal ik wat ik verdien als zelfstandige verkoper?',
    'Heb je tips voor een eerste gesprek met een CEO?',
    'Hoe ga ik om met een leidinggevende die kinderen op de eerste plaats zet?',
    'Wat kan ik doen om beter te presteren in Q4?',
    'Ben je het eens met mijn plan?',
  ])('laat door: %s', vraag => {
    expect(lijktPersoonlijk(vraag)).toBe(false)
  })
})
