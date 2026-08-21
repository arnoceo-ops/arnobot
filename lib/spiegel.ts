import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const DREMPEL_SESSIES = 30
const RECENTE_PERIODE_DAGEN = 21

type SessieRow = { user_id: string; created_at: string; themas: string[] | null }
type ThemaRanking = { thema: string; leden: number; mentions: number }

export type SpiegelSignaal = {
  onvoldoende: boolean
  huidigAantal?: number
  benodigd?: number
  periodeDagen?: number
  totaalLeden?: number
  dominant?: { thema: string; leden: number; trend: 'nieuw' | 'opkomend' | 'afnemend' | 'aanhoudend' | null }
  ranked?: { thema: string; leden: number }[]
}

// Gedeelde berekening voor "De Spiegel" (punt 2A): teambrede thema-frequentie over de laatste
// 3 weken t.o.v. de 3 weken daarvoor. Puur deterministisch, geen LLM-call, om hallucinatie op
// cijfers uit te sluiten (zie docs/TEAM_PLAN.md). Gebruikt door zowel team/spiegel/route.ts
// (UI-kaart) als team/zelfcoaching/route.ts (input voor de Strategy People Execution-synthese).
export async function computeSpiegelSignaal(memberIds: string[]): Promise<SpiegelSignaal> {
  if (memberIds.length === 0) return { onvoldoende: true }

  const { data: sessions } = await supabase
    .from('arnobot_blog_sessions')
    .select('user_id, created_at, themas')
    .in('user_id', memberIds)
    .not('themas', 'is', null)
    .order('created_at', { ascending: false })
    .limit(500)

  const rows = (sessions ?? []) as SessieRow[]
  const totaalMetThema = rows.filter(r => r.themas && r.themas.length > 0).length

  if (totaalMetThema < DREMPEL_SESSIES) {
    return { onvoldoende: true, huidigAantal: totaalMetThema, benodigd: DREMPEL_SESSIES }
  }

  const nu = Date.now()
  const recentStart = nu - RECENTE_PERIODE_DAGEN * 86400000
  const vorigeStart = nu - RECENTE_PERIODE_DAGEN * 2 * 86400000

  const recentLeden = new Map<string, Set<string>>()
  const recentMentions = new Map<string, number>()
  const vorigeLeden = new Map<string, Set<string>>()
  let vorigeTotaalMentions = 0

  for (const row of rows) {
    if (!row.themas || row.themas.length === 0) continue
    const t = new Date(row.created_at).getTime()
    for (const thema of row.themas) {
      if (t >= recentStart) {
        if (!recentLeden.has(thema)) recentLeden.set(thema, new Set())
        recentLeden.get(thema)!.add(row.user_id)
        recentMentions.set(thema, (recentMentions.get(thema) ?? 0) + 1)
      } else if (t >= vorigeStart) {
        if (!vorigeLeden.has(thema)) vorigeLeden.set(thema, new Set())
        vorigeLeden.get(thema)!.add(row.user_id)
        vorigeTotaalMentions++
      }
    }
  }

  const ranked: ThemaRanking[] = Array.from(recentLeden.entries())
    .map(([thema, leden]) => ({ thema, leden: leden.size, mentions: recentMentions.get(thema) ?? 0 }))
    .sort((a, b) => b.leden - a.leden || b.mentions - a.mentions)

  if (ranked.length === 0) {
    return { onvoldoende: true, huidigAantal: totaalMetThema, benodigd: DREMPEL_SESSIES }
  }

  const dominant = ranked[0]
  const vorigeLedenDominant = vorigeLeden.get(dominant.thema)?.size ?? 0

  let trend: 'nieuw' | 'opkomend' | 'afnemend' | 'aanhoudend' | null = null
  if (vorigeTotaalMentions > 0) {
    if (vorigeLedenDominant === 0) trend = 'nieuw'
    else if (dominant.leden > vorigeLedenDominant) trend = 'opkomend'
    else if (dominant.leden < vorigeLedenDominant) trend = 'afnemend'
    else trend = 'aanhoudend'
  }

  return {
    onvoldoende: false,
    periodeDagen: RECENTE_PERIODE_DAGEN,
    totaalLeden: memberIds.length,
    dominant: { thema: dominant.thema, leden: dominant.leden, trend },
    ranked: ranked.slice(0, 5).map(r => ({ thema: r.thema, leden: r.leden })),
  }
}
