import { beforeEach, describe, expect, it, vi } from 'vitest'

// De tellers BETALEND en TEGOED in het referralblok op de accountpagina.
// Een onderliggend bestand maakt bij het laden meteen een databaseclient; er wordt niets mee verbonden.
vi.hoisted(() => { process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'http://localhost'; process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'test' })

const h = vi.hoisted(() => ({ tabellen: {} as Record<string, Record<string, unknown>[]>, stuk: '', vragen: 0 }))

// Nepdatabase die de filters echt toepast: zo bewaakt de test ook dat iemand alleen de eigen cijfers ziet.
vi.mock('./db', () => ({
  billingDb: {
    from: (tabel: string) => {
      const filters: ((r: Record<string, unknown>) => boolean)[] = []
      const keten = {
        select: () => keten,
        order: () => keten,
        eq: (k: string, v: unknown) => { filters.push(r => r[k] === v); return keten },
        in: (k: string, v: unknown[]) => { filters.push(r => v.includes(r[k])); return keten },
        range: async (van: number, tot: number) => {
          h.vragen++
          if (h.stuk === tabel) return { data: null, error: { message: 'weg' } }
          return { data: (h.tabellen[tabel] ?? []).filter(r => filters.every(f => f(r))).slice(van, tot + 1), error: null }
        },
      }
      return keten
    },
  },
}))

import { referralCijfers } from './referralCijfers'

type Rij = Record<string, unknown>
const dossier = (extra: { gebruiker?: Rij; betalingen?: Rij[]; teams?: Rij[]; facturen?: Rij[]; ooitMetDeHandBetaald?: boolean; lid?: boolean } = {}) => ({
  gebruiker: {} as Rij, betalingen: [] as Rij[], teams: [] as Rij[], facturen: [] as Rij[], ooitMetDeHandBetaald: false, lid: false, ...extra,
})
const voeg = (tabel: string, rijen: Rij[]) => { (h.tabellen[tabel] ??= []).push(...rijen) }
function zet(klant: string, d: ReturnType<typeof dossier>) {
  voeg('approved_users', [{ user_id: klant, email: `${klant}@voorbeeld.nl`, ...d.gebruiker }])
  voeg('arnobot_payments', d.betalingen.map(b => ({ user_id: klant, ...b })))
  voeg('arnobot_teams', d.teams.map(t => ({ manager_id: klant, ...t })))
  voeg('arnobot_team_facturen', d.facturen)
  if (d.ooitMetDeHandBetaald) voeg('arnobot_admin_log', [{ doel_user_id: klant, actie: 'betaald_gezet' }])
  if (d.lid) voeg('arnobot_team_members', [{ user_id: klant, team_id: 'ander' }])
}
const verwijs = (klant: string, status = 'signed_up', aanbrenger = 'a') =>
  voeg('arnobot_referrals', [{ referrer_user_id: aanbrenger, referred_user_id: klant, status }])
const betaling = (extra: Rij = {}) => ({ status: 'paid', bedrag_cent: 5900, teruggeboekt_cent: 0, terugbetaald_cent: 0, ...extra })
const regel = (soort: string, referral_id: string, netto_cent: number | null, meeloop = true, aanbrenger_user_id = 'a') =>
  ({ soort, referral_id, netto_cent, meeloop, aanbrenger_user_id, created_at: '2027-01-01T00:00:00Z' })

beforeEach(() => { h.tabellen = {}; h.stuk = ''; h.vragen = 0 })

