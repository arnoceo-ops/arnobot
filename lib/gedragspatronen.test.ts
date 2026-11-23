import { describe, it, expect } from 'vitest'
import { telGedragspatronen } from './gedragspatronen'

const tel = (answers: string[]) => Object.fromEntries(telGedragspatronen(answers.map(answer => ({ answer }))).map(t => [t.sleutel, t.aantal]))

describe('telGedragspatronen', () => {
  it('herkent de antwoorden van de waarheidscontrole van 23-11', () => {
    const r = tel([
      'Laat me de meest actuele tabel overschrijven.\n\nDianne lees ik opnieuw in.',
      'Eerst de meest actuele tabel overschrijven.\n\nNu jouw vraag.',
      'Klopt helemaal.\n\nDe 10% is geen vraag meer.',
      'Als dit bedrijf dat niet wil honoreren, dan is de markt bereid dat wel te doen. Je hebt alle recht om verder te kijken.',
      'Dit klopt niet. Wacht, andersom: de prijs is gedaald.',
    ])
    expect(r.aankondiging).toBe(2)
    expect(r.bijval).toBe(1)
    expect(r['verwachting-als-feit']).toBe(1)
    expect(r['markt-voorspelling']).toBe(1)
    expect(r.zelfcorrectie).toBe(1)
  })

  it('telt een gewoon antwoord nergens', () => {
    const r = tel(['Je marge is 47% en daarmee 4 punten boven het gemiddelde. Wat staat er in je pipeline?'])
    expect(Object.values(r).every(n => n === 0)).toBe(true)
  })
})
