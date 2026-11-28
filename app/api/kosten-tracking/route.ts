import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { berekenPrognoseKostenUsd, planVerdeling, type Meting, type PlanVerdeling } from '@/lib/trackrecordPrognose'
import { amsterdamDagStart, amsterdamDatum, datumPlusDagen, isDatum } from '@/lib/amsterdamTijd'
import { nettoOmzetCentInMaand, type BetalingVoorOmzet } from '@/lib/maandOmzet'
import { isTesterVoorAbacus } from '@/lib/gebruikerKosten'
import { isInternalTestUser } from '@/lib/internalTestAccounts'
import { getLiveFxRateEurUsd } from '@/lib/fxRate'
import { haalAlleRijen } from '@/lib/haalAlleRijen'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function checkAuth(): Promise<boolean> {
  const cookieStore = await cookies()
  const token = cookieStore.get('arnobot_kosten')?.value
  return !!token && token === process.env.ARNOBOT_KOSTEN_KEY
}

// Geen tweede (schrijf)wachtwoord: afsluiten en werkelijke cijfers invullen vallen onder dezelfde paginatoegang als kijken (besluit Arno
// 2026-11-19: dat extra wachtwoord was nooit gevraagd). ARNOBOT_KOSTEN_WRITE_KEY wordt niet meer gelezen en kan uit Vercel.

// Maanden lopen in Amsterdamse tijd, gelijk aan de tab Gebruikers.
function maandRange(maand: string): { start: string; eind: string } {
  // maand is 'YYYY-MM-DD' (altijd de eerste van de maand)
  const volgende = `${datumPlusDagen(maand, 32).slice(0, 8)}01`
  return { start: amsterdamDagStart(maand), eind: amsterdamDagStart(volgende) }
}

function huidigeMaandIso(): string {
  return `${amsterdamDatum().slice(0, 8)}01`
}

function vorigeMaandIso(maand: string): string {
  return `${datumPlusDagen(maand, -1).slice(0, 8)}01`
}

type Omzet = {
  basis_gebruikers: number
  premium_gebruikers: number
  team_gebruikers: number
  prognose_omzet_eur: number
}

// Interne testaccounts en demo-nepleden tellen niet mee, met dezelfde regel als de tab Gebruikers (Arno's handmatige testaccount blijft).
async function meetGebruikVoorMaand(maand: string): Promise<{ meting: Meting; plannen: PlanVerdeling }> {
  const { start, eind } = maandRange(maand)

  // Alles in blokken (lib/haalAlleRijen.ts): een kale select kapt op 1000 rijen af, waarna het aantal unieke gebruikers (de basis van de
  // kosten per gebruiker) en de tellingen stilletjes te laag uitkwamen.
  const [berichtenRows, analyseRows, sparringRows, voiceAlle] = await Promise.all([
    haalAlleRijen<{ user_id: string }>((van, tot) =>
      supabase.from('arnobot_rds_logs').select('user_id').not('user_id', 'is', null).gte('created_at', start).lt('created_at', eind)
        .order('id', { ascending: true }).range(van, tot)),
    haalAlleRijen<{ user_id: string | null }>((van, tot) =>
      supabase.from('arnobot_analyses').select('user_id').gte('created_at', start).lt('created_at', eind)
        .order('id', { ascending: true }).range(van, tot)),
    haalAlleRijen<{ user_id: string | null; message_count: number | null }>((van, tot) =>
      supabase.from('arnobot_sparring_sessions').select('user_id, message_count').gte('created_at', start).lt('created_at', eind)
        .order('id', { ascending: true }).range(van, tot)),
    haalAlleRijen<{ user_id: string | null; char_count: number | null }>((van, tot) =>
      supabase.from('arnobot_elevenlabs_usage').select('user_id, char_count').neq('user_id', 'admin-voice-test').gte('created_at', start).lt('created_at', eind)
        .order('id', { ascending: true }).range(van, tot)),
  ])

  const echt = <T extends { user_id: string | null }>(rijen: T[]) => rijen.filter(r => !r.user_id || !isTesterVoorAbacus(r.user_id))
  const berichten = echt(berichtenRows)
  const analyses = echt(analyseRows)
  const sparring = echt(sparringRows)
  const voice = echt(voiceAlle)
  const actief = [...new Set(berichten.map(r => r.user_id))]

  const planPerId = new Map<string, string | null>()
  for (let i = 0; i < actief.length; i += 200) {
    const { data, error } = await supabase.from('approved_users').select('user_id, plan').in('user_id', actief.slice(i, i + 200))
    if (error) throw new Error(error.message)
    for (const u of data ?? []) planPerId.set(u.user_id, u.plan)
  }

  return {
    meting: {
      gebruikers_count: actief.length,
      berichten_count: berichten.length,
      analyses_count: analyses.length,
      sparring_sessies_count: sparring.length,
      sparring_berichten_count: sparring.reduce((s, r) => s + (r.message_count ?? 0), 0),
      voice_interacties_count: voice.length,
      voice_tekens_count: voice.reduce((s, r) => s + (r.char_count ?? 0), 0),
    },
    plannen: planVerdeling(actief, planPerId),
  }
}

