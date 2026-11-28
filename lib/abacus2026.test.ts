import { describe, expect, it } from 'vitest'
import {
  DEFAULT_INPUTS, DEFAULT_TIER_VERDELING, DEFAULT_BILLING_SPLIT, DEFAULT_BETAALPROVIDER, DEFAULT_TEAM_SCENARIO,
  DEFAULT_TEAM_BILLING_SPLIT, DEFAULT_SOLO_GEBRUIKERS, SCENARIO_PRIJZEN, SCENARIO_TEAM_PRIJS, TARIEVEN,
  berekenScenarioOmzetEnBetaalprovider, computeScenarioKosten, feitenControleKostenUsd,
} from './kostenTarieven'
import { benodigdeGebruikersVoorWinst, benodigdeSchaalVoorWinst, winstBijN, type DoelwinstAannames } from './abacusDoelwinst'
import { berekenVerloop } from './abacusVerloop'
import { berekenPrognoseKostenUsd, planVerdeling, sparringAanroepen, type Meting } from './trackrecordPrognose'

const aannames: DoelwinstAannames = {
  billingSplit: DEFAULT_BILLING_SPLIT, verdeling: DEFAULT_TIER_VERDELING, betaalprovider: DEFAULT_BETAALPROVIDER,
  teamBillingSplit: DEFAULT_TEAM_BILLING_SPLIT, inputs: DEFAULT_INPUTS,
}

describe('doelwinst', () => {
  it('team blijft vast: gelijk aan alle aantallen een voor een aflopen, ook rond de ElevenLabs-sprongen', () => {
    const winst = Array.from({ length: 3000 }, (_, n) => winstBijN(n, DEFAULT_TEAM_SCENARIO, aannames))
    for (const doel of [2000, 5000, 8000, 10000, 12000, 20000, 40000]) {
      let verwacht = 0
      winst.forEach((w, n) => { if (w < doel) verwacht = n + 1 })
      expect(verwacht).toBeLessThan(2900)
      expect(benodigdeGebruikersVoorWinst(doel, DEFAULT_TEAM_SCENARIO, aannames)).toBe(verwacht)
    }
  })

  it('team schaalt mee: de getoonde hele aantallen halen het doel', () => {
    for (const [doel, solo, klanten, leden] of [[5000, 250, 5, 4], [500, 20, 1, 4], [10000, 300, 10, 5], [3000, 0, 4, 5]]) {
      const u = benodigdeSchaalVoorWinst(doel, solo, { aantalKlanten: klanten, gemiddeldeLeden: leden }, aannames)!
      expect(winstBijN(u.solo, { aantalKlanten: u.teamKlanten, gemiddeldeLeden: leden }, aannames)).toBeGreaterThanOrEqual(doel)
      expect(u.totaal).toBe(u.solo + u.teamKlanten * (leden + 1))
    }
  })
})

describe('betaalprovider', () => {
  it('rekent bij een jaarabonnement het vaste bedrag een keer per jaar', () => {
    const bereken = (pct: number) => berekenScenarioOmzetEnBetaalprovider(SCENARIO_PRIJZEN, { basicPctJaarlijks: pct, proPctJaarlijks: pct },
      { basic: 100, pro: 0 }, { ...DEFAULT_BETAALPROVIDER, pctCreditcard: 0, sepaPct: 0, sepaFixed: 0.35 }, 120, SCENARIO_TEAM_PRIJS,
      { aantalKlanten: 0, gemiddeldeLeden: 5 }, { pctJaarlijks: 0 }).betaalproviderKosten
    expect(bereken(0)).toBeCloseTo(120 * 0.35, 6)
    expect(bereken(100)).toBeCloseTo(120 * 0.35 / 12, 6)
  })
})

