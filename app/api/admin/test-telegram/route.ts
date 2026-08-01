import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

async function sendTg(token: string, chatId: string, text: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    })
    const data = await res.json()
    return { ok: data.ok, error: data.ok ? undefined : data.description }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
}

export async function POST() {
  const cookieStore = await cookies()
  const token = cookieStore.get('arnobot_admin')?.value
  if (!token || token !== process.env.ARNOBOT_ADMIN_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results: Record<string, { configured: boolean; ok?: boolean; error?: string }> = {}

  // Enige bot in gebruik sinds de samenvoeging van ArnoBot Feedback + ArnoBot NewUsers
  // in de ArnoBot-groep (2026-08-01). Gebruikt voor feedback, CSP-meldingen, cron-fouten,
  // rate-limit-waarschuwingen en overzichtsmails, niet alleen RSS-ingest.
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (botToken && chatId) {
    results.arnobot = { configured: true, ...(await sendTg(botToken, chatId, 'ArnoBot test: bot werkt.')) }
  } else {
    results.arnobot = { configured: false }
  }

  return NextResponse.json({ results })
}
