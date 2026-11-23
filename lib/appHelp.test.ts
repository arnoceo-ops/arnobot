import { describe, it, expect } from 'vitest'
import * as appHelp from './appHelp'

describe('appHelp plannen', () => {
  const tekst = Object.values(appHelp).filter(v => typeof v === 'string').join('\n')
  it('noemt de echte verschillen tussen Basic en Pro, zonder bedragen', () => {
    expect(tekst).toContain('Verschil tussen Basic en Pro')
    expect(tekst).toContain('coachingdocument')
    expect(tekst).toContain('gesproken antwoorden')
    expect(tekst).not.toMatch(/€\s?\d/)
  })
})
