import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import AdminNav from '../AdminNav'
import TestPersonaButtons from './TestPersonaButtons'
import { MANUAL_TEST_USER_ID } from '@/lib/internalTestAccounts'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Bepaalt de huidige persona server-side (geen client-fetch-race, zie CLAUDE.md
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

export default async function TestPersonaPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('arnobot_admin')?.value
  if (!token || token !== process.env.ARNOBOT_ADMIN_KEY) redirect('/bot/admin/login')

  const persona = await huidigePersona()

  return (
    <>
      <AdminNav active="/bot/admin/test-persona" />
      <div className="admin-content" style={{ maxWidth: '800px', margin: '0 auto', padding: '48px 40px' }}>
        <h1 style={{ fontSize: '48px', fontWeight: 700, margin: '0 0 16px 0', letterSpacing: '-1px' }}>Test-persona</h1>
        <p style={{ fontSize: '14px', color: '#6b7280', lineHeight: 1.6, margin: '0 0 32px 0' }}>
          Zet het handmatige testaccount (test@arno.bot) in één klik om naar een andere rol, door de echte onderliggende data te wijzigen (teamlidmaatschap, command_manager, profiel.rol). Geen bypass, elke pagina gedraagt zich exact zoals bij een echte gebruiker met die gegevens.
        </p>
        <p style={{ fontSize: '12px', color: '#f59e0b', lineHeight: 1.6, margin: '0 0 32px 0' }}>
          Let op: een account kan maar één rol tegelijk hebben. Overschakelen naar een andere persona vervangt de huidige.
        </p>
        <TestPersonaButtons initial={persona} />
      </div>
    </>
  )
}
