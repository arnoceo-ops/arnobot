import { describe, expect, it } from 'vitest'
import {
  bepaalAlarmen, bouwAlarmTekst, soloKlanten, soloPerMaandCent, teamPerMaandCent, verstuurAlarmen,
  type Abonnement, type AlarmStore, type Betaling, type Klant, type TeamFactuur,
} from './kostenAlarm'

const nu = new Date('2026-11-28T08:00:00Z')
const abo = (extra: Partial<Abonnement> = {}): Abonnement => ({
  id: 's1', user_id: 'u1', plan: 'basis', cyclus: 'jaarlijks', status: 'active', bedrag_cent: 22800, btw_cent: 3957,
  periode_einde: '2027-11-01T00:00:00Z', ...extra,
})
const betaling = (extra: Partial<Betaling> = {}): Betaling => ({
  subscription_id: 's1', soort: 'eerste', status: 'paid', bedrag_cent: 22800, btw_cent: 3957, terugbetaald_cent: 0,
  betaald_at: '2026-11-01T10:00:00Z', ...extra,
})

describe('betaald per maand, solo', () => {
  it('een jaarbetaling van 228 euro inclusief btw is 15,70 per maand zonder btw', () => {
    expect(soloPerMaandCent(abo(), [betaling()], nu)! / 100).toBeCloseTo(15.7, 2)
  })
  it('een maandbetaling telt ook als de laatste van vorige maand is en de volgende nog moet komen', () => {
    const a = abo({ cyclus: 'maandelijks', bedrag_cent: 2900, btw_cent: 503, periode_einde: '2026-12-03T00:00:00Z' })
    const b = betaling({ bedrag_cent: 2900, btw_cent: 503, betaald_at: '2026-11-03T10:00:00Z' })
    expect(soloPerMaandCent(a, [b], new Date('2026-12-01T08:00:00Z'))! / 100).toBeCloseTo(23.97, 2)
  })
  it('een korting op de betaling en een terugbetaling tellen mee', () => {
    const vol = soloPerMaandCent(abo(), [betaling()], nu)!
    expect(soloPerMaandCent(abo(), [betaling({ bedrag_cent: 11400, btw_cent: 1979 })], nu)!).toBeCloseTo(vol / 2, -1)
    expect(soloPerMaandCent(abo(), [betaling({ terugbetaald_cent: 11400 })], nu)!).toBeCloseTo(vol / 2, -1)
  })
  it('na een upgrade geldt het bedrag van het abonnement', () => {
    const a = abo({ plan: 'premium', bedrag_cent: 39600, btw_cent: 6873 })
    const upgrade = betaling({ soort: 'upgrade', bedrag_cent: 9000, btw_cent: 1562, betaald_at: '2026-11-20T10:00:00Z' })
    expect(soloPerMaandCent(a, [betaling(), upgrade], nu)! / 100).toBeCloseTo((39600 - 6873) / 1200, 2)
  })
  it('opgezegd maar nog lopend telt mee, verlopen, beeindigd, zonder betaling of helemaal terugbetaald niet', () => {
    expect(soloPerMaandCent(abo({ status: 'cancelled' }), [betaling()], nu)).not.toBeNull()
    expect(soloPerMaandCent(abo({ periode_einde: '2026-11-01T00:00:00Z' }), [betaling()], nu)).toBeNull()
    expect(soloPerMaandCent(abo({ status: 'ended' }), [betaling()], nu)).toBeNull()
    expect(soloPerMaandCent(abo(), [], nu)).toBeNull()
    expect(soloPerMaandCent(abo(), [betaling({ terugbetaald_cent: 22800 })], nu)).toBeNull()
  })
  it('bij twee lopende abonnementen telt het hoogste, een keer', () => {
    const uit = soloKlanten([abo(), abo({ id: 's2', plan: 'premium' })], [betaling(), betaling({ subscription_id: 's2', bedrag_cent: 39600, btw_cent: 6873 })], nu)
    expect(uit).toHaveLength(1)
    expect(uit[0].omschrijving).toBe('Pro jaarlijks')
  })
})

