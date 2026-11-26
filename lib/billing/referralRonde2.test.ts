/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Ronde 2 van de referralcontrole: overlappende maanden (E5), de laatste dag van de termijn, tellen van teamleden (E4),
// het opdelen van de Telegrammelding en de gegevensexport.

const h = vi.hoisted(() => ({ antwoord: { data: [] as any[], error: null as null | { message: string } }, vragen: [] as any[] }))
const maakDb = vi.hoisted(() => () => ({
  from(tabel: string) {
    const vraag: any = { tabel, kolommen: '', filters: [] }
    h.vragen.push(vraag)
    const q: any = {
      select: (k: string) => { vraag.kolommen = k; return q },
      eq: (k: string, v: unknown) => { vraag.filters.push([k, v]); return q },
      order: () => q, limit: () => q, returns: () => q,
      then: (res: any, rej: any) => Promise.resolve(h.antwoord).then(res, rej),
    }
    return q
  },
}))
vi.mock('./db', () => ({ billingDb: maakDb() }))
vi.mock('@/lib/teamOpzegging', () => ({ ontblokkeerNaBetaling: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))

import { gratisVierdeMaand, kwalificatie, tegoedStatus, telMaanden, tijdigMomentTeam, vervallenNaAanmelding, type AanbrengerHistorie, type BetaaldePeriode } from './referralRegels'
import { maandReeks } from './referralSignalen'
import { splitsBericht } from './berichtDelen'
import { exporteerGrootboek } from './referralExport'
import { huidigSeats } from './teamFacturatie'

const maand = (start: string, einde: string): BetaaldePeriode => ({
  plan: 'premium', cyclus: 'maandelijks', klantType: 'particulier', periodeStart: `${start}T10:00:00Z`, periodeEinde: `${einde}T10:00:00Z`,
  betaaldAt: `${start}T10:00:00Z`, geldig: true, maandNettoCent: 4876,
})
const NU = new Date('2027-08-01T00:00:00Z')

beforeEach(() => { h.antwoord = { data: [], error: null }; h.vragen = [] })

describe('E5 overlappende periodes', () => {
  const jan = maand('2027-01-01', '2027-02-01')
  const feb = maand('2027-02-01', '2027-03-01')
  const mrt = maand('2027-03-01', '2027-04-01')
  it('drie betalingen voor dezelfde maand zijn een maand', () => {
    expect(kwalificatie([jan, { ...jan }, { ...jan }], NU)).toBeNull()
    expect(telMaanden([jan, { ...jan }, { ...jan }]).map(m => m.reeks)).toEqual([1, 1, 1])
  })
  it('halverwege opnieuw afgesloten telt niet extra, daarna tellen de volgende maanden weer gewoon', () => {
    const opnieuw = maand('2027-01-20', '2027-02-20')
    expect(kwalificatie([jan, opnieuw, maand('2027-02-20', '2027-03-20')], NU)).toBeNull()
    expect(kwalificatie([jan, opnieuw, maand('2027-02-20', '2027-03-20'), maand('2027-03-20', '2027-04-20')], NU)?.periode.periodeStart).toBe('2027-03-20T10:00:00Z')
  })
  it('aansluitende maanden blijven tellen', () => {
    expect(kwalificatie([jan, feb, mrt], NU)?.periode).toBe(mrt)
  })
  it('de gratis vierde maand en het signaal tellen op dezelfde manier', () => {
    expect(gratisVierdeMaand([jan, { ...jan }, feb, mrt])).toBeNull()
    const rij = (p: BetaaldePeriode) => ({ status: 'paid', cyclus: 'maandelijks', periode_start: p.periodeStart, periode_einde: p.periodeEinde, teruggeboekt_cent: 0, terugbetaald_cent: 0, bedrag_cent: 5900, terugbetaling_verwerkt_at: null }) as any
    expect(maandReeks([jan, { ...jan }, feb].map(rij))).toEqual({ reeks: 2, eerderGehaald: false })
    // Een dubbele betaling na de derde maand geeft niet nog eens hetzelfde signaal.
    expect(maandReeks([jan, feb, mrt, { ...mrt }].map(rij))).toEqual({ reeks: 3, eerderGehaald: true })
  })
})

describe('laatste dag van de termijn', () => {
  const stand = { loopt: false, laatsteEindeAt: null, eersteBetalingUiterlijkAt: '2027-07-01T08:00:00Z' }
  it('de hele dag telt nog, in Amsterdamse tijd, net als bij de klant', () => {
    expect(tegoedStatus(stand, new Date('2027-07-01T21:00:00Z'))).toBe('wacht')
    expect(tegoedStatus(stand, new Date('2027-07-01T22:30:00Z'))).toBe('vervallen')
  })
  it('een eerste abonnement later op de laatste dag is op tijd', () => {
    const historie: AanbrengerHistorie = { dekking: [{ start: '2027-07-01T20:00:00Z', einde: null, team: false }], eersteUiterlijk: { solo: '2027-07-01T08:00:00Z', team: null } }
    expect(vervallenNaAanmelding(historie, '2027-06-01T00:00:00Z', NU)).toBe(false)
  })
})

describe('besluit 1: het moment dat telt bij een teamfactuur', () => {
  it('binnen 14 dagen betaald: de aanmaakdag, daarna de betaaldag', () => {
    expect(tijdigMomentTeam('2027-02-09T06:00:00Z', '2027-02-23T20:00:00Z')).toBe('2027-02-09T06:00:00Z')
    expect(tijdigMomentTeam('2027-02-09T06:00:00Z', '2027-02-24T08:00:00Z')).toBe('2027-02-24T08:00:00Z')
  })
  it('zonder aanmaakdag, of betaald met een eerdere datum: de betaaldag', () => {
    expect(tijdigMomentTeam(null, '2027-02-01T08:00:00Z')).toBe('2027-02-01T08:00:00Z')
    expect(tijdigMomentTeam('2027-02-09T06:00:00Z', '2027-02-01T12:00:00Z')).toBe('2027-02-01T12:00:00Z')
  })
})

describe('E4 teamleden tellen', () => {
  it('een databasefout wordt niet stil het minimum', async () => {
    h.antwoord = { data: null as any, error: { message: 'time-out' } }
    await expect(huidigSeats('t1', 3)).rejects.toThrow('time-out')
  })
  it('nooit onder het minimum', async () => {
    h.antwoord = { data: [{ user_id: 'user_a' }], error: null }
    expect(await huidigSeats('t1', 3)).toBe(3)
  })
})

describe('Telegrammelding', () => {
  it('verdeelt een lange melding zonder iets weg te laten', () => {
    const alineas = Array.from({ length: 60 }, (_, i) => `regel ${i} ${'x'.repeat(200)}`)
    const delen = splitsBericht('kop', alineas, 'voet')
    expect(delen.length).toBeGreaterThan(1)
    for (const d of delen) expect(d.length).toBeLessThanOrEqual(3900)
    for (let i = 0; i < 60; i++) expect(delen.some(d => d.includes(`regel ${i} `))).toBe(true)
    expect(delen.at(-1)!.endsWith('voet')).toBe(true)
  })
  it('kort een te lange alinea in', () => {
    const [deel] = splitsBericht('kop', ['y'.repeat(9000)], 'voet')
    expect(deel.length).toBeLessThanOrEqual(3900)
  })
})

describe('gegevensexport', () => {
  const rij = { created_at: '2027-01-01', soort: 'toekenning', netto_cent: 1900, meeloop: true }
  it('vraagt niets over de andere persoon op en filtert op de eigen gebruiker', async () => {
    h.antwoord = { data: [rij], error: null }
    const uit = await exporteerGrootboek(maakDb() as any, 'ik')
    expect(h.vragen.map(v => v.filters[0])).toEqual([['aanbrenger_user_id', 'ik'], ['klant_user_id', 'ik']])
    for (const v of h.vragen) expect(v.kolommen).toBe('created_at, soort, netto_cent, meeloop')
    expect(uit.als_nieuwe_gebruiker).toEqual([{ created_at: '2027-01-01', soort: 'toekenning', meeloop: true }])
  })
  it('zonder de tabel een lege lijst, bij een andere fout geen stille lege export', async () => {
    h.antwoord = { data: null as any, error: { message: 'relation "arnobot_referral_grootboek" does not exist' } }
    expect((await exporteerGrootboek(maakDb() as any, 'ik')).als_aanbrenger).toEqual([])
    h.antwoord = { data: null as any, error: { message: 'time-out' } }
    await expect(exporteerGrootboek(maakDb() as any, 'ik')).rejects.toThrow('time-out')
  })
})
