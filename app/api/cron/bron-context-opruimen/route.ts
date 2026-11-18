import { registreerCronRun } from '@/lib/cronRun'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { notifyCronFailure } from '@/lib/cron-notify'
import { ruimBronContextOp } from '@/lib/bronContextOpruimen'

export const maxDuration = 60

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Dagelijks: de volledige context die het model bij een antwoord kreeg (arnobot_rds_logs.bron_context) maakt deze cron na 30 dagen
// leeg. De waarheidscontrole kijkt maar een week terug. De antwoorden zelf blijven staan. Meldt alleen bij een fout.
async function cronHandler(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const resultaat = await ruimBronContextOp(supabase)
    return NextResponse.json({ ok: true, ...resultaat })
  } catch (err) {
    await notifyCronFailure('bron-context-opruimen', err)
    return NextResponse.json({ error: 'Opruiming mislukt' }, { status: 500 })
  }
}

export const GET = registreerCronRun('/api/cron/bron-context-opruimen', cronHandler)
