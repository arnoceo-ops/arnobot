import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHmac, timingSafeEqual } from 'crypto'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const MAX_SIGNATURE_AGE_SECONDS = 5 * 60

// Calendly-signatuurformaat: "t=<unix-timestamp>,v1=<hmac-sha256-hex>" over "${t}.${rawBody}".
// Zonder geldige, verse signatuur wordt niets in de database geschreven: dit endpoint is
// publiek bereikbaar, dus iedereen zou anders willekeurige e-mailadressen als "geboekt" kunnen
// markeren.
function isValidSignature(rawBody: string, header: string | null): boolean {
  if (!header) return false
  const parts = Object.fromEntries(header.split(',').map(p => p.split('=') as [string, string]))
  const t = parts.t
  const v1 = parts.v1
  if (!t || !v1) return false

  const age = Math.abs(Date.now() / 1000 - Number(t))
  if (!Number.isFinite(age) || age > MAX_SIGNATURE_AGE_SECONDS) return false

  const signingKey = process.env.CALENDLY_WEBHOOK_SIGNING_KEY
  if (!signingKey) {
    console.error('[webhooks/calendly] CALENDLY_WEBHOOK_SIGNING_KEY ontbreekt')
    return false
  }

  const expected = createHmac('sha256', signingKey).update(`${t}.${rawBody}`).digest('hex')
  const expectedBuf = Buffer.from(expected, 'hex')
  const actualBuf = Buffer.from(v1, 'hex')
  if (expectedBuf.length !== actualBuf.length) return false
  return timingSafeEqual(expectedBuf, actualBuf)
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const signatureHeader = req.headers.get('calendly-webhook-signature')

  if (!isValidSignature(rawBody, signatureHeader)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const payload = JSON.parse(rawBody)
  if (payload.event !== 'invitee.created') {
    return NextResponse.json({ ok: true, skipped: true })
  }

  const email = payload.payload?.email
  if (typeof email !== 'string' || !email) {
    return NextResponse.json({ error: 'Geen e-mailadres in payload' }, { status: 400 })
  }

  const { error } = await supabase
    .from('approved_users')
    .update({ arno_call_booked_at: new Date().toISOString() })
    .eq('email', email)

  if (error) {
    console.error('[webhooks/calendly] update mislukt:', error.message)
    return NextResponse.json({ error: 'Opslaan mislukt' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