describe('referralCijfers', () => {
  const een = async (d: ReturnType<typeof dossier> | null, status = 'signed_up') => {
    h.tabellen = {}
    verwijs('k', status)
    if (d) zet('k', d)
    return (await referralCijfers('a')).betalend
  }
  const hand = { gebruiker: { paid_at: '2027-01-01' }, ooitMetDeHandBetaald: true }

  it('zonder referrals: twee keer nul', async () => expect(await referralCijfers('a')).toEqual({ betalend: 0, tegoedCent: 0 }))
  it('een online betaling telt, ook Basic zonder converted', async () => expect(await een(dossier({ betalingen: [betaling({ plan: 'basis' })] }))).toBe(1))
  it('een betaald team telt', async () => {
    expect(await een(dossier({ teams: [{ id: 't' }], facturen: [{ team_id: 't', status: 'paid' }] }))).toBe(1)
  })
  it('met de hand op BETAALD telt', async () => expect(await een(dossier(hand))).toBe(1))
  it('met de hand geconverteerd zonder betaalrijen telt', async () => expect(await een(dossier(), 'converted')).toBe(1))
  it('alleen aangemeld telt niet', async () => expect(await een(dossier())).toBe(0))
  it('een teruggedraaide of volledig terugbetaalde betaling telt niet, ook al staat er converted', async () => {
    expect(await een(dossier({ betalingen: [betaling({ teruggeboekt_cent: 5900 })] }), 'converted')).toBe(0)
    expect(await een(dossier({ betalingen: [betaling({ terugbetaald_cent: 5900 })] }), 'converted')).toBe(0)
  })
  it('een mislukte betaling telt niet', async () => expect(await een(dossier({ betalingen: [betaling({ status: 'failed' })] }))).toBe(0))
  it('een gratis account op BETAALD telt niet', async () => {
    expect(await een(dossier({ ...hand, gebruiker: { paid_at: '2027-01-01', gratis_sinds: '2027-01-02' } }), 'converted')).toBe(0)
  })
  it('een gewoon teamlid dat met de hand op BETAALD staat telt niet', async () => {
    expect(await een(dossier({ ...hand, lid: true }), 'converted')).toBe(0)
  })
  it('een open teamfactuur verlaagt de teller niet, een teruggedraaide wel', async () => {
    expect(await een(dossier({ ...hand, teams: [{ id: 't' }], facturen: [{ team_id: 't', status: 'open' }] }))).toBe(1)
    expect(await een(dossier({ ...hand, teams: [{ id: 't' }], facturen: [{ team_id: 't', status: 'refunded', reversed_at: '2027-02-01' }] }))).toBe(0)
  })
  it('een verwijderd of geanonimiseerd account telt niet', async () => {
    expect(await een(null, 'converted')).toBe(0)
    expect(await een(dossier({ gebruiker: { email: null } }), 'converted')).toBe(0)
  })
  it('klanten en tegoed van een ander tellen niet mee', async () => {
    verwijs('k', 'converted', 'ander')
    zet('k', dossier({ betalingen: [betaling()] }))
    voeg('arnobot_referral_grootboek', [regel('toekenning', 'r1', 1900, true, 'ander')])
    expect(await referralCijfers('a')).toEqual({ betalend: 0, tegoedCent: 0 })
  })
  it('het aantal zoekvragen groeit niet mee met het aantal referrals', async () => {
    for (let i = 0; i < 80; i++) { verwijs(`k${i}`); zet(`k${i}`, dossier({ betalingen: [betaling()] })) }
    expect((await referralCijfers('a')).betalend).toBe(80)
    expect(h.vragen).toBeLessThan(10)
  })

  it('tegoed komt uit het grootboek, in centen, zonder wat vervallen is', async () => {
    voeg('arnobot_referral_grootboek', [regel('toekenning', 'r1', 1900), regel('toekenning', 'r2', 1815), regel('verval', 'r2', -1815)])
    expect((await referralCijfers('a')).tegoedCent).toBe(1900)
  })
  it('zolang het grootboek meeloopt tellen alleen de meeloopregels', async () => {
    voeg('arnobot_referral_grootboek', [regel('toekenning', 'r1', 1900), regel('toekenning', 'r9', 5000, false)])
    expect((await referralCijfers('a')).tegoedCent).toBe(1900)
  })
  it('staat een bedrag nog niet vast, dan geen cijfer in plaats van een te lage stand', async () => {
    voeg('arnobot_referral_grootboek', [regel('toekenning', 'r1', 1900), regel('toekenning', 'r2', null)])
    expect((await referralCijfers('a')).tegoedCent).toBeNull()
  })
  it('een vervallen toekenning zonder bedrag verbergt de teller niet', async () => {
    voeg('arnobot_referral_grootboek', [regel('toekenning', 'r1', null), regel('verval', 'r1', 0)])
    expect((await referralCijfers('a')).tegoedCent).toBe(0)
  })

  it('lukt rekenen niet, dan geen cijfer in plaats van een nul die niet klopt', async () => {
    h.stuk = 'arnobot_referral_grootboek'
    expect(await referralCijfers('a')).toEqual({ betalend: 0, tegoedCent: null })
    h.stuk = 'arnobot_referrals'
    expect(await referralCijfers('a')).toEqual({ betalend: null, tegoedCent: 0 })
    h.stuk = 'arnobot_payments'
    verwijs('k')
    expect((await referralCijfers('a')).betalend).toBeNull()
  })
})
