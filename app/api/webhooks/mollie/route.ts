import { NextRequest, NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { verwerkMolliebetaling } from '@/lib/billing/verwerking'
import { mollieIngeschakeld } from '@/lib/billing/mollie'

// Mollie-webhook. Mollie stuurt een form-body met alleen `id=tr_...` en ondertekent die
// niet. Daarom vertrouwen we de body nooit: verwerkMolliebetaling haalt de betaling zelf
// op bij Mollie met onze API-sleutel. Een vervalste aanroep kan dus hooguit een
// bestaande betaling opnieuw laten controleren, wat idempotent is.
//
// Antwoord: 200 zodra het id geldig is en de verwerking is gelukt. Bij een fout 500, dan
// probeert Mollie het zelf opnieuw (tot 10 keer). Een ongeldig id krijgt 200 zodat Mollie
// niet blijft herhalen.
export async function POST(req: NextRequest) {
  if (!mollieIngeschakeld()) return NextResponse.json({ ok: true })

  const raw = await req.text()
  const id = new URLSearchParams(raw).get('id') ?? ''
  if (!/^tr_[A-Za-z0-9]{4,40}$/.test(id)) return NextResponse.json({ ok: true })

  try {
    await verwerkMolliebetaling(id)
    return NextResponse.json({ ok: true })
  } catch (e) {
    Sentry.captureException(e, { tags: { onderdeel: 'billing-webhook' } })
    console.error('[webhooks/mollie]', id, e instanceof Error ? e.message : e)
    return NextResponse.json({ error: 'Verwerking mislukt' }, { status: 500 })
  }
}
