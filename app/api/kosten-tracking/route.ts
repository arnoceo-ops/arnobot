import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { TARIEVEN, elevenLabsCost, vasteKostenPerMaand } from '@/lib/kostenTarieven'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function checkAuth(): Promise<boolean> {
  const cookieStore = await cookies()
  const token = cookieStore.get('arnobot_kosten')?.value
  return !!token && token === process.env.ARNOBOT_KOSTEN_KEY
}

// Los, tweede wachtwoord voor de schrijfacties (afsluiten, werkelijke cijfers
// invullen). Los van de paginatoegang: iedereen met het paginawachtwoord mag
// kijken en met scenario's spelen, alleen wie dit tweede wachtwoord kent mag
// echte cijfers vastleggen. Voorkomt tegelijk dat twee mensen zonder overleg
// dezelfde maand afsluiten of overschrijven.
function checkSchrijfWachtwoord(schrijfWachtwoord: unknown): boolean {
  return typeof schrijfWachtwoord === 'string' && !!schrijfWachtwoord && schrijfWachtwoord === process.env.ARNOBOT_KOSTEN_WRITE_KEY
}

function maandRange(maand: string): { start: string; eind: string } {
  // maand is 'YYYY-MM-DD' (altijd de eerste van de maand)
  const start = new Date(maand + 'T00:00:00.000Z')
  const eind = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1))
  return { start: start.toISOString(), eind: eind.toISOString() }
}

function huidigeMaandIso(): string {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10)
}

type Meting = {
  gebruikers_count: number
  berichten_count: number
  analyses_count: number
  sparring_sessies_count: number
  sparring_berichten_count: number
  voice_interacties_count: number
  voice_tekens_count: number
}

type Omzet = {
  basis_gebruikers: number
  premium_gebruikers: number
  elite_gebruikers: number
  team_gebruikers: number
  prognose_omzet_eur: number
}

async function meetGebruikVoorMaand(maand: string): Promise<Meting> {
  const { start, eind } = maandRange(maand)

  const [berichten, analyses, sparring, voice] = await Promise.all([
    supabase.from('arnobot_rds_logs').select('user_id', { count: 'exact' }).not('user_id', 'is', null).gte('created_at', start).lt('created_at', eind),
    supabase.from('arnobot_analyses').select('id', { count: 'exact', head: true }).gte('created_at', start).lt('created_at', eind),
    supabase.from('arnobot_sparring_sessions').select('message_count').gte('created_at', start).lt('created_at', eind),
    supabase.from('arnobot_elevenlabs_usage').select('char_count').neq('user_id', 'admin-voice-test').gte('created_at', start).lt('created_at', eind),
  ])

  const berichtenRows = (berichten.data ?? []) as { user_id: string }[]
  const gebruikersUniek = new Set(berichtenRows.map(r => r.user_id)).size
  const sparringRows = (sparring.data ?? []) as { message_count: number | null }[]
  const voiceRows = (voice.data ?? []) as { char_count: number | null }[]

  return {
    gebruikers_count: gebruikersUniek,
    berichten_count: berichten.count ?? berichtenRows.length,
    analyses_count: analyses.count ?? 0,
    sparring_sessies_count: sparringRows.length,
    sparring_berichten_count: sparringRows.reduce((s, r) => s + (r.message_count ?? 0), 0),
    voice_interacties_count: voiceRows.length,
    voice_tekens_count: voiceRows.reduce((s, r) => s + (r.char_count ?? 0), 0),
  }
}

// Puntmeting van de huidige abonneebasis, geen maandfilter: dit is een
// momentopname (hoeveel betalende gebruikers heb je nu per plan), geen
// telling van nieuwe aanmeldingen die specifieke maand. Prijzen per plan zijn
// optioneel overschrijfbaar vanuit de client (los instelbaar op het Business
// case-tabblad), zodat "sluit maand af" precies vastlegt wat daar te zien was.
async function meetOmzet(prijzen?: { basis?: number; premium?: number; elite?: number }): Promise<Omzet> {
  const { data } = await supabase
    .from('approved_users')
    .select('plan')
    .not('paid_at', 'is', null)
    .eq('is_active', true)

  const rows = (data ?? []) as { plan: string | null }[]
  const tel = (plan: string) => rows.filter(r => r.plan === plan).length

  const basis = tel('basis')
  const premium = tel('premium')
  const elite = tel('elite')
  const team = tel('team')

  const prijsBasis = prijzen?.basis ?? TARIEVEN.prijsBasisEur
  const prijsPremium = prijzen?.premium ?? TARIEVEN.prijsPremiumEur
  const prijsElite = prijzen?.elite ?? TARIEVEN.prijsEliteEur

  const prognoseOmzetEur = basis * prijsBasis + premium * prijsPremium + elite * prijsElite
  // Command/team heeft geen vlak tarief (staffel per seat), telt niet mee in
  // de omzetprognose, alleen het aantal wordt getoond.

  return {
    basis_gebruikers: basis,
    premium_gebruikers: premium,
    elite_gebruikers: elite,
    team_gebruikers: team,
    prognose_omzet_eur: prognoseOmzetEur,
  }
}

