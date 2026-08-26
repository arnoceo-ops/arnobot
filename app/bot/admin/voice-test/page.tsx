import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import AdminNav from '../AdminNav'
import VoiceTestClient from './VoiceTestClient'
import TestPersonaButtons from '../test-persona/TestPersonaButtons'
import { MANUAL_TEST_USER_ID } from '@/lib/internalTestAccounts'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Bepaalt de huidige test-persona server-side (geen client-fetch-race, zie CLAUDE.md
// "Client-side status-fetches — altijd een loaded-gate"), zodat de knoppen meteen de
// juiste staat tonen bij het laden van de pagina.
async function huidigePersona(): Promise<string> {
  const [{ data: approved }, { data: member }, { data: profielRow }] = await Promise.all([
    supabase.from('approved_users').select('command_manager').eq('user_id', MANUAL_TEST_USER_ID).maybeSingle(),
    supabase.from('arnobot_team_members').select('role').eq('user_id', MANUAL_TEST_USER_ID).maybeSingle(),
    supabase.from('arnobot_blog_profiles').select('profiel').eq('user_id', MANUAL_TEST_USER_ID).maybeSingle(),
  ])

  if (approved?.command_manager && member?.role === 'manager') return 'teammanager'
  if (member?.role === 'member') return 'teamlid'

  const rol = (profielRow?.profiel as { rol?: string } | null)?.rol
  if (rol === 'CEO/DGA') return 'ceo'
  if (rol === 'Solopreneur') return 'solopreneur'
  return 'verkoper'
}

// "TEMP": verzamelplek voor tijdelijke/interne testtools, bewust in het admin-menu
// zichtbaar onder die naam (was: VOICE) zodat duidelijk is dat dit geen permanente
// productfunctionaliteit is. Voice-test en de test-persona-switcher staan hier samen.
export default async function VoiceTestPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('arnobot_admin')?.value
  if (!token || token !== process.env.ARNOBOT_ADMIN_KEY) redirect('/bot/admin/login')

  const persona = await huidigePersona()

  return (
    <main style={{ background: '#111827', minHeight: '100vh', color: '#f1f5f9', fontFamily: 'sans-serif' }}>
      <AdminNav active="/bot/admin/voice-test" />
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '48px 40px 80px' }}>
        <p style={{ color: '#f59e0b', fontSize: '12px', letterSpacing: '4px', marginBottom: '8px' }}>ARNOBOT TEAM</p>
        <h1 style={{ fontSize: '48px', fontWeight: 700, margin: '0 0 12px 0', letterSpacing: '-1px', color: '#f1f5f9' }}>Test Personas</h1>
        <p style={{ fontSize: '14px', color: '#6b7280', lineHeight: 1.6, margin: '0 0 24px 0' }}>
          Zet het handmatige testaccount (test@arno.bot) in één klik om naar een andere rol, door de echte onderliggende data te wijzigen (teamlidmaatschap, command_manager, profiel.rol).
        </p>
        <TestPersonaButtons initial={persona} />
      </div>
      <VoiceTestClient />
    </main>
  )
}
