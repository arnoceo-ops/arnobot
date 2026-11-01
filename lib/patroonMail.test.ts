import { describe, it, expect, afterEach } from 'vitest'
import { kiesPatroonThema, parsePatroonUitvoer, bouwSparUrl, patroonMailBeschikbaarVoor, themaLeesbaar } from '@/lib/patroonMail'
import { FOUNDER_USER_ID, E2E_TEST_USER_ID } from '@/lib/internalTestAccounts'
import { PERSONA_BESCHRIJVINGEN, SPAR_WEERSTANDEN } from '@/lib/sparringPersonas'

const NU = Date.parse('2026-11-01T12:00:00Z')
const dagenTerug = (d: number) => new Date(NU - d * 86400000).toISOString()
const s = (themas: string[], d: number) => ({ title: 't', themas, created_at: dagenTerug(d) })

describe('kiesPatroonThema', () => {
  it('kiest een thema vanaf 3 gesprekken in het venster', () => {
    const r = kiesPatroonThema([s(['CLOSING'], 1), s(['CLOSING', 'MINDSET'], 5), s(['CLOSING'], 9), s(['MINDSET'], 2)], NU)
    expect(r).toEqual({ thema: 'CLOSING', aantal: 3 })
  })
  it('geeft null bij minder dan 3', () => {
    expect(kiesPatroonThema([s(['CLOSING'], 1), s(['CLOSING'], 2)], NU)).toBeNull()
  })
  it('telt gesprekken ouder dan 8 weken niet mee', () => {
    expect(kiesPatroonThema([s(['CLOSING'], 1), s(['CLOSING'], 2), s(['CLOSING'], 60)], NU)).toBeNull()
  })
  it('telt een gesprek één keer per thema en negeert onbekende labels', () => {
    expect(kiesPatroonThema([s(['CLOSING', 'CLOSING'], 1), s(['CLOSING'], 2), s(['ONZIN'], 3), s(['ONZIN'], 3), s(['ONZIN'], 3)], NU)).toBeNull()
  })
  it('kiest bij gelijke stand het meest recente thema', () => {
    const r = kiesPatroonThema([s(['CLOSING'], 30), s(['CLOSING'], 31), s(['CLOSING'], 32), s(['MINDSET'], 1), s(['MINDSET'], 2), s(['MINDSET'], 3)], NU)
    expect(r?.thema).toBe('MINDSET')
  })
})

describe('parsePatroonUitvoer', () => {
  const rol = 'verkoper'
  const persona = Object.keys(PERSONA_BESCHRIJVINGEN[rol])[0]
  const goed = (zin: string) => JSON.stringify({ patroon: true, zin, scenario: { persona, weerstand: SPAR_WEERSTANDEN[1] } })
  const ZIN = 'Je komt steeds terug op hoe je een prijs onderbouwt voordat de klant erom vraagt.'

  it('accepteert een geldige uitvoer', () => {
    expect(parsePatroonUitvoer(goed(ZIN), rol)).toEqual({ zin: ZIN, persona, weerstand: 'stevig' })
  })
  it('accepteert JSON in een codeblok', () => {
    expect(parsePatroonUitvoer('```json\n' + goed(ZIN) + '\n```', rol)).not.toBeNull()
  })
  it('geeft null bij geen patroon, kapotte JSON of een ongeldig scenario', () => {
    expect(parsePatroonUitvoer('{"patroon": false}', rol)).toBeNull()
    expect(parsePatroonUitvoer('geen json', rol)).toBeNull()
    expect(parsePatroonUitvoer(JSON.stringify({ patroon: true, zin: ZIN, scenario: { persona: 'bestaat_niet', weerstand: 'stevig' } }), rol)).toBeNull()
    expect(parsePatroonUitvoer(JSON.stringify({ patroon: true, zin: ZIN, scenario: { persona, weerstand: 'extreem' } }), rol)).toBeNull()
  })
  it('weigert streepjes, markdown, tijdsdruk en u', () => {
    expect(parsePatroonUitvoer(goed('Je komt steeds terug op prijs — en dat geeft spanning in het gesprek.'), rol)).toBeNull()
    expect(parsePatroonUitvoer(goed('Je komt steeds terug op prijs - en dat geeft spanning in het gesprek.'), rol)).toBeNull()
    expect(parsePatroonUitvoer(goed('Je komt steeds terug op **prijs** en dat geeft spanning in het gesprek.'), rol)).toBeNull()
    expect(parsePatroonUitvoer(goed('Je komt steeds terug op prijs, pak dit vandaag op in het gesprek.'), rol)).toBeNull()
    expect(parsePatroonUitvoer(goed('U komt steeds terug op prijs en dat geeft spanning in het gesprek.'), rol)).toBeNull()
  })
  it('laat een koppelteken in een samengesteld woord toe', () => {
    expect(parsePatroonUitvoer(goed('Je bespreekt steeds je follow-up na een offerte en hoe je die opvolgt.'), rol)).not.toBeNull()
  })
  it('weigert te korte of te lange zinnen', () => {
    expect(parsePatroonUitvoer(goed('Te kort.'), rol)).toBeNull()
    expect(parsePatroonUitvoer(goed('a '.repeat(200)), rol)).toBeNull()
  })
})

describe('hulpfuncties', () => {
  it('bouwt een deeplink naar Sparren', () => {
    expect(bouwSparUrl('cfo', 'stevig')).toBe('https://arno.bot/bot/sparren?persona=cfo&weerstand=stevig')
  })
  it('maakt een thema leesbaar', () => {
    expect(themaLeesbaar('PIJPLIJNBEHEER')).toBe('pijplijnbeheer')
  })
})

describe('patroonMailBeschikbaarVoor', () => {
  const oud = process.env.PATROON_MAIL
  afterEach(() => { if (oud === undefined) delete process.env.PATROON_MAIL; else process.env.PATROON_MAIL = oud })

  it('staat standaard alleen de oprichter toe', () => {
    delete process.env.PATROON_MAIL
    expect(patroonMailBeschikbaarVoor(FOUNDER_USER_ID)).toBe(true)
    expect(patroonMailBeschikbaarVoor('user_ergens')).toBe(false)
  })
  it('opent voor iedereen met PATROON_MAIL=aan, maar nooit voor testaccounts of nepleden', () => {
    process.env.PATROON_MAIL = 'aan'
    expect(patroonMailBeschikbaarVoor('user_ergens')).toBe(true)
    expect(patroonMailBeschikbaarVoor(E2E_TEST_USER_ID)).toBe(false)
    expect(patroonMailBeschikbaarVoor('fake_benny')).toBe(false)
  })
})
