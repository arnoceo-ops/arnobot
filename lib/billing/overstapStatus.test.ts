import { describe, expect, it } from 'vitest'
import type { SubRow } from './db'
import { bepaalOverstapStatus } from './overstapStatus'
import { berekenUpgradeBedrag } from './upgradeBedrag'

// Welke overstap-kaart een klant op de accountpagina ziet (docs/OVERSTAP_PLAN.md).

const ISO = (s: string) => new Date(s).toISOString()
const NU = new Date('2026-11-20T10:00:00.000Z')

function rij(extra: Partial<SubRow> = {}): SubRow {
  return {
    id: 'rij-1', user_id: 'user_1', plan: 'basis', cyclus: 'maandelijks', klant_type: 'particulier', status: 'active',
    bedrag_cent: 2900, btw_cent: 503, mollie_customer_id: 'cst_1',
    mollie_subscription_id: 'sub_huidig', mollie_sub_geannuleerd_at: null,
    periode_start: ISO('2026-11-04'), periode_einde: ISO('2026-12-04'), contract_einde: null,
    opzegging_aangevraagd_at: null, opzegging_ingaat_at: null,
    herinnering_30_at: null, herinnering_7_at: null, einde_mail_at: null,
    ...extra,
  }
}

describe('maandklant', () => {
  it('Basic: kaart per jaar betalen met de besparing uit de prijsbron, en de upgradekaart', () => {
    const s = bepaalOverstapStatus(rij(), NU, '2026-12-04')
    expect(s.naarJaar).toEqual({ ingaatOp: '2026-12-04', maandbedragEuro: 29, jaarbedragEuro: 228, besparingEuro: 120, zakelijk: false })
    const bij = berekenUpgradeBedrag('particulier', 'maandelijks', new Date(ISO('2026-11-04')), new Date(ISO('2026-12-04')), NU)
    expect(s.upgrade).toEqual({ bijbetalingCent: bij.brutoCent, zakelijk: false })
    expect(s.gepland).toBeNull()
    expect(s.opzeggingIntrekbaar).toBe(false)
  })

  it('Pro: besparing van €240 en geen upgradekaart', () => {
    const s = bepaalOverstapStatus(rij({ plan: 'premium' }), NU, '2026-12-04')
    expect(s.naarJaar).toMatchObject({ maandbedragEuro: 59, jaarbedragEuro: 468, besparingEuro: 240 })
    expect(s.upgrade).toBeNull()
  })

  it('zakelijk: zelfde bedragen, gemarkeerd als zakelijk (de pagina zet er excl. btw bij)', () => {
    const s = bepaalOverstapStatus(rij({ klant_type: 'zakelijk' }), NU, '2026-12-04')
    expect(s.naarJaar).toMatchObject({ besparingEuro: 120, zakelijk: true })
    expect(s.upgrade?.zakelijk).toBe(true)
  })

  it('zonder Mollies incassodatum geen kaart per jaar (nooit een geschatte datum), de upgrade blijft', () => {
    const s = bepaalOverstapStatus(rij(), NU, null)
    expect(s.naarJaar).toBeNull()
    expect(s.upgrade).not.toBeNull()
  })

  it('geen kaart per jaar als het Mollie-abonnement al als gestopt is vastgelegd of ontbreekt', () => {
    expect(bepaalOverstapStatus(rij({ mollie_sub_geannuleerd_at: ISO('2026-11-10') }), NU, '2026-12-04').naarJaar).toBeNull()
    expect(bepaalOverstapStatus(rij({ mollie_subscription_id: null }), NU, '2026-12-04').naarJaar).toBeNull()
  })
})

