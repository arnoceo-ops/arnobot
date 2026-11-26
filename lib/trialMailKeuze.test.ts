import { describe, expect, it } from 'vitest'
import { kiesTrialMail, type TrialMailStand } from './trialMailKeuze'

const stand = (over: Partial<TrialMailStand> & { gehad?: string[] } = {}): TrialMailStand => ({
  dagen: 1, profielAf: true, gesprekken: 0, sessies: 0, coachingRapporten: 0,
  gesprekMetArnoGeboekt: false, verzonden: new Set(over.gehad ?? []), ...over,
})

describe('kiesTrialMail', () => {
  it('stuurt niets op de dag van aanmelden', () => {
    expect(kiesTrialMail(stand({ dagen: 0, profielAf: false }))).toBeNull()
    expect(kiesTrialMail(stand({ dagen: 0, gesprekken: 3 }))).toBeNull()
  })

  it('verwijst zonder profiel op dag 1 en 4 naar het profiel', () => {
    expect(kiesTrialMail(stand({ profielAf: false }))).toBe('profiel_dag1')
    expect(kiesTrialMail(stand({ profielAf: false, dagen: 4, gehad: ['profiel_dag1'] }))).toBe('profiel_dag4')
  })

  it('herhaalt dag 1 niet voor wie de gewone variant al kreeg', () => {
    expect(kiesTrialMail(stand({ profielAf: false, dagen: 2, gehad: ['dag1'] }))).toBeNull()
    expect(kiesTrialMail(stand({ profielAf: false, dagen: 4, gehad: ['dag1'] }))).toBe('profiel_dag4')
  })

  it('verwijst nooit naar het profiel als dat af is', () => {
    for (let dagen = 0; dagen <= 30; dagen++) {
      for (const gesprekken of [0, 2]) {
        expect(kiesTrialMail(stand({ dagen, gesprekken })) ?? '').not.toMatch(/^profiel_/)
      }
    }
  })

  it('stuurt de gewone dag 1 en 4 nog na de profielmails', () => {
    expect(kiesTrialMail(stand({ gehad: ['profiel_dag1', 'profiel_dag4'] }))).toBe('dag1')
    expect(kiesTrialMail(stand({ dagen: 4, gehad: ['profiel_dag1', 'profiel_dag4', 'dag1'] }))).toBe('dag4')
  })

  it('geeft wie al begonnen is de mail over het eerste gesprek, zonder dag 1', () => {
    expect(kiesTrialMail(stand({ gesprekken: 1 }))).toBe('first_conversation')
    expect(kiesTrialMail(stand({ dagen: 4, gesprekken: 1, gehad: ['first_conversation'] }))).toBeNull()
  })

  it('stuurt dag 14 alleen aan wie minstens één gesprek heeft gevoerd', () => {
    expect(kiesTrialMail(stand({ dagen: 14, gehad: ['dag1', 'dag4'] }))).toBeNull()
    expect(kiesTrialMail(stand({ dagen: 14, profielAf: false, gehad: ['profiel_dag1', 'profiel_dag4'] }))).toBeNull()
    expect(kiesTrialMail(stand({ dagen: 14, gesprekken: 1, gehad: ['first_conversation'] }))).toBe('dag14')
  })

  it('laat dag 21 en dag 25 voor iedereen staan', () => {
    const gehad = ['profiel_dag1', 'profiel_dag4']
    expect(kiesTrialMail(stand({ dagen: 21, profielAf: false, gehad }))).toBe('dag21_gesprek')
    expect(kiesTrialMail(stand({ dagen: 25, profielAf: false, gehad: [...gehad, 'dag21_gesprek'] }))).toBe('dag25')
  })
})
