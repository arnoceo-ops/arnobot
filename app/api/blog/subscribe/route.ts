import { NextRequest, NextResponse } from 'next/server'
import { isBotUserAgent } from '@/lib/botDetection'
import { isValidEmail } from '@/lib/email-templates'
import { clientIp, subscribeEmailLimit, subscribeIpLimit } from '@/lib/blogRateLimit'
import { requestSubscription, normalizeEmail } from '@/lib/blogSubscribers'
import { sendConfirmationMail } from '@/lib/blogMail'

// Publiek aanmeldformulier voor de blogmails. Het antwoord is voor elk geldig adres gelijk,
// ook als het al op de lijst staat, zodat de lijst niet af te vragen is.
export async function POST(req: NextRequest) {
  const ok = NextResponse.json({ ok: true })

  if (isBotUserAgent(req.headers.get('user-agent') || '')) return ok

  const { success } = await subscribeIpLimit.limit(clientIp(req))
  if (!success) return NextResponse.json({ error: 'Te veel pogingen' }, { status: 429 })

  const body = (await req.json().catch(() => null)) as { email?: unknown; topics?: unknown; voornaam?: unknown; website?: unknown } | null
  if (!body) return NextResponse.json({ error: 'Ongeldig verzoek' }, { status: 400 })

  // Honeypot: het verborgen veld is voor mensen leeg. Bots vullen het in, die krijgen een
  // geslaagd antwoord zonder dat er iets gebeurt.
  if (typeof body.website === 'string' && body.website.trim() !== '') return ok

  // Bewust strenger dan isValidEmail: het adres gaat zonder verdere controle de To-header in, dus
  // geen komma's, haken of aanhalingstekens die een tweede ontvanger zouden kunnen inbrengen.
  if (
    typeof body.email !== 'string' ||
    body.email.length > 254 ||
    !isValidEmail(body.email.trim()) ||
    !/^[A-Za-z0-9._%+'-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/.test(body.email.trim())
  ) {
    return NextResponse.json({ error: 'Ongeldig e-mailadres' }, { status: 400 })
  }
  const email = normalizeEmail(body.email)

  const emailLimit = await subscribeEmailLimit.limit(email)
  if (!emailLimit.success) return NextResponse.json({ error: 'Te veel pogingen' }, { status: 429 })

  try {
    const pending = await requestSubscription(email, body.topics, body.voornaam)
    if (pending) await sendConfirmationMail(pending.email, pending.confirmToken, pending.voornaam)
    return ok
  } catch (err) {
    console.error('[blog/subscribe]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Aanmelden mislukt' }, { status: 500 })
  }
}
