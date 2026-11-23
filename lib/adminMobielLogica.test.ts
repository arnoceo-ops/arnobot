import { describe, it, expect } from 'vitest'
import {
  ergsteNiveau, proefDagenOver, vatGebruikersSamen, vatKostenSamen, niveauVanAandeel, naamVan, bouwBellijst,
  vatBetalingenSamen, planNaam, type GebruikerRij, type BetalingRij,
} from './adminMobielLogica'

const NU = new Date('2026-11-23T10:00:00Z')
const dag = 24 * 60 * 60 * 1000

const basis: GebruikerRij = {
  user_id: 'u1', email: 'a@x.nl', voornaam: 'Anna', achternaam: 'Jansen',
  is_active: true, paid_at: null, expires_at: null, trial_start: null, created_at: '2026-01-01T00:00:00Z', plan: 'basis',
}

describe('ergsteNiveau', () => {
  it('kiest het ergste', () => {
    expect(ergsteNiveau(['ok', 'let-op', 'fout'])).toBe('fout')
    expect(ergsteNiveau(['ok', 'let-op'])).toBe('let-op')
  })
  it('onbekend is geen alarm naast een meting die ok is', () => {
    expect(ergsteNiveau(['onbekend', 'ok'])).toBe('ok')
  })
  it('alleen onbekend of leeg geeft onbekend', () => {
    expect(ergsteNiveau(['onbekend'])).toBe('onbekend')
    expect(ergsteNiveau([])).toBe('onbekend')
  })
})

describe('proefDagenOver', () => {
  it('betaald of inactief geeft null', () => {
    expect(proefDagenOver({ ...basis, paid_at: '2026-11-01T00:00:00Z' }, NU)).toBeNull()
    expect(proefDagenOver({ ...basis, is_active: false, trial_start: NU.toISOString() }, NU)).toBeNull()
  })
  it('telt vanaf trial_start 30 dagen', () => {
    const start = new Date(NU.getTime() - 27 * dag).toISOString()
    expect(proefDagenOver({ ...basis, trial_start: start }, NU)).toBe(3)
  })
  it('expires_at gaat voor trial_start', () => {
    const eind = new Date(NU.getTime() + 3 * dag).toISOString()
    expect(proefDagenOver({ ...basis, trial_start: '2026-01-01T00:00:00Z', expires_at: eind }, NU)).toBe(3)
  })
  it('verlopen is -1 en zonder einddatum null', () => {
    expect(proefDagenOver({ ...basis, expires_at: new Date(NU.getTime() - dag).toISOString() }, NU)).toBe(-1)
    expect(proefDagenOver(basis, NU)).toBeNull()
  })
})

describe('vatGebruikersSamen', () => {
  const rijen: GebruikerRij[] = [
    { ...basis, user_id: 'a', paid_at: '2026-10-01T00:00:00Z', plan: 'premium', voornaam: 'Adam', achternaam: null },
    { ...basis, user_id: 'b', created_at: new Date(NU.getTime() - 2 * dag).toISOString(), trial_start: new Date(NU.getTime() - 27 * dag).toISOString(), voornaam: 'Bas', achternaam: null },
    { ...basis, user_id: 'c', is_active: false },
    { ...basis, user_id: 'd', trial_start: new Date(NU.getTime() - 5 * dag).toISOString(), voornaam: 'Dirk', achternaam: null },
  ]
  const gesprekken = new Map([['a', 4], ['b', 1], ['c', 9]])

  it('telt actief, betalend, nieuw en bijna verlopen', () => {
    const s = vatGebruikersSamen(rijen, gesprekken, NU)
    expect(s.actiefAccount).toBe(3)
    expect(s.betalend).toBe(1)
    expect(s.nieuw7d).toBe(1)
    expect(s.actief7d).toBe(2)
    expect(s.bijnaVerlopen).toEqual([{ naam: 'Bas', dagen: 3 }])
  })
  it('geeft de namen erbij, gesorteerd', () => {
    const s = vatGebruikersSamen(rijen, gesprekken, NU)
    expect(s.actiefLijst).toEqual([{ naam: 'Adam', gesprekken: 4 }, { naam: 'Bas', gesprekken: 1 }])
    expect(s.nieuwLijst).toEqual([{ naam: 'Bas', datum: rijen[1].created_at, soort: 'proef' }])
    expect(s.betalendLijst).toEqual([{ naam: 'Adam', plan: 'Pro' }])
  })
  it('een inactief account telt niet als actief, ook al had het gesprekken', () => {
    const s = vatGebruikersSamen(rijen, gesprekken, NU)
    expect(s.actiefLijst.map(a => a.naam)).not.toContain('Anna Jansen')
  })
})

