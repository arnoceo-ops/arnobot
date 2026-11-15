import { createClient } from '@supabase/supabase-js'

// Hulpfuncties rond een teamlid en zijn eigen abonnement (docs/TEAM_PROCES.md).

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

/** Heeft deze gebruiker een eigen, lopend online abonnement (status active)? Voor een lid dat zelf iets heeft afgenomen. */
export async function heeftEigenAbonnement(userId: string): Promise<boolean> {
  const { data } = await supabase.from('arnobot_subscriptions').select('id').eq('user_id', userId).eq('status', 'active').limit(1)
  return (data?.length ?? 0) > 0
}

/**
 * Na het verwijderen uit een team: het plan gelijk zetten aan het eigen abonnement dat nog loopt (active, of opgezegd
 * met een einddatum in de toekomst). Bij het joinen kreeg hij het plan van het team (Pro); zonder deze stap houdt een
 * lid met een eigen Basic-abonnement Pro-functies voor de Basic-prijs. Heeft hij niets lopend, dan blijft het plan zoals
 * het is: zijn eigen toegang volgt dan zijn datums en de toegangspoort sluit hem buiten zodra die voorbij zijn.
 */
export async function herstelPlanNaVerwijderen(userId: string, nu: Date = new Date()): Promise<'plan_gezet' | 'ongewijzigd'> {
  const { data } = await supabase
    .from('arnobot_subscriptions')
    .select('plan, status, periode_einde')
    .eq('user_id', userId)
    .in('status', ['active', 'cancelled'])
    .order('created_at', { ascending: false })
    .limit(5)
    .returns<{ plan: 'basis' | 'premium'; status: string; periode_einde: string | null }[]>()
  const lopend = (data ?? []).find(s => s.status === 'active' || (!!s.periode_einde && new Date(s.periode_einde).getTime() > nu.getTime()))
  if (!lopend) return 'ongewijzigd'
  await supabase.from('approved_users').update({ plan: lopend.plan }).eq('user_id', userId)
  return 'plan_gezet'
}
