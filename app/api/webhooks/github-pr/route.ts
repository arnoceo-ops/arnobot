import { NextRequest, NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'

// GitHub-signatuurformaat: header "X-Hub-Signature-256: sha256=<hmac-sha256-hex-over-de-raw-body>",
// geen timestamp zoals bij Calendly (app/api/webhooks/calendly/route.ts). Geen destructieve
// werking hier (alleen een Telegram-melding), dus geen apart replay-venster nodig, wel nog
// steeds een geldige signatuur vereisen: dit endpoint is publiek bereikbaar.
function isValidSignature(rawBody: string, header: string | null): boolean {
  if (!header?.startsWith('sha256=')) return false
  const secret = process.env.GITHUB_WEBHOOK_SECRET
  if (!secret) {
    console.error('[webhooks/github-pr] GITHUB_WEBHOOK_SECRET ontbreekt')
    return false
  }

  const expected = createHmac('sha256', secret).update(rawBody).digest('hex')
  const expectedBuf = Buffer.from(expected, 'hex')
  const actualBuf = Buffer.from(header.slice('sha256='.length), 'hex')
  if (expectedBuf.length !== actualBuf.length) return false
  return timingSafeEqual(expectedBuf, actualBuf)
}

async function sendTelegram(text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!token || !chatId) return

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  }).catch(() => {})
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const signatureHeader = req.headers.get('x-hub-signature-256')

  if (!isValidSignature(rawBody, signatureHeader)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const event = req.headers.get('x-github-event')
  const payload = JSON.parse(rawBody)

  // GitHub stuurt dit automatisch één keer bij het aanmaken van de webhook, om te bevestigen
  // dat de koppeling werkt.
  if (event === 'ping') {
    await sendTelegram('GitHub-webhook gekoppeld aan arno.bot: PR-meldingen komen vanaf nu hier binnen.')
    return NextResponse.json({ ok: true })
  }

  if (event !== 'pull_request' || payload.action !== 'opened') {
    return NextResponse.json({ ok: true, skipped: true })
  }

  const pr = payload.pull_request
  const title = pr?.title ?? 'onbekende titel'
  const url = pr?.html_url ?? ''
  const author = pr?.user?.login ?? 'onbekend'
  const branch = pr?.head?.ref ?? ''

  // De documentatie-versheidsroutine (CLAUDE.md, "Documentatie actueel houden") opent bij
  // elke push een PR met tekstcorrecties zodra docs en code uit de pas lopen. Die worden in
  // een gewone Claude Code-sessie nagekeken en gemerged, dus een Telegram-ping erover is
  // puur ruis voor Arno (zijn expliciete keuze, 2026-08-29). Andere PR's (Dependabot,
  // maandelijkse architectuur-audit, handmatig) blijven gewoon een melding geven.
  const isDocsFreshnessPr =
    title.startsWith('Documentatie-versheidscheck') || branch.startsWith('docs/versheidscheck-')
  if (isDocsFreshnessPr) {
    return NextResponse.json({ ok: true, skipped: 'docs-freshness-pr' })
  }

  await sendTelegram(`Nieuwe pull request op arnobot\n\n${title}\nDoor: ${author}\n${url}`)

  return NextResponse.json({ ok: true })
}
