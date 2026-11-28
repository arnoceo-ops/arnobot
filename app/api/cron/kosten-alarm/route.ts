import { registreerCronRun } from '@/lib/cronRun'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Redis } from '@upstash/redis'
import { notifyCronFailure, notifyTelegram } from '@/lib/cron-notify'
import { amsterdamDatum, datumPlusDagen, dagenInMaand } from '@/lib/amsterdamTijd'
import { getLiveFxRateEurUsd } from '@/lib/fxRate'
import { wieIs } from '@/lib/billing/wie'
import { bepaalAlarmen, bouwAlarmTekst, verstuurAlarmen } from '@/lib/kostenAlarm'
import { haalBetalendeKlanten, haalMaandKostenPerGebruiker } from '@/lib/kostenAlarmData'

// Dagelijks 06:10 UTC. Meldt via Telegram elke betalende klant die deze maand 80% of 100% heeft gekost van wat die per maand betaalt,
// elke drempel een keer per maand, anders stil. Op de eerste van de maand ook de afgelopen maand, zodat de kosten van de laatste dag
// niet ongezien blijven.

export const maxDuration = 60

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function cronHandler(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const nu = new Date()
    const redis = new Redis({ url: process.env.UPSTASH_REDIS_REST_URL!, token: process.env.UPSTASH_REDIS_REST_TOKEN! })
    const vandaag = amsterdamDatum(nu)
    const dag = Number(vandaag.slice(8, 10))
    const dezeMaand = `${vandaag.slice(0, 8)}01`
    const vorigeMaand = `${datumPlusDagen(dezeMaand, -1).slice(0, 8)}01`

    const [klanten, fx] = await Promise.all([haalBetalendeKlanten(supabase, nu), getLiveFxRateEurUsd()])
    const namen = new Map<string, string>()
    const totaal = { klanten: klanten.length, verstuurd: 0, mislukt: 0 }

    for (const maand of dag === 1 ? [vorigeMaand, dezeMaand] : [dezeMaand]) {
      const volgende = `${datumPlusDagen(maand, 32).slice(0, 8)}01`
      const kosten = await haalMaandKostenPerGebruiker(supabase, maand, volgende)
      const [jaar, mnd] = maand.split('-').map(Number)
      const verlopenDeel = maand === dezeMaand ? (dag - 1) / dagenInMaand(jaar, mnd) : 1
      const maandNaam = new Date(Date.UTC(jaar, mnd - 1, 1)).toLocaleDateString('nl-NL', { month: 'long', timeZone: 'UTC' })
      const uit = await verstuurAlarmen(bepaalAlarmen(klanten, kosten, fx.rate), maand.slice(0, 7), redis, async alarm => {
        const id = alarm.klant.userIds[0]
        if (!namen.has(id)) namen.set(id, await wieIs(id))
        return bouwAlarmTekst(alarm, namen.get(id)!, maandNaam, verlopenDeel)
      }, notifyTelegram)
      totaal.verstuurd += uit.verstuurd
      totaal.mislukt += uit.mislukt
    }

    if (totaal.mislukt > 0) throw new Error(`${totaal.mislukt} kostenmelding(en) niet aangekomen, morgen opnieuw`)
    return NextResponse.json({ ok: true, ...totaal })
  } catch (err) {
    await notifyCronFailure('kosten-alarm', err)
    return NextResponse.json({ error: 'cron_error' }, { status: 500 })
  }
}

export const GET = registreerCronRun('/api/cron/kosten-alarm', cronHandler)
