import { describe, expect, it } from 'vitest'
import { DEFAULT_INPUTS, computeScenarioKosten, resendOverageUsd, TARIEVEN } from './kostenTarieven'

describe('Resend in Abacus', () => {
  it('geen overschrijding onder de 50.000 inbegrepen mails', () => {
    expect(resendOverageUsd(8000, 6, true)).toBe(0)
  })

  it('rekent boven de 50.000 mails $0,90 per 1.000', () => {
    // 10.000 gebruikers x 6 mails = 60.000, overschot 10.000 = 10 x $0,90
    expect(resendOverageUsd(10000, 6, true)).toBeCloseTo(9, 5)
  })

  it('zonder Pro geen overschrijding: het gratis plan weigert mails', () => {
    expect(resendOverageUsd(1_000_000, 6, false)).toBe(0)
  })

  it('Pro telt als vaste maandpost mee wanneer actief', () => {
    expect(TARIEVEN.resendProUsd).toBe(20)
    const met = computeScenarioKosten({ ...DEFAULT_INPUTS, resendPro: true }, 10, 10)
    const zonder = computeScenarioKosten({ ...DEFAULT_INPUTS, resendPro: false }, 10, 10)
    expect(met.vastKosten - zonder.vastKosten).toBeCloseTo(TARIEVEN.resendProUsd, 5)
  })
})
