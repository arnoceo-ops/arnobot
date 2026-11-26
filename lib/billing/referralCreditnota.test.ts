/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// De creditnota bij een referralterugstorting, met een nagemaakte Moneybird: elke plek waar een run kan afbreken.

const h = vi.hoisted(() => ({
  db: null as any,
  facturen: [] as any[],
  mails: [] as string[],
  teller: 0,
  /** Naam van de aanroep die de eerstvolgende keer mislukt, en hoe. */
  faal: null as null | { bij: string; status: number },
  /** Het bedrag dat Moneybird teruggeeft wijkt af. */
  verschil: 0,
}))

vi.mock('./db', () => ({ billingDb: { from: (t: string) => h.db.from(t), rpc: (n: string, p: any) => h.db.rpc(n, p) } }))
vi.mock('./moneybird', async origineel => {
  const echt = await origineel<typeof import('./moneybird')>()
  const mis = (naam: string) => {
    if (h.faal?.bij !== naam) return
    const { status } = h.faal
    h.faal = null
    if (status === 0) throw new Error('timeout')
    throw new echt.MoneybirdError(status, naam)
  }
  const vind = (id: string) => h.facturen.find(f => f.id === id)
  const kopie = <T>(x: T): T => structuredClone(x)
  return {
    MoneybirdError: echt.MoneybirdError,
    creditBedragregel: echt.creditBedragregel,
    creditMailTekst: echt.creditMailTekst,
    moneybirdIngeschakeld: () => true,
    haalFactuur: async (id: string) => {
      mis('haal')
      if (!vind(id)) throw new echt.MoneybirdError(404, 'weg')
      return kopie(vind(id))
    },
    zoekFacturenOpReferentie: async (ref: string) => { mis('zoek'); return kopie(h.facturen.filter(f => f.reference === ref)) },
    maakCreditConcept: async (origineelId: string) => {
      mis('maak')
      const o = vind(origineelId)
      const nieuw = {
        id: `c${++h.teller}`, state: 'draft', reference: o.reference, original_sales_invoice_id: origineelId,
        total_price_incl_tax: `-${o.total_price_incl_tax}`, details: [{ id: 'tekst', amount: null }, { id: 'bedrag', amount: '-1' }], payments: [],
      }
      h.facturen.push(nieuw)
      return kopie(nieuw)
    },
    zetCreditBedrag: async (id: string, i: any) => {
      mis('zet')
      expect(i.regelId).toBe('bedrag')
      Object.assign(vind(id), { reference: i.referentie, total_price_incl_tax: (-(i.brutoCent + h.verschil) / 100).toFixed(2) })
      return kopie(vind(id))
    },
    verstuurFactuur: async (id: string, methode: string) => {
      mis(`verstuur-${methode}`)
      vind(id).state = 'open'
      if (methode === 'Email') h.mails.push(id)
      return { factuurnummer: '1' }
    },
    boekTerugbetaling: async (id: string, i: any) => { mis('boek'); vind(id).payments.push({ transaction_identifier: i.kenmerk }) },
  }
})

import { maakKetenDb } from './referralNepKeten'
import { creditAfboeken, creditReferentie, creditnotaStap, maakRestCreditnota, restReferentie } from './referralCreditnota'

const A = '11111111-1111-4111-8111-111111111111'
const NU = new Date('2030-01-11T10:00:00.000Z')
const REF = creditReferentie('tr_x', A)

async function zaai(opties: { klantType?: string; factuur?: string | null; actie?: Record<string, unknown> } = {}) {
  await h.db.zaai({
    arnobot_payments: [{ id: 'p1', user_id: 'u', subscription_id: 's1', mollie_payment_id: 'tr_x', moneybird_factuur_id: 'factuur' in opties ? opties.factuur : 'orig' }],
    arnobot_subscriptions: [{ id: 's1', klant_type: opties.klantType ?? 'particulier' }],
    approved_users: [{ user_id: 'u', voornaam: 'Test' }],
    arnobot_referral_acties: [{
      id: A, status: 'bevestigd', credit_status: 'nodig', credit_id: null, bezig_tot: null, fout: null, user_id: 'u', doel_id: 'p1',
      bruto_cent: 1900, mollie_refund_id: 're_1', gegevens: {}, ...opties.actie,
    }],
  })
  h.facturen = [{ id: 'orig', state: 'paid', reference: 'tr_x', original_sales_invoice_id: null, total_price_incl_tax: '228.00', details: [], payments: [] }]
}
const actie = async () => (await h.db.alle('arnobot_referral_acties'))[0]
const draai = async (na = 0) => creditnotaStap(await actie(), new Date(NU.getTime() + na))
const creditnotas = () => h.facturen.filter(f => f.original_sales_invoice_id === 'orig')

