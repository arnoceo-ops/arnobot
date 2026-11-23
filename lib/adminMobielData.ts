// Ophaallaag voor de admin-telefoonpagina (/bot/admin/mobiel). Hergebruikt de bestaande bronnen van
// de pc-admin (gebruikerstabel, lib/gebruikerKosten.ts, cron-gezondheid, capaciteitswacht,
// gedragspatronen) en laat elke kaart apart falen: een mislukte bron geeft een melding op die kaart,
// de rest van de pagina blijft staan. De berekeningen staan in lib/adminMobielLogica.ts (getest).
import { createClient } from '@supabase/supabase-js'
import { excludeInternalTestUsers, INTERNAL_TEST_USERS_IN, FAKE_DEMO_USER_LIKE } from '@/lib/internalTestAccounts'
import { haalAlleRijen } from '@/lib/haalAlleRijen'
import { haalGebruikerKosten, isTesterVoorAbacus } from '@/lib/gebruikerKosten'
import { MANUAL_TEST_USER_ID } from '@/lib/internalTestAccounts'
import { leesCronRuns, type CronRunRij } from '@/lib/cronRun'
import { leesCrons } from '@/lib/cronOverzicht'
import { beoordeelCron, registratieStartVan } from '@/lib/cronGezondheid'
import { leesTellers } from '@/lib/capaciteit'
import { beoordeelCapaciteit, DB_LIMIET_BYTES, type ResendPlan } from '@/lib/capaciteitDrempels'
import { leesServerMeting } from '@/lib/supabaseMetrics'
import { leesInstatusMeting } from '@/lib/instatus'
import { EXTERNE_DIENSTEN } from '@/lib/externeDiensten'
import { controleerKoppelingen } from '@/lib/billing/gezondheid'
import { telGedragspatronen } from '@/lib/gedragspatronen'
import { nlVandaag, nlDagStartIso } from '@/lib/nlTijd'
import { datumPlusDagen } from '@/lib/amsterdamTijd'
import {
  ergsteNiveau, naamVan, niveauVanAandeel, vatGebruikersSamen, vatKostenSamen,
  type GebruikerRij, type GebruikersSamenvatting, type KostenRegel, type Niveau,
} from '@/lib/adminMobielLogica'

export type Sectie<T> = { ok: true; data: T } | { ok: false }

export async function veilig<T>(naam: string, f: () => Promise<T>): Promise<Sectie<T>> {
  try {
    return { ok: true, data: await f() }
  } catch (e) {
    console.error(`[admin/mobiel] ${naam} mislukt:`, e instanceof Error ? e.message : e)
    return { ok: false }
  }
}

const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// --- Gebruikers --------------------------------------------------------------------------------

export async function haalGebruikers(nu: Date): Promise<{ samenvatting: GebruikersSamenvatting; namen: Map<string, string> }> {
  const supabase = db()
  const zevenDagenGeleden = nlDagStartIso(datumPlusDagen(nlVandaag(nu), -6))
  const [rijen, logs] = await Promise.all([
    haalAlleRijen<GebruikerRij>((van, tot) =>
      supabase.from('approved_users')
        .select('user_id, email, voornaam, achternaam, is_active, paid_at, expires_at, trial_start, created_at')
        .not('user_id', 'in', INTERNAL_TEST_USERS_IN).not('user_id', 'like', FAKE_DEMO_USER_LIKE)
        .order('user_id', { ascending: true }).range(van, tot)),
    haalAlleRijen<{ user_id: string }>((van, tot) =>
      supabase.from('arnobot_rds_logs').select('user_id').gte('created_at', zevenDagenGeleden)
        .not('user_id', 'is', null).not('user_id', 'in', INTERNAL_TEST_USERS_IN).not('user_id', 'like', FAKE_DEMO_USER_LIKE)
        .order('id', { ascending: true }).range(van, tot)),
  ])
  return {
    samenvatting: vatGebruikersSamen(rijen, new Set(logs.map(l => l.user_id)), nu),
    namen: new Map(rijen.map(r => [r.user_id, naamVan(r)])),
  }
}

// --- Kosten ------------------------------------------------------------------------------------

export type KostenKaart = {
  totaalUsd: number
  internUsd: number
  top: KostenRegel[]
  restUsd: number
  perLeverancier: { anthropic: number; voyage: number; audio: number; spraak: number }
  zonderPrijs: number
}

export async function haalKosten(namen: Map<string, string>, nu: Date): Promise<KostenKaart> {
  const perUser = await haalGebruikerKosten(db(), nu)
  const lijst = [...perUser.entries()].map(([userId, k]) => ({
    userId, naam: namen.get(userId) ?? (userId === MANUAL_TEST_USER_ID ? 'Testaccount Arno' : 'onbekend'), usd: k.totaalUsd, intern: isTesterVoorAbacus(userId),
  }))
  const som = vatKostenSamen(lijst)
  const tot = { anthropic: 0, voyage: 0, audio: 0, spraak: 0 }
  let zonderPrijs = 0
  for (const k of perUser.values()) {
    tot.anthropic += k.anthropicUsd; tot.voyage += k.voyageUsd; tot.audio += k.audioUsd; tot.spraak += k.voiceUsd
    zonderPrijs += k.zonderPrijs
  }
  return { ...som, perLeverancier: tot, zonderPrijs }
}

