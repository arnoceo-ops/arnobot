import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MANUAL_TEST_USER_ID } from '@/lib/internalTestAccounts'

const h = vi.hoisted(() => ({
  sub: null as unknown,
  betalingen: [] as unknown[],
  mollieAan: true,
  betaalTerug: vi.fn(),
  markeer: vi.fn(),
  verwerk: vi.fn(),
  mail: vi.fn(),
  log: vi.fn(),
  tg: vi.fn(),
}))

vi.mock('./db', () => {
  const keten = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const q: any = {
      select: () => q, eq: () => q, in: () => q, order: () => q, limit: () => q,
      maybeSingle: async () => ({ data: h.sub }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      then: (res: any) => res({ data: h.betalingen }),
    }
    return q
  }
  return { billingDb: { from: () => keten() } }
})
vi.mock('./mollie', () => ({ betaalTerug: h.betaalTerug, mollieIngeschakeld: () => h.mollieAan }))
vi.mock('./verwerking', () => ({ markeerTerugbetaald: h.markeer, verwerkMolliebetaling: h.verwerk }))
vi.mock('./mails', () => ({ verstuurBillingMail: h.mail }))
vi.mock('@/lib/adminLog', () => ({ logAdminActie: h.log }))
vi.mock('@/lib/cron-notify', () => ({ notifyTelegram: h.tg }))

import {
  herroepingBeschikbaarVoor, isBinnenBedenktijd, isProefmodus, kiesHerroepbareBetaling, laatsteDagBedenktijd, voerHerroepingUit,
} from './herroeping'
import type { PayRow } from './db'

const nu = new Date('2026-11-10T12:00:00Z')
const pay = (o: Partial<PayRow> = {}): PayRow => ({
  id: 'p1', user_id: 'user_x', subscription_id: 's1', mollie_payment_id: 'tr_1', soort: 'eerste', status: 'paid',
  bedrag_cent: 7700, btw_cent: 1336, terugbetaald_cent: 0, teruggeboekt_cent: 0, betaald_at: '2026-11-05T10:00:00Z',
  verwerkt_at: null, terugbetaling_verwerkt_at: null, moneybird_factuur_id: null, ...o,
})
const sub = (o: Record<string, unknown> = {}) => ({ id: 's1', klant_type: 'particulier', bedrag_cent: 7700, status: 'active', ...o })

beforeEach(() => {
  h.sub = sub()
  h.betalingen = []
  h.mollieAan = true
  vi.clearAllMocks()
  h.betaalTerug.mockResolvedValue({ id: 're_1' })
})

describe('bedenktijd van 14 dagen', () => {
  it('loopt tot en met de 14e kalenderdag in Amsterdamse tijd', () => {
    expect(laatsteDagBedenktijd('2026-11-01T10:00:00Z')).toBe('2026-11-15')
    expect(isBinnenBedenktijd('2026-11-01T10:00:00Z', new Date('2026-11-15T22:30:00Z'))).toBe(true)
    expect(isBinnenBedenktijd('2026-11-01T10:00:00Z', new Date('2026-11-15T23:30:00Z'))).toBe(false)
  })
  it('telt een betaling laat op de avond mee voor de Amsterdamse dag, niet de UTC-dag', () => {
    expect(laatsteDagBedenktijd('2026-11-01T23:30:00Z')).toBe('2026-11-16')
  })
})

describe('kiesHerroepbareBetaling', () => {
  it('kiest de upgrade vóór de eerste betaling', () => {
    const eerste = pay({ id: 'e', soort: 'eerste', betaald_at: '2026-11-02T10:00:00Z' })
    const upgrade = pay({ id: 'u', soort: 'upgrade', betaald_at: '2026-11-08T10:00:00Z', bedrag_cent: 2000 })
    expect(kiesHerroepbareBetaling([eerste, upgrade], nu)?.id).toBe('u')
    expect(kiesHerroepbareBetaling([eerste], nu)?.id).toBe('e')
  })
  it('slaat herhaalbetalingen, terugbetaalde, onbetaalde en te oude betalingen over', () => {
    expect(kiesHerroepbareBetaling([pay({ soort: 'herhaling' })], nu)).toBeNull()
    expect(kiesHerroepbareBetaling([pay({ soort: 'verlenging' })], nu)).toBeNull()
    expect(kiesHerroepbareBetaling([pay({ terugbetaald_cent: 7700 })], nu)).toBeNull()
    expect(kiesHerroepbareBetaling([pay({ status: 'open' })], nu)).toBeNull()
    expect(kiesHerroepbareBetaling([pay({ betaald_at: '2026-10-01T10:00:00Z' })], nu)).toBeNull()
    expect(kiesHerroepbareBetaling([pay({ betaald_at: null })], nu)).toBeNull()
  })
})

