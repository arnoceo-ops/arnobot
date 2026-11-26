import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import vercelConfig from '../vercel.json'
import { CRON_INFO, leesCrons, schemaTekst, cronTrigger } from './cronOverzicht'

const root = path.resolve(__dirname, '..')
const padsInVercel = vercelConfig.crons.map(c => c.path)

// Crons van vóór het veld `ingepland`. Deze lijst groeit niet: een nieuwe cron krijgt `ingepland` in CRON_INFO.
const VAN_VOOR_INGEPLAND = new Set([
  '/api/cron/blog',
  '/api/cron/billing',
  '/api/cron/referral-grootboek',
  '/api/cron/team-facturatie',
  '/api/cron/trial-emails',
  '/api/cron/inactivity-nudge',
  '/api/cron/weekly-activity',
  '/api/cron/productvragen',
  '/api/cron/feitencontrole',
  '/api/cron/waarheidscontrole',
  '/api/cron/uitdaging-herinnering',
  '/api/cron/weekly-top-users',
  '/api/cron/auto-analyse',
  '/api/bot/backfill-embeddings',
  '/api/cron/refresh-openers',
  '/api/cron/model-check',
  '/api/cron/competitie',
  '/api/cron/data-cleanup',
  '/api/cron/database-wacht',
  '/api/cron/capaciteitswacht',
  '/api/cron/cron-wacht',
  '/api/cron/storing-wacht',
  '/api/cron/stip-wacht',
  '/api/cron/team-proef',
  '/api/cron/update-handover',
  '/api/cron/meta-analyse',
  '/api/cron/meta-analyse-reminder',
  '/api/cron/patroon-samenvatting',
  '/api/cron/rss-ingest',
  '/api/cron/team-1on1-ritme',
  '/api/cron/comp-reminder-nov',
  '/api/cron/tabelgebruik-meting-nov',
  '/api/cron/sessies-afsluiten',
  '/api/cron/kennisbank-controle',
  '/api/cron/documenten-samenvatten',
  '/api/cron/documenten-opruimen',
  '/api/cron/bron-context-opruimen',
  '/api/cron/leveranciers-wijzigingen',
])

describe('cron-overzicht blijft gelijk aan vercel.json', () => {
  it('elke nieuwe cron heeft een geldige datum in ingepland, anders meldt de admin hem meteen als te laat', () => {
    const zonder = padsInVercel.filter(p => !VAN_VOOR_INGEPLAND.has(p) && Number.isNaN(Date.parse(CRON_INFO[p]?.ingepland ?? '')))
    expect(zonder, `Zet ingepland (ISO-moment van vandaag) in lib/cronOverzicht.ts: ${zonder.join(', ')}`).toEqual([])
  })

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

  it('elke cron registreert zijn run in cron_runs (lib/cronRun.ts), anders kan de admin hem niet als te laat markeren', () => {
    const zonder = padsInVercel.filter(p => {
      const bron = fs.readFileSync(path.join(root, 'app', p, 'route.ts'), 'utf8')
      return !bron.includes(`registreerCronRun('${p}'`)
    })
    expect(zonder, `Wikkel de handler in registreerCronRun: ${zonder.join(', ')}`).toEqual([])
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
    const winter = new Date('2026-11-26T12:00:00Z')
    expect(schemaTekst('5 4 * * *', winter)).toBe('dagelijks 05:05')
    expect(schemaTekst('0 4 * * 6', winter)).toBe('zaterdag 05:00')
    expect(schemaTekst('15 7 * * 1', winter)).toBe('maandag 08:15')
    expect(schemaTekst('5 4 1 * *', winter)).toBe('maandelijks op de 1e, 05:05')
    // Een vaste maand rekent met die maand: 16 oktober is nog zomertijd.
    expect(schemaTekst('0 8 16 10 *', winter)).toBe('16 oktober, 10:00')
    expect(schemaTekst('0 8 25-29 11 *', winter)).toBe('25 t/m 29 november, 09:00')
  })
  it('rekent in de zomer met twee uur verschil', () => {
    expect(schemaTekst('5 4 * * *', new Date('2027-07-01T12:00:00Z'))).toBe('dagelijks 06:05')
  })
  it('houdt UTC aan als de omrekening op een andere dag uitkomt', () => {
    expect(schemaTekst('30 23 * * 6', new Date('2026-11-26T12:00:00Z'))).toBe('zaterdag 23:30 UTC')
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
    expect(cronTrigger('trial-emails')).toMatch(/^Cron:trial-emails \(dagelijks 0[56]:05\)$/)
  })
})
