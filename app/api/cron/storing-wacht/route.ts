import { NextRequest, NextResponse } from 'next/server'
import { notifyCronFailure, notifyTelegram } from '@/lib/cron-notify'
import { nieuwMelden } from '@/lib/capaciteit'
import { registreerCronRun } from '@/lib/cronRun'
import { EXTERNE_DIENSTEN } from '@/lib/externeDiensten'
import { leesInstatusMeting } from '@/lib/instatus'
import { beoordeelArnoBot, beoordeelExtern, bouwStoringBericht, type StoringMelding } from '@/lib/storing'

// Elk kwartier. Meldt via Telegram wat de statuspagina alleen toont: arno.bot niet bereikbaar,
// te traag (gemiddelde responstijd van het laatste uur boven de grenzen in lib/performance.ts) of
// een grote storing bij Anthropic, Vercel, Supabase, Clerk of Resend. Anders stil.
// Dubbele-meldingsbeveiliging zoals de capaciteitswacht: een kritieke melding komt hooguit één keer
// per dag terug, een waarschuwing hooguit één keer per week. Een mislukte statusfetch is geen storing.
async function cronHandler(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const [instatus, extern] = await Promise.all([
      leesInstatusMeting(),
      Promise.all(EXTERNE_DIENSTEN.map(async d => {
        try {
          const r = await fetch(d.url, { cache: 'no-store', signal: AbortSignal.timeout(5000) })
          const j = await r.json()
          return { naam: d.name, indicator: (j?.status?.indicator as string | undefined) ?? null }
        } catch {
          return { naam: d.name, indicator: null }
        }
      })),
    ])

    const meldingen: StoringMelding[] = []
    if (instatus) meldingen.push(...beoordeelArnoBot(instatus))
    for (const e of extern) {
      const m = beoordeelExtern(e.naam, e.indicator)
      if (m) meldingen.push(m)
    }

    const nieuw: StoringMelding[] = []
    for (const m of meldingen) if (await nieuwMelden(m.sleutel, m.niveau)) nieuw.push(m)

    if (nieuw.length > 0) await notifyTelegram(bouwStoringBericht(nieuw))

    return NextResponse.json({ ok: true, instatus: instatus !== null, storingen: meldingen.length, gemeld: nieuw.map(m => m.sleutel) })
  } catch (err) {
    await notifyCronFailure('storing-wacht', err)
    return NextResponse.json({ error: 'cron_error' }, { status: 500 })
  }
}

export const GET = registreerCronRun('/api/cron/storing-wacht', cronHandler)
