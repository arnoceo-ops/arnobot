import { describe, it, expect } from 'vitest'
import { isAgentProef, proefEinde, proefStand, PROEF_DAGEN, type ProefManager } from './teamProef'

const nu = new Date('2026-11-14T12:00:00Z')
const dagenGeleden = (d: number) => new Date(nu.getTime() - d * 86_400_000).toISOString()
const manager = (o: Partial<ProefManager> = {}): ProefManager => ({
  trial_start: dagenGeleden(10), expires_at: null, paid_at: null, sd_attribution_method: 'link', ...o,
})

describe('isAgentProef', () => {
  it('is een proef voor een manager via een agent-link zonder betaling en zonder facturatie', () => {
    expect(isAgentProef(manager(), null)).toBe(true)
    expect(isAgentProef(manager(), undefined)).toBe(true) // manager zonder team
  })
  it('is geen proef als de aanmelding niet via een link kwam (handmatig toegewezen of geen agent)', () => {
    expect(isAgentProef(manager({ sd_attribution_method: 'manual' }), null)).toBe(false)
    expect(isAgentProef(manager({ sd_attribution_method: null }), null)).toBe(false)
  })
  it('is geen proef meer zodra de manager betaalt', () => {
    expect(isAgentProef(manager({ paid_at: dagenGeleden(1) }), null)).toBe(false)
  })
  it('is geen proef meer zodra de facturatie is ingesteld (min. seats gevuld)', () => {
    expect(isAgentProef(manager(), 3)).toBe(false)
  })
})

describe('proefEinde', () => {
  it('is 30 dagen na de aanmelding', () => {
    const einde = proefEinde(manager({ trial_start: dagenGeleden(10) }))!
    expect(Math.round((einde.getTime() - nu.getTime()) / 86_400_000)).toBe(PROEF_DAGEN - 10)
  })
  it('een gezette einddatum gaat voor (handmatig verlengd)', () => {
    const einde = proefEinde(manager({ expires_at: '2027-01-15T00:00:00.000Z' }))!
    expect(einde.toISOString()).toBe('2027-01-15T00:00:00.000Z')
  })
  it('is null zonder datums of met een ongeldige datum', () => {
    expect(proefEinde(manager({ trial_start: null }))).toBeNull()
    expect(proefEinde(manager({ trial_start: 'geen datum' }))).toBeNull()
  })
})

describe('proefStand', () => {
  const over = (dagen: number) => new Date(nu.getTime() + dagen * 86_400_000)
  it('loopt bij meer dan 5 dagen', () => {
    expect(proefStand(over(20), nu)).toEqual({ staat: 'loopt', dagen: 20 })
  })
  it('is bijna bij 5 dagen of minder', () => {
    expect(proefStand(over(5), nu)).toEqual({ staat: 'bijna', dagen: 5 })
    expect(proefStand(over(0.5), nu)).toEqual({ staat: 'bijna', dagen: 1 })
  })
  it('is verlopen op en na het einde', () => {
    expect(proefStand(nu, nu).staat).toBe('verlopen')
    expect(proefStand(over(-3), nu)).toEqual({ staat: 'verlopen', dagen: -3 })
  })
})

import { verlengStandaardDatum } from './teamProef'

describe('verlengStandaardDatum', () => {
  it('is 30 dagen na het einde van een lopende proef', () => {
    expect(verlengStandaardDatum(new Date('2026-11-20T00:00:00Z'), nu)).toBe('2026-12-20')
  })
  it('is 30 dagen na vandaag als de proef al voorbij is', () => {
    expect(verlengStandaardDatum(new Date('2026-10-01T00:00:00Z'), nu)).toBe('2026-12-14')
  })
  it('is 30 dagen na vandaag zonder einde', () => {
    expect(verlengStandaardDatum(null, nu)).toBe('2026-12-14')
  })
})
