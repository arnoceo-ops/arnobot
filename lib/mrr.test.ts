import { describe, it, expect } from 'vitest'
import { berekenMrrEuro, type AbonnementRij } from './mrr'

const actief = (o: Partial<AbonnementRij> = {}): AbonnementRij => ({
  status: 'active', cyclus: 'maandelijks', bedrag_cent: 5900, btw_cent: 1024, opzegging_aangevraagd_at: null, ...o,
})

describe('berekenMrrEuro', () => {
  it('is 0 zonder abonnementen', () => {
    expect(berekenMrrEuro([])).toBe(0)
  })
  it('telt een maandabonnement exclusief btw', () => {
    expect(berekenMrrEuro([actief()])).toBeCloseTo(48.76, 2)
  })
  it('deelt een jaarabonnement door 12', () => {
    expect(berekenMrrEuro([actief({ cyclus: 'jaarlijks', bedrag_cent: 46800, btw_cent: 8122 })])).toBeCloseTo(((46800 - 8122) / 12) / 100, 2)
  })
  it('telt opgezegde abonnementen niet mee', () => {
    expect(berekenMrrEuro([actief({ opzegging_aangevraagd_at: '2026-11-01T00:00:00Z' })])).toBe(0)
  })
  it('telt alleen status active', () => {
    for (const status of ['ended', 'refunded', 'abandoned', 'pending', 'cancelled', 'suspended']) {
      expect(berekenMrrEuro([actief({ status })]), status).toBe(0)
    }
  })
  it('slaat een onbekende cyclus en een ontbrekend bedrag over', () => {
    expect(berekenMrrEuro([actief({ cyclus: 'kwartaal' }), actief({ bedrag_cent: null })])).toBe(0)
  })
  it('telt meerdere abonnementen op', () => {
    expect(berekenMrrEuro([actief(), actief({ bedrag_cent: 2900, btw_cent: 503 })])).toBeCloseTo(48.76 + 23.97, 2)
  })
})

import { berekenTeamMrrEuro, type TeamRij } from './mrr'

const team = (o: Partial<TeamRij> = {}): TeamRij => ({ id: 't1', min_seats: 3, cyclus: 'maandelijks', geblokkeerd_at: null, ...o })
const betaald = new Set(['t1'])

describe('berekenTeamMrrEuro', () => {
  it('is 0 zonder teams', () => {
    expect(berekenTeamMrrEuro([], {}, new Set())).toBe(0)
  })
  it('gebruikt de factuurformule: 97 + 3 x 49 = 244 per maand bij 3 seats', () => {
    expect(berekenTeamMrrEuro([team()], { t1: 3 }, betaald)).toBe(244)
  })
  it('telt jaarlijks als maand-equivalent: 77 + 3 x 39 = 194', () => {
    expect(berekenTeamMrrEuro([team({ cyclus: 'jaarlijks' })], { t1: 3 }, betaald)).toBe(194)
  })
  it('rekent met het actuele ledenaantal als dat boven het minimum ligt', () => {
    expect(berekenTeamMrrEuro([team()], { t1: 5 }, betaald)).toBe(97 + 5 * 49)
  })
  it('rekent nooit onder het afgesproken minimum', () => {
    expect(berekenTeamMrrEuro([team({ min_seats: 4 })], { t1: 2 }, betaald)).toBe(97 + 4 * 49)
  })
  it('telt een team zonder betaalde factuur niet mee', () => {
    expect(berekenTeamMrrEuro([team()], { t1: 3 }, new Set())).toBe(0)
  })
  it('telt een geblokkeerd team niet mee', () => {
    expect(berekenTeamMrrEuro([team({ geblokkeerd_at: '2026-11-01T00:00:00Z' })], { t1: 3 }, betaald)).toBe(0)
  })
  it('slaat een team zonder minimum of met een onbekende cyclus over', () => {
    expect(berekenTeamMrrEuro([team({ min_seats: null })], { t1: 3 }, betaald)).toBe(0)
    expect(berekenTeamMrrEuro([team({ cyclus: 'kwartaal' })], { t1: 3 }, betaald)).toBe(0)
  })
  it('telt meerdere teams op', () => {
    const t2 = team({ id: 't2', min_seats: 3 })
    expect(berekenTeamMrrEuro([team(), t2], { t1: 3, t2: 3 }, new Set(['t1', 't2']))).toBe(488)
  })
})
