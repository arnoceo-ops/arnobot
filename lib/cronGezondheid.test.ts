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

import { registratieStartVan, bouwCronWachtBericht, ALARM_STATEN } from './cronGezondheid'

describe('nooit gedraaid sinds de registratie', () => {
  const start = nu.getTime() - 48 * 3600_000 // de registratie loopt 48 uur
  it('een dagelijkse cron zonder run is na 48 uur registratie te laat', () => {
    expect(beoordeelCron(undefined, DAGELIJKS, nu, start).staat).toBe('te_laat')
    expect(beoordeelCron(run(), DAGELIJKS, nu, start).staat).toBe('te_laat')
  })
  it('is nog onbekend zolang de registratie korter loopt dan het interval', () => {
    expect(beoordeelCron(undefined, DAGELIJKS, nu, nu.getTime() - 10 * 3600_000).staat).toBe('onbekend')
  })
  it('een maandelijkse cron is na 48 uur nog onbekend', () => {
    expect(beoordeelCron(undefined, '5 4 1 * *', nu, start).staat).toBe('onbekend')
  })
  it('een eenmalige cron zonder grens blijft onbekend', () => {
    expect(beoordeelCron(undefined, '0 8 16 10 *', nu, start).staat).toBe('onbekend')
  })
  it('zonder registratiestart blijft het onbekend', () => {
    expect(beoordeelCron(undefined, DAGELIJKS, nu, null).staat).toBe('onbekend')
  })
})

describe('registratieStartVan', () => {
  it('is de oudste start van welke cron dan ook', () => {
    const a = run({ naam: 'a', laatste_start: uurGeleden(5) })
    const b = run({ naam: 'b', laatste_start: uurGeleden(30) })
    expect(registratieStartVan({ a, b })).toBe(Date.parse(uurGeleden(30)))
  })
  it('is null zonder enige start', () => {
    expect(registratieStartVan({})).toBeNull()
    expect(registratieStartVan({ a: run() })).toBeNull()
  })
})

describe('cron-alarm', () => {
  it('meldt alleen te late en afgebroken crons, een mislukte run meldt zichzelf al', () => {
    expect([...ALARM_STATEN]).toEqual(['te_laat', 'afgebroken'])
  })
  it('bouwt een leesbaar bericht', () => {
    const t = bouwCronWachtBericht([{ naam: 'Abonnementsonderhoud', staat: 'te_laat', tekst: 'laatst gelukt 12/11 05:00, te lang geleden' }])
    expect(t).toContain('Abonnementsonderhoud: laatst gelukt 12/11 05:00, te lang geleden')
    expect(t).toContain('Status')
  })
})
