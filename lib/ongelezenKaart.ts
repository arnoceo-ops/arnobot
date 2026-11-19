// NIEUW-kaart op /bot: er staat een coaching of SPE-analyse klaar die de gebruiker nog niet heeft
// geopend (bijvoorbeeld omdat hij de pagina verliet terwijl er werd geschreven; de server maakt
// het document dan toch af). Een bevestigde teambaas ziet de SPE-analyse, iedereen anders de
// Mindset/Systeem/Actie-coaching, dezelfde keuze als app/bot/coaching/page.tsx. Alleen server-side.
import type { SupabaseClient } from '@supabase/supabase-js'
import { isOngelezen } from '@/lib/coachingGelezen'

export type OngelezenKaart = {
  label: string
  regel: string
  tekst: string
  knop: string
  href: string
}

export async function bepaalOngelezenKaart(db: SupabaseClient, userId: string, teambaas: boolean): Promise<OngelezenKaart | null> {
  const { data, error } = teambaas
    ? await db.from('arnobot_salesbaas_coaching').select('updated_at, gelezen_op, strategy_score').eq('user_id', userId).maybeSingle()
    : await db.from('arnobot_coaching').select('updated_at, gelezen_op, mindset_score').eq('user_id', userId).maybeSingle()
  if (error || !data) return null

  // Een oude rij zonder scores laat de coachingpagina niets tonen (CoachingClient), dus ook geen kaart.
  const heeftInhoud = teambaas
    ? (data as { strategy_score?: number | null }).strategy_score != null
    : (data as { mindset_score?: number | null }).mindset_score != null
  if (!heeftInhoud) return null
  if (!isOngelezen(data.updated_at as string, data.gelezen_op as string | null)) return null

  const datum = new Date(data.updated_at as string).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', timeZone: 'Europe/Amsterdam' })
  const soort = teambaas ? 'analyse' : 'coaching'
  return {
    label: 'NIEUW',
    regel: `geschreven op ${datum}`,
    tekst: `Je nieuwe ${soort} staat klaar. Lees hem nu.`,
    knop: teambaas ? 'LEES ANALYSE' : 'LEES COACHING',
    href: '/bot/coaching',
  }
}
