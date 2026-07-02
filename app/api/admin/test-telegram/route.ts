import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function POST() {
  const cookieStore = await cookies()
  const token = cookieStore.get('arnobot_admin')?.value
  if (!token || token !== process.env.ARNOBOT_ADMIN_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const tgToken = process.env.TELEGRAM_NEW_USER_BOT_TOKEN
  const tgChat = process.env.TELEGRAM_NEW_USER_CHAT_ID

  if (!tgToken || !tgChat) {
    return NextResponse.json({ error: 'Env vars ontbreken', tgToken: !!tgToken, tgChat: !!tgChat }, { status: 500 })
  }

  const res = await fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: tgChat, text: 'ArnoBot admin test: Telegram werkt.' }),
  })
  const data = await res.json()
  return NextResponse.json({ ok: data.ok, telegram: data })
}
