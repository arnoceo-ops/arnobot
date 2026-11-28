// "Doelwinst: hoeveel users heb je nodig?" op de Abacus-tab Business case. Los van het scherm, zodat het te testen is.
import {
  TARIEVEN, SCENARIO_PRIJZEN, SCENARIO_TEAM_PRIJS, computeScenarioKosten, berekenScenarioOmzetEnBetaalprovider,
  type ScenarioBillingSplit, type TierVerdeling, type Betaalprovider, type TeamScenario, type TeamBillingSplit, type Inputs,
} from '@/lib/kostenTarieven'

export type DoelwinstAannames = {
  billingSplit: ScenarioBillingSplit
  verdeling: TierVerdeling
  betaalprovider: Betaalprovider
  teamBillingSplit: TeamBillingSplit
  inputs: Inputs
}

export const MAX_GEBRUIKERS_ZOEKGRENS = 2_000_000
const MAX_SCHAAL_ZOEKGRENS = 10_000_000

export function winstBijN(n: number, team: TeamScenario, a: DoelwinstAannames): number {
  const { basicN, proN, teamLeden, omzetTotaal, betaalproviderKosten } = berekenScenarioOmzetEnBetaalprovider(
    SCENARIO_PRIJZEN, a.billingSplit, a.verdeling, a.betaalprovider, n, SCENARIO_TEAM_PRIJS, team, a.teamBillingSplit)
  return omzetTotaal - computeScenarioKosten(a.inputs, basicN, proN, teamLeden).totaal / a.inputs.fxRate - betaalproviderKosten
}

// De grootste terugval die de winst in een keer kan maken: de grootste prijsstap bij ElevenLabs plus het inschakelen van Supabase PITR,
// ruim afgerond.
function grootsteSprongEur(inputs: Inputs): number {
  const prijzen = [0, ...inputs.tiers.map(t => t.price)]
  const stap = Math.max(...prijzen.slice(1).map((p, i) => p - prijzen[i]))
  return (stap + TARIEVEN.supabasePitrUsd + 50) / inputs.fxRate
}

/**
 * Team blijft vast: het kleinste aantal solo users vanaf waar de winst op of boven het doel BLIJFT. De winst stijgt niet overal: bij een
 * groter ElevenLabs-pakket zakt ze even terug, dus het eerste aantal dat het doel haalt is niet genoeg.
 */
export function benodigdeGebruikersVoorWinst(doelWinstEur: number, team: TeamScenario, a: DoelwinstAannames): number | null {
  const ruim = doelWinstEur + grootsteSprongEur(a.inputs)
  if (winstBijN(MAX_GEBRUIKERS_ZOEKGRENS, team, a) < ruim) return null
  // Eerst een aantal met zoveel marge dat geen latere sprong er nog onder kan komen.
  let lo = 0
  let hi = MAX_GEBRUIKERS_ZOEKGRENS
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2)
    if (winstBijN(mid, team, a) >= ruim) hi = mid
    else lo = mid + 1
  }
  // Daarvandaan terug tot het laatste aantal dat het doel niet haalt.
  let n = lo
  while (n > 0 && winstBijN(n - 1, team, a) >= doelWinstEur) n--
  return n
}

export type SchaalUitkomst = { solo: number; teamKlanten: number; teamLeden: number; totaal: number }

/**
 * Team schaalt mee: solo users en teamklanten groeien met dezelfde factor, de teamgrootte blijft gelijk. De getoonde hele aantallen halen
 * het doel zelf: na het zoeken op een doorlopende factor wordt er afgerond en zo nodig bijgeteld.
 */
export function benodigdeSchaalVoorWinst(doelWinstEur: number, baseN: number, baseTeam: TeamScenario, a: DoelwinstAannames): SchaalUitkomst | null {
  // Bij solo=0 en teamklanten=0 kan een factor niets laten groeien (0 x schaal blijft 0).
  if (baseN <= 0 && baseTeam.aantalKlanten <= 0) return null
  const team = (aantalKlanten: number): TeamScenario => ({ aantalKlanten, gemiddeldeLeden: baseTeam.gemiddeldeLeden })
  const winstBijSchaal = (s: number) => winstBijN(Math.round(baseN * s), team(baseTeam.aantalKlanten * s), a)
  let hi = 1
  while (winstBijSchaal(hi) < doelWinstEur) {
    if (hi > MAX_SCHAAL_ZOEKGRENS) return null
    hi *= 2
  }
  let lo = 0
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2
    if (winstBijSchaal(mid) >= doelWinstEur) hi = mid
    else lo = mid
  }
  let solo = Math.round(baseN * hi)
  let teamKlanten = Math.ceil(baseTeam.aantalKlanten * hi - 1e-6)
  for (let i = 0; winstBijN(solo, team(teamKlanten), a) < doelWinstEur; i++) {
    if (i > 100_000) return null
    if (baseN > 0) solo++
    else teamKlanten++
  }
  // Personen in teams, de manager per klant meegeteld.
  const teamLeden = teamKlanten * (baseTeam.gemiddeldeLeden + 1)
  return { solo, teamKlanten, teamLeden, totaal: solo + teamLeden }
}
