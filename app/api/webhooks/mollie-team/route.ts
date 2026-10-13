import { NextRequest, NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { verwerkTeamBetaling } from '@/lib/billing/teamFacturatie'
import { MollieError, mollieIngeschakeld } from '@/lib/billing/mollie'

// Losse webhook voor Team-betaallinks (zie lib/billing/mollie.ts, maakBetaalLink), bewust
// gescheiden van /api/webhooks/mollie (solo-abonnementen): zo raakt een wijziging hier nooit
// de al bewezen solo-betaalflow, en andersom. Zelfde beveiligingsredenering: Mollie stuurt
// alleen `id`, nooit vertrouwen, altijd zelf ophalen bij Mollie.
export async function POST(req: NextRequest) {
  if (!mollieIngeschakeld()) return NextResponse.json({ ok: true })

  const raw = await req.text()
  const id = new URLSearchParams(raw).get('id') ?? ''
  if (!/^tr_[A-Za-z0-9]{4,40}$/.test(id)) return NextResponse.json({ ok: true })

  try {
    await verwerkTeamBetaling(id)
    return NextResponse.json({ ok: true })
  } catch (e) {
    if (e instanceof MollieError && e.status === 404) return NextResponse.json({ ok: true })
    Sentry.captureException(e, { tags: { onderdeel: 'team-billing-webhook' } })
    console.error('[webhooks/mollie-team]', id, e instanceof Error ? e.message : e)
    return NextResponse.json({ error: 'Verwerking mislukt' }, { status: 500 })
  }
}
