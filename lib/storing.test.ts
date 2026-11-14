import { describe, it, expect } from 'vitest'
import { beoordeelExtern, beoordeelArnoBot, bouwStoringBericht, MIN_METINGEN_VOOR_SNELHEID } from './storing'

const nu = new Date('2026-11-14T12:00:00Z')
const log = (minutenGeleden: number, responseTime: number, status = 'UP') => ({
  createdAt: new Date(nu.getTime() - minutenGeleden * 60_000).toISOString(), status, responseTime,
})

describe('beoordeelExtern', () => {
  it('meldt een grote of kritieke storing', () => {
    expect(beoordeelExtern('Anthropic', 'major')).toMatchObject({ niveau: 'kritiek', sleutel: 'storing:extern:Anthropic' })
    expect(beoordeelExtern('Supabase', 'critical')?.tekst).toContain('kritieke')
  })
  it('meldt geen klein incident, geen rustige dienst en geen mislukte fetch', () => {
    expect(beoordeelExtern('Clerk', 'minor')).toBeNull()
    expect(beoordeelExtern('Clerk', 'none')).toBeNull()
    expect(beoordeelExtern('Clerk', 'unknown')).toBeNull()
    expect(beoordeelExtern('Clerk', null)).toBeNull()
  })
})

describe('beoordeelArnoBot', () => {
  it('meldt niets bij een gezonde monitor en normale snelheid (gemeten basis 668 ms)', () => {
    const m = { monitorStatus: 'UP', logs: [log(5, 650), log(15, 700), log(25, 640), log(35, 690)] }
    expect(beoordeelArnoBot(m, nu)).toEqual([])
  })
  it('meldt DOWN als kritiek en DEGRADED als waarschuwing', () => {
    expect(beoordeelArnoBot({ monitorStatus: 'DOWN', logs: [] }, nu)[0]).toMatchObject({ niveau: 'kritiek', sleutel: 'storing:arnobot:down' })
    expect(beoordeelArnoBot({ monitorStatus: 'DEGRADED', logs: [] }, nu)[0]).toMatchObject({ niveau: 'waarschuwing' })
  })
  it('meldt onder druk als waarschuwing bij een gemiddelde boven 1200 ms in het laatste uur', () => {
    const m = { monitorStatus: 'UP', logs: [log(5, 1400), log(15, 1500), log(25, 1600)] }
    const r = beoordeelArnoBot(m, nu)
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ niveau: 'waarschuwing', sleutel: 'storing:snelheid:onder_druk' })
    expect(r[0].tekst).toContain('1500 ms')
  })
  it('meldt laag als kritiek bij een gemiddelde boven 2500 ms', () => {
    const m = { monitorStatus: 'UP', logs: [log(5, 3000), log(15, 3200), log(25, 2900)] }
    expect(beoordeelArnoBot(m, nu)[0]).toMatchObject({ niveau: 'kritiek', sleutel: 'storing:snelheid:laag' })
  })
  it('oordeelt niet op te weinig metingen in het laatste uur', () => {
    const m = { monitorStatus: 'UP', logs: [log(5, 9000), log(15, 9000)] }
    expect(MIN_METINGEN_VOOR_SNELHEID).toBe(3)
    expect(beoordeelArnoBot(m, nu)).toEqual([])
  })
  it('negeert metingen ouder dan een uur', () => {
    const m = { monitorStatus: 'UP', logs: [log(5, 700), log(15, 700), log(25, 700), log(90, 9000), log(120, 9000)] }
    expect(beoordeelArnoBot(m, nu)).toEqual([])
  })
})

describe('bouwStoringBericht', () => {
  it('zegt ACTIE NODIG bij een kritieke melding en alleen Let op bij een waarschuwing', () => {
    expect(bouwStoringBericht([{ sleutel: 'a', niveau: 'kritiek', tekst: 'Eén.' }])).toContain('ACTIE NODIG')
    const w = bouwStoringBericht([{ sleutel: 'b', niveau: 'waarschuwing', tekst: 'Twee.' }])
    expect(w).toContain('Let op')
    expect(w).not.toContain('ACTIE NODIG')
  })
})

import { werkStoringenBij, herstelTekst, duurTekst, bouwHerstelBericht, HERSTEL_NA_SCHONE_RUNS, type ActieveStoring, type StoringMelding } from './storing'

