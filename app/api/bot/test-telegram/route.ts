import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get('arnobot_admin')?.value
  if (!token || token !== process.env.ARNOBOT_ADMIN_KEY) {
    return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
  }

  const tgToken = process.env.TELEGRAM_NEW_USER_BOT_TOKEN
  const tgChat = process.env.TELEGRAM_NEW_USER_CHAT_ID

  if (!tgToken || !tgChat) {
    return NextResponse.json({ error: 'Env vars ontbreken', tgToken: !!tgToken, tgChat: !!tgChat })
  }

  const botRes = await fetch(`https://api.telegram.org/bot${tgToken}/getMe`)
  const botData = await botRes.json()

  const res = await fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: tgChat, text: 'ArnoBot test — Telegram werkt.' }),
  })

  const data = await res.json()
  return NextResponse.json({
    bot: botData?.result ? { username: botData.result.username, name: botData.result.first_name } : botData,
    send_status: res.status,
    send_result: data,
    chat_id_used: tgChat,
  })
}