beforeEach(async () => {
  vi.stubEnv('REFERRAL_CREDITNOTA', 'true')
  vi.stubEnv('MONEYBIRD_BETALING_REGISTREREN', '')
  h.db ??= maakKetenDb()
  h.mails = []
  h.teller = 0
  h.faal = null
  h.verschil = 0
  await zaai()
})
afterEach(() => vi.unstubAllEnvs())

describe('wanneer niet', () => {
  it.each(['', 'TRUE', '1'])('schakelaar "%s" is uit', async waarde => {
    vi.stubEnv('REFERRAL_CREDITNOTA', waarde)
    expect(await draai()).toBe('uit')
    expect(creditnotas()).toHaveLength(0)
  })
  it('wacht op een echte factuur en slaat testmodus over', async () => {
    for (const factuur of [null, 'bezig']) {
      await zaai({ factuur })
      expect(await draai()).toBe('wacht-op-factuur')
    }
    await zaai({ factuur: 'testmodus' })
    expect(await draai()).toBe('geen-factuur-testmodus')
    expect((await actie()).credit_status).toBe('nvt')
  })
  it('een lopende claim wordt niet overgenomen, een verlopen claim wel', async () => {
    await zaai({ actie: { credit_status: 'bezig', bezig_tot: new Date(NU.getTime() + 60_000).toISOString() } })
    expect(await draai()).toBe('niet-geclaimd')
    expect(await draai(120_000)).toBe('klaar')
  })
})

describe('de creditnota', () => {
  it('particulier: precies het teruggestorte bedrag, eigen referentie, niet gemaild, een keer', async () => {
    expect(await draai()).toBe('klaar')
    expect(creditnotas()).toMatchObject([{ state: 'open', reference: REF, total_price_incl_tax: '-19.00', payments: [] }])
    expect(await actie()).toMatchObject({ credit_status: 'klaar', credit_id: 'c1', bezig_tot: null, fout: null })
    expect(await draai()).toBe('niet-nodig')
    expect(creditnotas()).toHaveLength(1)
    expect(h.mails).toEqual([])
  })
  it('zakelijk: een keer gemaild', async () => {
    await zaai({ klantType: 'zakelijk' })
    expect(await draai()).toBe('klaar')
    expect(h.mails).toEqual(['c1'])
  })
  it('met betalingen registreren: de terugstorting een keer op de creditnota', async () => {
    vi.stubEnv('MONEYBIRD_BETALING_REGISTREREN', 'true')
    h.faal = { bij: 'boek', status: 500 }
    expect(await draai()).toBe('mislukt')
    expect(await draai()).toBe('klaar')
    expect(creditnotas()[0].payments).toEqual([{ transaction_identifier: 're_1' }])
  })
  it('klopt het bedrag niet, dan gaat er niets de deur uit', async () => {
    h.verschil = 1
    expect(await draai()).toBe('handwerk')
    expect(creditnotas()[0].state).toBe('draft')
    expect(h.mails).toEqual([])
    expect((await actie()).credit_status).toBe('nodig')
  })
})