const melding = (sleutel: string): StoringMelding => ({ sleutel, niveau: 'kritiek', tekst: 'x' })
const actief = (sleutel: string, o: Partial<ActieveStoring> = {}): ActieveStoring => ({ sleutel, sinds: '2026-11-14T10:00:00.000Z', gemeld: true, schoneRuns: 0, ...o })
const altijd = () => true

describe('werkStoringenBij', () => {
  it('neemt een nieuwe storing op met het moment van zien en of er is gemeld', () => {
    const r = werkStoringenBij([], [melding('a')], new Set(['a']), altijd, nu)
    expect(r.actief).toEqual([{ sleutel: 'a', sinds: nu.toISOString(), gemeld: true, schoneRuns: 0 }])
    expect(r.hersteld).toEqual([])
  })
  it('houdt het oorspronkelijke begin en onthoudt dat er eerder gemeld is', () => {
    const r = werkStoringenBij([actief('a')], [melding('a')], new Set(), altijd, nu)
    expect(r.actief[0]).toMatchObject({ sleutel: 'a', sinds: '2026-11-14T10:00:00.000Z', gemeld: true, schoneRuns: 0 })
  })
  it('een storing zonder melding (gededupliceerd) geeft later geen herstelbericht', () => {
    let staat = werkStoringenBij([], [melding('a')], new Set(), altijd, nu).actief
    for (let i = 0; i < HERSTEL_NA_SCHONE_RUNS; i++) staat = werkStoringenBij(staat, [], new Set(), altijd, nu).actief
    expect(staat).toEqual([])
    const laatste = werkStoringenBij([actief('a', { gemeld: false, schoneRuns: HERSTEL_NA_SCHONE_RUNS - 1 })], [], new Set(), altijd, nu)
    expect(laatste.hersteld).toEqual([])
  })
  it('meldt herstel pas na twee schone runs achter elkaar', () => {
    const eerste = werkStoringenBij([actief('a')], [], new Set(), altijd, nu)
    expect(eerste.hersteld).toEqual([])
    expect(eerste.actief[0].schoneRuns).toBe(1)
    const tweede = werkStoringenBij(eerste.actief, [], new Set(), altijd, nu)
    expect(tweede.hersteld).toHaveLength(1)
    expect(tweede.hersteld[0].sleutel).toBe('a')
    expect(tweede.actief).toEqual([])
  })
  it('een storing die tussendoor terugkomt begint de teller opnieuw', () => {
    const een = werkStoringenBij([actief('a')], [], new Set(), altijd, nu)
    const terug = werkStoringenBij(een.actief, [melding('a')], new Set(), altijd, nu)
    expect(terug.actief[0].schoneRuns).toBe(0)
    expect(terug.hersteld).toEqual([])
  })
  it('zegt niets over een storing waarvan de bron deze run niet te lezen was', () => {
    const r = werkStoringenBij([actief('storing:arnobot:down', { schoneRuns: 1 })], [], new Set(), () => false, nu)
    expect(r.hersteld).toEqual([])
    expect(r.actief).toEqual([actief('storing:arnobot:down', { schoneRuns: 1 })])
  })
  it('volgt meerdere storingen onafhankelijk', () => {
    const r = werkStoringenBij([actief('a', { schoneRuns: 1 }), actief('b')], [melding('b')], new Set(), altijd, nu)
    expect(r.hersteld.map(h => h.sleutel)).toEqual(['a'])
    expect(r.actief.map(a => a.sleutel)).toEqual(['b'])
  })
})

describe('herstelbericht', () => {
  it('geeft per soort storing een leesbare tekst', () => {
    expect(herstelTekst('storing:arnobot:down')).toBe('arno.bot is weer bereikbaar.')
    expect(herstelTekst('storing:snelheid:laag')).toBe('arno.bot is weer snel genoeg.')
    expect(herstelTekst('storing:extern:Anthropic')).toBe('Anthropic meldt geen grote storing meer.')
  })
  it('rekent de duur uit', () => {
    expect(duurTekst(20 * 60_000)).toBe('20 min')
    expect(duurTekst(60 * 60_000)).toBe('1 uur')
    expect(duurTekst(135 * 60_000)).toBe('2 uur 15 min')
  })
  it('bouwt een bericht met de duur sinds het begin', () => {
    const t = bouwHerstelBericht([actief('storing:arnobot:down', { sinds: new Date(nu.getTime() - 135 * 60_000).toISOString() })], nu)
    expect(t).toContain('Storing voorbij')
    expect(t).toContain('arno.bot is weer bereikbaar.')
    expect(t).toContain('2 uur 15 min')
  })
})