describe('wie de knop ziet', () => {
  it('alleen de interne testaccounts, tot HERROEPING_OPEN=true', () => {
    vi.stubEnv('HERROEPING_OPEN', '')
    expect(herroepingBeschikbaarVoor('user_gewoon')).toBe(false)
    expect(herroepingBeschikbaarVoor(MANUAL_TEST_USER_ID)).toBe(true)
    vi.stubEnv('HERROEPING_OPEN', 'true')
    expect(herroepingBeschikbaarVoor('user_gewoon')).toBe(true)
    vi.unstubAllEnvs()
  })
  it('de eigenaar ziet de knop in proefmodus zolang hij niet openstaat, daarna is de eigenaar een gewone klant', () => {
    vi.stubEnv('ARNOBOT_OWNER_USER_ID', 'user_eigenaar')
    vi.stubEnv('HERROEPING_OPEN', '')
    expect(herroepingBeschikbaarVoor('user_eigenaar')).toBe(true)
    expect(isProefmodus('user_eigenaar')).toBe(true)
    vi.stubEnv('HERROEPING_OPEN', 'true')
    expect(isProefmodus('user_eigenaar')).toBe(false)
    vi.unstubAllEnvs()
  })
})

describe('voerHerroepingUit', () => {
  it('geeft 404 en doet niets als er niets te herroepen valt', async () => {
    const r = await voerHerroepingUit('user_gewoon', nu)
    expect(r).toMatchObject({ ok: false, status: 404 })
    expect(h.betaalTerug).not.toHaveBeenCalled()
  })

  it('betaalt een eerste betaling volledig terug via dezelfde route als de adminknop', async () => {
    h.betalingen = [pay()]
    const r = await voerHerroepingUit('user_gewoon', nu)
    expect(r).toEqual({ ok: true, soort: 'eerste', bedragCent: 7700, proef: false })
    expect(h.betaalTerug).toHaveBeenCalledWith(expect.objectContaining({ betalingId: 'tr_1', brutoCent: 7700, idempotencyKey: 'herroeping-p1' }))
    expect(h.markeer).toHaveBeenCalledWith('p1')
    expect(h.verwerk).toHaveBeenCalledWith('tr_1')
    expect(h.log).toHaveBeenCalledWith(expect.objectContaining({ actie: 'herroeping', doelUserId: 'user_gewoon' }))
  })

  it('draait bij een upgrade alleen de upgrade terug', async () => {
    h.betalingen = [pay({ id: 'e', mollie_payment_id: 'tr_e', betaald_at: '2026-11-02T10:00:00Z' }), pay({ id: 'u', mollie_payment_id: 'tr_u', soort: 'upgrade', bedrag_cent: 2000, betaald_at: '2026-11-08T10:00:00Z' })]
    const r = await voerHerroepingUit('user_gewoon', nu)
    expect(r).toMatchObject({ ok: true, soort: 'upgrade', bedragCent: 2000 })
    expect(h.betaalTerug).toHaveBeenCalledWith(expect.objectContaining({ betalingId: 'tr_u', brutoCent: 2000 }))
  })

  it('geldt niet voor zakelijke klanten', async () => {
    h.sub = sub({ klant_type: 'zakelijk' })
    h.betalingen = [pay()]
    const r = await voerHerroepingUit('user_gewoon', nu)
    expect(r).toMatchObject({ ok: false, status: 404 })
    expect(h.betaalTerug).not.toHaveBeenCalled()
  })

  it('geeft 503 en betaalt niets terug als Mollie niet is ingeschakeld', async () => {
    h.mollieAan = false
    h.betalingen = [pay()]
    const r = await voerHerroepingUit('user_gewoon', nu)
    expect(r).toMatchObject({ ok: false, status: 503 })
    expect(h.betaalTerug).not.toHaveBeenCalled()
  })

  it('proefmodus voor een testaccount: mail, adminlog en Telegram, maar niets naar Mollie', async () => {
    h.sub = null
    const r = await voerHerroepingUit(MANUAL_TEST_USER_ID, nu)
    expect(r).toEqual({ ok: true, soort: 'eerste', bedragCent: 7700, proef: true })
    expect(h.betaalTerug).not.toHaveBeenCalled()
    expect(h.markeer).not.toHaveBeenCalled()
    expect(h.verwerk).not.toHaveBeenCalled()
    expect(h.mail).toHaveBeenCalledWith(MANUAL_TEST_USER_ID, 'terugbetaling_bevestiging', { bedragCent: 7700, upgrade: false })
    expect(h.log).toHaveBeenCalledWith(expect.objectContaining({ actie: 'herroeping', details: { extra: expect.objectContaining({ proef: true }) } }))
    expect(h.tg).toHaveBeenCalledWith(expect.stringContaining('PROEF'))
    expect(h.tg).toHaveBeenCalledWith(expect.stringContaining('€77,00'))
  })

  it('proefmodus blijft proefmodus, ook als het testaccount een echte betaling heeft', async () => {
    h.betalingen = [pay()]
    const r = await voerHerroepingUit(MANUAL_TEST_USER_ID, nu)
    expect(r).toMatchObject({ ok: true, proef: true })
    expect(h.betaalTerug).not.toHaveBeenCalled()
  })
})