describe('hervatten na een afgebroken run', () => {
  it.each(['zoek', 'maak', 'zet', 'verstuur-Manual'])('mislukt bij %s: de volgende ronde maakt het af, met een creditnota', async bij => {
    h.faal = { bij, status: 500 }
    expect(await draai()).toBe('mislukt')
    expect(await draai()).toBe('klaar')
    expect(creditnotas()).toMatchObject([{ state: 'open', reference: REF, total_price_incl_tax: '-19.00' }])
  })
  it('het kenmerk niet bewaard maar de referentie staat al: teruggevonden, niet dubbel', async () => {
    await draai()
    await h.db.wijzig('arnobot_referral_acties', A, { credit_status: 'nodig', credit_id: null })
    expect(await draai()).toBe('klaar')
    expect(creditnotas()).toHaveLength(1)
  })
  it('een onbekend concept op de factuur: niets bijmaken en niets overnemen', async () => {
    h.facturen.push({ id: 'vreemd', state: 'draft', reference: 'tr_x', original_sales_invoice_id: 'orig', total_price_incl_tax: '-228.00', details: [], payments: [] })
    expect(await draai()).toBe('handwerk')
    expect(creditnotas().map(f => f.id)).toEqual(['vreemd'])
    expect((await actie()).fout).toContain('VERWIJDER het, verstuur het niet')
  })
  it('een verstuurde creditnota die niet van ons is (met de hand gemaakt): niets bijmaken, met de manier om af te boeken', async () => {
    h.facturen.push({ id: 'hand', state: 'open', reference: 'tr_x', original_sales_invoice_id: 'orig', total_price_incl_tax: '-19.00', details: [], payments: [] })
    expect(await draai()).toBe('handwerk')
    expect(creditnotas().map(f => f.id)).toEqual(['hand'])
    const { fout, credit_status } = await actie()
    expect(credit_status).toBe('nodig')
    expect(fout).toContain(creditAfboeken(A))
    expect(fout).toContain('VERWIJDER')
    expect(fout).not.toMatch(/verwijder of verstuur/i)
  })
  it('afgebroken na het aanmaken: ook nadat dat concept toch verstuurd is komt er geen tweede', async () => {
    h.facturen.push({ id: 'wees', state: 'draft', reference: 'tr_x', original_sales_invoice_id: 'orig', total_price_incl_tax: '-228.00', details: [], payments: [] })
    expect(await draai()).toBe('handwerk')
    h.facturen.find(f => f.id === 'wees').state = 'open'
    expect(await draai()).toBe('handwerk')
    expect(creditnotas()).toHaveLength(1)
  })
  it('bij hervatten van een eigen concept wordt opnieuw gekeken: intussen met de hand gemaakt is niet versturen', async () => {
    h.faal = { bij: 'zet', status: 500 }
    expect(await draai()).toBe('mislukt')
    h.facturen.push({ id: 'hand', state: 'open', reference: 'tr_x', original_sales_invoice_id: 'orig', total_price_incl_tax: '-19.00', details: [], payments: [] })
    expect(await draai()).toBe('handwerk')
    expect(creditnotas().find(f => f.id === 'c1').state).toBe('draft')
  })
  it('het onafgemaakte concept van een andere actie op dezelfde betaling staat niet in de weg', async () => {
    await h.db.voegToe('arnobot_referral_acties', { id: 'andere', doel_id: 'p1', credit_id: 'vanAndere' })
    h.facturen.push({ id: 'vanAndere', state: 'draft', reference: 'tr_x', original_sales_invoice_id: 'orig', total_price_incl_tax: '-228.00', details: [], payments: [] })
    expect(await draai()).toBe('klaar')
  })
  it('een verwijderd concept met bewaard kenmerk wordt opnieuw gemaakt', async () => {
    h.faal = { bij: 'zet', status: 500 }
    await draai()
    h.facturen = h.facturen.filter(f => f.id !== 'c1')
    expect(await draai()).toBe('klaar')
    expect(creditnotas()).toMatchObject([{ id: 'c2', total_price_incl_tax: '-19.00' }])
  })
  it('ongedaan voordat de creditnota er was: ons deel wordt alsnog gecrediteerd', async () => {
    await zaai({ actie: { status: 'ongedaan' } })
    expect(await draai()).toBe('klaar')
    expect(creditnotas()).toMatchObject([{ total_price_incl_tax: '-19.00' }])
  })
  it('mail: een duidelijke weigering wordt opnieuw geprobeerd', async () => {
    await zaai({ klantType: 'zakelijk' })
    h.faal = { bij: 'verstuur-Email', status: 422 }
    expect(await draai()).toBe('mislukt')
    expect(await draai()).toBe('klaar')
    expect(h.mails).toEqual(['c1'])
  })
  it('mail met onbekende uitkomst: niet nog eens versturen, wel vragen', async () => {
    await zaai({ klantType: 'zakelijk' })
    h.faal = { bij: 'verstuur-Email', status: 0 }
    expect(await draai()).toBe('handwerk')
    expect((await actie()).fout).toContain('gemaild')
    // De uitkomst was onbekend: hier is zij toch aangekomen. Geen tweede mail en nooit vanzelf klaar.
    h.facturen.find(f => f.id === 'c1').state = 'open'
    for (let ronde = 0; ronde < 3; ronde++) expect(await draai()).toBe('handwerk')
    expect(await actie()).toMatchObject({ credit_status: 'nodig' })
    expect((await actie()).fout).toContain(creditAfboeken(A))
    expect(h.mails).toEqual([])
  })
  it('mail met onbekende uitkomst terwijl de creditnota nog concept is: zeker niet verstuurd, dus opnieuw', async () => {
    await zaai({ klantType: 'zakelijk' })
    h.faal = { bij: 'verstuur-Email', status: 0 }
    expect(await draai()).toBe('handwerk')
    expect(await draai()).toBe('klaar')
    expect(h.mails).toEqual(['c1'])
  })
  it('gestopt tussen vastleggen en mailen, creditnota al open: vragen, niet stil klaar', async () => {
    await zaai({ klantType: 'zakelijk', actie: { credit_status: 'bezig', credit_id: 'c9', gegevens: { credit_mail_at: NU.toISOString() } } })
    h.facturen.push({ id: 'c9', state: 'open', reference: REF, original_sales_invoice_id: 'orig', total_price_incl_tax: '-19.00', details: [], payments: [] })
    expect(await draai()).toBe('handwerk')
    expect(h.mails).toEqual([])
  })
  it('wie een oude rij heeft mailt niet nog eens', async () => {
    await zaai({ klantType: 'zakelijk' })
    const oud = await actie()
    h.faal = { bij: 'verstuur-Email', status: 0 }
    await draai()
    h.facturen.find(f => f.id === 'c1').state = 'open'
    // De tweede run las de actie voor de eerste: zonder credit_id en zonder mailvlag.
    expect(await creditnotaStap(oud, NU)).toBe('handwerk')
    expect(h.mails).toEqual([])
    expect(creditnotas()).toHaveLength(1)
  })
})

