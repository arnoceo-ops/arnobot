// Ophaallaag voor de admin-telefoonpagina (/bot/admin/mobiel). Hergebruikt de bestaande bronnen van
// de pc-admin (gebruikerstabel, lib/gebruikerKosten.ts, cron-gezondheid, capaciteitswacht,
// gedragspatronen, teamproef) en laat elke kaart apart falen: een mislukte bron geeft een melding op
// die kaart, de rest van de pagina blijft staan. De berekeningen staan in lib/adminMobielLogica.ts (getest).
import { createClient } from '@supabase/supabase-js'
import {
  INTERNAL_TEST_USERS_IN, FAKE_DEMO_USER_LIKE, TEST_TEAM_IDS_IN, MANUAL_TEST_USER_ID,
  excludeInternalTestUsers, isFakeDemoUser, isInternalTestUser,
} from '@/lib/internalTestAccounts'
import { haalAlleRijen } from '@/lib/haalAlleRijen'
import { haalGebruikerKosten, isTesterVoorAbacus } from '@/lib/gebruikerKosten'
import { leesCronRuns, type CronRunRij } from '@/lib/cronRun'
import { leesCrons } from '@/lib/cronOverzicht'
import { beoordeelCron, registratieStartVan } from '@/lib/cronGezondheid'
import { leesTellers } from '@/lib/capaciteit'
import { beoordeelCapaciteit, DB_LIMIET_BYTES, type ResendPlan } from '@/lib/capaciteitDrempels'
import { leesServerMeting } from '@/lib/supabaseMetrics'
import { leesInstatusMeting } from '@/lib/instatus'
import { EXTERNE_DIENSTEN } from '@/lib/externeDiensten'
import { dienstRaaktOns } from '@/lib/adminStippen'
import { controleerKoppelingen } from '@/lib/billing/gezondheid'
import { telGedragspatronen } from '@/lib/gedragspatronen'
import { isAgentProef, proefEinde, proefStand } from '@/lib/teamProef'
import { nlVandaag, nlDagStartIso } from '@/lib/nlTijd'
import { datumPlusDagen } from '@/lib/amsterdamTijd'
import { amsterdamMaandStart } from '@/lib/voiceLimiet'
import {
  ergsteNiveau, naamVan, niveauVanAandeel, planNaam, proefDagenOver, vatGebruikersSamen, vatKostenSamen,
  bouwBellijst, vatBetalingenSamen,
  type BetalingRij, type GebruikerRij, type GebruikersSamenvatting, type KostenRegel, type Niveau,
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

export async function haalGebruikers(nu: Date): Promise<{ samenvatting: GebruikersSamenvatting; namen: Map<string, string>; rijen: GebruikerRij[] }> {
  const supabase = db()
  const zevenDagenGeleden = nlDagStartIso(datumPlusDagen(nlVandaag(nu), -6))
  const [rijen, logs] = await Promise.all([
    haalAlleRijen<GebruikerRij>((van, tot) =>
      supabase.from('approved_users')
        .select('user_id, email, voornaam, achternaam, is_active, paid_at, expires_at, trial_start, created_at, plan')
        .not('user_id', 'in', INTERNAL_TEST_USERS_IN).not('user_id', 'like', FAKE_DEMO_USER_LIKE)
        .order('user_id', { ascending: true }).range(van, tot)),
    haalAlleRijen<{ user_id: string; session_id: string | null }>((van, tot) =>
      supabase.from('arnobot_rds_logs').select('user_id, session_id').gte('created_at', zevenDagenGeleden)
        .not('user_id', 'is', null).not('user_id', 'in', INTERNAL_TEST_USERS_IN).not('user_id', 'like', FAKE_DEMO_USER_LIKE)
        .order('id', { ascending: true }).range(van, tot)),
  ])
  // Gesprekken = verschillende sessies, zoals de kolom GESPREKKEN op de pc-pagina.
  const sessies = new Map<string, Set<string>>()
  for (const l of logs) {
    const set = sessies.get(l.user_id) ?? new Set<string>()
    set.add(l.session_id ?? 'zonder-sessie')
    sessies.set(l.user_id, set)
  }
  const gesprekken = new Map([...sessies.entries()].map(([id, s]) => [id, s.size]))
  return {
    samenvatting: vatGebruikersSamen(rijen, gesprekken, nu),
    namen: new Map(rijen.map(r => [r.user_id, naamVan(r)])),
    rijen,
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

export type StatusRegel = { label: string; waarde: string; niveau: Niveau; meldingen?: string[]; meldBijOranje?: boolean }
export type StatusKaart = { niveau: Niveau; regels: StatusRegel[]; problemen: string[] }

const INDICATOR_NIVEAU: Record<string, Niveau> = { none: 'ok', minor: 'let-op', major: 'fout', critical: 'fout' }

const COMPONENT_LABEL: Record<string, string> = {
  degraded_performance: 'verminderd', partial_outage: 'gedeeltelijk down', major_outage: 'down', under_maintenance: 'onderhoud',
}

/** Wat er speelt, zoals de desktop-statuspagina: de onderdelen die niet operationeel zijn en het nieuwste incident. */
function dienstDetails(j: { components?: { name: string; status: string; group?: boolean }[]; incidents?: { name: string; status: string }[] }): string[] {
  const regels: string[] = []
  for (const c of j.components ?? []) {
    if (c.group || c.status === 'operational') continue
    regels.push(`${c.name}: ${COMPONENT_LABEL[c.status] ?? c.status}`)
  }
  // Zoals de desktop-statuspagina: alleen het nieuwste incident, naam en status, zonder updatetekst.
  const i = j.incidents?.[0]
  if (i) regels.push(`${i.name} · ${i.status}`)
  return regels
}

async function haalDienstStatus(): Promise<{ regel: StatusRegel; details: string[] }[]> {
  return Promise.all(EXTERNE_DIENSTEN.map(async (d) => {
    try {
      const r = await fetch(d.url, { cache: 'no-store', signal: AbortSignal.timeout(5000) })
      const j = await r.json()
      const niveau = INDICATOR_NIVEAU[j?.status?.indicator as string] ?? 'onbekend'
      // Een dienst kan als geheel 'operationeel' zijn en toch een open incident hebben (bijvoorbeeld in
      // 'monitoring'). Dat blijft zichtbaar onder de regel, net als op de desktop, zonder als probleem te tellen.
      const details = dienstDetails(j)
      return {
        regel: {
          label: d.name, waarde: niveau === 'ok' ? 'operationeel' : (j?.status?.description ?? 'let op'), niveau,
          meldingen: niveau === 'ok' ? details : undefined, meldBijOranje: dienstRaaktOns(d.name, j ?? {}),
        },
        details: niveau === 'ok' ? [] : details,
      }
    } catch {
      // Een statusfetch die mislukt is geen storing: onbekend, geen alarm (zoals /bot/admin/status).
      return { regel: { label: d.name, waarde: 'status niet beschikbaar', niveau: 'onbekend' as Niveau }, details: [] }
    }
  }))
}

/** zonderCron: de stip-wacht beoordeelt zichzelf niet, zijn eigen run is op dat moment net gestart. */
export async function haalStatus(actieveGebruikers: number, nu: Date, opties: { zonderCron?: string } = {}): Promise<StatusKaart> {
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
    const crons = leesCrons().filter(c => c.pad !== opties.zonderCron).map(c => ({ c, g: beoordeelCron(runs[c.pad], c.schema, nu, start) }))
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
  for (const { regel: d, details } of diensten) {
    regels.push(d)
    if (d.niveau === 'let-op' || d.niveau === 'fout') problemen.push([`${d.label}: ${d.waarde}`, ...details.map(t => `↳ ${t}`)].join('\n'))
  }

  return { niveau: ergsteNiveau(regels.map(r => r.niveau)), regels, problemen }
}

// --- Te beoordelen -----------------------------------------------------------------------------

export type TeBeoordelen = {
  offtopic: { id: number; naam: string; categorie: string; bericht: string; datum: string }[]
  duimpjes: { naam: string; vraag: string; datum: string }[]
  bel: { naam: string; dagen: number; vragen: number }[]
}

export async function haalTeBeoordelen(namen: Map<string, string>, rijen: GebruikerRij[], nu: Date): Promise<TeBeoordelen> {
  const supabase = db()
  const zevenDagenGeleden = new Date(nu.getTime() - 7 * 864e5).toISOString()
  const naam = (id: string) => namen.get(id) ?? 'onbekend'

  // Bellijst: eerst wie in aanmerking komt (proef loopt binnen 7 dagen af), dan alleen van die mensen het aantal vragen.
  const kandidaatIds = rijen
    .filter(r => { const d = proefDagenOver(r, nu); return d !== null && d >= 0 && d <= 7 })
    .map(r => r.user_id)

  const [flags, duimpjes, vragen] = await Promise.all([
    supabase.from('arnobot_offtopic_flags').select('id, user_id, category, message, created_at')
      .eq('reviewed', false).order('created_at', { ascending: false }).limit(20),
    supabase.from('arnobot_rds_logs').select('user_id, question, created_at')
      .eq('feedback', 'neg').gte('created_at', zevenDagenGeleden)
      .not('user_id', 'in', INTERNAL_TEST_USERS_IN).not('user_id', 'like', FAKE_DEMO_USER_LIKE)
      .order('created_at', { ascending: false }).limit(20),
    kandidaatIds.length
      ? haalAlleRijen<{ user_id: string }>((van, tot) =>
          supabase.from('arnobot_rds_logs').select('user_id').in('user_id', kandidaatIds)
            .order('id', { ascending: true }).range(van, tot))
      : Promise.resolve([] as { user_id: string }[]),
  ])
  if (flags.error) throw new Error(flags.error.message)
  if (duimpjes.error) throw new Error(duimpjes.error.message)

  const vragenPerUser = new Map<string, number>()
  for (const v of vragen) vragenPerUser.set(v.user_id, (vragenPerUser.get(v.user_id) ?? 0) + 1)

  return {
    offtopic: (flags.data ?? []).map(v => ({
      id: v.id as number, naam: naam(v.user_id as string), categorie: String(v.category ?? ''),
      bericht: String(v.message ?? '').slice(0, 160), datum: v.created_at as string,
    })),
    duimpjes: (duimpjes.data ?? []).map(v => ({
      naam: naam(v.user_id as string), vraag: String(v.question ?? '').slice(0, 140), datum: v.created_at as string,
    })),
    bel: bouwBellijst(rijen, vragenPerUser, nu),
  }
}

// --- Geld --------------------------------------------------------------------------------------

export type GeldKaart = {
  maandCent: number
  weekCent: number
  week: { naam: string; cent: number; datum: string }[]
  mislukt: { naam: string; cent: number; datum: string; status: string }[]
  opgezegd: { naam: string; plan: string }[]
  openTeamFacturen: { team: string; cent: number; datum: string; status: string }[]
}

export async function haalGeld(namen: Map<string, string>, nu: Date): Promise<GeldKaart> {
  const supabase = db()
  const maandStart = amsterdamMaandStart(nu)
  const vanaf = new Date(Math.min(new Date(maandStart).getTime(), nu.getTime() - 14 * 864e5)).toISOString()
  const naam = (id: string) => namen.get(id) ?? 'onbekend'

  const [betalingen, abos, facturen, teams] = await Promise.all([
    haalAlleRijen<BetalingRij>((van, tot) =>
      supabase.from('arnobot_payments').select('user_id, status, bedrag_cent, terugbetaald_cent, betaald_at, created_at')
        .gte('created_at', vanaf)
        .not('user_id', 'in', INTERNAL_TEST_USERS_IN).not('user_id', 'like', FAKE_DEMO_USER_LIKE)
        .order('id', { ascending: true }).range(van, tot)),
    supabase.from('arnobot_subscriptions').select('user_id, plan, status, opzegging_aangevraagd_at')
      .eq('status', 'active').not('opzegging_aangevraagd_at', 'is', null)
      .not('user_id', 'in', INTERNAL_TEST_USERS_IN).not('user_id', 'like', FAKE_DEMO_USER_LIKE),
    supabase.from('arnobot_team_facturen').select('team_id, bedrag_cent, status, created_at')
      .in('status', ['open', 'expired']).not('team_id', 'in', TEST_TEAM_IDS_IN).order('created_at', { ascending: false }).limit(40),
    supabase.from('arnobot_teams').select('id, name').not('id', 'in', TEST_TEAM_IDS_IN),
  ])
  if (abos.error) throw new Error(abos.error.message)
  const teamNaam = new Map((teams.data ?? []).map(t => [t.id as string, String(t.name ?? 'team')]))
  const som = vatBetalingenSamen(betalingen, nu, maandStart)
  return {
    maandCent: som.maandCent,
    weekCent: som.weekCent,
    week: som.week.map(w => ({ naam: naam(w.userId), cent: w.cent, datum: w.datum })),
    mislukt: som.mislukt.map(m => ({ naam: naam(m.userId), cent: m.cent, datum: m.datum, status: m.status })),
    opgezegd: (abos.data ?? []).map(s => ({ naam: naam(s.user_id as string), plan: planNaam(s.plan as string | null) })),
    // Open facturen altijd, verlopen (betaallink niet gebruikt) alleen van de laatste 30 dagen: oudere zijn geen actie meer.
    openTeamFacturen: (facturen.data ?? [])
      .filter(f => f.status === 'open' || new Date(f.created_at as string).getTime() >= nu.getTime() - 30 * 864e5)
      .map(f => ({ team: teamNaam.get(f.team_id as string) ?? 'team', cent: f.bedrag_cent as number, datum: f.created_at as string, status: f.status as string })),
  }
}

// --- Teams -------------------------------------------------------------------------------------

export type TeamsKaart = {
  teams: { naam: string; manager: string; leden: number; stand: string; niveau: Niveau }[]
  aanvragen: { bedrijf: string; aanvrager: string; seats: number | null; datum: string }[]
}

type ManagerRij = {
  user_id: string; email: string | null; voornaam: string | null; achternaam: string | null
  trial_start: string | null; expires_at: string | null; paid_at: string | null; sd_attribution_method: string | null
}

// Alleen kijken: verlengen van een proef blijft op de pc (knop VERLENG PROEF op /bot/admin/teams).
export async function haalTeams(nu: Date): Promise<TeamsKaart> {
  const supabase = db()
  const dertigDagenGeleden = new Date(nu.getTime() - 30 * 864e5).toISOString()
  const { data: teams, error } = await supabase
    .from('arnobot_teams').select('id, name, manager_id, min_seats, geblokkeerd_at')
    .not('id', 'in', TEST_TEAM_IDS_IN).order('name')
  if (error) throw new Error(error.message)
  const lijst = teams ?? []
  const managerIds = [...new Set(lijst.map(t => t.manager_id as string))]
  const teamIds = lijst.map(t => t.id as string)

  const [managers, leden, aanvragen] = await Promise.all([
    managerIds.length
      ? supabase.from('approved_users')
          .select('user_id, email, voornaam, achternaam, trial_start, expires_at, paid_at, sd_attribution_method')
          .in('user_id', managerIds)
      : Promise.resolve({ data: [] as ManagerRij[] }),
    teamIds.length
      ? supabase.from('arnobot_team_members').select('team_id, user_id').in('team_id', teamIds)
      : Promise.resolve({ data: [] as { team_id: string; user_id: string }[] }),
    supabase.from('arnobot_command_requests').select('bedrijfsnaam, aanvrager_naam, aantal_seats, created_at')
      .gte('created_at', dertigDagenGeleden).order('created_at', { ascending: false }).limit(10),
  ])
  const managerPerId = new Map(((managers.data ?? []) as ManagerRij[]).map(m => [m.user_id, m]))
  const ledenPerTeam = new Map<string, number>()
  for (const l of (leden.data ?? []) as { team_id: string; user_id: string }[]) {
    if (isFakeDemoUser(l.user_id) || isInternalTestUser(l.user_id)) continue
    ledenPerTeam.set(l.team_id, (ledenPerTeam.get(l.team_id) ?? 0) + 1)
  }

  return {
    teams: lijst.map(t => {
      const m = managerPerId.get(t.manager_id as string)
      let stand = 'klant'
      let niveau: Niveau = 'ok'
      if (t.geblokkeerd_at) {
        stand = 'geblokkeerd'; niveau = 'fout'
      } else if (m && isAgentProef(m, t.min_seats as number | null)) {
        const einde = proefEinde(m)
        if (einde) {
          const p = proefStand(einde, nu)
          if (p.staat === 'loopt') stand = `gratis proef, nog ${p.dagen} dagen`
          else if (p.staat === 'bijna') { stand = `gratis proef, nog ${p.dagen} dagen`; niveau = 'let-op' }
          else if (p.staat === 'coulance') { stand = `proef voorbij, coulance nog ${p.dagen} dagen`; niveau = 'let-op' }
          else { stand = 'proef afgelopen'; niveau = 'fout' }
        } else stand = 'gratis proef'
      }
      return {
        naam: String(t.name ?? 'team'),
        manager: m ? naamVan(m) : 'onbekend',
        leden: ledenPerTeam.get(t.id as string) ?? 0,
        stand, niveau,
      }
    }),
    aanvragen: (aanvragen.data ?? []).map(a => ({
      bedrijf: String(a.bedrijfsnaam ?? ''), aanvrager: String(a.aanvrager_naam ?? ''),
      seats: (a.aantal_seats as number | null) ?? null, datum: a.created_at as string,
    })),
  }
}

// --- Patronen (signaal voor het stoplicht en voor Te beoordelen) -------------------------------

export type PatroonRegel = { naam: string; deze: number; vorige: number; tweeWekenOpRij: boolean }

// De waarheidscontrole zelf (AI-beoordeling van een steekproef) draait niet op de telefoon: die staat in de
// wekelijkse mail. Hier alleen dezelfde tekstpatroontelling als in die mail (lib/gedragspatronen.ts, geen AI),
// om te zien of een patroon twee weken op rij terugkomt. Dan gaat de aanpak naar de code (CLAUDE.md, Waarheidscontrole).
export async function haalPatronen(nu: Date): Promise<PatroonRegel[]> {
  const supabase = db()
  const eigenaar = process.env.ARNOBOT_OWNER_USER_ID
  const grensDeze = nu.getTime() - 7 * 864e5
  const vanaf = new Date(nu.getTime() - 14 * 864e5).toISOString()
  const rijen = await haalAlleRijen<{ user_id: string | null; answer: string | null; created_at: string }>((van, tot) =>
    excludeInternalTestUsers(
      supabase.from('arnobot_rds_logs').select('user_id, answer, created_at').gte('created_at', vanaf),
    ).order('id', { ascending: true }).range(van, tot), { max: 50_000 })
  const bruikbaar = rijen.filter(r => r.user_id && r.answer && (!eigenaar || r.user_id !== eigenaar)) as { answer: string; created_at: string }[]
  const deze = bruikbaar.filter(r => new Date(r.created_at).getTime() >= grensDeze)
  const vorige = bruikbaar.filter(r => new Date(r.created_at).getTime() < grensDeze)
  const tD = telGedragspatronen(deze)
  const tV = telGedragspatronen(vorige)
  return tD
    .map((p, i): PatroonRegel => ({ naam: p.naam, deze: p.aantal, vorige: tV[i].aantal, tweeWekenOpRij: p.aantal > 0 && tV[i].aantal > 0 }))
    .filter(p => p.deze > 0 || p.vorige > 0)
}

