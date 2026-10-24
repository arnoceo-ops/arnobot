import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'
import { billingDb, type SubRow } from '@/lib/billing/db'
import { isTeamCovered } from '@/lib/teamAccess'
import { datumToegang, trialEinde } from '@/lib/toegang'
import { VERLENG_VENSTER_DAGEN } from '@/lib/billing/perioden'

const DAG_MS = 24 * 60 * 60 * 1000

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Status van het abonnement en de toegang voor /bot/doorgaan en de accountpagina. Alleen eigen
// gegevens: userId komt uit de sessie.
export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

  const { data: gebruiker } = await supabase
    .from('approved_users')
    .select('paid_at, expires_at, trial_start, is_active')
    .eq('user_id', userId)
    .maybeSingle()

  // Voor de tekst op /bot/doorgaan: loopt de proefperiode nog, of is de toegang al afgelopen. Zelfde
  // regels als proxy.ts: actief, en eigen datums of teamtoegang.
  const toegangActief = !!gebruiker && gebruiker.is_active !== false && (datumToegang(gebruiker) || await isTeamCovered(userId))
  const status = {
    eerderBetaald: !!gebruiker?.paid_at,
    // Alleen "betaald en actief" als de toegang niet is verlopen (afgelopen of terugbetaald): zo kan
    // iemand na afloop gewoon opnieuw afrekenen.
    alBetaald: !!gebruiker?.paid_at && !(gebruiker.expires_at && new Date(gebruiker.expires_at) < new Date()),
    toegangActief,
    // Einde van de proefperiode als die nog loopt: een abonnement dat nu wordt afgesloten gaat dan
    // pas op dat moment in (lib/billing/verwerking.ts), de afrekenpagina toont die datum.
    trialEinde: gebruiker && gebruiker.is_active !== false ? (trialEinde(gebruiker)?.toISOString() ?? null) : null,
  }

  const { data: sub } = await billingDb
    .from('arnobot_subscriptions')
    .select('*')
    .eq('user_id', userId)
    .in('status', ['pending', 'active', 'cancelled'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<SubRow>()

  if (!sub) return NextResponse.json({ ...status, abonnement: null })

  // Een onafgeronde poging van meer dan twee uur oud telt niet meer mee.
  if (sub.status === 'pending' && Date.now() - new Date(sub.created_at ?? 0).getTime() > 2 * 60 * 60 * 1000) {
    return NextResponse.json({ ...status, abonnement: null })
  }

  const nu = Date.now()
  const contractEinde = sub.contract_einde ? new Date(sub.contract_einde).getTime() : null
  const kanVerlengen =
    sub.status === 'active' &&
    sub.klant_type === 'particulier' &&
    contractEinde !== null &&
    contractEinde > nu &&
    contractEinde - nu <= VERLENG_VENSTER_DAGEN * DAG_MS

  return NextResponse.json({
    ...status,
    abonnement: {
      status: sub.status,
      plan: sub.plan,
      cyclus: sub.cyclus,
      klantType: sub.klant_type,
      periodeEinde: sub.periode_einde,
      contractEinde: sub.contract_einde,
      opzeggingIngaatOp: sub.opzegging_ingaat_at,
      kanVerlengen,
    },
  })
}
