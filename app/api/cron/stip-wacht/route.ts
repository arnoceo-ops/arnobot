import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { notifyCronFailure, notifyTelegram } from '@/lib/cron-notify'
import { registreerCronRun } from '@/lib/cronRun'
import { pushActief, stuurPush } from '@/lib/adminPush'
import { haalStippen } from '@/lib/adminStipData'
import { werkStippenBij, type StipStaat } from '@/lib/adminStippen'

// Elk kwartier. Stuurt een pushmelding naar de admin-app als een stip daar oranje of rood wordt, of na
// een half uur weer groen is (regels in lib/adminStippen.ts). Doet niets zolang de proefmelding in de
// app niet is bevestigd. Neemt de pushdienst een melding niet aan, dan gaat die alsnog naar Telegram.

export const maxDuration = 60

const PAD = '/api/cron/stip-wacht'
const SLEUTEL = 'admin_push_stippen'

const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function cronHandler(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    if (!(await pushActief())) return NextResponse.json({ ok: true, overgeslagen: 'meldingen niet aan' })

    // Zonder leesbare vorige stand zou elke oranje stip opnieuw melden: dan liever deze run als fout.
    const { data, error } = await db().from('arnobot_meta').select('value').eq('key', SLEUTEL).maybeSingle()
    if (error) throw new Error(error.message)
    const vorige: StipStaat = data?.value ? JSON.parse(data.value) : {}

    const { staat, meldingen } = werkStippenBij(vorige, await haalStippen(new Date(), PAD))

    let viaTelegram = 0
    for (const m of meldingen) {
      if ((await stuurPush({ titel: m.titel, tekst: m.tekst, tag: m.sleutel })) === 0) {
        viaTelegram++
        await notifyTelegram(`Pushmelding naar de admin-app lukte niet\n\n${m.titel}\n${m.tekst}`)
      }
    }

    const { error: schrijfFout } = await db().from('arnobot_meta').upsert({ key: SLEUTEL, value: JSON.stringify(staat) }, { onConflict: 'key' })
    if (schrijfFout) throw new Error(schrijfFout.message)

    return NextResponse.json({ ok: true, gemeld: meldingen.map(m => m.titel), viaTelegram })
  } catch (err) {
    await notifyCronFailure('stip-wacht', err)
    return NextResponse.json({ error: 'cron_error' }, { status: 500 })
  }
}

export const GET = registreerCronRun('/api/cron/stip-wacht', cronHandler)
