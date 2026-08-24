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

// Punt 2C "Manager als Variabele": als 3 of meer teamleden onafhankelijk van elkaar hetzelfde
// thema laten domineren, is de kans groot dat niet de teamleden het probleem zijn, maar iets
// systemisch in hoe de manager het team aanstuurt. Bewust GEEN losse detectiefunctie: leunt
// volledig op wat computeSpiegelSignaal (2A) al berekent (dominant.leden), geen nieuwe query,
// geen nieuwe drempel-logica. Bewust een VASTE, letterlijke tekst i.p.v. AI-gegenereerd: dit is
// het gevoeligste signaal van de drie, de formulering moet exact gecontroleerd zijn (geen
// beschuldiging, wel een hypothese), niet elke keer opnieuw door een LLM geschreven worden.
const MANAGER_ALS_VARIABELE_DREMPEL = 3

export function formatSystemischSignaal(spiegel: SpiegelSignaal): string | null {
  if (spiegel.onvoldoende || !spiegel.dominant) return null
  if (spiegel.dominant.leden < MANAGER_ALS_VARIABELE_DREMPEL) return null
  return `Er is een patroon dat bij ${spiegel.dominant.leden} van je teamleden terugkomt: ${spiegel.dominant.thema.toLowerCase()}. Dat kan toeval zijn, maar het kan ook betekenen dat er iets systemisch speelt in hoe het team werkt. Wil je dit bespreken?`
}

// Lagere, zachtere trede vóór het systemische signaal hierboven (Arno's expliciete verzoek,
// 2026-08-22): bij 2 leden op hetzelfde dominante thema, geef dan al een vroege, milde melding
// in de leiderschapspagina, in plaats van dat de eerste keer dat de sales baas hiervan hoort
// meteen de zwaardere "systemisch"-hypothese bij 3+ is. Bewust GEEN kaart op de teampagina en
// GEEN Telegram-melding aan Arno op dit niveau, dat blijft voorbehouden aan de drempel van 3.
// Vaste tekst, zelfde reden als hierboven: niet aan een LLM overlaten.
export function formatVroegSignaal(spiegel: SpiegelSignaal): string | null {
  if (spiegel.onvoldoende || !spiegel.dominant) return null
  if (spiegel.dominant.leden !== 2) return null
  return `Twee van je teamleden laten onafhankelijk van elkaar hetzelfde thema terugkomen: ${spiegel.dominant.thema.toLowerCase()}. Nog geen duidelijk patroon, maar de moeite waard om in de gaten te houden.`
}

const MAANDNAMEN = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']

// Punt 2B "De Tijdlijn", herzien ontwerp (2026-08-21, zie docs/TEAM_PLAN.md): geen eigen
// weergaveblok, alleen extra context voor bestaande AI-syntheses (Team Spotlight) die het
// patroon kunnen duiden, in plaats van het rauw te tonen. Live berekend uit dezelfde
// arnobot_blog_sessions.themas-data als computeSpiegelSignaal, gegroepeerd op kalendermaand
// i.p.v. een lopend venster.
export async function computeThemaMaandTrend(memberIds: string[]): Promise<string> {
  if (memberIds.length === 0) return ''

  const { data: sessions } = await supabase
    .from('arnobot_blog_sessions')
    .select('created_at, themas')
    .in('user_id', memberIds)
    .not('themas', 'is', null)
    .order('created_at', { ascending: true })

  const byMonth = new Map<string, Map<string, number>>()
  for (const s of sessions ?? []) {
    if (!s.themas || s.themas.length === 0) continue
    const month = s.created_at.slice(0, 7)
    if (!byMonth.has(month)) byMonth.set(month, new Map())
    const counts = byMonth.get(month)!
    for (const thema of s.themas) counts.set(thema, (counts.get(thema) ?? 0) + 1)
  }

  const regels = Array.from(byMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([month, counts]) => {
      const dominant = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0]
      const label = `${MAANDNAMEN[parseInt(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`
      return `${label}: dominant thema ${dominant ?? 'onbekend'}`
    })

  return regels.length >= 2 ? regels.join('\n') : ''
}
