import { registreerCronRun } from '@/lib/cronRun'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { notifyCronFailure, notifyTelegram } from '@/lib/cron-notify'
import { meetKennisbankKandidaten } from '@/lib/rag'
import { beoordeelKennisbank } from '@/lib/kennisbankControle'

export const maxDuration = 60

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Vaste kernvragen over sales: elk hoort ongeveer 100 kandidaten uit de kennisbank op te leveren.
const PROBEVRAGEN = [
  'Hoe ga ik om met een prijsbezwaar van een klant?',
  'Hoe bereid ik een goed discovery gesprek voor?',
  'Hoe vind ik de beslisser in een organisatie en bouw ik een relatie op?',
]

// Dagelijkse controle op de kennisbank: werkt de zoekstap nog volledig, zitten er geen fragmenten
// zonder vector in, en is er niets gewist? Meldt alleen bij een probleem (Telegram).
async function cronHandler(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const [totaal, zonder, kandidaten] = await Promise.all([
      supabase.from('blog_chunks').select('id', { count: 'exact', head: true }),
      supabase.from('blog_chunks').select('id', { count: 'exact', head: true }).is('embedding', null),
      meetKennisbankKandidaten(PROBEVRAGEN),
    ])
    if (totaal.error || zonder.error) throw new Error(totaal.error?.message ?? zonder.error?.message)

    const problemen = beoordeelKennisbank({
      totaal: totaal.count ?? 0,
      zonderEmbedding: zonder.count ?? 0,
      kandidaten,
    })
    if (problemen.length > 0) {
      await notifyTelegram(`Kennisbank-controle op arno.bot: aandacht nodig\n\n${problemen.join('\n')}`)
    }
    return NextResponse.json({ ok: problemen.length === 0, totaal: totaal.count, kandidaten, problemen })
  } catch (err) {
    await notifyCronFailure('kennisbank-controle', err)
    return NextResponse.json({ error: 'Controle mislukt' }, { status: 500 })
  }
}

export const GET = registreerCronRun('/api/cron/kennisbank-controle', cronHandler)
