import { NextRequest, NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { verwerkTeamBetaling } from '@/lib/billing/teamFacturatie'
import { MollieError, mollieIngeschakeld } from '@/lib/billing/mollie'
import { leesRijHint, leesWebhookId } from '@/lib/billing/webhookId'

// Losse webhook voor Team-betaallinks (zie lib/billing/mollie.ts, maakBetaalLink), bewust
// gescheiden van /api/webhooks/mollie (solo-abonnementen): zo raakt een wijziging hier nooit
// de al bewezen solo-betaalflow, en andersom. Zelfde beveiligingsredenering: nooit de body of
// het `?r=`-hint vertrouwen, de betaling wordt altijd bij Mollie bevestigd (betaald, en horend
// bij de betaallink van de factuur).
export async function POST(req: NextRequest) {
  if (!mollieIngeschakeld()) return NextResponse.json({ ok: true })

  const id = leesWebhookId(await req.text())
  if (!id) return NextResponse.json({ ok: true })
  const hint = leesRijHint(req.nextUrl.searchParams.get('r'))

  try {
    await verwerkTeamBetaling(id, hint)
    return NextResponse.json({ ok: true })
  } catch (e) {
    if (e instanceof MollieError && e.status === 404) return NextResponse.json({ ok: true })
    Sentry.captureException(e, { tags: { onderdeel: 'team-billing-webhook' } })
    console.error('[webhooks/mollie-team]', id, e instanceof Error ? e.message : e)
    return NextResponse.json({ error: 'Verwerking mislukt' }, { status: 500 })
  }
}
