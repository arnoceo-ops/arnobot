import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import * as Sentry from '@sentry/nextjs'
import { billingDb, type PayRow } from '@/lib/billing/db'
import { betaalTerug, MollieError, mollieIngeschakeld } from '@/lib/billing/mollie'
import { markeerTerugbetaald, verwerkMolliebetaling } from '@/lib/billing/verwerking'
import { adminKeyMatches } from '@/lib/adminAuth'
import { logAdminActie } from '@/lib/adminLog'

// Volledige terugbetaling van de laatste online betaling van een gebruiker, bedoeld voor de
// bedenktijd van 14 dagen (voorwaarden artikel 8). Het beëindigen van de toegang, het
// stopzetten van het Mollie-abonnement en de bevestigingsmail volgen uit de gewone
// betaalverwerking (verwerkMolliebetaling), zodat webhook en deze actie dezelfde route lopen.
export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get('arnobot_admin')?.value
  if (!adminKeyMatches(token)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!mollieIngeschakeld()) return NextResponse.json({ error: 'Mollie is niet ingeschakeld' }, { status: 503 })

  const { userId, bevestigNaBedenktijd } = await req.json().catch(() => ({}))
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

  // De bedenktijd is 14 dagen na de betaling (voorwaarden artikel 8). Daarna terugbetalen kan
  // bewust, maar nooit per ongeluk: zonder expliciete bevestiging geeft dit een 409 terug.
  const dagenGeleden = betaling.betaald_at
    ? Math.floor((Date.now() - new Date(betaling.betaald_at).getTime()) / 86_400_000)
    : null
  const buitenBedenktijd = dagenGeleden !== null && dagenGeleden > 14
  if (buitenBedenktijd && bevestigNaBedenktijd !== true) {
    return NextResponse.json(
      { error: `Deze betaling is ${dagenGeleden} dagen oud, buiten de bedenktijd van 14 dagen`, buitenBedenktijd: true, dagen: dagenGeleden },
      { status: 409 },
    )
  }

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
    await logAdminActie({
      actie: 'terugbetaling', doelUserId: userId,
      details: { extra: { bedrag_cent: betaling.bedrag_cent, mollie_payment_id: betaling.mollie_payment_id, dagen_na_betaling: dagenGeleden, buiten_bedenktijd: buitenBedenktijd, refund_id: refund.id } },
    })
    return NextResponse.json({ ok: true, refundId: refund.id, bedragCent: betaling.bedrag_cent })
  } catch (e) {
    Sentry.captureException(e, { tags: { onderdeel: 'billing-refund' } })
    console.error('[admin/refund]', e instanceof MollieError ? e.message : e instanceof Error ? e.message : e)
    return NextResponse.json({ error: 'Terugbetaling mislukt' }, { status: 502 })
  }
}