describe('jaarklant', () => {
  it('geen kaart per jaar; Basic particulier jaar (geen Mollie-abonnement) kan wel upgraden', () => {
    const s = bepaalOverstapStatus(rij({ cyclus: 'jaarlijks', mollie_subscription_id: null, periode_start: ISO('2026-10-04'), periode_einde: ISO('2027-10-04') }), NU, null)
    expect(s.naarJaar).toBeNull()
    expect(s.upgrade).not.toBeNull()
  })

  it('geen upgradekaart als de betaalperiode al voorbij is', () => {
    expect(bepaalOverstapStatus(rij({ periode_einde: ISO('2026-11-15') }), NU, '2026-12-04').upgrade).toBeNull()
  })
})

describe('geplande wijziging', () => {
  const gepland = { gepland_at: ISO('2026-11-10'), gepland_mollie_subscription_id: 'sub_gepland', gepland_cyclus: 'jaarlijks' as const, gepland_plan: 'basis' as const, gepland_ingangs_at: ISO('2026-12-04') }

  it('maand naar jaar: alleen de kaart "je stapt over op", met de ingangsdatum', () => {
    const s = bepaalOverstapStatus(rij(gepland), NU, '2026-12-04')
    expect(s).toEqual({ naarJaar: null, upgrade: null, gepland: { ingaatOp: '2026-12-04' }, opzeggingIntrekbaar: false })
  })

  it('Pro naar Basic gepland: ook die kaart', () => {
    const s = bepaalOverstapStatus(rij({ ...gepland, plan: 'premium', gepland_plan: 'basis', gepland_cyclus: 'maandelijks' }), NU, null)
    expect(s.gepland).toEqual({ ingaatOp: '2026-12-04' })
  })

  it('upgrade onderweg (plan al Pro, Pro-abonnement nog gepland): niets tonen, er is niets in te trekken', () => {
    const s = bepaalOverstapStatus(rij({ ...gepland, plan: 'premium', gepland_plan: 'premium', gepland_cyclus: 'maandelijks' }), NU, null)
    expect(s).toEqual({ naarJaar: null, upgrade: null, gepland: null, opzeggingIntrekbaar: false })
  })

  it('gepland zonder ingangsdatum: niets tonen', () => {
    expect(bepaalOverstapStatus(rij({ ...gepland, gepland_ingangs_at: null }), NU, null).gepland).toBeNull()
  })
})

describe('opzegging', () => {
  const opgezegd = { status: 'cancelled' as const, opzegging_ingaat_at: ISO('2026-12-04') }

  it('intrekbaar zolang de opzegging nog niet is ingegaan', () => {
    expect(bepaalOverstapStatus(rij(opgezegd), NU, null).opzeggingIntrekbaar).toBe(true)
  })
  it('niet meer intrekbaar als hij al is ingegaan', () => {
    expect(bepaalOverstapStatus(rij({ ...opgezegd, opzegging_ingaat_at: ISO('2026-11-15') }), NU, null).opzeggingIntrekbaar).toBe(false)
    // Gestopt omdat de klant Team wordt: niet intrekbaar.
    expect(bepaalOverstapStatus(rij(opgezegd), NU, null, true).opzeggingIntrekbaar).toBe(false)
  })
  it('niet automatisch intrekbaar als er ook een overstap gepland staat', () => {
    expect(bepaalOverstapStatus(rij({ ...opgezegd, gepland_at: ISO('2026-11-10') }), NU, null).opzeggingIntrekbaar).toBe(false)
  })
  it('een opgezegd abonnement toont verder geen kaarten', () => {
    const s = bepaalOverstapStatus(rij(opgezegd), NU, '2026-12-04')
    expect(s.naarJaar).toBeNull()
    expect(s.upgrade).toBeNull()
  })
})

describe('andere statussen', () => {
  it.each(['pending', 'ended', 'refunded', 'abandoned'] as const)('%s: niets te tonen', status => {
    expect(bepaalOverstapStatus(rij({ status }), NU, '2026-12-04')).toEqual({ naarJaar: null, upgrade: null, gepland: null, opzeggingIntrekbaar: false })
  })
})
