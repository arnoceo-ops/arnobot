import { describe, expect, it } from 'vitest'

// Bewaakt de tarieven van 2026-11-26 en dat de drie prijsbronnen (site en checkout, teamfacturen, Abacus) gelijk lopen.

import {
  SCENARIO_PRIJZEN, SCENARIO_TEAM_PRIJS, DEFAULT_PRIJZEN, DEFAULT_INPUTS, DEFAULT_TIER_VERDELING, DEFAULT_BILLING_SPLIT,
  DEFAULT_BETAALPROVIDER, DEFAULT_TEAM_SCENARIO, DEFAULT_TEAM_BILLING_SPLIT, berekenScenarioOmzetEnBetaalprovider, computeScenarioKosten, DEFAULT_SOLO_GEBRUIKERS,
} from './kostenTarieven'
import {
  TEAM_BASISTARIEF_MAANDELIJKS, TEAM_BASISTARIEF_JAARLIJKS, TEAM_PRIJS_PER_GEBRUIKER_MAANDELIJKS, TEAM_PRIJS_PER_GEBRUIKER_JAARLIJKS,
  TEAM_ELITE_SURPLUS_PER_MAAND, berekenTeamPrijsPerMaand,
} from './teamPricing'

describe('tarieven', () => {
  it('Basic ongewijzigd, Pro 49 per maand en 396 per jaar', () => {
    expect(SCENARIO_PRIJZEN).toEqual({ basicMaandelijks: 29, basicJaarlijksTotaal: 228, proMaandelijks: 49, proJaarlijksTotaal: 396 })
    expect(DEFAULT_PRIJZEN).toEqual({ basis: 29, premium: 49 })
  })
  it('een teamlid betaalt precies de solo Pro-prijs, per maand en per jaar', () => {
    expect(TEAM_PRIJS_PER_GEBRUIKER_MAANDELIJKS).toBe(SCENARIO_PRIJZEN.proMaandelijks)
    expect(TEAM_PRIJS_PER_GEBRUIKER_JAARLIJKS * 12).toBe(SCENARIO_PRIJZEN.proJaarlijksTotaal)
  })
  it('teamfacturen en Abacus gebruiken dezelfde teamprijs', () => {
    expect(SCENARIO_TEAM_PRIJS).toEqual({
      basisMaandelijks: TEAM_BASISTARIEF_MAANDELIJKS, basisJaarlijksTotaal: TEAM_BASISTARIEF_JAARLIJKS * 12,
      perGebruikerMaandelijks: TEAM_PRIJS_PER_GEBRUIKER_MAANDELIJKS, perGebruikerJaarlijksTotaal: TEAM_PRIJS_PER_GEBRUIKER_JAARLIJKS * 12,
    })
  })
  it('manager plus 3 teamleden is 244 per maand en 2112 per jaar', () => {
    expect(berekenTeamPrijsPerMaand(3, 'maandelijks')).toBe(244)
    expect(berekenTeamPrijsPerMaand(3, 'jaarlijks')! * 12).toBe(2112)
  })
  it('de Elite-toeslag beweegt niet mee', () => {
    expect(TEAM_ELITE_SURPLUS_PER_MAAND).toBe(338)
  })
})

describe('Abacus standaardscenario: 300 solo users en 10 teams van een manager plus 5', () => {
  const r = berekenScenarioOmzetEnBetaalprovider(SCENARIO_PRIJZEN, DEFAULT_BILLING_SPLIT, DEFAULT_TIER_VERDELING, DEFAULT_BETAALPROVIDER, DEFAULT_SOLO_GEBRUIKERS,
    SCENARIO_TEAM_PRIJS, DEFAULT_TEAM_SCENARIO, DEFAULT_TEAM_BILLING_SPLIT)
  it('telt de manager niet in de omzet per teamlid, wel in de gebruikers', () => {
    expect(r.teamLeden).toBe(60)
    expect(Math.round(r.teamOmzet)).toBe(3220)
    expect(Math.round(r.omzetTotaal)).toBe(12970)
  })
  it('geeft de doorgerekende winst bij de koers van 26 november', () => {
    const fx = 1.0949
    const kosten = computeScenarioKosten({ ...DEFAULT_INPUTS, fxRate: fx }, r.basicN, r.proN, r.teamLeden).totaal / fx
    // Marge van 25 euro: wijzigt een kostenaanname, dan is dat geen prijsfout. Op 28 november 2026 van 6609 naar 6290: het afsluiten
    // van gesprekken staat sindsdien als eigen kostenpost in Abacus. Daarna naar 5815: chat en rerank op gemeten tarieven. Daarna naar 5657: Sonnet voor de samenvatting van iedereen.
    // Later die dag een nieuw standaardscenario (Arno), daarmee 8362. Daarna 8247: gemeten tarieven voor uitdaging en analyses, de feitencontrole erbij, Clerk Pro aan, en Mollie bij jaarklanten een keer per jaar.
    expect(Math.abs(r.omzetTotaal - kosten - r.betaalproviderKosten - 8247)).toBeLessThan(5)
  })
})
