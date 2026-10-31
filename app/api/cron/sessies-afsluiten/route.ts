export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isInternalTestUser } from '@/lib/internalTestAccounts'
import { notifyCronFailure } from '@/lib/cron-notify'

// Sessie-sluiter: rondt gesprekken af die de gebruiker nooit heeft gesloten. De client doet dat
// al best effort (sendBeacon bij weggaan en bij SLUIT), maar dat mist gesprekken als de tab
// sneuvelt, de telefoon de app killt of de verbinding wegvalt (gemeten 2026-10-31: 12 van 136
// stille sessies zonder of met een achterlopende samenvatting). Zonder samenvatting komt een
// gesprek niet in het sessiegeheugen, de analyses of de coaching. De gebruiker ziet de synthese
// dan niet direct, maar hij komt er wel te staan.
//
// Selectie gebeurt in de database (docs/sql/2026-10-31-sessies-afsluiten.sql), niet door de
// logtabel hier te lezen: dat schaalt niet. De synthese zelf is exact dezelfde code als bij SLUIT
// (/api/bot/session-end), aangeroepen met het CRON_SECRET, geen tweede implementatie.

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const STIL_UUR = 12 // pas afsluiten als er 12 uur niets meer is gezegd
// Alleen gesprekken van de laatste 36 uur oppakken. Oudere achterstand wordt bewust niet
// gesynthetiseerd: dat zou maanden oude uitdagingen als "openstaande actie" terug in het
// geheugen zetten. Een mislukte poging wordt zo ongeveer 24 keer opnieuw geprobeerd.
const VENSTER_UUR = 36
const MAX_PER_RUN = 12
const PARALLEL = 3
const MAX_MISLUKT = 3
const BASIS_URL = 'https://www.arno.bot'

type Kandidaat = { session_id: string; user_id: string; vragen: number; laatste: string }

async function sluitAf(k: Kandidaat): Promise<void> {
  const [{ data: logs }, { data: bestaand }] = await Promise.all([
    supabase
      .from('arnobot_rds_logs')
      .select('question, answer')
      .eq('user_id', k.user_id)
      .eq('session_id', k.session_id)
      .order('created_at', { ascending: true }),
    supabase
      .from('arnobot_blog_sessions')
      .select('community_excluded')
      .eq('user_id', k.user_id)
      .eq('session_id', k.session_id)
      .maybeSingle(),
  ])
  if (!logs?.length) return

  const messages = logs.flatMap(l => [
    { role: 'user', content: l.question },
    { role: 'arno', content: l.answer },
  ])

  const res = await fetch(`${BASIS_URL}/api/bot/session-end`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.CRON_SECRET}` },
    body: JSON.stringify({
      sessionId: k.session_id,
      cronUserId: k.user_id,
      messages,
      explicitClose: false,
      // Een gesprek dat al als community-uitgesloten staat blijft dat, zonder bestaande rij is de
      // herkomst niet te achterhalen en geldt de gewone (eigen) vraag.
      startedFromCommunity: bestaand?.community_excluded === true,
      communityConsent: false,
    }),
  })
  if (!res.ok) throw new Error(`session-end ${res.status}`)
}

export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { data, error } = await supabase.rpc('sessies_zonder_actuele_synthese', {
      stil_uur: STIL_UUR,
      venster_uur: VENSTER_UUR,
      max_aantal: MAX_PER_RUN * 3,
    })
    if (error) throw new Error(error.message)

    const kandidaten = ((data ?? []) as Kandidaat[]).filter(k => !isInternalTestUser(k.user_id))
    if (kandidaten.length === 0) return NextResponse.json({ ok: true, afgesloten: 0 })

    // Sessies die al meerdere keer mislukten niet eindeloos opnieuw proberen.
    const failKeys = kandidaten.map(k => `sessie_afsluit_fail:${k.session_id}`)
    const { data: failRows } = await supabase.from('arnobot_meta').select('key, value').in('key', failKeys)
    const aantalMislukt = new Map((failRows ?? []).map(r => [r.key as string, parseInt(String(r.value), 10) || 0]))
    const aanDeBeurt = kandidaten
      .filter(k => (aantalMislukt.get(`sessie_afsluit_fail:${k.session_id}`) ?? 0) < MAX_MISLUKT)
      .slice(0, MAX_PER_RUN)

    let gelukt = 0
    const mislukt: string[] = []
    for (let i = 0; i < aanDeBeurt.length; i += PARALLEL) {
      const groep = aanDeBeurt.slice(i, i + PARALLEL)
      const uitkomsten = await Promise.allSettled(groep.map(sluitAf))
      for (let j = 0; j < groep.length; j++) {
        const sid = groep[j].session_id
        if (uitkomsten[j].status === 'fulfilled') {
          gelukt++
        } else {
          mislukt.push(sid)
          const key = `sessie_afsluit_fail:${sid}`
          const ts = new Date().toISOString()
          await supabase.from('arnobot_meta').upsert([{ key, value: String((aantalMislukt.get(key) ?? 0) + 1), updated_at: ts }])
        }
      }
    }

    // Pas melden als een sessie definitief is opgegeven (MAX_MISLUKT keer mislukt), niet bij elke
    // tijdelijke fout.
    const opgegeven = mislukt.filter(sid => (aantalMislukt.get(`sessie_afsluit_fail:${sid}`) ?? 0) + 1 >= MAX_MISLUKT)
    if (opgegeven.length > 0) {
      await notifyCronFailure('sessies-afsluiten', new Error(`${opgegeven.length} sessie(s) definitief niet af te sluiten: ${opgegeven.join(', ')}`))
    }

    return NextResponse.json({ ok: true, afgesloten: gelukt, mislukt: mislukt.length })
  } catch (err) {
    await notifyCronFailure('sessies-afsluiten', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
