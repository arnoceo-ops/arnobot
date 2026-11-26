/* eslint-disable @typescript-eslint/no-explicit-any */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Bevindingen uit de tweede onafhankelijke controle die buiten de planner vallen: bankbedragen (F7), een herroeping van
// 0 euro (F8), de melding aan de eigenaar bij solo naar teamlid (F9) en de uitleg bij een vastgelopen actie (F4).

const h = vi.hoisted(() => ({
  rij: null as any,
  sub: null as any,
  mail: vi.fn(async () => true),
  tg: vi.fn(async (_t: string) => true),
  creditnota: vi.fn(),
  /** De waarden die useState in HerroepSectie om de beurt krijgt. */
  state: null as unknown[] | null,
  meeloop: true,
  teksten: {} as Record<string, string>,
}))

vi.mock('react', async origineel => {
  const echt = await origineel<typeof import('react')>()
  return { ...echt, useState: (begin: unknown) => (h.state && h.state.length ? [h.state.shift(), () => {}] : echt.useState(begin)) }
})
vi.mock('@/hooks/useIsNativeApp', () => ({ useIsNativeApp: () => false }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('./db', () => ({
  billingDb: {
    from(tabel: string) {
      let wijzigt = false
      const q: any = {
        select: () => q, eq: () => q, neq: () => q, in: () => q, is: () => q, order: () => q, limit: () => q, returns: () => q,
        update: () => { wijzigt = true; return q }, insert: () => q, upsert: () => q,
        maybeSingle: async () => ({ data: tabel === 'arnobot_payments' ? h.rij : tabel === 'arnobot_subscriptions' ? h.sub : null, error: null }),
        then: (ok: any) => ok({ data: wijzigt ? [{ id: 'x' }] : [], error: null }),
      }
      return q
    },
  },
}))
vi.mock('./mails', () => ({ verstuurBillingMail: h.mail }))
vi.mock('./facturatie', () => ({ creditnotaVoorBetaling: h.creditnota, factureerBetaling: vi.fn() }))
vi.mock('./mollie', () => ({ stopAbonnement: vi.fn(), haalAbonnement: vi.fn(), haalBetaling: vi.fn(), maakAbonnement: vi.fn(), lijstKlantAbonnementen: vi.fn(async () => []), MollieError: class extends Error {} }))
vi.mock('./wie', () => ({ wieIs: async () => 'Test Klant' }))
vi.mock('@/lib/cron-notify', () => ({ notifyTelegram: h.tg }))
vi.mock('@/lib/referralKenmerken', () => ({ zetGratisKenmerk: vi.fn(), eersteProefStart: vi.fn() }))

import { markeerTerugbetaald } from './verwerking'
import { heeftAndereTerugbetaling, isVolledigTerugbetaald, restantCent } from './terugbetaling'
import { kiesHerroepbareBetaling } from './herroeping'
import HerroepSectie from '@/app/bot/account/HerroepSectie'

beforeEach(() => {
  vi.clearAllMocks()
  h.state = null
  h.sub = { id: 's1', user_id: 'u', plan: 'premium', cyclus: 'maandelijks', klant_type: 'particulier', status: 'active', bedrag_cent: 5900, mollie_customer_id: 'c' }
  h.rij = { id: 'p1', user_id: 'u', subscription_id: 's1', mollie_payment_id: 'tr_1', soort: 'eerste', status: 'paid', bedrag_cent: 5900, referral_refund_cent: 0 }
})
afterEach(() => vi.unstubAllEnvs())

describe('F7: wat per bank is gegeven staat apart van wat via Mollie is teruggestort', () => {
  const rij = { bedrag_cent: 5900, referral_refund_cent: 1000, referral_bank_cent: 2000 }
  it('het hoogste terug te betalen bedrag trekt beide af', () => {
    expect(restantCent(rij)).toBe(2900)
    expect(restantCent({ bedrag_cent: 5900, referral_bank_cent: 5900 })).toBe(0)
    // Zonder de kolommen: precies als voorheen.
    expect(restantCent({ bedrag_cent: 5900 })).toBe(5900)
  })
  it('vergelijken met wat Mollie noemt gebeurt zonder het bankbedrag', () => {
    expect(heeftAndereTerugbetaling(rij, 1500)).toBe(true)
    expect(heeftAndereTerugbetaling(rij, 1000)).toBe(false)
    // 2000 per bank en 3900 via Mollie: de klant heeft alles terug, dan eindigt het abonnement.
    expect(isVolledigTerugbetaald(rij, 3900)).toBe(true)
    expect(isVolledigTerugbetaald(rij, 3899)).toBe(false)
    expect(isVolledigTerugbetaald(rij, 5900)).toBe(true)
    // Bij Mollie alleen referraltegoed terug is nooit een terugbetaling van de koop.
    expect(isVolledigTerugbetaald({ bedrag_cent: 5900, referral_refund_cent: 1000, referral_bank_cent: 4900 }, 1000)).toBe(false)
    expect(isVolledigTerugbetaald({ bedrag_cent: 5900, referral_bank_cent: 5900 }, 0)).toBe(false)
    // Zonder bankbedrag precies als voorheen.
    expect(isVolledigTerugbetaald({ bedrag_cent: 5900 }, 5899)).toBe(false)
    expect(isVolledigTerugbetaald({ bedrag_cent: 5900 }, 5900)).toBe(true)
  })
  it('de mail na terugbetalen door de beheerder noemt alleen wat nu echt teruggaat', async () => {
    h.rij.referral_bank_cent = 2000
    await markeerTerugbetaald('p1')
    expect(h.mail).toHaveBeenCalledWith('u', 'terugbetaling_bevestiging', { bedragCent: 3900 })
  })
  it('zonder referralkolommen is de mail als voorheen', async () => {
    delete h.rij.referral_refund_cent
    await markeerTerugbetaald('p1')
    expect(h.mail).toHaveBeenCalledWith('u', 'terugbetaling_bevestiging', { bedragCent: 5900 })
    expect(h.tg).toHaveBeenCalledWith(expect.not.stringContaining('bevestigingsmail'))
  })
  it('een betaling die per bank helemaal terug is blijft te herroepen', () => {
    const b = { ...h.rij, referral_bank_cent: 5900, terugbetaald_cent: 0, betaald_at: '2026-11-20T10:00:00Z', terugbetaling_verwerkt_at: null }
    expect(kiesHerroepbareBetaling([b], new Date('2026-11-25T10:00:00Z'))).not.toBeNull()
  })
  it('de lezers die geld tegen Mollie vergelijken gebruiken het bankbedrag niet, de andere wel', () => {
    const bron = (pad: string) => readFileSync(join(__dirname, '../..', pad), 'utf8')
    // Creditnota en omzetting naar zakelijk: ook na een bankbedrag nooit de hele factuur automatisch.
    expect(bron('lib/billing/facturatie.ts')).toContain('referral_bank_cent')
    expect(bron('lib/billing/klanttypeCorrectie.ts')).toContain('referral_bank_cent')
    // Voor de kolom bestaat mag er nooit met naam om gevraagd worden.
    expect(bron('lib/billing/klanttypeCorrectie.ts')).not.toMatch(/select\([^)]*referral_bank_cent/)
  })
})

describe('F8: een herroeping van 0 euro', () => {
  it.each(['eerste', 'upgrade'])('%s: geen mail met 0 euro, en de eigenaar hoort dat de klant geen bevestiging kreeg', async soort => {
    h.rij = { ...h.rij, soort, referral_refund_cent: 5900 }
    expect(await markeerTerugbetaald('p1')).toBe(true)
    expect(h.mail).not.toHaveBeenCalled()
    expect(h.tg).toHaveBeenCalledWith(expect.stringContaining('geen bevestigingsmail'))
    expect(h.creditnota).toHaveBeenCalled()
  })

  const toon = (state: unknown[]) => {
    h.state = state
    return renderToStaticMarkup(createElement(HerroepSectie))
  }
  const aanbod = (bedragCent: number, soort = 'eerste') => ({ beschikbaar: true, herroepbaar: { soort, bedragCent, uiterlijkTot: '2026-12-01', gesimuleerd: false } })
  // useState in volgorde: data, bevestig, bezig, fout, klaar.
  it.each([false, true])('geen bedragzinnen bij 0 (bevestigen: %s), de rest blijft', bevestig => {
    const html = toon([aanbod(0), bevestig, false, null, null])
    expect(html).not.toContain('€')
    expect(html).not.toContain('geld terug')
    expect(html).toContain('bedenktijd')
    expect(html).toContain(bevestig ? 'Je abonnement stopt direct en je toegang eindigt.' : 'KOOP ONGEDAAN MAKEN')
  })
  it('met een bedrag staat alles er nog, woord voor woord', () => {
    expect(toon([aanbod(5900), false, false, null, null])).toContain('Maak je aankoop ongedaan en je krijgt je geld terug.')
    expect(toon([aanbod(2000, 'upgrade'), true, false, null, null])).toContain('Je krijgt €20,00 terug. Je upgrade wordt teruggedraaid en je abonnement loopt door.')
  })
  it('na afloop bij 0: geen belofte van een mail of van geld', () => {
    const html = toon([aanbod(0), false, false, null, { proef: false, soort: 'eerste', bedragCent: 0 }])
    expect(html).toContain('Gelukt.')
    expect(html).not.toContain('bevestiging per e-mail')
    expect(html).not.toContain('Het bedrag komt terug')
    expect(html).toContain('Je abonnement is gestopt')
  })
  it('na afloop met een bedrag: als voorheen', () => {
    const html = toon([aanbod(5900), false, false, null, { proef: false, soort: 'eerste', bedragCent: 5900 }])
    expect(html).toContain('✓ Gelukt. Je krijgt een bevestiging per e-mail. Het bedrag komt terug op de rekening waarmee je betaalde.')
  })
})

describe('F4: bij een vastgelopen actie staat welke functie geldt', () => {
  it('de melding en het adminscherm noemen beide wegen', () => {
    for (const pad of ['lib/billing/referralTerugstorten.ts', 'app/bot/admin/referrals/Uitbetalen.tsx']) {
      const tekst = readFileSync(join(__dirname, '../..', pad), 'utf8')
      expect(tekst).toContain('referral_bevestig_met_de_hand')
      expect(tekst).toContain('referral_vrijgeven')
    }
  })
})
