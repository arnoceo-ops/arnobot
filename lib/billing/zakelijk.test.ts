import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { valideerZakelijk } from './zakelijk'

// De regels voor zakelijke gegevens bij afrekenen en bij het activeren van een Team. VIES wordt niet
// aangeroepen: in testmodus (test_-sleutel) slaat de validatie die controle over.

const geldig = { bedrijfsnaam: 'Voorbeeld BV', kvk: '12345678', btwNummer: 'NL123456789B01', straat: 'Kerkstraat 1', postcode: '1234 ab', plaats: 'Utrecht' }
let oudeSleutel: string | undefined

beforeEach(() => { oudeSleutel = process.env.MOLLIE_API_KEY; process.env.MOLLIE_API_KEY = 'test_abc' })
afterEach(() => { if (oudeSleutel === undefined) delete process.env.MOLLIE_API_KEY; else process.env.MOLLIE_API_KEY = oudeSleutel })

describe('valideerZakelijk', () => {
  it('accepteert geldige gegevens en normaliseert postcode en btw-nummer', async () => {
    const r = await valideerZakelijk({ ...geldig, btwNummer: 'nl 1234.56.789 b01' })
    expect(r).toEqual({ ok: true, gegevens: { bedrijfsnaam: 'Voorbeeld BV', kvk: '12345678', btw: 'NL123456789B01', btwGevalideerd: false, straat: 'Kerkstraat 1', postcode: '1234 AB', plaats: 'Utrecht' } })
  })

  it.each([
    ['bedrijfsnaam', { bedrijfsnaam: ' ' }, 'bedrijfsnaam'],
    ['KvK met 7 cijfers', { kvk: '1234567' }, 'KvK'],
    ['Belgisch btw-nummer', { btwNummer: 'BE0123456789' }, 'Belgisch'],
    ['buitenlands btw-nummer', { btwNummer: 'DE123456789' }, 'Nederlands BTW-nummer'],
    ['ontbrekend btw-nummer', { btwNummer: '' }, 'Nederlands BTW-nummer'],
    ['te korte straat', { straat: 'ab' }, 'straat'],
    ['ongeldige postcode', { postcode: '0123 AB' }, 'postcode'],
    ['ontbrekende plaats', { plaats: '' }, 'plaats'],
  ])('weigert %s', async (_naam, afwijking, woord) => {
    const r = await valideerZakelijk({ ...geldig, ...afwijking })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.fout.toLowerCase()).toContain(woord.toLowerCase())
  })

  it('weigert niet-tekstwaarden zonder te crashen', async () => {
    const r = await valideerZakelijk({ bedrijfsnaam: 42, kvk: null, btwNummer: undefined, straat: {}, postcode: [], plaats: false })
    expect(r.ok).toBe(false)
  })
})
