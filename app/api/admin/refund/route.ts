import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import * as Sentry from '@sentry/nextjs'
import { billingDb, type PayRow } from '@/lib/billing/db'
import { betaalTerug, MollieError, mollieIngeschakeld } from '@/lib/billing/mollie'
import { markeerTerugbetaald, verwerkMolliebetaling } from '@/lib/billing/verwerking'
import { adminKeyMatches } from '@/lib/adminAuth'
import { heeftAndereTerugbetaling, restantCent } from '@/lib/billing/terugbetaling'
import { openReferralBedragen, slotVoorTerugbetaling, zonderReferralBedrag } from '@/lib/billing/referralSlot'
import { logAdminActie } from '@/lib/adminLog'
import { notifyTelegram } from '@/lib/cron-notify'

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

  const { userId, bevestigNaBedenktijd, betalingId } = await req.json().catch(() => ({}))
  if (typeof userId !== 'string' || !userId) return NextResponse.json({ error: 'Geen userId' }, { status: 400 })

  // Zonder betalingId de nieuwste betaalde betaling (kan een upgrade of herhaling zijn). Met betalingId
  // precies die betaling, zodat een gericht terug te draaien upgrade niet de verkeerde raakt.
  let betalingQuery = billingDb
    .from('arnobot_payments')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'paid')
  if (typeof betalingId === 'string' && betalingId) betalingQuery = betalingQuery.eq('id', betalingId)
  const { data: kandidaten } = await betalingQuery
    .order('betaald_at', { ascending: false })
    .limit(24)
    .returns<PayRow[]>()
  // Een openstaande referralreservering mag niet laten lijken dat er niets terug te betalen is: dan zou een oudere
  // betaling gekozen worden.
  const open = await openReferralBedragen(kandidaten ?? [])
  if (open.fout) {
    Sentry.captureMessage(`Terugbetalen: referralacties niet te controleren: ${open.fout}`, { level: 'error', tags: { onderdeel: 'billing-refund' } })
    return NextResponse.json({ error: 'Niet te controleren of er een referralterugstorting loopt. Probeer het zo opnieuw.' }, { status: 503 })
  }
  const nogOpen = (b: PayRow) => {
    const o = open.bedragen.get(b.id)
    return o ? o.gereserveerdCent + o.onderwegCent + o.vastCent : 0
  }
  // Een betaling waarop alleen referraltegoed is teruggestort, is nog gewoon terug te betalen.
  let betaling = (kandidaten ?? []).find(b => !heeftAndereTerugbetaling(b, b.terugbetaald_cent ?? 0) && restantCent(zonderReferralBedrag(b, nogOpen(b))) > 0)
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

  // Hetzelfde slot als de referralterugstortingen: wat nog niet verstuurd is valt vrij, nieuwe reserveringen zijn even
  // geblokkeerd. Zonder uitgevoerde SQL bestaat er niets om te blokkeren. Niet te controleren: niets terugbetalen.
  const slot = await slotVoorTerugbetaling(userId, betaling.id)
  if (slot.stand === 'fout') {
    Sentry.captureMessage(`Terugbetalen: referralslot mislukt: ${slot.fout}`, { level: 'error', tags: { onderdeel: 'billing-refund' } })
    return NextResponse.json({ error: 'Niet te controleren of er een referralterugstorting loopt. Probeer het zo opnieuw.' }, { status: 503 })
  }
  if (slot.stand === 'ok') {
    if (slot.onderwegCent > 0) {
      return NextResponse.json({ error: `Op deze betaling loopt nu een referralterugstorting van ${(slot.onderwegCent / 100).toFixed(2)} euro. Die wordt dagelijks nagekeken en loopt na een begrensd aantal mislukte controles vast, met een melding. Probeer het later opnieuw.` }, { status: 409 })
    }
    betaling = { ...betaling, referral_refund_cent: slot.referralRefundCent }
    if (restantCent(betaling) <= 0) {
      if (slot.vastCent > 0) {
        await notifyTelegram(`Terugbetalen niet mogelijk vanuit de admin (referral, arno.bot)\n\nBetaling: ${betaling.mollie_payment_id}\nDe hele betaling staat geboekt als vastgelopen referralterugstorting (${(slot.vastCent / 100).toFixed(2)} euro). Kijk in Mollie of dat is teruggestort. Zo niet, betaal het daar terug en beëindig het abonnement.`)
      }
      return NextResponse.json({ error: 'Geen terug te betalen online betaling gevonden' }, { status: 404 })
    }
  }

  try {
    const refund = await betaalTerug({
      betalingId: betaling.mollie_payment_id,
      brutoCent: restantCent(betaling),
      omschrijving: 'Terugbetaling binnen bedenktijd ArnoBot',
      idempotencyKey: `refund-${betaling.id}`,
    })
    // Toegang meteen beëindigen: Mollie telt een terugbetaling pas mee als hij is afgerond,
    // en dat kan uren tot dagen duren. De webhook later is dan een idempotente no-op.
    await markeerTerugbetaald(betaling.id)
    await verwerkMolliebetaling(betaling.mollie_payment_id)
    if (slot.stand === 'ok' && slot.vastCent > 0) {
      await notifyTelegram(`Controleer of nabetalen nodig is (referral, arno.bot)\n\nBetaling: ${betaling.mollie_payment_id}\nEr staat een vastgelopen referralterugstorting van ${(slot.vastCent / 100).toFixed(2)} euro op, die niet is meebetaald. Is dat bedrag niet teruggestort, betaal het dan na.`)
    }
    await logAdminActie({
      actie: 'terugbetaling', doelUserId: userId,
      details: { extra: { bedrag_cent: restantCent(betaling), mollie_payment_id: betaling.mollie_payment_id, dagen_na_betaling: dagenGeleden, buiten_bedenktijd: buitenBedenktijd, refund_id: refund.id } },
    })
    return NextResponse.json({ ok: true, refundId: refund.id, bedragCent: restantCent(betaling) })
  } catch (e) {
    Sentry.captureException(e, { tags: { onderdeel: 'billing-refund' } })
    console.error('[admin/refund]', e instanceof MollieError ? e.message : e instanceof Error ? e.message : e)
    return NextResponse.json({ error: 'Terugbetaling mislukt' }, { status: 502 })
  }
}