// --- Status ------------------------------------------------------------------------------------

export type StatusRegel = { label: string; waarde: string; niveau: Niveau }
export type StatusKaart = { niveau: Niveau; regels: StatusRegel[]; problemen: string[] }

const INDICATOR_NIVEAU: Record<string, Niveau> = { none: 'ok', minor: 'let-op', major: 'fout', critical: 'fout' }

async function haalDienstStatus(): Promise<StatusRegel[]> {
  return Promise.all(EXTERNE_DIENSTEN.map(async (d): Promise<StatusRegel> => {
    try {
      const r = await fetch(d.url, { cache: 'no-store', signal: AbortSignal.timeout(5000) })
      const j = await r.json()
      const niveau = INDICATOR_NIVEAU[j?.status?.indicator as string] ?? 'onbekend'
      return { label: d.name, waarde: niveau === 'ok' ? 'operationeel' : (j?.status?.description ?? 'let op'), niveau }
    } catch {
      // Een statusfetch die mislukt is geen storing: onbekend, geen alarm (zoals /bot/admin/status).
      return { label: d.name, waarde: 'status niet beschikbaar', niveau: 'onbekend' }
    }
  }))
}

export async function haalStatus(actieveGebruikers: number, nu: Date): Promise<StatusKaart> {
  const supabase = db()
  const [cronRuns, dbGrootte, dbGezondheid, server, tellers, instatus, koppelingen, diensten] = await Promise.all([
    leesCronRuns().catch(() => null),
    supabase.rpc('arnobot_db_grootte'),
    supabase.rpc('arnobot_db_gezondheid'),
    leesServerMeting(),
    leesTellers().catch(() => ({ mailDag: 0, mailMaand: 0, anthropic429Dag: 0 })),
    leesInstatusMeting(),
    controleerKoppelingen().catch(() => null),
    haalDienstStatus(),
  ])

  const regels: StatusRegel[] = []
  const problemen: string[] = []

  // Crons
  if (cronRuns) {
    const runs = cronRuns as Record<string, CronRunRij>
    const start = registratieStartVan(runs)
    const crons = leesCrons().map(c => ({ c, g: beoordeelCron(runs[c.pad], c.schema, nu, start) }))
    const slecht = crons.filter(({ g }) => g.staat !== 'ok' && g.staat !== 'onbekend')
    const ok = crons.filter(({ g }) => g.staat === 'ok').length
    regels.push({ label: 'Crons', waarde: `${ok} van ${crons.length} in orde`, niveau: slecht.length ? 'fout' : 'ok' })
    for (const { c, g } of slecht) problemen.push(`${c.naam}: ${g.tekst}`)
  } else {
    regels.push({ label: 'Crons', waarde: 'niet te lezen', niveau: 'onbekend' })
  }

  // Capaciteit
  const dbBytes = dbGrootte.error || dbGrootte.data == null ? null : Number(dbGrootte.data)
  const gez = dbGezondheid.error ? null : (dbGezondheid.data as { verbindingen?: number; max_verbindingen?: number } | null)
  const verb = gez?.verbindingen != null ? Number(gez.verbindingen) : null
  const verbMax = gez?.max_verbindingen != null ? Number(gez.max_verbindingen) : null
  const resendPlan: ResendPlan = process.env.RESEND_PLAN === 'pro' ? 'pro' : 'gratis'
  const meldingen = beoordeelCapaciteit({
    resendPlan, ...tellers, dbBytes, dbVerbindingen: verb, dbMaxVerbindingen: verbMax,
    serverGeheugen: server.geheugenGebruikt, actieveGebruikers,
  }).filter(m => m.niveau !== 'mijlpaal')
  const capNiveau: Niveau = meldingen.some(m => m.niveau === 'kritiek') ? 'fout' : meldingen.length ? 'let-op' : 'ok'
  const pct = (x: number | null) => (x === null ? 'onbekend' : `${Math.round(x * 100)}%`)
  regels.push({ label: 'Database', waarde: pct(dbBytes === null ? null : dbBytes / DB_LIMIET_BYTES), niveau: niveauVanAandeel(dbBytes === null ? null : dbBytes / DB_LIMIET_BYTES) })
  regels.push({ label: 'Servergeheugen', waarde: pct(server.geheugenGebruikt), niveau: niveauVanAandeel(server.geheugenGebruikt) })
  if (capNiveau !== 'ok') for (const m of meldingen) problemen.push(m.tekst)

  // Bereikbaarheid van arno.bot (Instatus)
  if (instatus) {
    const dagGeleden = nu.getTime() - 24 * 60 * 60 * 1000
    const dag = instatus.logs.filter(l => new Date(l.createdAt).getTime() > dagGeleden)
    const beschikbaar = dag.length ? Math.round((dag.filter(l => l.status === 'UP').length / dag.length) * 100) : null
    const up = instatus.monitorStatus === 'UP'
    regels.push({
      label: 'arno.bot bereikbaar',
      waarde: beschikbaar === null ? (up ? 'ja' : 'onbekend') : `${beschikbaar}% afgelopen 24 uur`,
      niveau: !up && instatus.monitorStatus ? 'fout' : beschikbaar !== null && beschikbaar < 99 ? 'let-op' : 'ok',
    })
  } else {
    regels.push({ label: 'arno.bot bereikbaar', waarde: 'meting niet beschikbaar', niveau: 'onbekend' })
  }

  // Betaalkoppelingen
  if (koppelingen) {
    for (const k of koppelingen) {
      regels.push({ label: k.naam, waarde: k.beschrijving, niveau: k.niveau })
      if (k.niveau !== 'ok') problemen.push(`${k.naam}: ${k.beschrijving}`)
    }
  }

  // Externe diensten (alleen niet-onbekende problemen krijgen een regel in problemen)
  for (const d of diensten) {
    regels.push(d)
    if (d.niveau === 'let-op' || d.niveau === 'fout') problemen.push(`${d.label}: ${d.waarde}`)
  }

  return { niveau: ergsteNiveau(regels.map(r => r.niveau)), regels, problemen }
}

