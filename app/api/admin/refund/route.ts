import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import * as Sentry from '@sentry/nextjs'
import { billingDb, type PayRow } from '@/lib/billing/db'
import { betaalTerug, MollieError, mollieIngeschakeld } from '@/lib/billing/mollie'
import { markeerTerugbetaald, verwerkMolliebetaling } from '@/lib/billing/verwerking'

// Volledige terugbetaling van de laatste online betaling van een gebruiker, bedoeld voor de
// bedenktijd van 14 dagen (voorwaarden artikel 8). Het beëindigen van de toegang, het
// stopzetten van het Mollie-abonnement en de bevestigingsmail volgen uit de gewone
// betaalverwerking (verwerkMolliebetaling), zodat webhook en deze actie dezelfde route lopen.
export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get('arnobot_admin')?.value
  if (!token || token !== process.env.ARNOBOT_ADMIN_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!mollieIngeschakeld()) return NextResponse.json({ error: 'Mollie is niet ingeschakeld' }, { status: 503 })

  const { userId } = await req.json().catch(() => ({}))
  if (typeof userId !== 'string' || !userId) return NextResponse.json({ error: 'Geen userId' }, { status: 400 })

  const { data: betaling } = await billingDb
    .from('arnobot_payments')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'paid')
    .eq('terugbetaald_cent', 0)
    .order('betaald_at', { ascending: false })
    .limit(1)
    .maybeSingle<PayRow>()
  if (!betaling) return NextResponse.json({ error: 'Geen terug te betalen online betaling gevonden' }, { status: 404 })

  try {
    const refund = await betaalTerug({
      betalingId: betaling.mollie_payment_id,
      brutoCent: betaling.bedrag_cent,
      omschrijving: 'Terugbetaling binnen bedenktijd ArnoBot',
      idempotencyKey: `refund-${betaling.id}`,
    })
    // Toegang meteen beëindigen: Mollie telt een terugbetaling pas mee als hij is afgerond,
    // en dat kan uren tot dagen duren. De webhook later is dan een idempotente no-op.
    await markeerTerugbetaald(betaling.id)
    await verwerkMolliebetaling(betaling.mollie_payment_id)
    return NextResponse.json({ ok: true, refundId: refund.id, bedragCent: betaling.bedrag_cent })
  } catch (e) {
    Sentry.captureException(e, { tags: { onderdeel: 'billing-refund' } })
    console.error('[admin/refund]', e instanceof MollieError ? e.message : e instanceof Error ? e.message : e)
    return NextResponse.json({ error: 'Terugbetaling mislukt' }, { status: 502 })
  }
}
