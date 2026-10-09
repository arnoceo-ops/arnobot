import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import * as Sentry from '@sentry/nextjs'
import { billingDb, type SubRow } from '@/lib/billing/db'
import { heeftGeldigeMachtiging, maakAbonnement, mollieIngeschakeld } from '@/lib/billing/mollie'
import { abonnementVoorVerlenging, PARTICULIER_LOOPTIJD_MAANDEN, VERLENG_VENSTER_DAGEN, voegMaandenToe } from '@/lib/billing/perioden'
import { planNaam } from '@/lib/billing/prijzen'

const DAG_MS = 24 * 60 * 60 * 1000

// Eén klik verlengen voor particulieren, na de mail op 30 of 7 dagen vóór het einde. We
// gebruiken de bestaande machtiging: er komt een nieuw Mollie-abonnement dat start op het
// contracteinde. Is er geen geldige machtiging meer, dan antwoorden we needsCheckout en
// loopt de gebruiker gewoon door het normale afrekenen.
export async function POST() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
  if (!mollieIngeschakeld()) return NextResponse.json({ error: 'Online betalen is nog niet beschikbaar' }, { status: 503 })

  const { data: sub } = await billingDb
    .from('arnobot_subscriptions')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .eq('klant_type', 'particulier')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<SubRow>()

  if (!sub || !sub.contract_einde) {
    return NextResponse.json({ error: 'Geen abonnement om te verlengen' }, { status: 404 })
  }
  const einde = new Date(sub.contract_einde)
  const resterend = einde.getTime() - Date.now()
  if (resterend <= 0 || resterend > VERLENG_VENSTER_DAGEN * DAG_MS) {
    return NextResponse.json({ error: 'Verlengen kan pas kort voor het einde van je abonnement' }, { status: 400 })
  }

  try {
    if (!(await heeftGeldigeMachtiging(sub.mollie_customer_id))) {
      return NextResponse.json({ needsCheckout: true })
    }
    const plan = abonnementVoorVerlenging(einde, sub.cyclus)
    if (!plan.interval || !plan.startDatum) throw new Error('Geen verlengplan')
    const ms = await maakAbonnement({
      klantId: sub.mollie_customer_id,
      brutoCent: sub.bedrag_cent,
      interval: plan.interval,
      times: plan.times,
      startDatum: plan.startDatum,
      omschrijving: `ArnoBot ${planNaam(sub.plan)} ${sub.cyclus} (verlenging)`,
      metadata: { userId, subscriptionRowId: sub.id },
      idempotencyKey: `verleng-${sub.id}-${sub.contract_einde}`,
    })
    await billingDb
      .from('arnobot_subscriptions')
      .update({
        mollie_subscription_id: ms.id,
        mollie_sub_geannuleerd_at: null,
        contract_einde: voegMaandenToe(einde, PARTICULIER_LOOPTIJD_MAANDEN).toISOString(),
        herinnering_30_at: null,
        herinnering_7_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sub.id)
    return NextResponse.json({ ok: true })
  } catch (e) {
    Sentry.captureException(e, { tags: { onderdeel: 'billing-verlengen' } })
    console.error('[billing/verleng]', e instanceof Error ? e.message : e)
    return NextResponse.json({ error: 'Verlengen is niet gelukt, probeer het zo opnieuw of mail hq@arno.bot' }, { status: 502 })
  }
}
