import { registreerCronRun } from '@/lib/cronRun'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { excludeInternalTestUsers } from '@/lib/internalTestAccounts'
import { notifyCronFailure, notifyTelegram } from '@/lib/cron-notify'
import { leesTellers, nieuwMelden } from '@/lib/capaciteit'
import { beoordeelCapaciteit, type ResendPlan } from '@/lib/capaciteitDrempels'

// Dagelijks 07:30 UTC. Vergelijkt het echte verbruik met de limiet van elk plan waar we op zitten
// en meldt via Telegram pas bij 70% of 90%, of bij een gebruikersmijlpaal. Anders stil.
// Vervangt de maandelijkse milestone-check (2026-11-04).

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function cronHandler(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const { count } = await excludeInternalTestUsers(
      supabase.from('approved_users').select('*', { count: 'exact', head: true }).eq('is_active', true),
    )
    const actieveGebruikers = count ?? 0

    // Databasegrootte via een SQL-functie (docs/sql/2026-11-04-db-grootte.sql). Ontbreekt die nog, dan slaan we dit over.
    let dbBytes: number | null = null
    const { data: grootte, error: grootteFout } = await supabase.rpc('arnobot_db_grootte')
    if (!grootteFout && grootte !== null && grootte !== undefined) dbBytes = Number(grootte)

    // Databaseverbindingen via een SQL-functie (docs/sql/2026-11-04-db-gezondheid.sql). Ontbreekt die, dan slaan we dit over.
    let dbVerbindingen: number | null = null
    let dbMaxVerbindingen: number | null = null
    const { data: gezondheid, error: gezondheidFout } = await supabase.rpc('arnobot_db_gezondheid')
    if (!gezondheidFout && gezondheid) {
      dbVerbindingen = Number((gezondheid as { verbindingen?: number }).verbindingen ?? NaN)
      dbMaxVerbindingen = Number((gezondheid as { max_verbindingen?: number }).max_verbindingen ?? NaN)
      if (Number.isNaN(dbVerbindingen) || Number.isNaN(dbMaxVerbindingen)) dbVerbindingen = dbMaxVerbindingen = null
    }

    const tellers = await leesTellers()
    const resendPlan: ResendPlan = process.env.RESEND_PLAN === 'pro' ? 'pro' : 'gratis'

    const meldingen = beoordeelCapaciteit({ resendPlan, ...tellers, dbBytes, dbVerbindingen, dbMaxVerbindingen, actieveGebruikers })

    const nieuw = []
    for (const m of meldingen) if (await nieuwMelden(m.sleutel, m.niveau)) nieuw.push(m)

    if (nieuw.length > 0) {
      const kritiek = nieuw.some(m => m.niveau === 'kritiek')
      await notifyTelegram(`${kritiek ? 'ArnoBot capaciteit: ACTIE NODIG' : 'ArnoBot capaciteit'}\n\n${nieuw.map(m => m.tekst).join('\n\n')}`)
    }

    return NextResponse.json({
      ok: true,
      actieveGebruikers,
      resendPlan,
      ...tellers,
      dbBytes,
      dbVerbindingen,
      dbMaxVerbindingen,
      gemeld: nieuw.map(m => m.sleutel),
    })
  } catch (err) {
    await notifyCronFailure('capaciteitswacht', err)
    return NextResponse.json({ error: 'cron_error' }, { status: 500 })
  }
}

export const GET = registreerCronRun('/api/cron/capaciteitswacht', cronHandler)
