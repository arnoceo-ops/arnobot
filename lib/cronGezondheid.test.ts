import { describe, it, expect } from 'vitest'
import { beoordeelCron } from './cronGezondheid'
import { maxLeeftijdMs } from './cronOverzicht'
import type { CronRunRij } from './cronRun'

const run = (o: Partial<CronRunRij> = {}): CronRunRij => ({
  naam: '/api/cron/x', laatste_start: null, laatste_ok: null, laatste_fout: null, laatste_fout_tekst: null, laatste_duur_ms: null, ...o,
})
const DAGELIJKS = '5 4 * * *'
const nu = new Date('2026-11-14T12:00:00Z')
const uurGeleden = (u: number) => new Date(nu.getTime() - u * 3600_000).toISOString()

describe('maxLeeftijdMs', () => {
  it('geeft per type schema een ruime grens', () => {
    expect(maxLeeftijdMs('*/15 * * * *')).toBe(45 * 60_000)
    expect(maxLeeftijdMs('0 * * * *')).toBe(3 * 3600_000)
    expect(maxLeeftijdMs('5 4 * * *')).toBe(36 * 3600_000)
    expect(maxLeeftijdMs('0 4 * * 6')).toBe(8 * 86_400_000)
    expect(maxLeeftijdMs('5 4 1 * *')).toBe(35 * 86_400_000)
  })
  it('is null voor een eenmalige datum in het jaar', () => {
    expect(maxLeeftijdMs('0 8 16 10 *')).toBeNull()
    expect(maxLeeftijdMs('0 8 25-29 11 *')).toBeNull()
  })
})

describe('beoordeelCron', () => {
  it('onbekend zonder registratie', () => {
    expect(beoordeelCron(undefined, DAGELIJKS, nu).staat).toBe('onbekend')
    expect(beoordeelCron(run(), DAGELIJKS, nu).staat).toBe('onbekend')
  })
  it('ok bij een recent succes', () => {
    const r = beoordeelCron(run({ laatste_start: uurGeleden(8), laatste_ok: uurGeleden(8) }), DAGELIJKS, nu)
    expect(r.staat).toBe('ok')
    expect(r.tekst).toMatch(/^gelukt \d{2}\/\d{2} \d{2}:\d{2}$/)
  })
  it('te_laat als het laatste succes ouder is dan het schema toestaat', () => {
    expect(beoordeelCron(run({ laatste_start: uurGeleden(40), laatste_ok: uurGeleden(40) }), DAGELIJKS, nu).staat).toBe('te_laat')
  })
  it('een wekelijkse cron is na 5 dagen nog niet te laat', () => {
    expect(beoordeelCron(run({ laatste_start: uurGeleden(120), laatste_ok: uurGeleden(120) }), '0 4 * * 6', nu).staat).toBe('ok')
  })
  it('fout als de laatste afgeronde run mislukte, met de reden', () => {
    const r = beoordeelCron(run({ laatste_ok: uurGeleden(30), laatste_fout: uurGeleden(2), laatste_fout_tekst: 'HTTP 500: kapot' }), DAGELIJKS, nu)
    expect(r.staat).toBe('fout')
    expect(r.tekst).toContain('HTTP 500: kapot')
  })
  it('weer ok zodra een succes na de fout komt', () => {
    expect(beoordeelCron(run({ laatste_fout: uurGeleden(30), laatste_ok: uurGeleden(2) }), DAGELIJKS, nu).staat).toBe('ok')
  })
  it('afgebroken als een run al lang gestart is zonder afronding', () => {
    expect(beoordeelCron(run({ laatste_ok: uurGeleden(30), laatste_start: uurGeleden(3) }), DAGELIJKS, nu).staat).toBe('afgebroken')
  })
  it('een run die net draait is niet afgebroken', () => {
    const net = new Date(nu.getTime() - 2 * 60_000).toISOString()
    expect(beoordeelCron(run({ laatste_ok: uurGeleden(30), laatste_start: net }), DAGELIJKS, nu).staat).toBe('ok')
  })
  it('een eenmalige cron zonder grens wordt nooit te laat', () => {
    expect(beoordeelCron(run({ laatste_start: uurGeleden(9000), laatste_ok: uurGeleden(9000) }), '0 8 16 10 *', nu).staat).toBe('ok')
  })
})
