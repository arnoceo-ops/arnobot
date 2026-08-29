import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Detecteert het patroon van reflexief "ja, gedaan" klikken zonder het echt te doen: hoog
// ja-percentage GECOMBINEERD met opvallend snelle klikken. Percentage alleen zou ook een
// oprecht goed presterende gebruiker raken, snelheid alleen zegt niets zonder het percentage.
// Rolling window (laatste 10 beantwoorde acties), geen permanente vlag: het patroon moet
// vanzelf normaliseren zodra het gedrag verandert, niet blijven hangen op oud gedrag.
const MIN_SAMPLE = 5
const RECENT_WINDOW = 10
const SNEL_MS = 2000
const JA_PERCENTAGE_DREMPEL = 0.8
const SNELLE_JA_PERCENTAGE_DREMPEL = 0.5
const VERVOLGVRAAG_KANS_BASIS = 1 / 3

export type ActiePatroon = {
  geescaleerd: boolean
  jaPercentage: number | null
  snelleJaPercentage: number | null
  aantal: number
}

export async function berekenActiePatroon(userId: string): Promise<ActiePatroon> {
  const { data } = await supabase
    .from('arnobot_blog_sessions')
    .select('actie_status, actie_klik_ms')
    .eq('user_id', userId)
    .eq('community_excluded', false)
    .not('actie_status', 'is', null)
    .order('created_at', { ascending: false })
    .limit(RECENT_WINDOW)

  const antwoorden = data ?? []
  const aantal = antwoorden.length
  if (aantal < MIN_SAMPLE) {
    return { geescaleerd: false, jaPercentage: null, snelleJaPercentage: null, aantal }
  }

  const jaAntwoorden = antwoorden.filter(a => a.actie_status === 'ja')
  const jaPercentage = jaAntwoorden.length / aantal
  const snelleJa = jaAntwoorden.filter(a => typeof a.actie_klik_ms === 'number' && a.actie_klik_ms < SNEL_MS)
  const snelleJaPercentage = jaAntwoorden.length > 0 ? snelleJa.length / jaAntwoorden.length : 0

  const geescaleerd = jaPercentage >= JA_PERCENTAGE_DREMPEL && snelleJaPercentage >= SNELLE_JA_PERCENTAGE_DREMPEL
  return { geescaleerd, jaPercentage, snelleJaPercentage, aantal }
}

// Geëscaleerd: altijd een vervolgvraag bij "ja". Niet geëscaleerd: onvoorspelbaar (1 op de 3)
// zodat een gebruiker nooit zeker weet wanneer een klik wel/niet wordt doorgevraagd.
export function moetVervolgvraagStellen(patroon: ActiePatroon): boolean {
  if (patroon.geescaleerd) return true
  return Math.random() < VERVOLGVRAAG_KANS_BASIS
}
