import { registreerCronRun } from '@/lib/cronRun'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { notifyCronFailure, notifyTelegram } from '@/lib/cron-notify'
import { ruimDocumentenOp } from '@/lib/documentenOpruimen'

export const maxDuration = 60

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Elk uur: tijdelijke documenten voorbij hun verloopmoment (48 uur na het laatste bericht) opruimen, oude sporen
// na 30 dagen wissen en achtergebleven uploads van meer dan een etmaal weghalen. Nooit een bewaard document.
// Meldt alleen bij een fout (Telegram), zonder namen of inhoud.
async function cronHandler(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const resultaat = await ruimDocumentenOp(supabase)
    if (resultaat.fouten.length > 0) {
      await notifyTelegram(`Documenten-opruiming op arno.bot: ${resultaat.fouten.length} fout(en)\n\n${resultaat.fouten.slice(0, 5).join('\n')}`)
    }
    return NextResponse.json({ ok: resultaat.fouten.length === 0, ...resultaat })
  } catch (err) {
    await notifyCronFailure('documenten-opruimen', err)
    return NextResponse.json({ error: 'Opruiming mislukt' }, { status: 500 })
  }
}

export const GET = registreerCronRun('/api/cron/documenten-opruimen', cronHandler)
