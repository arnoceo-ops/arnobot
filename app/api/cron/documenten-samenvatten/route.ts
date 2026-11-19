import { registreerCronRun } from '@/lib/cronRun'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { notifyCronFailure, notifyTelegram } from '@/lib/cron-notify'
import { samenvatOpenDocumenten } from '@/lib/documentSamenvatting'
import { samenvattenBeschikbaarVoor } from '@/lib/documentenRegels'

export const maxDuration = 300

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// Elke 5 minuten: bewaarde documenten zonder samenvatting samenvatten (max 10 per run, max 3 pogingen per document,
// max 20 per gebruiker per etmaal), alleen voor wie samenvattenBeschikbaarVoor toestaat. Meldt alleen als er iets mislukt
// is, zonder namen of inhoud.
async function cronHandler(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const resultaat = await samenvatOpenDocumenten(supabase, anthropic, samenvattenBeschikbaarVoor)
    if (resultaat.mislukt > 0) {
      await notifyTelegram(`Documenten samenvatten op arno.bot: ${resultaat.mislukt} mislukt, ${resultaat.klaar} gelukt (per document maximaal 3 pogingen).`)
    }
    return NextResponse.json({ ok: true, ...resultaat })
  } catch (err) {
    await notifyCronFailure('documenten-samenvatten', err)
    return NextResponse.json({ error: 'Samenvatten mislukt' }, { status: 500 })
  }
}

export const GET = registreerCronRun('/api/cron/documenten-samenvatten', cronHandler)
