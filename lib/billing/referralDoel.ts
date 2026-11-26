import { billingDb, type PayRow } from './db'
import type { Betaling } from './referralGrootboek'
import type { TeamFactuurRow } from './teamFacturatie'

// Een referraluitkering gaat over een eigen betaling of over een betaalde teamfactuur. Hier ziet een teamfactuur eruit als
// een betaling, zodat planner, terugstortmachine en creditnota voor beide dezelfde regels volgen. Een per bank betaalde
// factuur heeft een leeg Mollie-kenmerk: daarop is niets terug te storten.

export const isTeamDoel = (a: { doel_soort: string }) => a.doel_soort === 'teamfactuur'

/** `soort`: een tussentijdse factuur is als een bijbetaling bij een upgrade en dus nooit een verlenging. */
export function factuurAlsBetaling(f: TeamFactuurRow, userId: string): Betaling {
  return {
    id: f.id, user_id: userId, subscription_id: null, mollie_payment_id: f.mollie_payment_id ?? '',
    soort: f.soort === 'tussentijds' ? 'upgrade' : 'eerste', status: f.status, bedrag_cent: f.bedrag_cent, btw_cent: f.btw_cent,
    terugbetaald_cent: f.terugbetaald_cent ?? 0, teruggeboekt_cent: f.teruggeboekt_cent ?? 0, referral_refund_cent: f.referral_refund_cent ?? 0,
    referral_bank_cent: 0, betaald_at: f.betaald_at, terugbetaling_verwerkt_at: f.reversed_at ?? null, moneybird_factuur_id: f.moneybird_factuur_id,
    plan: 'team', cyclus: f.cyclus, klant_type: 'zakelijk', periode_start: f.periode_start, periode_einde: f.periode_einde,
  } as unknown as Betaling
}

/** De betaling of teamfactuur onder een actie. null: bestaat niet, of is niet (meer) van deze gebruiker. */
export async function leesDoel(a: { doel_soort: string; doel_id: string; user_id: string }): Promise<PayRow | null> {
  if (!isTeamDoel(a)) {
    const { data, error } = await billingDb.from('arnobot_payments').select('*').eq('id', a.doel_id).eq('user_id', a.user_id).maybeSingle<PayRow>()
    if (error) throw new Error(`betaling ophalen mislukt: ${error.message}`)
    return data
  }
  const { data: factuur, error } = await billingDb.from('arnobot_team_facturen').select('*').eq('id', a.doel_id).maybeSingle<TeamFactuurRow>()
  if (error) throw new Error(`teamfactuur ophalen mislukt: ${error.message}`)
  if (!factuur) return null
  const { data: team, error: teamFout } = await billingDb.from('arnobot_teams').select('manager_id').eq('id', factuur.team_id).maybeSingle<{ manager_id: string }>()
  if (teamFout) throw new Error(`team ophalen mislukt: ${teamFout.message}`)
  return team?.manager_id === a.user_id ? factuurAlsBetaling(factuur, a.user_id) : null
}