describe('bouwBellijst', () => {
  const eind = (dagenVooruit: number) => new Date(NU.getTime() + dagenVooruit * dag).toISOString()
  const rijen: GebruikerRij[] = [
    { ...basis, user_id: 'a', voornaam: 'Aan', achternaam: null, expires_at: eind(2) },
    { ...basis, user_id: 'b', voornaam: 'Bij', achternaam: null, expires_at: eind(1) },
    { ...basis, user_id: 'c', voornaam: 'Veel', achternaam: null, expires_at: eind(1) },
    { ...basis, user_id: 'd', voornaam: 'Ver', achternaam: null, expires_at: eind(20) },
    { ...basis, user_id: 'e', voornaam: 'Betaald', achternaam: null, expires_at: eind(1), paid_at: '2026-10-01T00:00:00Z' },
  ]
  it('alleen proef binnen 7 dagen met minder dan 3 vragen, dichtstbij eerst', () => {
    const l = bouwBellijst(rijen, new Map([['a', 0], ['b', 2], ['c', 3]]), NU)
    expect(l.map(x => x.naam)).toEqual(['Bij', 'Aan'])
  })
})

describe('vatBetalingenSamen', () => {
  const MAAND = '2026-11-01T00:00:00+01:00'
  const b = (over: Partial<BetalingRij>): BetalingRij => ({
    user_id: 'u', status: 'paid', bedrag_cent: 1000, terugbetaald_cent: null,
    betaald_at: new Date(NU.getTime() - 2 * dag).toISOString(), created_at: new Date(NU.getTime() - 2 * dag).toISOString(), ...over,
  })
  it('telt netto na terugbetaling, per maand en per week', () => {
    const r = vatBetalingenSamen([
      b({ bedrag_cent: 2900 }),
      b({ bedrag_cent: 1900, terugbetaald_cent: 1900 }),
      b({ bedrag_cent: 5000, betaald_at: '2026-11-05T10:00:00Z', created_at: '2026-11-05T10:00:00Z' }),
      b({ bedrag_cent: 4000, betaald_at: '2026-10-20T10:00:00Z', created_at: '2026-10-20T10:00:00Z' }),
    ], NU, MAAND)
    expect(r.weekCent).toBe(2900)
    expect(r.maandCent).toBe(7900)
  })
  it('mislukte en verlopen betalingen van de laatste 14 dagen apart, geen oudere', () => {
    const r = vatBetalingenSamen([
      b({ status: 'failed', created_at: new Date(NU.getTime() - 3 * dag).toISOString() }),
      b({ status: 'expired', created_at: new Date(NU.getTime() - 10 * dag).toISOString() }),
      b({ status: 'failed', created_at: new Date(NU.getTime() - 20 * dag).toISOString() }),
      b({ status: 'open' }),
    ], NU, MAAND)
    expect(r.mislukt.map(m => m.status)).toEqual(['failed', 'expired'])
  })
})

describe('vatKostenSamen', () => {
  it('zet top 5, rest en intern apart en het totaal klopt', () => {
    const lijst = [
      ...[10, 9, 8, 7, 6, 5, 4].map((usd, i) => ({ userId: `u${i}`, naam: `N${i}`, usd, intern: false })),
      { userId: 't', naam: 'Test', usd: 3, intern: true },
    ]
    const r = vatKostenSamen(lijst)
    expect(r.top.map(t => t.naam)).toEqual(['N0', 'N1', 'N2', 'N3', 'N4'])
    expect(r.restUsd).toBe(9)
    expect(r.internUsd).toBe(3)
    expect(r.totaalUsd).toBe(52)
  })
})

describe('niveauVanAandeel', () => {
  it('volgt de grenzen van de capaciteitswacht', () => {
    expect(niveauVanAandeel(0.5)).toBe('ok')
    expect(niveauVanAandeel(0.7)).toBe('let-op')
    expect(niveauVanAandeel(0.9)).toBe('fout')
    expect(niveauVanAandeel(null)).toBe('onbekend')
  })
})

describe('naamVan en planNaam', () => {
  it('valt terug op e-mail en dan op onbekend', () => {
    expect(naamVan({ voornaam: null, achternaam: null, email: 'a@x.nl' })).toBe('a@x.nl')
    expect(naamVan({ voornaam: null, achternaam: null, email: null })).toBe('onbekend')
  })
  it('geeft de plannamen uit de app', () => {
    expect(planNaam('premium')).toBe('Pro')
    expect(planNaam('basis')).toBe('Basic')
    expect(planNaam(null)).toBe('onbekend')
  })
})
