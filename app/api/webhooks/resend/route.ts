import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { suppressEmail } from '@/lib/blogSubscribers'
import { recordMailEvent } from '@/lib/blogEngagement'

// Resend-webhook voor de blogmails.
// 1. Harde bounces en spamklachten: het adres wordt direct afgemeld, doorgaan met mailen schaadt
//    de reputatie van het afzenderdomein.
// 2. Openen en doorklikken (email.opened, email.clicked): per bezorging bijgehouden, zodat de
//    admin kan zien welke abonnee wat doet (lib/blogEngagement.ts). Alleen actief als open- en
//    kliktracking in Resend voor het domein aanstaat, en dit staat in de privacyverklaring.
//
// Instellen (Resend dashboard, Webhooks): URL https://www.arno.bot/api/webhooks/resend, events
// email.bounced, email.complained, email.opened en email.clicked, en het signing secret als
// RESEND_WEBHOOK_SECRET in Vercel.
// De handtekening wordt geverifieerd; zonder geldig secret doet de route niets.
export async function POST(req: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET
  if (!secret) return NextResponse.json({ error: 'Niet geconfigureerd' }, { status: 503 })

  const payload = await req.text()
  const id = req.headers.get('svix-id')
  const timestamp = req.headers.get('svix-timestamp')
  const signature = req.headers.get('svix-signature')
  if (!id || !timestamp || !signature) return NextResponse.json({ error: 'Ongeldig' }, { status: 400 })

  let event
  try {
    event = new Resend(process.env.RESEND_API_KEY).webhooks.verify({
      payload,
      headers: { id, timestamp, signature },
      webhookSecret: secret,
    })
  } catch {
    return NextResponse.json({ error: 'Ongeldige handtekening' }, { status: 401 })
  }

  try {
    if (event.type === 'email.complained') {
      for (const to of event.data.to) await suppressEmail(to)
    } else if (event.type === 'email.opened') {
      await recordMailEvent(event.data.email_id, 'opened', event.created_at)
    } else if (event.type === 'email.clicked') {
      await recordMailEvent(event.data.email_id, 'clicked', event.created_at, event.data.click?.link)
    } else if (event.type === 'email.bounced') {
      // Alleen blijvende bounces: een tijdelijke (volle inbox) is geen reden om af te melden.
      if (String(event.data.bounce?.type ?? '').toLowerCase() === 'permanent') {
        for (const to of event.data.to) await suppressEmail(to)
      }
    }
  } catch (err) {
    console.error('[webhooks/resend]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Verwerken mislukt' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