describe('betaald per maand, team', () => {
  const factuur = (extra: Partial<TeamFactuur> = {}): TeamFactuur => ({
    team_id: 't', status: 'paid', soort: 'regulier', cyclus: 'maandelijks', periode_start: '2026-11-01', periode_einde: '2026-12-01',
    bedrag_cent: 29524, btw_cent: 5124, ...extra,
  })
  it('maandfactuur telt vol, jaarfactuur door 12', () => {
    expect(teamPerMaandCent([factuur()], nu)!).toBeCloseTo(24400, 0)
    expect(teamPerMaandCent([factuur({ cyclus: 'jaarlijks', periode_einde: '2027-11-01', bedrag_cent: 255552, btw_cent: 44352 })], nu)!).toBeCloseTo(17600, 0)
  })
  it('na afloop telt de vorige factuur nog 31 dagen, daarna niet meer', () => {
    expect(teamPerMaandCent([factuur()], new Date('2026-12-20T00:00:00Z'))).not.toBeNull()
    expect(teamPerMaandCent([factuur()], new Date('2027-01-05T00:00:00Z'))).toBeNull()
  })
  it('een open factuur is geen betaling', () => {
    expect(teamPerMaandCent([factuur({ status: 'open' })], nu)).toBeNull()
  })
})

const klant: Klant = { sleutel: 'u1', userIds: ['u1'], omschrijving: 'Basic jaarlijks', perMaandCent: 1570 }
const kosten = (eur: number) => new Map([['u1', eur * 1.1]])

describe('drempels', () => {
  it('stil onder 80%, daarboven 80, vanaf het volle bedrag 100', () => {
    expect(bepaalAlarmen([klant], kosten(12.5), 1.1)).toHaveLength(0)
    expect(bepaalAlarmen([klant], kosten(12.6), 1.1)[0].drempel).toBe(80)
    expect(bepaalAlarmen([klant], kosten(15.7), 1.1)[0].drempel).toBe(100)
  })
  it('telt bij een team de kosten van alle leden op', () => {
    const team = { ...klant, sleutel: 'team:t', userIds: ['a', 'b'] }
    expect(bepaalAlarmen([team], new Map([['a', 8 * 1.1], ['b', 6 * 1.1]]), 1.1)[0].pct).toBeCloseTo(89.2, 1)
  })
  it('zet naam, bedragen en verwachting in het bericht', () => {
    const tekst = bouwAlarmTekst(bepaalAlarmen([klant], kosten(12.8), 1.1)[0], 'Jan (jan@voorbeeld.nl)', 'november', 0.9)
    expect(tekst).toContain('Wie: Jan (jan@voorbeeld.nl)')
    expect(tekst).toContain('Betaalt per maand: €15,70 excl. btw')
    expect(tekst).toContain('Kosten november tot nu toe: €12,80 (82%)')
    expect(tekst).toContain('Verwachting einde maand: €14,22')
  })
  it('geeft geen verwachting aan het begin van de maand en niet na afloop', () => {
    const alarm = bepaalAlarmen([klant], kosten(13), 1.1)[0]
    expect(bouwAlarmTekst(alarm, 'x', 'november', 0.03)).not.toContain('Verwachting')
    expect(bouwAlarmTekst(alarm, 'x', 'november', 1)).not.toContain('tot nu toe')
  })
})

describe('eenmaal per klant per maand', () => {
  function geheugen() {
    const sleutels = new Set<string>()
    const store: AlarmStore = {
      async set(s) { if (sleutels.has(s)) return null; sleutels.add(s); return 'OK' },
      async del(s) { sleutels.delete(s) },
    }
    return { store, sleutels }
  }
  const draai = (store: AlarmStore, eur: number, lukt = true, maand = '2026-11') => {
    const berichten: string[] = []
    return verstuurAlarmen(bepaalAlarmen([klant], kosten(eur), 1.1), maand, store, async a => String(a.drempel), async t => { berichten.push(t); return lukt })
      .then(() => berichten)
  }
  it('80 een keer, daarna 100 een keer, volgende maand opnieuw', async () => {
    const { store } = geheugen()
    expect(await draai(store, 13)).toEqual(['80'])
    expect(await draai(store, 14)).toEqual([])
    expect(await draai(store, 16)).toEqual(['100'])
    expect(await draai(store, 20)).toEqual([])
    expect(await draai(store, 13, true, '2026-12')).toEqual(['80'])
  })
  it('wie meteen op 100 staat krijgt later geen 80 meer', async () => {
    const { store } = geheugen()
    expect(await draai(store, 16)).toEqual(['100'])
    expect(await draai(store, 13)).toEqual([])
  })
  it('een bericht dat niet aankomt wordt opnieuw geprobeerd', async () => {
    const { store } = geheugen()
    await draai(store, 13, false)
    expect(await draai(store, 13)).toEqual(['80'])
  })
})
