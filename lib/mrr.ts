// MRR uit arnobot_subscriptions, de bron die de Mollie-flow echt bijhoudt. De oude berekening
// las approved_users.bedrag en .interval, kolommen die sinds Mollie door niets meer worden
// geschreven: de MRR bleef daardoor op 0, ook met betalende abonnees.
//
// Definitie (bewust zo):
//  - alleen status 'active';
//  - zonder opzegging: een abonnement waarvoor een opzegging is aangevraagd loopt nog tot het
//    einde van de periode, maar komt niet terug en telt dus niet meer mee;
//  - exclusief btw (bedrag_cent is bruto, btw_cent zit erin);
//  - jaarlijks gedeeld door 12, een onbekende cyclus wordt overgeslagen in plaats van gegokt.
// Team (berekenTeamMrrEuro hieronder) telt mee met dezelfde formule als de facturen
// (lib/teamPricing.ts: platformtarief + seats x prijs per seat, excl. btw, jaarlijks als
// maand-equivalent): een team met een betaalde reguliere factuur die de huidige periode dekt,
// niet geblokkeerd, seats = actuele ledenaantal maar nooit onder het afgesproken minimum. Het
// demo-team (TEST_TEAM_ID) telt nooit mee. De Elite-surplus binnen een Team-offerte en de
// naar-rato tussenfacturen zijn geen vaste maandwaarde en tellen niet mee.

import { berekenTeamPrijsPerMaand, type Cyclus } from '@/lib/teamPricing'

export type AbonnementRij = {
  status: string
  cyclus: string | null
  bedrag_cent: number | null
  btw_cent: number | null
  opzegging_aangevraagd_at: string | null
}

export function berekenMrrEuro(rijen: AbonnementRij[]): number {
  let cent = 0
  for (const r of rijen) {
    if (r.status !== 'active') continue
    if (r.opzegging_aangevraagd_at) continue
    if (r.bedrag_cent == null) continue
    const netto = r.bedrag_cent - (r.btw_cent ?? 0)
    if (r.cyclus === 'maandelijks') cent += netto
    else if (r.cyclus === 'jaarlijks') cent += netto / 12
  }
  return cent / 100
}

export type TeamRij = {
  id: string
  min_seats: number | null
  cyclus: string | null
  geblokkeerd_at: string | null
}

/**
 * MRR van Team in euro, excl. btw. `betaaldeTeamIds`: teams met een betaalde reguliere factuur
 * die de huidige periode dekt. `ledenPerTeam`: echte leden per team (zonder test- en demo-accounts).
 */
export function berekenTeamMrrEuro(
  teams: TeamRij[],
  ledenPerTeam: Record<string, number>,
  betaaldeTeamIds: ReadonlySet<string>,
): number {
  let euro = 0
  for (const t of teams) {
    if (!betaaldeTeamIds.has(t.id)) continue
    if (t.geblokkeerd_at) continue
    if (t.min_seats == null) continue
    if (t.cyclus !== 'maandelijks' && t.cyclus !== 'jaarlijks') continue
    const seats = Math.max(ledenPerTeam[t.id] ?? 0, t.min_seats)
    euro += berekenTeamPrijsPerMaand(seats, t.cyclus as Cyclus) ?? 0
  }
  return euro
}
