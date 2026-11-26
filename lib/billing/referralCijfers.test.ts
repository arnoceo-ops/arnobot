import { beforeEach, describe, expect, it, vi } from 'vitest'

// De tellers BETALEND en TEGOED in het referralblok op de accountpagina.
// Een onderliggend bestand maakt bij het laden meteen een databaseclient; er wordt niets mee verbonden.
vi.hoisted(() => { process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'http://localhost'; process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'test' })

const h = vi.hoisted(() => ({
  referrals: [] as { referred_user_id: string; status: string }[],
  grootboek: [] as Record<string, unknown>[],
  dossiers: {} as Record<string, unknown>,
  fout: null as null | 'referrals' | 'grootboek',
}))

vi.mock('./db', () => ({
  billingDb: {
    from: (tabel: string) => {
      const welke = tabel === 'arnobot_referrals' ? 'referrals' : 'grootboek'
      const antwoord = () => h.fout === welke ? { data: null, error: { message: 'weg' } } : { data: h[welke], error: null }
      const keten = { select: () => keten, eq: () => keten, limit: async () => antwoord() }
      return keten
    },
  },
}))

vi.mock('./referralGrootboek', async importOriginal => ({
  ...(await importOriginal<typeof import('./referralGrootboek')>()),
  laadDossier: async (id: string) => {
    if (h.dossiers[id] === 'stuk') throw new Error('weg')
    return h.dossiers[id] ?? null
  },
}))

import { referralCijfers } from './referralCijfers'

const dossier = (extra: Record<string, unknown> = {}) => ({
  gebruiker: {}, betalingen: [], teams: [], facturen: [], ooitMetDeHandBetaald: false, ...extra,
})
const betaling = (extra: Record<string, unknown> = {}) => ({ status: 'paid', bedrag_cent: 5900, teruggeboekt_cent: 0, terugbetaald_cent: 0, ...extra })
const regel = (soort: string, referral_id: string, netto_cent: number, meeloop = true) => ({ soort, referral_id, netto_cent, meeloop, created_at: '2027-01-01T00:00:00Z' })

beforeEach(() => { h.referrals = []; h.grootboek = []; h.dossiers = {}; h.fout = null })

describe('referralCijfers', () => {
  const een = async (d: unknown, status = 'signed_up') => {
    h.referrals = [{ referred_user_id: 'k', status }]
    h.dossiers = { k: d }
    return (await referralCijfers('a')).betalend
  }

  it('zonder referrals: twee keer nul', async () => expect(await referralCijfers('a')).toEqual({ betalend: 0, tegoedCent: 0 }))
  it('een online betaling telt, ook Basic zonder converted', async () => expect(await een(dossier({ betalingen: [betaling({ plan: 'basis' })] }))).toBe(1))
  it('een betaald team telt', async () => {
    expect(await een(dossier({ teams: [{ id: 't' }], facturen: [{ team_id: 't', status: 'paid' }] }))).toBe(1)
  })
  it('met de hand op BETAALD telt', async () => expect(await een(dossier({ gebruiker: { paid_at: '2027-01-01' }, ooitMetDeHandBetaald: true }))).toBe(1))
  it('met de hand geconverteerd zonder betaalrijen telt', async () => expect(await een(dossier(), 'converted')).toBe(1))
  it('alleen aangemeld telt niet', async () => expect(await een(dossier())).toBe(0))
  it('een teruggedraaide of volledig terugbetaalde betaling telt niet, ook al staat er converted', async () => {
    expect(await een(dossier({ betalingen: [betaling({ teruggeboekt_cent: 5900 })] }), 'converted')).toBe(0)
    expect(await een(dossier({ betalingen: [betaling({ terugbetaald_cent: 5900 })] }), 'converted')).toBe(0)
  })
  it('een mislukte betaling telt niet', async () => expect(await een(dossier({ betalingen: [betaling({ status: 'failed' })] }))).toBe(0))
  it('een gratis account op BETAALD telt niet', async () => {
    expect(await een(dossier({ gebruiker: { paid_at: '2027-01-01', gratis_sinds: '2027-01-02' }, ooitMetDeHandBetaald: true }), 'converted')).toBe(0)
  })
  it('een verwijderd account telt niet', async () => expect(await een(null, 'converted')).toBe(0))

  it('tegoed komt uit het grootboek, in centen, zonder wat vervallen is', async () => {
    h.grootboek = [regel('toekenning', 'r1', 1900), regel('toekenning', 'r2', 1815), regel('verval', 'r2', -1815)]
    expect((await referralCijfers('a')).tegoedCent).toBe(1900)
  })
  it('zolang het grootboek meeloopt tellen echte hulpregels de stand niet weg', async () => {
    h.grootboek = [regel('toekenning', 'r1', 1900), regel('handwerk', 'r1', 0, false)]
    expect((await referralCijfers('a')).tegoedCent).toBe(1900)
  })

  it('lukt rekenen niet, dan geen cijfer in plaats van een nul die niet klopt', async () => {
    h.fout = 'grootboek'
    expect(await referralCijfers('a')).toEqual({ betalend: 0, tegoedCent: null })
    h.fout = 'referrals'
    expect(await referralCijfers('a')).toEqual({ betalend: null, tegoedCent: 0 })
    h.fout = null
    h.referrals = [{ referred_user_id: 'k', status: 'signed_up' }]
    h.dossiers = { k: 'stuk' }
    expect((await referralCijfers('a')).betalend).toBeNull()
  })
})
