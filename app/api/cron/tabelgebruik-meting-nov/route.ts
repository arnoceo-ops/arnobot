import { registreerCronRun } from '@/lib/cronRun'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { notifyCronFailure } from '@/lib/cron-notify'
import { meldMetDetailMail } from '@/lib/detailMail'
import { excludeInternalTestUsers } from '@/lib/internalTestAccounts'
import { haalAlleRijen } from '@/lib/haalAlleRijen'
import { haalWerkruisWeg } from '@/lib/chatStreamRonde'
import { vindSuperlatiefZinnen } from '@/lib/tabelClaims'

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

type Verbruik = { bijlagen?: number; tools?: { naam: string; invoer: string; fout?: true }[]; tabelClaims?: { zin: string }[] } | null

// Beurten vanaf dit moment hebben het werkruisfilter en de superlatievencontrole van 2026-11-24 (commits 979d313f en 63ad691c).
const FILTER_SINDS = '2026-11-24T09:00:00Z'

async function cronHandler(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const nu = new Date()
    if (nu.getUTCFullYear() !== 2026) return NextResponse.json({ ok: true, skipped: 'alleen 2026' })

    const sinds = new Date(nu.getTime() - 7 * 864e5).toISOString()
    // In blokken: PostgREST geeft hooguit 1000 rijen per vraag, ook bij .limit(5000), dus een week gesprekken werd stil afgekapt.
    const alle = await haalAlleRijen<{ created_at: string; verbruik: Verbruik; answer: string | null }>((van, tot) =>
      excludeInternalTestUsers(supabase.from('arnobot_rds_logs').select('created_at, verbruik, answer').gte('created_at', sinds))
        .order('created_at', { ascending: true }).order('id').range(van, tot))

    const rijen = alle.filter(r => r.verbruik)
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

    // Automatische steekproef op de tabelgesprekken sinds het filter (geen reminder voor Arno: de uitkomst staat in het bericht).
    const tabelBeurten = rijen.filter(r => r.created_at >= FILTER_SINDS && r.verbruik?.tools?.some(t => t.naam === 'schrijf_tabel_over'))
    const lekken = tabelBeurten.filter(r => r.answer && haalWerkruisWeg(r.answer) !== r.answer)
    const onjuist = tabelBeurten.flatMap(r => r.verbruik?.tabelClaims ?? [])
    const superlatieven = tabelBeurten.flatMap(r => vindSuperlatiefZinnen(r.answer ?? ''))
    const nietTeControleren = Math.max(0, superlatieven.length - onjuist.length)
    const steekproef = [
      `Steekproef tabelgesprekken sinds 24-11 (filter en superlatievencontrole): ${tabelBeurten.length} beurten.`,
      lekken.length ? `Werkruis aan het begin van een antwoord: ${lekken.length} keer, bijvoorbeeld: "${(lekken[0].answer ?? '').slice(0, 100)}"` : 'Geen werkruis aan het begin van antwoorden.',
      onjuist.length ? `Onjuiste superlatieven gemeld: ${onjuist.length}, bijvoorbeeld: "${onjuist[0].zin.slice(0, 140)}"` : 'Geen onjuiste superlatieven gevonden.',
      `Superlatieven in tabelantwoorden: ${superlatieven.length}, waarvan ${nietTeControleren} niet te koppelen aan een kolom en getal (niet gecontroleerd)${nietTeControleren > 0 ? `, bijvoorbeeld: "${superlatieven.find(z => !onjuist.some(o => o.zin === z.slice(0, 200)))?.slice(0, 140) ?? ''}"` : ''}.`,
    ].join('\n')

    await meldMetDetailMail(
      'Meting tabelgebruik',
      `${tabelBeurten.length} tabelgesprekken, ${tabelVragen} aanroepen van tabel_vraag.`,
      [
        'Meting tabelgebruik (afgesproken voor vrijdag 27-11), laatste 7 dagen, zonder testaccounts:',
        eerste
          ? `Beurten met bijlage sinds de meting van toolaanroepen (${eerste.slice(0, 10)}): ${bijlageBeurten.length}, waarvan ${zonderTool.length} zonder toolaanroep.`
          : 'Nog geen beurten met toolgegevens in de logs.',
        `Aanroepen van tabel_vraag: ${tabelVragen}${top ? `. Kolommen: ${top}` : ''}.`,
        '',
        steekproef,
      ].join('\n')
    )
    return NextResponse.json({ ok: true, beurten: bijlageBeurten.length, zonderTool: zonderTool.length, tabelVragen })
  } catch (err) {
    await notifyCronFailure('tabelgebruik-meting-nov', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export const GET = registreerCronRun('/api/cron/tabelgebruik-meting-nov', cronHandler)