describe('verloop en cashflow', () => {
  it('maand 12 is gelijk aan het scenario', () => {
    const laatste = berekenVerloop('lineair', DEFAULT_SOLO_GEBRUIKERS, DEFAULT_TEAM_SCENARIO, aannames)[11]
    expect(laatste.omzet).toBeCloseTo(12970, 6)
    expect(laatste.winst).toBeCloseTo(winstBijN(DEFAULT_SOLO_GEBRUIKERS, DEFAULT_TEAM_SCENARIO, aannames), 6)
  })

  it('zonder jaarabonnementen is ontvangen gelijk aan de omzet', () => {
    const zonder = { ...aannames, billingSplit: { basicPctJaarlijks: 0, proPctJaarlijks: 0 }, teamBillingSplit: { pctJaarlijks: 0 } }
    for (const m of berekenVerloop('lineair', 300, DEFAULT_TEAM_SCENARIO, zonder)) expect(m.ontvangen).toBeCloseTo(m.omzet, 6)
  })

  it('met alleen jaarabonnementen komt elke klant een keer binnen: 120 Basic is 120 x 228', () => {
    const alles = { ...aannames, verdeling: { basic: 100, pro: 0 }, billingSplit: { basicPctJaarlijks: 100, proPctJaarlijks: 0 } }
    const verloop = berekenVerloop('lineair', 120, { aantalKlanten: 0, gemiddeldeLeden: 5 }, alles)
    expect(verloop[0].ontvangen).toBeCloseTo(10 * 228, 6)
    expect(verloop[0].omzet).toBeCloseTo(10 * 19, 6)
    expect(verloop.reduce((s, m) => s + m.ontvangen, 0)).toBeCloseTo(120 * 228, 6)
  })

  it('een teamklant op jaarbasis met manager plus 5 komt binnen als 924 + 5 x 396', () => {
    const jaar = { ...aannames, teamBillingSplit: { pctJaarlijks: 100 } }
    const verloop = berekenVerloop('lineair', 0, { aantalKlanten: 12, gemiddeldeLeden: 5 }, jaar)
    expect(verloop[0].ontvangen).toBeCloseTo(924 + 5 * 396, 6)
  })
})

describe('feitencontrole', () => {
  it('rekent een deel van de vragen en stopt bij de daggrens', () => {
    expect(feitenControleKostenUsd(1000, 59, 0.02)).toBeCloseTo(590 * 0.02, 6)
    expect(feitenControleKostenUsd(1_000_000, 59, 0.02)).toBeCloseTo(TARIEVEN.feitenControleMaxPerDag * 365 / 12 * 0.02, 6)
  })
  it('telt mee in het totaal', () => {
    const met = computeScenarioKosten(DEFAULT_INPUTS, 10, 10)
    const zonder = computeScenarioKosten({ ...DEFAULT_INPUTS, feitenControlePerBeoordeling: 0 }, 10, 10)
    expect(met.totaal - zonder.totaal).toBeCloseTo(met.feitenControleKosten, 6)
  })
})

describe('Trackrecord-prognose', () => {
  const nul: Meting = { gebruikers_count: 0, berichten_count: 0, analyses_count: 0, sparring_sessies_count: 0, sparring_berichten_count: 0, voice_interacties_count: 0, voice_tekens_count: 0 }

  it('verdeelt de actieve gebruikers over de plannen', () => {
    expect(planVerdeling(['a', 'b', 'c', 'd'], new Map([['a', 'basis'], ['b', 'premium'], ['c', 'team']]))).toEqual({ basic: 1, pro: 2, team: 1 })
  })

  it('telt een aanroep per twee berichten in een sparringsessie', () => {
    expect(sparringAanroepen(25)).toBe(12)
  })

  it('geeft bij standaardgebruik hetzelfde als de Calculator, op de gemeten posten na', () => {
    const i = { ...DEFAULT_INPUTS, clerkPro: TARIEVEN.clerkProActief, pctSparring: 0, pctVoice: 0, analysesPerGebruiker: 0 }
    const calculator = computeScenarioKosten(i, 8, 2)
    const m = { ...nul, gebruikers_count: 10, berichten_count: 10 * DEFAULT_INPUTS.berichten }
    expect(berekenPrognoseKostenUsd(m, { basic: 8, pro: 2, team: 0 }, DEFAULT_INPUTS.fxRate)).toBeCloseTo(calculator.totaal - calculator.analysesKosten, 6)
  })

  it('rekent coaching en uitdaging niet voor Basic', () => {
    const m = { ...nul, gebruikers_count: 10, berichten_count: 100 }
    const basic = berekenPrognoseKostenUsd(m, { basic: 10, pro: 0, team: 0 }, 1.1)
    const pro = berekenPrognoseKostenUsd(m, { basic: 0, pro: 10, team: 0 }, 1.1)
    expect(pro - basic).toBeGreaterThan(10 * (2 * TARIEVEN.coachingKostenPerSynthese + 10 * TARIEVEN.uitdagingKostenPerStuk) - 0.001)
  })

  it('telt gemeten analyses tegen het tarief', () => {
    const m = { ...nul, gebruikers_count: 5, berichten_count: 50 }
    const zonder = berekenPrognoseKostenUsd(m, { basic: 5, pro: 0, team: 0 }, 1.1)
    const met = berekenPrognoseKostenUsd({ ...m, analyses_count: 7 }, { basic: 5, pro: 0, team: 0 }, 1.1)
    expect(met - zonder).toBeCloseTo(7 * TARIEVEN.kostenPerAnalyse, 6)
  })
})
