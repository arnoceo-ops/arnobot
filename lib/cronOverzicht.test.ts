import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import vercelConfig from '../vercel.json'
import { CRON_INFO, leesCrons, schemaTekst, cronTrigger } from './cronOverzicht'

const root = path.resolve(__dirname, '..')
const padsInVercel = vercelConfig.crons.map(c => c.path)

describe('cron-overzicht blijft gelijk aan vercel.json', () => {
  it('elke cron in vercel.json heeft een beschrijving in CRON_INFO', () => {
    const ontbrekend = padsInVercel.filter(p => !(p in CRON_INFO))
    expect(ontbrekend, `Voeg toe aan lib/cronOverzicht.ts: ${ontbrekend.join(', ')}`).toEqual([])
  })

  it('CRON_INFO bevat geen crons die niet meer in vercel.json staan', () => {
    const overbodig = Object.keys(CRON_INFO).filter(p => !padsInVercel.includes(p))
    expect(overbodig, `Verwijder uit lib/cronOverzicht.ts: ${overbodig.join(', ')}`).toEqual([])
  })

  it('elke cron in vercel.json heeft een route', () => {
    const zonderRoute = padsInVercel.filter(p => !fs.existsSync(path.join(root, 'app', p, 'route.ts')))
    expect(zonderRoute).toEqual([])
  })

  it('elke cron-route onder app/api/cron staat in vercel.json (geen vergeten of wees-cron)', () => {
    const cronMap = path.join(root, 'app', 'api', 'cron')
    const metRoute = fs.readdirSync(cronMap, { withFileTypes: true })
      .filter(d => d.isDirectory() && fs.existsSync(path.join(cronMap, d.name, 'route.ts')))
      .map(d => `/api/cron/${d.name}`)
    const nietGepland = metRoute.filter(p => !padsInVercel.includes(p))
    expect(nietGepland, `Route zonder schema in vercel.json: ${nietGepland.join(', ')}`).toEqual([])
  })

  it('elk schema in vercel.json is door schemaTekst te lezen', () => {
    const onleesbaar = vercelConfig.crons.filter(c => schemaTekst(c.schedule) === c.schedule)
    expect(onleesbaar.map(c => c.schedule)).toEqual([])
  })
})

describe('schemaTekst', () => {
  it('leest de vormen die we gebruiken', () => {
    expect(schemaTekst('*/15 * * * *')).toBe('elk kwartier')
    expect(schemaTekst('0 * * * *')).toBe('elk uur, op :00')
    expect(schemaTekst('40 * * * *')).toBe('elk uur, op :40')
    expect(schemaTekst('5 4 * * *')).toBe('dagelijks 04:05 UTC')
    expect(schemaTekst('0 4 * * 6')).toBe('zaterdag 04:00 UTC')
    expect(schemaTekst('15 7 * * 1')).toBe('maandag 07:15 UTC')
    expect(schemaTekst('5 4 1 * *')).toBe('maandelijks op de 1e, 04:05 UTC')
    expect(schemaTekst('0 8 16 10 *')).toBe('16 oktober, 08:00 UTC')
    expect(schemaTekst('0 8 25-29 11 *')).toBe('25 t/m 29 november, 08:00 UTC')
  })
  it('geeft een onbekende vorm ongewijzigd terug', () => {
    expect(schemaTekst('1 2 3')).toBe('1 2 3')
  })
})

describe('leesCrons en cronTrigger', () => {
  it('geeft alle crons terug met een schema', () => {
    const crons = leesCrons()
    expect(crons).toHaveLength(padsInVercel.length)
    expect(crons.every(c => c.schemaTekst && c.naam)).toBe(true)
  })
  it('bouwt de triggertekst uit het echte schema', () => {
    expect(cronTrigger('trial-emails')).toBe('Cron:trial-emails (dagelijks 04:05 UTC)')
  })
})
