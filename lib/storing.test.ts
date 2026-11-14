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
