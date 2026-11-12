import { describe, expect, it } from 'vitest'
import { EMAIL_META, getEmailTemplate } from '@/lib/email-templates'

// De klantmails rond overstappen, intrekken en een upgrade (docs/OVERSTAP_PLAN.md, teksten door Arno
// goedgekeurd op 2026-11-12). Controleert de inhoud en de huisregel: nooit een streepje in klanttekst.

const DATUM = '2026-12-04T00:00:00.000Z'
const heeftStreepje = (s: string) => /[—–]/.test(s)

describe('overstap_ingepland', () => {
  const m = getEmailTemplate('overstap_ingepland', 'Test', false, {
    billing: { van: 'Basic maandelijks', naar: 'Basic jaarlijks', bedragCent: 22800, datum: DATUM, perPeriode: 'per jaar' },
  })

  it('noemt datum, oud en nieuw abonnement, bedrag en hoe je intrekt', () => {
    expect(m.subject).toBe('Je overstap is ingepland')
    expect(m.html).toContain('4 december 2026')
    expect(m.html).toContain('over van Basic maandelijks naar Basic jaarlijks')
    expect(m.html).toContain('228,00')
    expect(m.html).toContain('per jaar')
    expect(m.html).toContain('Tot dan blijft alles zoals het is')
    expect(m.html).toContain('uiterlijk een dag voor 4 december 2026')
    expect(m.html).toContain('admin@arno.bot')
  })

  it('particulier: inclusief BTW, zakelijk: exclusief BTW', () => {
    expect(m.html).toContain('inclusief BTW')
    const z = getEmailTemplate('overstap_ingepland', 'Test', false, {
      billing: { van: 'Basic maandelijks', naar: 'Basic jaarlijks', bedragCent: 19000, datum: DATUM, perPeriode: 'per jaar', zakelijk: true },
    })
    expect(z.html).toContain('exclusief BTW')
    expect(z.html).not.toContain('inclusief BTW')
  })

  it('heeft geen streepjes', () => {
    expect(heeftStreepje(m.subject)).toBe(false)
    expect(heeftStreepje(m.html)).toBe(false)
  })

  it('valt terug op neutrale woorden als gegevens ontbreken', () => {
    const leeg = getEmailTemplate('overstap_ingepland', 'Test', false, { billing: {} })
    expect(leeg.html).toContain('je huidige abonnement')
    expect(leeg.html).toContain('je nieuwe abonnement')
  })
})

describe('opzegging_ingetrokken', () => {
  it('met automatische betaling: noemt de volgende betaling', () => {
    const m = getEmailTemplate('opzegging_ingetrokken', 'Test', false, { billing: { datum: DATUM, metBetaling: true } })
    expect(m.subject).toBe('Je opzegging is ingetrokken')
    expect(m.html).toContain('Je abonnement loopt gewoon door. Je volgende betaling is op 4 december 2026.')
    expect(heeftStreepje(m.html)).toBe(false)
  })

  it('zonder automatische betaling (particulier jaar): zegt alleen dat het doorloopt tot de datum', () => {
    const m = getEmailTemplate('opzegging_ingetrokken', 'Test', false, { billing: { datum: DATUM, metBetaling: false } })
    expect(m.html).toContain('Je abonnement loopt gewoon door tot 4 december 2026.')
    expect(m.html).not.toContain('volgende betaling')
  })
})

describe('solo_naar_team', () => {
  it('noemt de einddatum van het solo-abonnement, het Team en de eerste Team-factuur exclusief BTW', () => {
    const m = getEmailTemplate('solo_naar_team', 'Test', false, { billing: { datum: DATUM, bedragCent: 15000, perPeriode: 'per maand' } })
    expect(m.subject).toBe('Je solo-abonnement gaat over naar je Team')
    expect(m.html).toContain('Je solo-abonnement stopt op 4 december 2026.')
    expect(m.html).toContain('Tot die datum blijft alles werken en betaal je niets extra.')
    expect(m.html).toContain('Vanaf 4 december 2026 loopt je Team')
    expect(m.html).toContain('eerste Team-factuur van €150,00 exclusief BTW per maand.')
    expect(m.html).toContain('admin@arno.bot')
    expect(heeftStreepje(m.subject)).toBe(false)
    expect(heeftStreepje(m.html)).toBe(false)
  })

  it('jaarlijks Team: per jaar', () => {
    const m = getEmailTemplate('solo_naar_team', 'Test', false, { billing: { datum: DATUM, bedragCent: 180000, perPeriode: 'per jaar' } })
    expect(m.html).toContain('€1.800,00 exclusief BTW per jaar.')
  })
})

