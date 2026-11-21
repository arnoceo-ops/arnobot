import { registreerCronRun } from '@/lib/cronRun'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { notifyCronFailure, notifyTelegram } from '@/lib/cron-notify'
import { excludeInternalTestUsers } from '@/lib/internalTestAccounts'

// Eenmalige meting (2026-11-21), afgesproken met Arno voor vrijdag 27 november: hoe vaak gaat een beurt met een bijlage langs de
// tabeltool en welke kolommen worden gevraagd (arnobot_rds_logs.verbruik.tools, commit "toolaanroepen in verbruik"), plus de
// herinnering om de feitencontrole-meldingen sinds de aanpassing van 21-11 na te lopen (commit 1984cbab, kolomtoewijzing in een
// tabel-bijlage niet beoordelen). Dezelfde meting als scripts/meet-tabelgebruik.mjs. Geen AI-aanroepen.
//
// Wegwerpcode: na 27 november 2026 mag dit bestand + de vercel.json-regel eruit. Schema "0 7 27 11 *" draait één keer per jaar en de
// jaar-controle hieronder laat het in 2027 niets doen.

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type Verbruik = { bijlagen?: number; tools?: { naam: string; invoer: string; fout?: true }[] } | null

async function cronHandler(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const nu = new Date()
    if (nu.getUTCFullYear() !== 2026) return NextResponse.json({ ok: true, skipped: 'alleen 2026' })

    const sinds = new Date(nu.getTime() - 7 * 864e5).toISOString()
    const query = supabase.from('arnobot_rds_logs').select('created_at, verbruik').gte('created_at', sinds)
    const { data, error } = await excludeInternalTestUsers(query).order('created_at', { ascending: true }).limit(5000)
    if (error) throw new Error(error.message)

    const rijen = ((data ?? []) as { created_at: string; verbruik: Verbruik }[]).filter(r => r.verbruik)
    const metTools = rijen.filter(r => Array.isArray(r.verbruik?.tools))
    const eerste = metTools[0]?.created_at
    const bijlageBeurten = rijen.filter(r => (r.verbruik?.bijlagen ?? 0) > 0 && eerste !== undefined && r.created_at >= eerste)
    const zonderTool = bijlageBeurten.filter(r => !r.verbruik?.tools || r.verbruik.tools.length === 0)
    const kolommen = new Map<string, number>()
    let tabelVragen = 0
    for (const r of metTools) for (const t of r.verbruik!.tools!) {
      if (t.naam !== 'tabel_vraag') continue
      tabelVragen++
      try { const k = (JSON.parse(t.invoer) as { kolom?: string }).kolom; if (k) kolommen.set(k, (kolommen.get(k) ?? 0) + 1) } catch { /* ingekorte invoer */ }
    }
    const top = [...kolommen].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, n]) => `${n}x ${k}`).join(', ')

    await notifyTelegram(
      [
        'Meting tabelgebruik (afgesproken voor vrijdag 27-11), laatste 7 dagen, zonder testaccounts:',
        eerste
          ? `Beurten met bijlage sinds de meting van toolaanroepen (${eerste.slice(0, 10)}): ${bijlageBeurten.length}, waarvan ${zonderTool.length} zonder toolaanroep.`
          : 'Nog geen beurten met toolgegevens in de logs.',
        `Aanroepen van tabel_vraag: ${tabelVragen}${top ? `. Kolommen: ${top}` : ''}.`,
        'Reminder: loop de feitencontrole-meldingen sinds 21-11 na op valse kolommeldingen (aanpassing in commit 1984cbab). Zeg het tegen Claude, dan kijkt die mee.',
      ].join('\n')
    )
    return NextResponse.json({ ok: true, beurten: bijlageBeurten.length, zonderTool: zonderTool.length, tabelVragen })
  } catch (err) {
    await notifyCronFailure('tabelgebruik-meting-nov', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export const GET = registreerCronRun('/api/cron/tabelgebruik-meting-nov', cronHandler)
