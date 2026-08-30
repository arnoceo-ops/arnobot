import { createClient } from '@supabase/supabase-js'
import { E2E_TEST_USER_ID } from '../lib/internalTestAccounts'

// Draait één keer ná alle tests. Ruimt de data op die de geautomatiseerde E2E-run onder
// playwright-test@arno.bot heeft weggeschreven naar dezelfde productie-Supabase als echte
// gebruikers (de routes gebruiken .env.local, zie playwright.config.ts). Zonder deze stap
// hoopt testverkeer zich op in de productie-tabellen; het wordt overal weggefilterd
// (lib/internalTestAccounts.ts + scripts/check-testaccount-filter.mjs), maar fysiek
// opruimen houdt de dataset schoon.
//
// Bewust NIET verwijderd: de approved_users-rij en het arnobot_blog_profiles-profiel van
// het testaccount. Die worden door e2e/auth.setup.ts hergebruikt/ge-upsert en hoeven niet
// elke run opnieuw opgebouwd te worden. Team Hippios (TEST_TEAM_ID) staat los van dit
// account en wordt hier niet aangeraakt.
//
// test@arno.bot (Arno's handmatige testaccount) valt hier NIET onder: dat is geen
// geautomatiseerde run en de filters vangen dat verkeer af.

const TABELLEN = [
  'arnobot_rds_logs',
  'arnobot_memory_entities',
  'arnobot_shared_sessions',
  'arnobot_coaching_history',
  'arnobot_coaching_scores',
  'arnobot_coaching',
  'arnobot_analyses',
  'arnobot_sparring_sessions',
  'arnobot_events',
  'arnobot_blog_sessions',
]

export default async function globalTeardown() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.warn('[e2e teardown] Supabase-env ontbreekt, opruiming overgeslagen')
    return
  }

  const supabase = createClient(url, key)
  for (const tabel of TABELLEN) {
    const { error } = await supabase.from(tabel).delete().eq('user_id', E2E_TEST_USER_ID)
    if (error) console.warn(`[e2e teardown] ${tabel}: ${error.message}`)
  }
}