// Aantallen: de betalende gebruikers per plan op dit moment (geen maandfilter). Omzet: de echte betalingen uit de administratie, netto en
// een jaarbetaling gespreid over 12 maanden (lib/maandOmzet.ts, zelfde regel als de tab Gebruikers). Teamfacturen tellen niet mee.
async function meetOmzet(maand: string): Promise<Omzet> {
  const { data, error } = await supabase
    .from('approved_users')
    .select('user_id, plan')
    .not('paid_at', 'is', null)
    .eq('is_active', true)
  if (error) throw new Error(error.message)

  const rows = ((data ?? []) as { user_id: string; plan: string | null }[]).filter(r => !isInternalTestUser(r.user_id))
  const tel = (plan: string) => rows.filter(r => r.plan === plan).length

  const { eind } = maandRange(maand)
  // Een jaarbetaling van tot 12 maanden eerder draagt nog bij.
  const vanaf = amsterdamDagStart(datumPlusDagen(maand, -366))
  const [betalingen, abonnementen] = await Promise.all([
    haalAlleRijen<{ user_id: string } & BetalingVoorOmzet>((van, tot) =>
      supabase.from('arnobot_payments').select('user_id, bedrag_cent, btw_cent, terugbetaald_cent, betaald_at, subscription_id')
        .eq('status', 'paid').gte('betaald_at', vanaf).lt('betaald_at', eind).order('id', { ascending: true }).range(van, tot)),
    haalAlleRijen<{ id: string; cyclus: string }>((van, tot) =>
      supabase.from('arnobot_subscriptions').select('id, cyclus').order('id', { ascending: true }).range(van, tot)),
  ])
  const aboPerId = new Map(abonnementen.map(a => [a.id, a]))
  const omzetCent = betalingen
    .filter(b => !isInternalTestUser(b.user_id))
    .reduce((s, b) => s + nettoOmzetCentInMaand(b, b.subscription_id ? aboPerId.get(b.subscription_id) : undefined, maand.slice(0, 7)), 0)

  return {
    basis_gebruikers: tel('basis'),
    premium_gebruikers: tel('premium'),
    team_gebruikers: tel('team'),
    prognose_omzet_eur: Math.round(omzetCent) / 100,
  }
}

type PlatformRij = { bron: string; usd: number; aanroepen: number }

// Gemeten AI-kosten zonder gebruiker (crons, admin) per maand, per bron. Sleutel is 'YYYY-MM', met dezelfde maandgrenzen (Amsterdam) als de rest
// van dit tabblad. Onderdeel van de werkelijke kosten, niet opgeteld bij de prognose.
async function platformPerMaand(vanafMaand: string): Promise<Record<string, PlatformRij[]>> {
  const rijen = await haalAlleRijen<{ bron: string; kosten_usd: number | string | null; created_at: string }>((van, tot) =>
    supabase.from('arnobot_ai_gebruik').select('bron, kosten_usd, created_at').is('user_id', null).gte('created_at', maandRange(vanafMaand).start)
      .order('id', { ascending: true }).range(van, tot))
  const perMaand = new Map<string, Map<string, PlatformRij>>()
  for (const r of rijen) {
    const maand = amsterdamDatum(new Date(r.created_at)).slice(0, 7)
    const bronnen = perMaand.get(maand) ?? perMaand.set(maand, new Map()).get(maand)!
    const rij = bronnen.get(r.bron) ?? bronnen.set(r.bron, { bron: r.bron, usd: 0, aanroepen: 0 }).get(r.bron)!
    rij.usd += Number(r.kosten_usd ?? 0)
    rij.aanroepen += 1
  }
  return Object.fromEntries([...perMaand].map(([maand, bronnen]) => [maand, [...bronnen.values()].sort((a, b) => b.usd - a.usd)]))
}

