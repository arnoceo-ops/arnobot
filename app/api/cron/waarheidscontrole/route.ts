import { NextRequest, NextResponse } from 'next/server'
import { notifyCronFailure, notifyTelegram } from '@/lib/cron-notify'
import { verstuurMailZacht } from '@/lib/mail'
import { maakWaarheidsRapport, maakRapportMail } from '@/lib/waarheidsRapport'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

// Wekelijkse waarheidscontrole (maandag): zie lib/waarheidsRapport.ts. Stuurt Arno een mail met de
// steekproef en een korte Telegram-melding zonder gebruikersinhoud. ?dry=1 (met CRON_SECRET) geeft
// het rapport terug zonder iets te versturen.
export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const dry = req.nextUrl.searchParams.get('dry') === '1'

  try {
    const rapport = await maakWaarheidsRapport()
    const samenvatting = { gecontroleerd: rapport.gecontroleerd, zonderBron: rapport.zonderBron, mislukt: rapport.mislukt, hoog: rapport.hoog, middel: rapport.middel, laag: rapport.laag, schoon: rapport.schoon }
    // Een week zonder antwoorden met bron is stil: geen mail, geen melding.
    if (rapport.gecontroleerd === 0) return NextResponse.json({ ok: true, ...samenvatting, verstuurd: false })

    const mail = maakRapportMail(rapport)
    if (dry) return NextResponse.json({ ok: true, dry: true, ...samenvatting, onderwerp: mail.onderwerp, html: mail.html })

    const verstuurd = await verstuurMailZacht({ from: 'ArnoBot <noreply@arno.bot>', to: 'arno@arno.bot', subject: mail.onderwerp, html: mail.html })
    await notifyTelegram(`ARNOBOT WAARHEIDSCONTROLE\n${rapport.gecontroleerd} antwoorden gecontroleerd: ${rapport.hoog} hoog, ${rapport.middel} middel, ${rapport.laag} algemene kennis.\n${verstuurd ? 'Het rapport staat in je mail.' : 'De mail is niet aangekomen, zie Sentry.'}`)
    return NextResponse.json({ ok: true, ...samenvatting, verstuurd })
  } catch (err) {
    await notifyCronFailure('waarheidscontrole', err)
    return NextResponse.json({ error: 'Cron mislukt' }, { status: 500 })
  }
}
