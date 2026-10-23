import { describe, expect, it } from 'vitest'
import { beslisZonderToegang, datumToegang, HERSTEL_STANDAARD, isHerstelPad } from './toegang'

const nu = new Date('2026-10-23T10:00:00Z')
const dagen = (n: number) => new Date(nu.getTime() + n * 24 * 60 * 60 * 1000).toISOString()

describe('datumToegang', () => {
  it('geeft toegang tijdens de trial van 30 dagen', () => {
    expect(datumToegang({ trial_start: dagen(-29) }, nu)).toBe(true)
  })
  it('sluit na 30 dagen trial uit', () => {
    expect(datumToegang({ trial_start: dagen(-31) }, nu)).toBe(false)
  })
  it('wie op doorgaan klikte houdt 5 dagen uitloop na de trial', () => {
    const klik = { renewal_requested_at: dagen(-8) }
    expect(datumToegang({ trial_start: dagen(-31), ...klik }, nu)).toBe(true)
    expect(datumToegang({ trial_start: dagen(-34.9), ...klik }, nu)).toBe(true)
  })
  it('na die 5 dagen uitloop is de toegang dicht, ook zonder betaling', () => {
    expect(datumToegang({ trial_start: dagen(-35.1), renewal_requested_at: dagen(-8) }, nu)).toBe(false)
  })
  it('zonder doorgaan-klik geen uitloop', () => {
    expect(datumToegang({ trial_start: dagen(-30.1), renewal_requested_at: null }, nu)).toBe(false)
  })
  it('de uitloop verlengt een betaalde of gezette einddatum niet', () => {
    expect(datumToegang({ expires_at: dagen(-1), trial_start: dagen(-100), renewal_requested_at: dagen(-90) }, nu)).toBe(false)
  })
  it('geeft toegang tot een toekomstige expires_at', () => {
    expect(datumToegang({ expires_at: dagen(5), trial_start: dagen(-100) }, nu)).toBe(true)
  })
  it('een verstreken expires_at is bindend, ook bij paid_at', () => {
    expect(datumToegang({ expires_at: dagen(-1), paid_at: dagen(-50) }, nu)).toBe(false)
  })
  it('paid_at zonder expires_at is onbeperkte toegang', () => {
    expect(datumToegang({ paid_at: dagen(-400), trial_start: dagen(-400) }, nu)).toBe(true)
  })
  it('zonder datums geen toegang', () => {
    expect(datumToegang({}, nu)).toBe(false)
  })
  it('een ongeldige datum geeft geen toegang', () => {
    expect(datumToegang({ expires_at: 'geen-datum' }, nu)).toBe(false)
    expect(datumToegang({ trial_start: 'geen-datum' }, nu)).toBe(false)
  })
})

describe('beslisZonderToegang', () => {
  it('stuurt /bot naar afrekenen in plaats van /sign-in', () => {
    expect(beslisZonderToegang('/bot')).toEqual({ actie: 'redirect', naar: '/bot/doorgaan' })
  })
  it('laat de herstelpagina\'s door', () => {
    expect(beslisZonderToegang('/bot/doorgaan')).toEqual({ actie: 'door' })
    expect(beslisZonderToegang('/bot/herstart')).toEqual({ actie: 'door' })
    expect(beslisZonderToegang('/bot/account')).toEqual({ actie: 'door' })
    expect(beslisZonderToegang('/bot/account/data')).toEqual({ actie: 'door' })
  })
  it('stuurt andere pagina\'s naar afrekenen', () => {
    for (const p of ['/bot/coaching', '/bot/analyses', '/bot/team', '/bot/profiel']) {
      expect(beslisZonderToegang(p)).toEqual({ actie: 'redirect', naar: '/bot/doorgaan' })
    }
  })
  it('herkent geen pad met alleen dezelfde beginletters', () => {
    expect(isHerstelPad('/bot/doorgaanx')).toBe(false)
    expect(isHerstelPad('/bot/accountfoo')).toBe(false)
  })
  it('geeft nooit een redirect naar een pagina die zelf weer doorverwijst (geen loop)', () => {
    const doel = beslisZonderToegang('/bot')
    expect(doel.actie).toBe('redirect')
    expect(isHerstelPad(HERSTEL_STANDAARD)).toBe(true)
    expect(beslisZonderToegang(HERSTEL_STANDAARD)).toEqual({ actie: 'door' })
  })
})
