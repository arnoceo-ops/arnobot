import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import * as Sentry from '@sentry/nextjs'
import { adminKeyMatches } from '@/lib/adminAuth'
import { logAdminActie } from '@/lib/adminLog'
import { legBesluitVast } from '@/lib/billing/referralGrootboek'
import { notifyTelegram } from '@/lib/cron-notify'
import { wieIs } from '@/lib/billing/wie'

// Arno's besluit over een referral die als handwerk in het grootboek staat. Legt alleen vast: er verandert niets aan
// tegoed, betalingen of toegang.
export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  if (!adminKeyMatches(cookieStore.get('arnobot_admin')?.value)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const referralId = typeof body?.referralId === 'string' ? body.referralId : ''
  const besluit = body?.besluit
  if (!referralId || (besluit !== 'toekennen' && besluit !== 'afwijzen')) {
    return NextResponse.json({ error: 'Ongeldige aanvraag' }, { status: 400 })
  }

  try {
    const uitkomst = await legBesluitVast(referralId, {
      besluit,
      nettoCent: typeof body.nettoCent === 'number' ? body.nettoCent : null,
      toelichting: typeof body.toelichting === 'string' ? body.toelichting : '',
    })
    if (!uitkomst.ok) return NextResponse.json({ error: uitkomst.fout }, { status: uitkomst.status })
    await logAdminActie({
      actie: 'referral_besluit', doelUserId: uitkomst.regel.aanbrenger_user_id,
      details: { nieuw: { soort: uitkomst.regel.soort, netto_cent: uitkomst.regel.netto_cent }, extra: { referralId, reden: uitkomst.regel.reden } },
    })
    // De cron meldt alleen zijn eigen regels, dus een mijlpaal door dit besluit gaat hier naar Telegram.
    for (const m of uitkomst.mijlpalen) await notifyTelegram(`Mijlpaal referrals op arno.bot: ${await wieIs(m.aanbrengerId)} heeft ${m.aantal} toekenningen.`)
    return NextResponse.json({ ok: true, mijlpalen: uitkomst.mijlpalen.map(m => m.aantal) })
  } catch (e) {
    Sentry.captureException(e, { tags: { onderdeel: 'referral-besluit' }, extra: { referralId } })
    return NextResponse.json({ error: 'Opslaan mislukt' }, { status: 500 })
  }
}
