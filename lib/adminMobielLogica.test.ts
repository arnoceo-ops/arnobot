import { describe, it, expect } from 'vitest'
import { ergsteNiveau, proefDagenOver, vatGebruikersSamen, vatKostenSamen, niveauVanAandeel, naamVan, type GebruikerRij } from './adminMobielLogica'

const NU = new Date('2026-11-23T10:00:00Z')
const dag = 24 * 60 * 60 * 1000

const basis: GebruikerRij = {
  user_id: 'u1', email: 'a@x.nl', voornaam: 'Anna', achternaam: 'Jansen',
  is_active: true, paid_at: null, expires_at: null, trial_start: null, created_at: '2026-01-01T00:00:00Z',
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
  it('telt actief, betalend, nieuw en bijna verlopen', () => {
    const rijen: GebruikerRij[] = [
      { ...basis, user_id: 'a', paid_at: '2026-10-01T00:00:00Z' },
      { ...basis, user_id: 'b', created_at: new Date(NU.getTime() - 2 * dag).toISOString(), trial_start: new Date(NU.getTime() - 27 * dag).toISOString(), voornaam: 'Bas', achternaam: null },
      { ...basis, user_id: 'c', is_active: false },
      { ...basis, user_id: 'd', trial_start: new Date(NU.getTime() - 5 * dag).toISOString() },
    ]
    const s = vatGebruikersSamen(rijen, new Set(['a', 'b', 'c']), NU)
    expect(s.actiefAccount).toBe(3)
    expect(s.betalend).toBe(1)
    expect(s.nieuw7d).toBe(1)
    expect(s.actief7d).toBe(2)
    expect(s.bijnaVerlopen).toEqual([{ naam: 'Bas', dagen: 3 }])
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

describe('naamVan', () => {
  it('valt terug op e-mail en dan op onbekend', () => {
    expect(naamVan({ voornaam: null, achternaam: null, email: 'a@x.nl' })).toBe('a@x.nl')
    expect(naamVan({ voornaam: null, achternaam: null, email: null })).toBe('onbekend')
  })
})
