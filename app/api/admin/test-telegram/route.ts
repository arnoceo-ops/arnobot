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

  // Bot 1: nieuwe gebruikers
  const t1 = process.env.TELEGRAM_NEW_USER_BOT_TOKEN
  const c1 = process.env.TELEGRAM_NEW_USER_CHAT_ID
  if (t1 && c1) {
    results.nieuwe_gebruikers = { configured: true, ...(await sendTg(t1, c1, 'ArnoBot test: nieuwe-gebruikers bot werkt.')) }
  } else {
    results.nieuwe_gebruikers = { configured: false }
  }

  // Bot 2: RSS ingest
  const t2 = process.env.TELEGRAM_BOT_TOKEN
  const c2 = process.env.TELEGRAM_CHAT_ID
  if (t2 && c2) {
    results.rss_ingest = { configured: true, ...(await sendTg(t2, c2, 'ArnoBot test: RSS-ingest bot werkt.')) }
  } else {
    results.rss_ingest = { configured: false }
  }

  return NextResponse.json({ results })
}
