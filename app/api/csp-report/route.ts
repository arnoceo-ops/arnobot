import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function stripQuery(value: unknown): string | null {
  if (typeof value !== 'string') return null
  return value.split(/[?#]/)[0]
}

async function notifyTelegram(directive: string, blocked: string, page: string, sourceFile: string | null, lineNumber: number | null, columnNumber: number | null) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!token || !chatId) return

  const bron = sourceFile ? `\nBron: ${sourceFile}${lineNumber ? `:${lineNumber}${columnNumber ? `:${columnNumber}` : ''}` : ''}` : ''
  const text = `CSP schending op arno.bot\n\nGeblokkeerd: ${blocked}\nRegel: ${directive}\nPagina: ${page}${bron}`
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
    // Query en fragment weg: signed-upload-URL's bevatten een token, en met unieke tokens
    // werkte de 24-uurs-dedup hieronder niet (elke poging een nieuwe melding).
    const blocked   = stripQuery(report['blocked-uri'] ?? null)
    const page      = stripQuery(report['document-uri'] ?? null)
    // Brondbestand + regel/kolom, door de browser standaard meegestuurd maar nooit opgeslagen
    // (2-10-2026): zonder deze velden is een melding als "eval geblokkeerd op /" niet te
    // herleiden naar het veroorzakende scriptje, alleen te gissen.
    const sourceFile = stripQuery(report['source-file'] ?? null)
    const lineNumber = report['line-number'] ?? null
    const columnNumber = report['column-number'] ?? null

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
      source_file: sourceFile,
      line_number: lineNumber,
      column_number: columnNumber,
    })

    // Alleen notificatie als deze combinatie nog niet in de afgelopen 24 uur is gemeld
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { count } = await supabase
      .from('arnobot_csp_violations')
      .select('*', { count: 'exact', head: true })
      .eq('violated_directive', directive)
      .eq('blocked_uri', blocked)
      .gte('created_at', since)

    // frame-ancestors-schendingen (externe partijen die arno.bot inbedden, bv. linkpreviews)
    // worden wel opgeslagen maar niet gemeld: ruis, geen bug in onze eigen pagina's.
    if (count === 1 && !directive?.startsWith('frame-ancestors')) {
      await notifyTelegram(directive ?? '?', blocked ?? '?', page ?? '?', sourceFile, lineNumber, columnNumber)
    }
  } catch {
    // Nooit een error teruggeven — browser verwacht 204
  }

  return new NextResponse(null, { status: 204 })
}