describe('upgrade_gelukt', () => {
  const basis = { datum: DATUM, perPeriode: 'per maand', bedragCent: 5900, bijbetalingCent: 3000 }

  it('particulier: Pro nu, bijbetaling per incasso, daarna het Pro-bedrag inclusief BTW', () => {
    const m = getEmailTemplate('upgrade_gelukt', 'Test', false, { billing: basis })
    expect(m.subject).toBe('Je upgrade naar Pro is gelukt')
    expect(m.html).toContain('Je hebt nu Pro.')
    expect(m.html).toContain('De bijbetaling van €30,00 voor de rest van deze periode wordt de komende werkdagen automatisch afgeschreven.')
    expect(m.html).toContain('Vanaf 4 december 2026 betaal je €59,00 per maand, inclusief BTW.')
    expect(m.html).toContain('admin@arno.bot')
    expect(heeftStreepje(m.subject)).toBe(false)
    expect(heeftStreepje(m.html)).toBe(false)
  })

  it('zakelijk: beide bedragen exclusief BTW', () => {
    const m = getEmailTemplate('upgrade_gelukt', 'Test', false, { billing: { ...basis, zakelijk: true, bedragCent: 4876, bijbetalingCent: 2479 } })
    expect(m.html).toContain('€24,79 exclusief BTW')
    expect(m.html).toContain('betaal je €48,76 per maand, exclusief BTW')
    expect(m.html).not.toContain('inclusief BTW')
  })

  it('niets bij te betalen: zegt dat, en noemt geen afschrijving', () => {
    const m = getEmailTemplate('upgrade_gelukt', 'Test', false, { billing: { ...basis, bijbetalingCent: 0 } })
    expect(m.html).toContain('Er is nu niets bij te betalen.')
    expect(m.html).not.toContain('automatisch afgeschreven')
  })
})

describe('upgrade_bijbetaling_mislukt', () => {
  it('met een geplande overstap: verwijst naar de datum en zegt "eerder Pro"', () => {
    const m = getEmailTemplate('upgrade_bijbetaling_mislukt', 'Test', false, { billing: { datum: DATUM } })
    expect(m.subject).toBe('De bijbetaling voor je upgrade is niet gelukt')
    expect(m.html).toContain('Daarom heb je weer Basic.')
    expect(m.html).toContain('Je overstap naar Pro per 4 december 2026 blijft staan.')
    expect(m.html).toContain('Wil je eerder Pro')
    expect(heeftStreepje(m.subject)).toBe(false)
    expect(heeftStreepje(m.html)).toBe(false)
  })

  it('zonder geplande overstap: belooft geen overstap en zegt "Wil je Pro"', () => {
    const m = getEmailTemplate('upgrade_bijbetaling_mislukt', 'Test', false, { billing: {} })
    expect(m.html).not.toContain('blijft staan')
    expect(m.html).toContain('Wil je Pro, probeer')
  })
})

describe('terugbetaling_bevestiging', () => {
  it('bij een gewone terugbetaling: het abonnement is beëindigd (ongewijzigd)', () => {
    const m = getEmailTemplate('terugbetaling_bevestiging', 'Test', false, { billing: { bedragCent: 2900 } })
    expect(m.html).toContain('Je abonnement is hiermee beëindigd.')
  })

  it('bij een upgrade: de upgrade is teruggedraaid en het abonnement loopt door', () => {
    const m = getEmailTemplate('terugbetaling_bevestiging', 'Test', false, { billing: { bedragCent: 1500, upgrade: true } })
    expect(m.html).toContain('Je upgrade is hiermee teruggedraaid. Je abonnement loopt door.')
    expect(m.html).not.toContain('beëindigd')
    expect(m.html).toContain('15,00')
  })
})

describe('registratie', () => {
  it.each(['overstap_ingepland', 'opzegging_ingetrokken', 'upgrade_gelukt', 'solo_naar_team', 'upgrade_bijbetaling_mislukt'] as const)('%s staat in EMAIL_META', type => {
    expect(EMAIL_META[type]).toMatchObject({ category: 'user' })
    expect(EMAIL_META[type].label.length).toBeGreaterThan(0)
  })
})