describe('creditnota voor het restant bij een volledige terugbetaling', () => {
  const rest = (extra: Partial<Parameters<typeof maakRestCreditnota>[0]> = {}) =>
    maakRestCreditnota({ factuurId: 'orig', betaalkenmerk: 'tr_x', brutoCent: 20900, zakelijk: false, nu: NU, ...extra })

  it('precies het restant, eigen referentie, en een tweede aanroep maakt niets bij', async () => {
    await rest()
    await rest()
    expect(creditnotas()).toMatchObject([{ state: 'open', reference: restReferentie('tr_x'), total_price_incl_tax: '-209.00' }])
    expect(creditnotas()).toHaveLength(1)
    expect(h.mails).toEqual([])
  })
  it('naast de creditnota van de uitkering zelf', async () => {
    await draai()
    await rest()
    expect(creditnotas().map(f => f.total_price_incl_tax).sort()).toEqual(['-19.00', '-209.00'])
  })
  it('afgebroken bij het zetten van het bedrag: niet dubbel, een mens kijkt', async () => {
    h.faal = { bij: 'zet', status: 500 }
    await expect(rest()).rejects.toThrow()
    await expect(rest()).rejects.toThrow('al een creditnota')
    expect(creditnotas()).toHaveLength(1)
  })
  it('een onbekende creditnota op de factuur: niets maken', async () => {
    h.facturen.push({ id: 'hand', state: 'open', reference: 'tr_x', original_sales_invoice_id: 'orig', total_price_incl_tax: '-228.00', details: [], payments: [] })
    await expect(rest()).rejects.toThrow('al een creditnota')
    expect(creditnotas()).toHaveLength(1)
  })
  it('zakelijk wordt een keer gemaild', async () => {
    await rest({ zakelijk: true })
    await rest({ zakelijk: true })
    expect(h.mails).toHaveLength(1)
  })
})
