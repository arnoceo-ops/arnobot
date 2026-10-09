import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { billingDb, type SubRow } from '@/lib/billing/db'
import { mollieIngeschakeld } from '@/lib/billing/mollie'
import { VERLENG_VENSTER_DAGEN } from '@/lib/billing/perioden'

const DAG_MS = 24 * 60 * 60 * 1000

// Status van het online abonnement voor /bot/doorgaan en de accountpagina. Alleen eigen
// gegevens: userId komt uit de sessie.
export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

  const mollieEnabled = mollieIngeschakeld()
  if (!mollieEnabled) return NextResponse.json({ mollieEnabled, abonnement: null })

  const { data: sub } = await billingDb
    .from('arnobot_subscriptions')
    .select('*')
    .eq('user_id', userId)
    .in('status', ['pending', 'active', 'cancelled'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<SubRow>()

  if (!sub) return NextResponse.json({ mollieEnabled, abonnement: null })

  // Een onafgeronde poging van meer dan twee uur oud telt niet meer mee.
  if (sub.status === 'pending' && Date.now() - new Date(sub.created_at ?? 0).getTime() > 2 * 60 * 60 * 1000) {
    return NextResponse.json({ mollieEnabled, abonnement: null })
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
    mollieEnabled,
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
