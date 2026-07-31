import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { feedback } = await req.json()
  if (!feedback?.trim()) return NextResponse.json({ error: 'Geen feedback' }, { status: 400 })
  if (typeof feedback !== 'string' || feedback.length > 2000) {
    return NextResponse.json({ error: 'Ongeldig verzoek' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { data: user } = await supabase
    .from('approved_users')
    .select('voornaam, achternaam, email')
    .eq('user_id', userId)
    .single()

  const naam = [user?.voornaam, user?.achternaam].filter(Boolean).join(' ') || user?.email || userId

  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!token || !chatId) return NextResponse.json({ error: 'Telegram niet geconfigureerd' }, { status: 500 })

  const tgSafe = (s: string) => s.replace(/[\r\n\t]/g, ' ')
  const text = `Feedback van ${tgSafe(naam)}\n\n${tgSafe(feedback.trim())}`
  const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  })
  const tgData = await tgRes.json()
  if (!tgData.ok) {
    console.error('Telegram error:', tgData)
    return NextResponse.json({ error: 'Verzenden mislukt' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
