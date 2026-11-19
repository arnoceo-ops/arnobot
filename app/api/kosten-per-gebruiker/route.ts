import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { haalAlleRijen } from '@/lib/haalAlleRijen'
import { amsterdamMaandStart } from '@/lib/voiceLimiet'
import { maandSleutel } from '@/lib/maandKosten'
import { getLiveFxRateEurUsd } from '@/lib/fxRate'
import { isInternalTestUser } from '@/lib/internalTestAccounts'
import { isTesterVoorAbacus, somKostenPerGebruiker, type KostenRij } from '@/lib/gebruikerKosten'
import { nettoOmzetCentInMaand, type BetalingVoorOmzet } from '@/lib/maandOmzet'

// Kosten per gebruiker per kalendermaand (Amsterdamse tijd) voor de Abacus-tab Gebruikers. Zelfde paginatoegang als de rest van Abacus.
// Bron: arnobot_ai_gebruik (Anthropic, Voyage, OpenAI-dicteren, AssemblyAI) en arnobot_elevenlabs_usage. Met namen (besluit Arno 2026-11-19: geen pseudoniem).

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function checkAuth(): Promise<boolean> {
  const cookieStore = await cookies()
  const token = cookieStore.get('arnobot_kosten')?.value
  return !!token && token === process.env.ARNOBOT_KOSTEN_KEY
}

// Begin en einde van een kalendermaand in Amsterdam; het midden van de maand als anker omdat de zomertijd pas eind maart en eind oktober wisselt.
function maandGrenzen(maand: string): { start: string; eind: string } {
  const [j, m] = maand.split('-').map(Number)
  return { start: amsterdamMaandStart(new Date(Date.UTC(j, m - 1, 15, 12))), eind: amsterdamMaandStart(new Date(Date.UTC(j, m, 15, 12))) }
}

function laatsteMaanden(aantal: number, nu = new Date()): string[] {
  const uit: string[] = []
  for (let i = 0; i < aantal; i++) uit.push(maandSleutel(new Date(Date.UTC(nu.getUTCFullYear(), nu.getUTCMonth() - i, 15, 12))))
  return uit
}

