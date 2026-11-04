import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { notifyCronFailure, notifyTelegram } from '@/lib/cron-notify'
import { nieuwMelden } from '@/lib/capaciteit'
import { beoordeelCapaciteit } from '@/lib/capaciteitDrempels'
import { leesServerMeting } from '@/lib/supabaseMetrics'

// Elk uur. Meet het geheugen van de databaseserver (Prometheus-endpoint van Supabase) en
// het aantal databaseverbindingen, zodat een piek overdag wordt gezien en niet alleen het moment
// van de dagelijkse capaciteitswacht. Meldt via Telegram pas bij 70% of 90%, anders stil. Dezelfde
// dubbele-meldingsbeveiliging als de dagelijkse wacht, dus nooit twee keer dezelfde melding.

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const { geheugenGebruikt } = await leesServerMeting()

    let dbVerbindingen: number | null = null
    let dbMaxVerbindingen: number | null = null
    const { data, error } = await supabase.rpc('arnobot_db_gezondheid')
    if (!error && data) {
      const v = Number((data as { verbindingen?: number }).verbindingen)
      const max = Number((data as { max_verbindingen?: number }).max_verbindingen)
      if (Number.isFinite(v) && Number.isFinite(max)) {
        dbVerbindingen = v
        dbMaxVerbindingen = max
      }
    }

    // Alleen de databasemetingen invullen, de rest neutraal zodat die meldingen niet afgaan.
    const meldingen = beoordeelCapaciteit({
      resendPlan: 'pro',
      mailDag: 0,
      mailMaand: 0,
      dbBytes: null,
      anthropic429Dag: 0,
      actieveGebruikers: 0,
      serverGeheugen: geheugenGebruikt,
      dbVerbindingen,
      dbMaxVerbindingen,
    })

    const nieuw = []
    for (const m of meldingen) if (await nieuwMelden(m.sleutel, m.niveau)) nieuw.push(m)

    if (nieuw.length > 0) {
      const kritiek = nieuw.some(m => m.niveau === 'kritiek')
      await notifyTelegram(`${kritiek ? 'ArnoBot capaciteit: ACTIE NODIG' : 'ArnoBot capaciteit'}\n\n${nieuw.map(m => m.tekst).join('\n\n')}`)
    }

    return NextResponse.json({
      ok: true,
      geheugenGebruikt: geheugenGebruikt === null ? null : Math.round(geheugenGebruikt * 100),
      dbVerbindingen,
      dbMaxVerbindingen,
      gemeld: nieuw.map(m => m.sleutel),
    })
  } catch (err) {
    await notifyCronFailure('database-wacht', err)
    return NextResponse.json({ error: 'cron_error' }, { status: 500 })
  }
}
