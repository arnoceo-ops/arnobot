import { NextRequest, NextResponse } from 'next/server'
import { notifyCronFailure, notifyTelegram } from '@/lib/cron-notify'
import { nieuwMelden } from '@/lib/capaciteit'
import { pushActief } from '@/lib/adminPush'
import { leesCrons } from '@/lib/cronOverzicht'
import { leesCronRuns, registreerCronRun } from '@/lib/cronRun'
import { ALARM_STATEN, beoordeelCron, bouwCronWachtBericht, registratieStartVan } from '@/lib/cronGezondheid'

// Dagelijks 07:40 UTC. Meldt via Telegram een geplande cron die te laat is (draait niet meer, of
// nooit sinds de registratie) of is afgebroken (gestart maar nooit afgerond, meestal een timeout).
// Dat zijn de storingen die anders onzichtbaar zijn: een mislukte run meldt zichzelf al via
// notifyCronFailure, dus die staat hier bewust niet in. Eén melding per cron en staat per week
// (zelfde dubbele-meldingsbeveiliging als de capaciteitswacht). Anders stil.
async function cronHandler(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const runs = await leesCronRuns()
    const registratieStart = registratieStartVan(runs)
    const nu = new Date()

    const problemen = leesCrons()
      // Deze wacht beoordeelt zichzelf niet: zijn eigen run is op dit moment net gestart.
      .filter(c => c.pad !== '/api/cron/cron-wacht')
      .map(c => ({ c, g: beoordeelCron(runs[c.pad], c.schema, nu, registratieStart, c.ingepland) }))
      .filter(x => ALARM_STATEN.includes(x.g.staat))

    const nieuw = []
    for (const p of problemen) if (await nieuwMelden(`cron:${p.c.pad}:${p.g.staat}`, 'waarschuwing')) nieuw.push(p)

    // De crons zijn een stip in de admin-app. Neemt die het over, dan meldt Telegram alleen nog als de
    // stip-wacht zelf stilligt, want die kan dat niet over zichzelf melden.
    const stipWachtStil = problemen.some(p => p.c.pad === '/api/cron/stip-wacht')
    if (nieuw.length > 0 && (stipWachtStil || !(await pushActief()))) {
      await notifyTelegram(bouwCronWachtBericht(nieuw.map(p => ({ naam: p.c.naam, staat: p.g.staat, tekst: p.g.tekst }))))
    }

    return NextResponse.json({ ok: true, problemen: problemen.length, gemeld: nieuw.map(p => p.c.pad) })
  } catch (err) {
    await notifyCronFailure('cron-wacht', err)
    return NextResponse.json({ error: 'cron_error' }, { status: 500 })
  }
}

export const GET = registreerCronRun('/api/cron/cron-wacht', cronHandler)
