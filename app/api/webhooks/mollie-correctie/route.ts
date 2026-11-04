import { NextRequest, NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { verwerkKlanttypeCorrectie } from '@/lib/billing/klanttypeCorrectie'
import { MollieError, mollieIngeschakeld } from '@/lib/billing/mollie'
import { leesRijHint, leesWebhookId } from '@/lib/billing/webhookId'

// Losse webhook voor de particulier->zakelijk correctiebetaling (zie
// lib/billing/klanttypeCorrectie.ts), bewust gescheiden van de solo- en Team-webhooks: raakt
// zo geen van beide bewezen flows. Zelfde beveiliging: nooit de body of het `?r=`-hint
// vertrouwen, de betaling wordt altijd bij Mollie bevestigd.
export async function POST(req: NextRequest) {
  if (!mollieIngeschakeld()) return NextResponse.json({ ok: true })

  const id = leesWebhookId(await req.text())
  if (!id) return NextResponse.json({ ok: true })
  const hint = leesRijHint(req.nextUrl.searchParams.get('r'))

  try {
    await verwerkKlanttypeCorrectie(id, hint)
    return NextResponse.json({ ok: true })
  } catch (e) {
    if (e instanceof MollieError && e.status === 404) return NextResponse.json({ ok: true })
    Sentry.captureException(e, { tags: { onderdeel: 'klanttype-correctie-webhook' } })
    console.error('[webhooks/mollie-correctie]', id, e instanceof Error ? e.message : e)
    return NextResponse.json({ error: 'Verwerking mislukt' }, { status: 500 })
  }
}