export async function GET(req: NextRequest) {
  if (!(await checkAuth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const gevraagd = req.nextUrl.searchParams.get('maand') ?? ''
  const maand = /^\d{4}-(0[1-9]|1[0-2])$/.test(gevraagd) ? gevraagd : maandSleutel()
  const { start, eind } = maandGrenzen(maand)

  try {
    const [rijen, voice, berichten, fx] = await Promise.all([
      haalAlleRijen<KostenRij & { bron: string }>((van, tot) =>
        supabase.from('arnobot_ai_gebruik').select('user_id, bron, model, kosten_usd')
          .gte('created_at', start).lt('created_at', eind).order('id', { ascending: true }).range(van, tot)),
      haalAlleRijen<{ user_id: string | null; char_count: number | null }>((van, tot) =>
        supabase.from('arnobot_elevenlabs_usage').select('user_id, char_count')
          .gte('created_at', start).lt('created_at', eind).order('id', { ascending: true }).range(van, tot)),
      haalAlleRijen<{ user_id: string | null; created_at: string }>((van, tot) =>
        supabase.from('arnobot_rds_logs').select('user_id, created_at')
          .gte('created_at', start).lt('created_at', eind).not('user_id', 'is', null).order('id', { ascending: true }).range(van, tot)),
      getLiveFxRateEurUsd(),
    ])

    // De meting loopt pas sinds de eerste rij in arnobot_ai_gebruik. Berichten van daarvoor hebben geen gemeten kosten, dus die tellen we apart:
    // anders lijkt het alsof ze niets hebben gekost.
    const { data: eerste } = await supabase.from('arnobot_ai_gebruik').select('created_at').order('created_at', { ascending: true }).limit(1)
    const meetStart: string | null = eerste?.[0]?.created_at ?? null

    const perGebruiker = somKostenPerGebruiker(rijen, voice)
    const berichtenPerGebruiker = new Map<string, number>()
    const gemetenBerichtenPerGebruiker = new Map<string, number>()
    for (const b of berichten) {
      if (!b.user_id) continue
      berichtenPerGebruiker.set(b.user_id, (berichtenPerGebruiker.get(b.user_id) ?? 0) + 1)
      if (meetStart && b.created_at >= meetStart) gemetenBerichtenPerGebruiker.set(b.user_id, (gemetenBerichtenPerGebruiker.get(b.user_id) ?? 0) + 1)
    }

    // Per gebruiker en per bron, en het platformwerk zonder gebruiker (crons, admin) apart.
    const perBronPerGebruiker = new Map<string, Map<string, { usd: number; aanroepen: number }>>()
    const platform = new Map<string, { usd: number; aanroepen: number }>()
    for (const r of rijen) {
      const doel = r.user_id ? (perBronPerGebruiker.get(r.user_id) ?? perBronPerGebruiker.set(r.user_id, new Map()).get(r.user_id)!) : platform
      const huidig = doel.get(r.bron) ?? { usd: 0, aanroepen: 0 }
      huidig.usd += r.kosten_usd === null ? 0 : Number(r.kosten_usd)
      huidig.aanroepen++
      doel.set(r.bron, huidig)
    }
    const naarLijst = (m: Map<string, { usd: number; aanroepen: number }>) =>
      [...m.entries()].map(([bron, v]) => ({ bron, usd: v.usd, aanroepen: v.aanroepen })).sort((a, b) => b.usd - a.usd)

    const ids = [...new Set([...perGebruiker.keys(), ...berichtenPerGebruiker.keys()])]
    const { data: profielen } = ids.length
      ? await supabase.from('approved_users').select('user_id, voornaam, achternaam, full_name, email, plan, paid_at, is_active').in('user_id', ids)
      : { data: [] as { user_id: string; voornaam: string | null; achternaam: string | null; full_name: string | null; email: string | null; plan: string | null; paid_at: string | null; is_active: boolean | null }[] }
    const profielPerId = new Map((profielen ?? []).map(p => [p.user_id, p]))

    // Echte omzet in plaats van een aangenomen prijs (lib/maandOmzet.ts): netto zonder btw, een jaarbetaling gespreid over 12 maanden vanaf de
    // maand van betalen, en het laatste abonnement. Een gebruiker in zijn proef heeft geen omzet en laat dat ook zo zien.
    const omzetCent = new Map<string, number>()
    const abonnement = new Map<string, string>()
    if (ids.length) {
      // Een jaarbetaling van tot 12 maanden terug draagt nog bij aan deze maand.
      const [jaarMaand, maandNummer] = maand.split('-').map(Number)
      const betaaldVanaf = new Date(Date.UTC(jaarMaand, maandNummer - 1 - 12, 1)).toISOString()
      const [betalingen, abonnementen] = await Promise.all([
        haalAlleRijen<{ user_id: string } & BetalingVoorOmzet>((van, tot) =>
          supabase.from('arnobot_payments').select('user_id, bedrag_cent, btw_cent, terugbetaald_cent, betaald_at, subscription_id')
            .in('user_id', ids).eq('status', 'paid').gte('betaald_at', betaaldVanaf).lt('betaald_at', eind).order('id', { ascending: true }).range(van, tot)),
        haalAlleRijen<{ id: string; user_id: string; plan: string; cyclus: string; status: string; created_at: string }>((van, tot) =>
          supabase.from('arnobot_subscriptions').select('id, user_id, plan, cyclus, status, created_at')
            .in('user_id', ids).order('id', { ascending: true }).range(van, tot)),
      ])
      const aboPerId = new Map(abonnementen.map(a => [a.id, a]))
      for (const b of betalingen) {
        const abo = b.subscription_id ? aboPerId.get(b.subscription_id) : undefined
        const bedrag = nettoOmzetCentInMaand(b, abo, maand)
        if (bedrag > 0) omzetCent.set(b.user_id, (omzetCent.get(b.user_id) ?? 0) + bedrag)
      }
      const ABO_STATUS: Record<string, string> = { active: 'actief', ended: 'beëindigd', refunded: 'terugbetaald', abandoned: 'niet afgerond', pending: 'wacht op betaling', cancelled: 'opgezegd', suspended: 'geschorst' }
      for (const s of [...abonnementen].sort((x, y) => y.created_at.localeCompare(x.created_at))) {
        if (abonnement.has(s.user_id)) continue
        abonnement.set(s.user_id, `${s.plan === 'premium' ? 'Pro' : s.plan === 'team' ? 'Team' : 'Basic'} ${s.cyclus === 'jaarlijks' ? 'jaarlijks' : 'maandelijks'}, ${ABO_STATUS[s.status] ?? s.status}`)
      }
    }

    const alleGebruikers = ids.map(id => {
      const p = profielPerId.get(id)
      const naam = [p?.voornaam, p?.achternaam].filter(Boolean).join(' ') || p?.full_name || p?.email || id.slice(-8)
      const k = perGebruiker.get(id)
      return {
        userId: id,
        naam,
        email: p?.email ?? null,
        plan: p?.plan ?? null,
        betaald: !!p?.paid_at,
        actief: p?.is_active ?? false,
        abonnement: abonnement.get(id) ?? null,
        omzetCent: Math.round(omzetCent.get(id) ?? 0),
        testaccount: isInternalTestUser(id),
        berichten: berichtenPerGebruiker.get(id) ?? 0,
        gemetenBerichten: gemetenBerichtenPerGebruiker.get(id) ?? 0,
        totaalUsd: k?.totaalUsd ?? 0,
        anthropicUsd: k?.anthropicUsd ?? 0,
        voyageUsd: k?.voyageUsd ?? 0,
        audioUsd: k?.audioUsd ?? 0,
        voiceUsd: k?.voiceUsd ?? 0,
        zonderPrijs: k?.zonderPrijs ?? 0,
        perBron: naarLijst(perBronPerGebruiker.get(id) ?? new Map()),
      }
    }).sort((a, b) => b.totaalUsd - a.totaalUsd)

    // Testers verdwijnen uit de lijst maar hun kosten blijven zichtbaar als één regel (anders klopt het totaal niet meer met de Console).
    const gebruikers = alleGebruikers.filter(g => !isTesterVoorAbacus(g.userId))
    const testers = alleGebruikers.filter(g => isTesterVoorAbacus(g.userId))

    return NextResponse.json({
      maand,
      maanden: laatsteMaanden(6),
      meetStart,
      // Marge alleen tonen als de hele maand gemeten is: anders staat er een volle maand omzet tegenover een half gemeten maand kosten.
      maandVolledigGemeten: meetStart !== null && meetStart <= start,
      fxEurUsd: fx.rate,
      gebruikers,
      testers: { aantal: testers.length, totaalUsd: testers.reduce((s, g) => s + g.totaalUsd, 0), berichten: testers.reduce((s, g) => s + g.berichten, 0) },
      platform: { totaalUsd: [...platform.values()].reduce((s, v) => s + v.usd, 0), perBron: naarLijst(platform) },
    })
  } catch (err) {
    console.error('[kosten-per-gebruiker]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Ophalen mislukt' }, { status: 500 })
  }
}
