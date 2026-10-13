import { NextRequest, NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { verwerkKlanttypeCorrectie } from '@/lib/billing/klanttypeCorrectie'
import { MollieError, mollieIngeschakeld } from '@/lib/billing/mollie'

// Losse webhook voor de particulier->zakelijk correctiebetaling (zie
// lib/billing/klanttypeCorrectie.ts), bewust gescheiden van de solo- en Team-webhooks: raakt
// zo geen van beide bewezen flows. Zelfde beveiliging: Mollie stuurt alleen `id`, altijd zelf
// ophalen bij Mollie, nooit de body vertrouwen.
export async function POST(req: NextRequest) {
  if (!mollieIngeschakeld()) return NextResponse.json({ ok: true })

  const raw = await req.text()
  const id = new URLSearchParams(raw).get('id') ?? ''
  if (!/^tr_[A-Za-z0-9]{4,40}$/.test(id)) return NextResponse.json({ ok: true })

  try {
    await verwerkKlanttypeCorrectie(id)
    return NextResponse.json({ ok: true })
  } catch (e) {
    if (e instanceof MollieError && e.status === 404) return NextResponse.json({ ok: true })
    Sentry.captureException(e, { tags: { onderdeel: 'klanttype-correctie-webhook' } })
    console.error('[webhooks/mollie-correctie]', id, e instanceof Error ? e.message : e)
    return NextResponse.json({ error: 'Verwerking mislukt' }, { status: 500 })
  }
}
