// Verloop van de eerste 12 maanden op de Abacus-tab Business case, met naast omzet en winst ook wat er binnenkomt. Het scenario is het
// EINDPUNT na maand 12: maand 12 levert exact de scenariocijfers op. Solo users en teamklanten groeien met dezelfde factor mee. Solo wordt
// afgerond op hele users, teamklanten blijven fractioneel (verwachtingswaarde), zodat de lijn bij weinig teamklanten niet springt.
// Omzet verdeelt een jaarbetaling over 12 maanden. Ontvangen telt haar in een keer, in de maand van aanmelden, zonder btw. Verlengingen
// vallen pas in maand 13. Aanname: iedereen betaalt direct en niemand zegt binnen het jaar op.
import {
  SCENARIO_PRIJZEN, SCENARIO_TEAM_PRIJS, computeScenarioKosten, berekenScenarioOmzetEnBetaalprovider,
  type TeamScenario,
} from '@/lib/kostenTarieven'
import type { DoelwinstAannames } from '@/lib/abacusDoelwinst'

export const VERLOOP_MAANDEN = 12

export type Groeicurve = 'lineair' | 'versnellend'
export type VerloopMaand = { maand: number; users: number; omzet: number; kosten: number; winst: number; ontvangen: number; kas: number }

export function berekenVerloop(curve: Groeicurve, soloEind: number, team: TeamScenario, a: DoelwinstAannames): VerloopMaand[] {
  const P = SCENARIO_PRIJZEN
  const T = SCENARIO_TEAM_PRIJS
  let vorige = { basic: 0, pro: 0, teams: 0 }
  return Array.from({ length: VERLOOP_MAANDEN }, (_, i) => {
    const maand = i + 1
    const lineair = maand / VERLOOP_MAANDEN
    const factor = curve === 'lineair' ? lineair : lineair * lineair
    const teamM: TeamScenario = { aantalKlanten: team.aantalKlanten * factor, gemiddeldeLeden: team.gemiddeldeLeden }
    const r = berekenScenarioOmzetEnBetaalprovider(
      P, a.billingSplit, a.verdeling, a.betaalprovider, Math.round(soloEind * factor), T, teamM, a.teamBillingSplit)
    const kosten = computeScenarioKosten(a.inputs, r.basicN, r.proN, r.teamLeden).totaal / a.inputs.fxRate + r.betaalproviderKosten

    const basicJaar = a.billingSplit.basicPctJaarlijks / 100
    const proJaar = a.billingSplit.proPctJaarlijks / 100
    const teamJaar = a.teamBillingSplit.pctJaarlijks / 100
    const jaarKlanten = { basic: r.basicN * basicJaar, pro: r.proN * proJaar, teams: teamM.aantalKlanten * teamJaar }
    const perMaand = r.basicN * (1 - basicJaar) * P.basicMaandelijks
      + r.proN * (1 - proJaar) * P.proMaandelijks
      + teamM.aantalKlanten * (1 - teamJaar) * (T.basisMaandelijks + team.gemiddeldeLeden * T.perGebruikerMaandelijks)
    const ineens = (jaarKlanten.basic - vorige.basic) * P.basicJaarlijksTotaal
      + (jaarKlanten.pro - vorige.pro) * P.proJaarlijksTotaal
      + (jaarKlanten.teams - vorige.teams) * (T.basisJaarlijksTotaal + team.gemiddeldeLeden * T.perGebruikerJaarlijksTotaal)
    vorige = jaarKlanten
    const ontvangen = perMaand + ineens

    return {
      maand, users: Math.round(r.basicN + r.proN + r.teamLeden), omzet: r.omzetTotaal, kosten,
      winst: r.omzetTotaal - kosten, ontvangen, kas: ontvangen - kosten,
    }
  })
}
