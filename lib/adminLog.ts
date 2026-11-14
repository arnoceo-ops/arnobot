import { createClient } from '@supabase/supabase-js'
import * as Sentry from '@sentry/nextjs'

// Logboek van adminacties die geld of toegang wijzigen (tabel arnobot_admin_log,
// docs/sql/2026-11-14-admin-log-en-cron-runs.sql). Alleen toevoegen. Een mislukte log blokkeert
// de actie zelf niet (een betaling of intrekking moet doorgaan), maar komt wel in Sentry en de log.

export type AdminActie =
  | 'betaald_gezet'
  | 'terugbetaling'
  | 'plan_gewijzigd'
  | 'teamrol_gewijzigd'
  | 'sd_agent_gewijzigd'
  | 'gratis_toegang'
  | 'toegang_aan'
  | 'toegang_uit'
  | 'team_instellingen'
  | 'team_bedrijfsgegevens'
  | 'team_proef_beeindigd'
  | 'team_proef_verlengd'

export const ACTIE_LABEL: Record<AdminActie, string> = {
  betaald_gezet: 'BETAALD GEZET',
  terugbetaling: 'TERUGBETALING',
  plan_gewijzigd: 'PLAN GEWIJZIGD',
  teamrol_gewijzigd: 'TEAMROL GEWIJZIGD',
  sd_agent_gewijzigd: 'SD-AGENT GEWIJZIGD',
  gratis_toegang: 'GRATIS TOEGANG',
  toegang_aan: 'TOEGANG AAN',
  toegang_uit: 'TOEGANG UIT',
  team_instellingen: 'TEAM-INSTELLINGEN',
  team_bedrijfsgegevens: 'TEAM-BEDRIJFSGEGEVENS',
  team_proef_beeindigd: 'TEAMPROEF BEËINDIGD',
  team_proef_verlengd: 'TEAMPROEF VERLENGD',
}

export type AdminLogDetails = {
  oud?: Record<string, unknown>
  nieuw?: Record<string, unknown>
  extra?: Record<string, unknown>
}

export type AdminLogInvoer = {
  actie: AdminActie
  doelUserId?: string | null
  doelTeamId?: string | null
  details?: AdminLogDetails
}

export async function logAdminActie({ actie, doelUserId, doelTeamId, details }: AdminLogInvoer): Promise<void> {
  try {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    const { error } = await supabase.from('arnobot_admin_log').insert({
      actie,
      doel_user_id: doelUserId ?? null,
      doel_team_id: doelTeamId ?? null,
      details: details ?? {},
    })
    if (error) throw new Error(error.message)
  } catch (e) {
    console.error('[adminLog]', actie, e instanceof Error ? e.message : e)
    Sentry.captureException(e, { tags: { onderdeel: 'admin-log' }, extra: { actie, doelUserId, doelTeamId } })
  }
}

function waarde(v: unknown): string {
  if (v === null || v === undefined || v === '') return 'leeg'
  if (typeof v === 'boolean') return v ? 'ja' : 'nee'
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v)) return v.slice(0, 10)
  return String(v)
}

/** "plan: basis → premium, rol: leeg → manager" uit oud en nieuw; zonder oud alleen de nieuwe waarden. */
export function beschrijfDetails(details: AdminLogDetails | null | undefined): string {
  if (!details) return ''
  const delen: string[] = []
  const nieuw = details.nieuw ?? {}
  for (const k of Object.keys(nieuw)) {
    const oud = details.oud && k in details.oud ? waarde(details.oud[k]) : null
    delen.push(oud !== null ? `${k}: ${oud} → ${waarde(nieuw[k])}` : `${k}: ${waarde(nieuw[k])}`)
  }
  for (const [k, v] of Object.entries(details.extra ?? {})) delen.push(`${k}: ${waarde(v)}`)
  return delen.join(', ')
}