export async function GET() {
  if (!(await checkAuth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: geschiedenis, error } = await supabase
    .from('arnobot_kosten_tracking')
    .select('*')
    .order('maand', { ascending: false })

  if (error) {
    console.error('[kosten-tracking GET]', error.message)
    return NextResponse.json({ error: 'Ophalen mislukt' }, { status: 500 })
  }

  const huidigeMaand = huidigeMaandIso()
  const vorigeMaand = vorigeMaandIso(huidigeMaand)
  const afgesloten = new Set((geschiedenis ?? []).map(r => r.maand as string))

  async function live(maand: string) {
    const [{ meting, plannen }, omzet, fxRate] = await Promise.all([meetGebruikVoorMaand(maand), meetOmzet(maand), getLiveFxRateEurUsd()])
    const prognoseKostenUsd = berekenPrognoseKostenUsd(meting, plannen, fxRate.rate)
    return {
      maand,
      ...meting,
      ...omzet,
      prognose_usd: prognoseKostenUsd,
      prognose_kosten_eur: prognoseKostenUsd / fxRate.rate,
      fx_rate_live: fxRate.live,
    }
  }

  let liveHuidigeMaand: Awaited<ReturnType<typeof live>> | null = null
  let openVorigeMaand: Awaited<ReturnType<typeof live>> | null = null
  try {
    const [huidig, vorig] = await Promise.all([
      afgesloten.has(huidigeMaand) ? null : live(huidigeMaand),
      afgesloten.has(vorigeMaand) ? null : live(vorigeMaand),
    ])
    liveHuidigeMaand = huidig
    // Zonder een enkel bericht valt er over die maand niets af te sluiten.
    openVorigeMaand = vorig && vorig.berichten_count > 0 ? vorig : null
  } catch (err) {
    console.error('[kosten-tracking live]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Ophalen mislukt' }, { status: 500 })
  }

  // Een fout hier mag het trackrecord zelf niet blokkeren: dan ontbreekt alleen het blok met platformwerk.
  const oudsteMaand = [vorigeMaand, ...(geschiedenis ?? []).map(r => r.maand as string)].sort()[0]
  const platform = await platformPerMaand(oudsteMaand).catch(err => {
    console.error('[kosten-tracking platformwerk]', err)
    return null
  })

  return NextResponse.json({ geschiedenis: geschiedenis ?? [], liveHuidigeMaand, openVorigeMaand, platform })
}

export async function POST(req: NextRequest) {
  if (!(await checkAuth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { action, maand, werkelijkeKosten, werkelijkeOmzet } = body as {
    action?: string; maand?: string; werkelijkeKosten?: number; werkelijkeOmzet?: number
  }

  if (action === 'afsluiten') {
    const doelMaand = typeof maand === 'string' && maand ? maand : huidigeMaandIso()
    if (!isDatum(doelMaand) || !doelMaand.endsWith('-01') || doelMaand > huidigeMaandIso()) {
      return NextResponse.json({ error: 'Ongeldige maand' }, { status: 400 })
    }
    const [{ meting, plannen }, omzet, fxRate] = await Promise.all([
      meetGebruikVoorMaand(doelMaand),
      meetOmzet(doelMaand),
      getLiveFxRateEurUsd(),
    ])
    const prognose = berekenPrognoseKostenUsd(meting, plannen, fxRate.rate)

    const { error } = await supabase.from('arnobot_kosten_tracking').upsert({
      maand: doelMaand,
      ...meting,
      ...omzet,
      prognose_usd: prognose,
      afgesloten_op: new Date().toISOString(),
    }, { onConflict: 'maand' })

    if (error) {
      console.error('[kosten-tracking afsluiten]', error.message)
      return NextResponse.json({ error: 'Opslaan mislukt' }, { status: 500 })
    }
    return NextResponse.json({ ok: true, maand: doelMaand, prognose_usd: prognose, prognose_omzet_eur: omzet.prognose_omzet_eur })
  }

  if (action === 'werkelijk') {
    if (typeof maand !== 'string' || !maand || typeof werkelijkeKosten !== 'number') {
      return NextResponse.json({ error: 'maand en werkelijkeKosten zijn verplicht' }, { status: 400 })
    }
    const { error } = await supabase
      .from('arnobot_kosten_tracking')
      .update({ werkelijke_kosten_usd: werkelijkeKosten })
      .eq('maand', maand)

    if (error) {
      console.error('[kosten-tracking werkelijk]', error.message)
      return NextResponse.json({ error: 'Opslaan mislukt' }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  }

  if (action === 'werkelijkOmzet') {
    if (typeof maand !== 'string' || !maand || typeof werkelijkeOmzet !== 'number') {
      return NextResponse.json({ error: 'maand en werkelijkeOmzet zijn verplicht' }, { status: 400 })
    }
    const { error } = await supabase
      .from('arnobot_kosten_tracking')
      .update({ werkelijke_omzet_eur: werkelijkeOmzet })
      .eq('maand', maand)

    if (error) {
      console.error('[kosten-tracking werkelijkOmzet]', error.message)
      return NextResponse.json({ error: 'Opslaan mislukt' }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Onbekende action' }, { status: 400 })
}
