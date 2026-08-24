import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const RITME_DREMPEL_DAGEN = 14

export type LagendLid = { user_id: string; daysSince: number; referentie: string }

// Gedeelde detectie voor de 1:1-cadans-notificatieflow (docs/TEAM_PLAN.md), gebruikt door
// team-1on1-ritme/route.ts voor zowel het aanmaken van het belletje als de escalatie-check.
// Team-breed (niet manager-gescoped), zelfde principe als de 1:1 MEETINGS-tegels in
// dashboard/route.ts (Arno's expliciete verzoek 2026-08-22: een teamoverzicht moet hetzelfde
// beeld geven aan wie het team ook managet, i.p.v. elke manager zijn eigen deel). Leden zonder
// ooit een 1:1 tellen vanaf joined_at, niet vanaf het begin der tijden.
export async function getLagendeLeden(
  teamId: string,
  memberIds: string[],
  joinedAtMap: Record<string, string>
): Promise<LagendLid[]> {
  if (memberIds.length === 0) return []

  const { data: logs } = await supabase
    .from('arnobot_1on1_log')
    .select('member_id, created_at')
    .eq('team_id', teamId)
    .in('member_id', memberIds)
    .order('created_at', { ascending: false })

  const laatste: Record<string, string> = {}
  for (const l of logs ?? []) {
    if (l.member_id && !laatste[l.member_id]) laatste[l.member_id] = l.created_at
  }

  const grens = Date.now() - RITME_DREMPEL_DAGEN * 86400000
  const result: LagendLid[] = []
  for (const id of memberIds) {
    const referentie = laatste[id] ?? joinedAtMap[id]
    if (!referentie) continue
    const referentieTijd = new Date(referentie).getTime()
    if (referentieTijd < grens) {
      result.push({ user_id: id, daysSince: Math.floor((Date.now() - referentieTijd) / 86400000), referentie })
    }
  }
  return result
}
