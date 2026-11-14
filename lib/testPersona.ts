import { createClient } from '@supabase/supabase-js'
import { MANUAL_TEST_USER_ID } from '@/lib/internalTestAccounts'

export type TestPlan = 'basis' | 'premium' | 'team'

// Bepaalt de huidige test-persona van het handmatige testaccount (test@arno.bot) server-side, zodat
// de knoppen op /bot/admin/gebruikers meteen de juiste staat tonen bij het laden (geen client-fetch-
// race, zie CLAUDE.md "Client-side status-fetches, altijd een loaded-gate"). Stond eerder op de
// TEMP-pagina (voice-test), die is opgeruimd.
export async function huidigePersona(): Promise<{ persona: string; plan: TestPlan }> {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const [{ data: approved }, { data: member }, { data: profielRow }] = await Promise.all([
    supabase.from('approved_users').select('command_manager, plan').eq('user_id', MANUAL_TEST_USER_ID).maybeSingle(),
    supabase.from('arnobot_team_members').select('role').eq('user_id', MANUAL_TEST_USER_ID).maybeSingle(),
    supabase.from('arnobot_blog_profiles').select('profiel').eq('user_id', MANUAL_TEST_USER_ID).maybeSingle(),
  ])

  const plan = (approved?.plan as TestPlan) ?? 'premium'

  if (approved?.command_manager && member?.role === 'manager') return { persona: 'teammanager', plan }
  if (member?.role === 'member') return { persona: 'teamlid', plan }

  const rol = (profielRow?.profiel as { rol?: string } | null)?.rol
  if (rol === 'CEO/DGA') return { persona: 'ceo', plan }
  if (rol === 'Solopreneur') return { persona: 'solopreneur', plan }
  return { persona: 'verkoper', plan }
}
