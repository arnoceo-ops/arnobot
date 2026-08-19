import { NextRequest, NextResponse } from 'next/server'

// Eenmalige herinnering (2026-09-16) om golf 1 van de systeemprompt-upgrade te evalueren,
// zie docs/SYSTEEMPROMPT_UPGRADE.md. Cron in vercel.json heeft geen native "vuur één keer"-optie
// (alleen dag/maand, dus zou elk jaar op 16 september opnieuw vuren), vandaar deze jaar-guard
// in plaats van een generieke eenmalige-cron-voorziening te bouwen voor één persoonlijke herinnering.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (new Date().getUTCFullYear() !== 2026) {
    return NextResponse.json({ skipped: true, reden: 'eenmalige herinnering, jaar verstreken' })
  }

  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!token || !chatId) {
    return NextResponse.json({ error: 'Telegram niet geconfigureerd' }, { status: 500 })
  }

  const text = `Golf 1 van de systeemprompt-upgrade (kwalificeren bij klantcasussen + neutraal checken van openstaande acties, lib/systemPrompt.ts) staat nu 4 weken live.

Tijd om te evalueren: draai de meta-analyse opnieuw op /bot/admin/meta-analyse voor de gesprekken sinds 19 augustus 2026, en check of "verifieert voor adviseren" en "houdt rekening met openstaande acties" beter scoren dan in de analyse van 18 augustus 2026.

Beslis op basis daarvan over golf 2 (patroonherkenning-als-leermoment plus de "ruimte in plaats van obstakel"-regel). Volledige herleiding staat in docs/SYSTEEMPROMPT_UPGRADE.md.`

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  })

  return NextResponse.json({ ok: true })
}
