import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isExcludedFromProductAnalytics } from '@/lib/internalTestAccounts'

// Levert de veilige, categorische person-properties voor PostHog. Wordt één keer per
// sessie door PostHogTracker.tsx opgehaald en via posthog.identify() gezet.
//
// Bewust server-side: de waarden komen uit de database o.b.v. de Clerk-sessie, nooit uit
// de request body. Geen PII in de response (geen naam, e-mail, bedrijfsnaam, vrije tekst).

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const PLAN_LABEL: Record<string, string> = {
  basis: 'basic',
  premium: 'pro',
  team: 'team',
}

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

  const [approvedRes, profielRes, teamRes, gesprekkenRes, coachingRes] = await Promise.all([
    supabase
      .from('approved_users')
      .select('plan, command_manager, created_at, trial_start, expires_at, paid_at')
      .eq('user_id', userId)
      .maybeSingle(),
    supabase.from('arnobot_blog_profiles').select('profiel').eq('user_id', userId).maybeSingle(),
    supabase.from('arnobot_team_members').select('team_id, role').eq('user_id', userId).maybeSingle(),
    supabase.from('arnobot_blog_sessions').select('*', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('arnobot_coaching').select('*', { count: 'exact', head: true }).eq('user_id', userId),
  ])

  const u = approvedRes.data
  const rol = (profielRes.data?.profiel as { rol?: string } | null)?.rol || null
  const teamId = teamRes.data?.team_id ?? null

  const now = Date.now()
  let trialStatus: 'betaald' | 'verlopen' | 'actief' = 'actief'
  if (u?.paid_at) trialStatus = 'betaald'
  else if (u?.expires_at && new Date(u.expires_at).getTime() < now) trialStatus = 'verlopen'

  const props: Record<string, string | number | boolean | null> = {
    plan: u?.plan ? (PLAN_LABEL[u.plan] ?? u.plan) : 'onbekend',
    rol,
    trial_status: trialStatus,
    heeft_team: teamId !== null,
    // team_id is een interne UUID (geen teamnaam), gebruikt om in analyses per klant-team
    // uit te splitsen zonder de betaalde "group analytics"-add-on van PostHog.
    team_id: teamId,
    team_rol: teamRes.data?.role ?? null,
    is_teambaas: u?.command_manager === true,
    aangemeld_op: u?.created_at ?? u?.trial_start ?? null,
    aantal_gesprekken: gesprekkenRes.count ?? 0,
    aantal_coachingsessies: coachingRes.count ?? 0,
    // True voor de interne testaccounts en de oprichter. In PostHog filter je hierop via
    // Settings -> Project -> "Internal and test users" (person property is_intern = true),
    // zodat dit verkeer uit alle insights valt, ongeacht IP of apparaat.
    is_intern: isExcludedFromProductAnalytics(userId),
  }

  return NextResponse.json({ distinctId: userId, props })
}
