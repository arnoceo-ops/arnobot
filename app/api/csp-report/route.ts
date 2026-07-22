import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function notifyTelegram(directive: string, blocked: string, page: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!token || !chatId) return

  const text = `CSP schending op arno.bot\n\nGeblokkeerd: ${blocked}\nRegel: ${directive}\nPagina: ${page}`
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const report = body['csp-report'] ?? body

    const directive = report['violated-directive'] ?? null
    const blocked   = report['blocked-uri'] ?? null
    const page      = report['document-uri'] ?? null

    // Negeer meldingen van buiten productie (bv. localhost tijdens lokaal
    // ontwikkelen) — anders komt elke lokale dev-sessie in de Telegram-
    // meldingen en de violations-tabel terecht naast echte gebruikersmeldingen.
    let hostname = ''
    try { hostname = page ? new URL(page).hostname : '' } catch {}
    if (!hostname.endsWith('arno.bot')) {
      return new NextResponse(null, { status: 204 })
    }

    await supabase.from('arnobot_csp_violations').insert({
      document_uri: page,
      violated_directive: directive,
      blocked_uri: blocked,
      user_agent: req.headers.get('user-agent') ?? null,
    })

    // Alleen notificatie als deze combinatie nog niet in de afgelopen 24 uur is gemeld
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { count } = await supabase
      .from('arnobot_csp_violations')
      .select('*', { count: 'exact', head: true })
      .eq('violated_directive', directive)
      .eq('blocked_uri', blocked)
      .gte('created_at', since)

    if (count === 1) {
      await notifyTelegram(directive ?? '?', blocked ?? '?', page ?? '?')
    }
  } catch {
    // Nooit een error teruggeven — browser verwacht 204
  }

  return new NextResponse(null, { status: 204 })
}