// --- Te beoordelen -----------------------------------------------------------------------------

export type TeBeoordelen = { id: number; naam: string; categorie: string; bericht: string; datum: string }

export async function haalTeBeoordelen(): Promise<TeBeoordelen[]> {
  const supabase = db()
  const { data, error } = await supabase
    .from('arnobot_offtopic_flags')
    .select('id, user_id, category, message, created_at')
    .eq('reviewed', false)
    .order('created_at', { ascending: false })
    .limit(20)
  if (error) throw new Error(error.message)
  const vlaggen = data ?? []
  if (!vlaggen.length) return []
  const ids = [...new Set(vlaggen.map(v => v.user_id))]
  const { data: users } = await supabase
    .from('approved_users')
    .select('user_id, email, voornaam, achternaam')
    .in('user_id', ids)
  const namen = new Map((users ?? []).map(u => [u.user_id as string, naamVan(u as { voornaam: string | null; achternaam: string | null; email: string | null })]))
  return vlaggen.map(v => ({
    id: v.id as number,
    naam: namen.get(v.user_id as string) ?? 'onbekend',
    categorie: String(v.category ?? ''),
    bericht: String(v.message ?? '').slice(0, 160),
    datum: v.created_at as string,
  }))
}

// --- Waarheidscontrole en patronen -------------------------------------------------------------

export type PatroonRegel = { naam: string; deze: number; vorige: number; tweeWekenOpRij: boolean }
export type PatronenKaart = { laatsteMail: string | null; patronen: PatroonRegel[]; antwoorden: number }

// De waarheidscontrole zelf (AI-beoordeling van een steekproef) draait niet live op de telefoon: dat kost
// geld bij elke paginalading. De kaart toont wanneer de wekelijkse mail voor het laatst is gelukt, plus
// dezelfde tekstpatroontelling als de mail (lib/gedragspatronen.ts), zonder AI.
export async function haalPatronen(nu: Date): Promise<PatronenKaart> {
  const supabase = db()
  const eigenaar = process.env.ARNOBOT_OWNER_USER_ID
  const grensDeze = nu.getTime() - 7 * 864e5
  const vanaf = new Date(nu.getTime() - 14 * 864e5).toISOString()
  const [rijen, runs] = await Promise.all([
    haalAlleRijen<{ user_id: string | null; answer: string | null; created_at: string }>((van, tot) =>
      excludeInternalTestUsers(
        supabase.from('arnobot_rds_logs').select('user_id, answer, created_at').gte('created_at', vanaf),
      ).order('id', { ascending: true }).range(van, tot), { max: 50_000 }),
    leesCronRuns().catch(() => ({} as Record<string, CronRunRij>)),
  ])
  const bruikbaar = rijen.filter(r => r.user_id && r.answer && (!eigenaar || r.user_id !== eigenaar)) as { answer: string; created_at: string }[]
  const deze = bruikbaar.filter(r => new Date(r.created_at).getTime() >= grensDeze)
  const vorige = bruikbaar.filter(r => new Date(r.created_at).getTime() < grensDeze)
  const tD = telGedragspatronen(deze)
  const tV = telGedragspatronen(vorige)
  const patronen = tD
    .map((p, i): PatroonRegel => ({ naam: p.naam, deze: p.aantal, vorige: tV[i].aantal, tweeWekenOpRij: p.aantal > 0 && tV[i].aantal > 0 }))
    .filter(p => p.deze > 0 || p.vorige > 0)
  return { laatsteMail: (runs as Record<string, CronRunRij>)['/api/cron/waarheidscontrole']?.laatste_ok ?? null, patronen, antwoorden: deze.length }
}
