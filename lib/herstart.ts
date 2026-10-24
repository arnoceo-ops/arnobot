// Wie mag nog een gratis proefperiode starten nadat de toegang is geëindigd. Los van de route
// gehouden zodat de regels testbaar zijn.
//
// Regels: de eerste proefperiode loopt via de normale aanmelding. Een tweede kan via de winback-mail
// (dag 45, vijf dagen geldig) of, als die gemist is, na 201 dagen. Wie twee proefperiodes heeft
// gehad en niet betaalt, krijgt pas twaalf maanden na het einde van de tweede weer een gratis
// proefperiode; betalen kan altijd (/bot/doorgaan).

export type HerstartStatus =
  | 'active'
  | 'not_eligible'
  | 'winback'
  | 'too_late'
  | 'paid_only'
  | 'second_trial'

export const HERSTART_WACHT_DAGEN = 365

export type HerstartVelden = {
  is_active: boolean
  deactivated_at: string | null
  winback_sent_at: string | null
  trial_reactivated_at: string | null
  trial_start: string | null
}

const DAG = 1000 * 60 * 60 * 24

export function herstartStatus(user: HerstartVelden, nu: number = Date.now()): HerstartStatus {
  if (user.is_active) return 'active'
  if (!user.deactivated_at) return 'not_eligible'

  const dagenSindsEinde = (nu - new Date(user.deactivated_at).getTime()) / DAG

  // Twee proefperiodes gehad: twaalf maanden wachten, daarna weer een gratis proefperiode.
  if (user.trial_reactivated_at) {
    return dagenSindsEinde >= HERSTART_WACHT_DAGEN ? 'second_trial' : 'paid_only'
  }

  if (!user.winback_sent_at) return 'not_eligible'

  const dagenSindsWinback = (nu - new Date(user.winback_sent_at).getTime()) / DAG
  if (dagenSindsWinback <= 5) return 'winback'

  if (dagenSindsEinde >= 201) return 'second_trial'

  return 'too_late'
}
