/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Teamregels sinds 2026-11-26: de manager zit in het basistarief en telt niet als teamlid; zelf aanmelden kan vanaf 3
// teamleden; een kleiner team dat Arno instelt krijgt gewoon de formule en nooit een bedrag van 0 euro.

const h = vi.hoisted(() => ({ team: null as any, teamFout: null as null | { message: string }, leden: [] as { user_id: string }[], ledenFout: null as null | { message: string } }))
vi.mock('@/lib/billing/db', () => ({
  billingDb: {
    from(tabel: string) {
      const q: any = {
        select: () => q, eq: () => q, returns: () => q,
        maybeSingle: () => Promise.resolve({ data: h.team, error: h.teamFout }),
        then: (ok: any, nee: any) => Promise.resolve(tabel === 'arnobot_team_members' ? { data: h.leden, error: h.ledenFout } : { data: null, error: null }).then(ok, nee),
      }
      return q
    },
  },
}))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/lib/teamOpzegging', () => ({ ontblokkeerNaBetaling: vi.fn() }))

import { berekenReguliereBedrag, huidigSeats } from './billing/teamFacturatie'
import { berekenTeamPrijsPerMaand, teamPrijsPerMaandStrikt, TEAM_BASISTARIEF_MAANDELIJKS, TEAM_BASISTARIEF_JAARLIJKS, TEAM_PRIJS_PER_GEBRUIKER_MAANDELIJKS, TEAM_PRIJS_PER_GEBRUIKER_JAARLIJKS, TEAM_MIN_TEAMLEDEN, TEAM_KLEIN_TEKST } from './teamPricing'

const leden = (...ids: string[]) => ids.map(user_id => ({ user_id }))
beforeEach(() => { h.team = { manager_id: 'user_baas' }; h.teamFout = null; h.leden = []; h.ledenFout = null })

describe('huidigSeats telt de manager niet', () => {
  it('manager plus 4 leden zijn 4 teamleden', async () => {
    h.leden = leden('user_baas', 'user_a', 'user_b', 'user_c', 'user_d')
    expect(await huidigSeats('t1', 3)).toBe(4)
  })
  it('alleen de eigenaar valt weg: een tweede account met de rol manager telt mee', async () => {
    h.leden = leden('user_baas', 'user_tweede_manager', 'user_a')
    expect(await huidigSeats('t1', 1)).toBe(2)
  })
  it('zonder rij voor de manager verandert er niets', async () => {
    h.leden = leden('user_a', 'user_b', 'user_c', 'user_d')
    expect(await huidigSeats('t1', 3)).toBe(4)
  })
  it('manager plus 2 leden betaalt het afgesproken minimum van 3', async () => {
    h.leden = leden('user_baas', 'user_a', 'user_b')
    expect(await huidigSeats('t1', 3)).toBe(3)
  })
  it('zonder team of bij een databasefout komt er geen aantal terug', async () => {
    h.team = null
    await expect(huidigSeats('t1', 3)).rejects.toThrow('teamleden tellen mislukt')
    h.team = { manager_id: 'user_baas' }; h.teamFout = { message: 'time-out' }
    await expect(huidigSeats('t1', 3)).rejects.toThrow('time-out')
    h.teamFout = null; h.ledenFout = { message: 'kapot' }
    await expect(huidigSeats('t1', 3)).rejects.toThrow('kapot')
  })
})

describe('teamprijs', () => {
  it('manager plus 3 teamleden is het kleinste team dat zelf kan aanmelden', () => {
    expect(TEAM_MIN_TEAMLEDEN).toBe(3)
    expect(berekenTeamPrijsPerMaand(3, 'maandelijks')).toBe(TEAM_BASISTARIEF_MAANDELIJKS + 3 * TEAM_PRIJS_PER_GEBRUIKER_MAANDELIJKS)
    expect(TEAM_KLEIN_TEKST).toBe('Team is er vanaf een manager en 3 teamleden. Begin je kleiner, bijvoorbeeld als startup met 2 teamleden? Neem dan contact op via team@arno.bot.')
  })
  it.each([1, 2])('een klein team van %i teamleden krijgt de gewone formule', n => {
    expect(berekenTeamPrijsPerMaand(n, 'maandelijks')).toBe(TEAM_BASISTARIEF_MAANDELIJKS + n * TEAM_PRIJS_PER_GEBRUIKER_MAANDELIJKS)
    expect(berekenReguliereBedrag(n, 'jaarlijks').nettoCent).toBe((TEAM_BASISTARIEF_JAARLIJKS + n * TEAM_PRIJS_PER_GEBRUIKER_JAARLIJKS) * 12 * 100)
  })
  it.each([0, -1, 2.5, NaN])('bij %s teamleden is het een fout, nooit 0 euro', n => {
    expect(berekenTeamPrijsPerMaand(n)).toBeNull()
    expect(() => teamPrijsPerMaandStrikt(n, 'maandelijks')).toThrow()
    expect(() => berekenReguliereBedrag(n, 'maandelijks')).toThrow()
  })
})
