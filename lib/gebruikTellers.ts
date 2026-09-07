import type { SupabaseClient } from '@supabase/supabase-js'
import type { GroeibalansTellers } from '@/lib/groeibalans'

// Eén bron voor de "hoeveel gebruikt deze persoon ArnoBot"-tellers: gesprekken, sparsessies,
// analyses, coaching. Gebruikt door het Gebruiksbalans-kader (app/bot/page.tsx), de
// AI-herclassificatie (lib/groeibalansServer.ts) en de PostHog person-properties
// (app/api/bot/posthog-identity/route.ts).
//
// Belangrijk: `gesprekken` telt alleen wat de gebruiker zelf óók in zijn Bieb ziet, met exact
// dezelfde twee filters als app/api/bot/sessions/route.ts. Zonder die filters tellen
// verwijderde gesprekken (deleted_at) en community-vragen zonder toestemming
// (community_excluded) mee, wat de teller opblies en o.a. de >= 5-drempel van het kader te
// vroeg deed omslaan. arnobot_analyses gebruikt harde delete, arnobot_coaching is één rij per
// gebruiker en arnobot_sparring_sessions kent geen soft-delete: die drie hebben geen filter nodig.

export async function telGebruik(supabase: SupabaseClient, userId: string): Promise<GroeibalansTellers> {
  const [gesprekkenRes, sparRes, analysesRes, coachingRes] = await Promise.all([
    supabase
      .from('arnobot_blog_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .is('deleted_at', null)
      .eq('community_excluded', false),
    supabase.from('arnobot_sparring_sessions').select('*', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('arnobot_analyses').select('*', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('arnobot_coaching').select('*', { count: 'exact', head: true }).eq('user_id', userId),
  ])

  return {
    gesprekken: gesprekkenRes.count ?? 0,
    sparsessies: sparRes.count ?? 0,
    analyses: analysesRes.count ?? 0,
    coaching: coachingRes.count ?? 0,
  }
}
