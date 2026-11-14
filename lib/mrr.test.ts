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
