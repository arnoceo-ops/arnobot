import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Bepaalt of iemand daadwerkelijk als teambaas geldt, gebaseerd op de drie bestaande
// gates (command_manager entitlement, echte manager-rol in een team, gebruik niet op
// individueel gezet), nooit op profiel.rol (het onboarding-chipje): dat bleek onbetrouwbaar,
// zie docs/TEAM_PLAN.md sectie "Raamwerk: rollen x disciplines".
export async function isConfirmedTeambaas(userId: string): Promise<boolean> {
  const [memberRes, profileRes, approvedRes] = await Promise.all([
    supabase
      .from('arnobot_team_members')
      .select('role')
      .eq('user_id', userId)
      .single(),
    supabase
      .from('arnobot_blog_profiles')
      .select('profiel')
      .eq('user_id', userId)
      .single(),
    supabase
      .from('approved_users')
      .select('command_manager')
      .eq('user_id', userId)
      .single(),
  ])

  const isManagerLid = memberRes.data?.role === 'manager'
  const gebruik = (profileRes.data?.profiel as { gebruik?: string } | null)?.gebruik ?? null
  const heeftCommandManager = approvedRes.data?.command_manager === true

  return isManagerLid && gebruik !== 'individueel' && heeftCommandManager
}