function berekenPrognoseKostenUsd(m: Meting): number {
  const anthropicKosten = m.berichten_count * TARIEVEN.anthropicPerBericht
  const analysesKosten = m.analyses_count * TARIEVEN.kostenPerAnalyse
  const fable5Kosten = m.gebruikers_count * (
    TARIEVEN.coachingPerGebruikerPerMaand * TARIEVEN.coachingKostenPerSynthese
    + TARIEVEN.uitdagingPerGebruikerPerMaand * TARIEVEN.uitdagingKostenPerStuk
  )
  const sparringKosten = m.sparring_berichten_count * TARIEVEN.kostenPerSparringBericht
    + m.sparring_sessies_count * TARIEVEN.kostenPerDebrief
  const overigeAnthropicKosten = m.gebruikers_count * TARIEVEN.overigeAnthropicPerGebruikerPerMaand

  const creditsNodig = m.voice_tekens_count * TARIEVEN.creditPerTeken
  const eleven = elevenLabsCost(creditsNodig, TARIEVEN.tiers)
  const whisperKosten = m.voice_interacties_count * TARIEVEN.kostenPerVoiceInteractie

  const upstashCommands = m.berichten_count * TARIEVEN.upstashPerBericht
  const upstashOverage = Math.max(0, upstashCommands - TARIEVEN.upstashFreeLimit)
  const upstashKosten = (upstashOverage / 100000) * TARIEVEN.upstashPricePer100k

  return vasteKostenPerMaand(m.gebruikers_count) + anthropicKosten + analysesKosten + fable5Kosten
    + sparringKosten + overigeAnthropicKosten + eleven.price + whisperKosten + upstashKosten
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
  const alAfgesloten = (geschiedenis ?? []).some(r => r.maand === huidigeMaand)

  let liveHuidigeMaand = null
  if (!alAfgesloten) {
    const [meting, omzet] = await Promise.all([meetGebruikVoorMaand(huidigeMaand), meetOmzet()])
    const prognoseKostenUsd = berekenPrognoseKostenUsd(meting)
    liveHuidigeMaand = {
      maand: huidigeMaand,
      ...meting,
      ...omzet,
      prognose_usd: prognoseKostenUsd,
      prognose_kosten_eur: prognoseKostenUsd / TARIEVEN.fxRateEurUsd,
    }
  }

  return NextResponse.json({ geschiedenis: geschiedenis ?? [], liveHuidigeMaand })
}

export async function POST(req: NextRequest) {
  if (!(await checkAuth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { action, maand, werkelijkeKosten, werkelijkeOmzet, prijsBasis, prijsPremium, prijsElite, schrijfWachtwoord } = body as {
    action?: string; maand?: string; werkelijkeKosten?: number; werkelijkeOmzet?: number
    prijsBasis?: number; prijsPremium?: number; prijsElite?: number; schrijfWachtwoord?: string
  }

  if (action === 'afsluiten' || action === 'werkelijk' || action === 'werkelijkOmzet') {
    if (!checkSchrijfWachtwoord(schrijfWachtwoord)) {
      return NextResponse.json({ error: 'Onjuist schrijfwachtwoord.' }, { status: 401 })
    }
  }

  if (action === 'afsluiten') {
    const doelMaand = typeof maand === 'string' && maand ? maand : huidigeMaandIso()
    const [meting, omzet] = await Promise.all([
      meetGebruikVoorMaand(doelMaand),
      meetOmzet({ basis: prijsBasis, premium: prijsPremium, elite: prijsElite }),
    ])
    const prognose = berekenPrognoseKostenUsd(meting)

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
