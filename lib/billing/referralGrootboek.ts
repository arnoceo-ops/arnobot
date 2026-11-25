import { billingDb, type PayRow, type SubRow } from './db'
import { heeftAndereTerugbetaling } from './terugbetaling'
import { huidigSeats, type TeamFactuurRow, type TeamRow } from './teamFacturatie'
import { formatEuro } from './geld'
import {
  TERMIJN_NA_PROEF_DAGEN, TERMIJN_NA_TEAMPROEF_DAGEN, maandNettoCent, tegoedNettoCent, tegoedStatus, type BetaaldePeriode,
} from './referralRegels'
import { beoordeelReferral, type AanbrengerFeiten, type Beoordeling, type KlantFeiten } from './referralBeoordeling'
import { berekenTeamPrijsPerMaand, TEAM_MIN_GEBRUIKERS, type Cyclus } from '@/lib/teamPricing'
import { TRIAL_DAGEN } from '@/lib/toegang'
import { nlVandaag } from '@/lib/nlTijd'
import { isInternalTestUser, TEST_TEAM_IDS } from '@/lib/internalTestAccounts'
import { haalAlleRijen } from '@/lib/haalAlleRijen'

// Het grootboek van het referraltegoed (docs/REFERRAL_AUTOMATISERING.md). Alleen toevoegen: elke gebeurtenis is een
// regel met een unieke sleutel, het saldo is de som van de regels. Draait nu MEELOPEND: de regels hebben
// meeloop = true, er verandert niets aan referrals, tegoed, betalingen of toegang, en niemand krijgt bericht behalve
// Arno. Bij livegang worden de meeloopregels niet meegenomen. Tabel: docs/sql/2026-11-25-referral-grootboek.sql.

export const MEELOOP = true
const DAG_MS = 24 * 60 * 60 * 1000

export type RegelSoort = 'toekenning' | 'afwijzing' | 'vaststelling' | 'verval' | 'handwerk'

export interface GrootboekRegel {
  event_key: string
  meeloop: boolean
  soort: RegelSoort
  referral_id: string
  aanbrenger_user_id: string
  klant_user_id: string
  /** Mutatie van het saldo in centen exclusief btw. null: toegekend, bedrag nog niet vast te stellen. */
  netto_cent: number | null
  reden: string
  klant_maand_netto_cent: number | null
  created_at?: string
}

export interface ReferralRij {
  id: string
  referrer_user_id: string
  referred_user_id: string
  created_at: string | null
}

export type ReferralStand =
  | { referral: ReferralRij; stand: 'uitgesloten' }
  | { referral: ReferralRij; stand: 'afgehandeld' }
  | { referral: ReferralRij; stand: 'beoordeeld'; beoordeling: Beoordeling }
  | { referral: ReferralRij; stand: 'fout'; fout: string }

export interface GrootboekRun {
  migratieOntbreekt: boolean
  referrals: ReferralStand[]
  /** Alle regels in het grootboek, inclusief de nieuwe van deze run. */
  regels: GrootboekRegel[]
  /** Regels die er door deze run bij zijn gekomen (of bij zouden komen als er niet geschreven wordt). */
  nieuw: GrootboekRegel[]
  fouten: string[]
}

type Antwoord<T> = { data: T | null; error: { message: string } | null }

/** Een mislukte zoekvraag mag nooit als "niets gevonden" tellen: dan zou tegoed ten onrechte vervallen. */
function verplicht<T>(wat: string, r: Antwoord<T>): T | null {
  if (r.error) throw new Error(`${wat} ophalen mislukt: ${r.error.message}`)
  return r.data
}

interface Gebruiker {
  trial_start: string | null
  paid_at: string | null
  command_manager: boolean | null
  sd_attribution_method: string | null
}

type Sub = SubRow & { updated_at?: string | null }
type Team = TeamRow & { stopt_op?: string | null }

interface Dossier {
  gebruiker: Gebruiker
  subs: Sub[]
  betalingen: (PayRow & { plan?: BetaaldePeriode['plan'] | null; cyclus?: Cyclus | null; klant_type?: BetaaldePeriode['klantType'] | null; periode_start?: string | null; periode_einde?: string | null })[]
  isGewoonTeamlid: boolean
  teams: Team[]
  facturen: TeamFactuurRow[]
}

/** null: het account bestaat niet meer. */
async function laadDossier(userId: string): Promise<Dossier | null> {
  const [gebruiker, subs, betalingen, lid, teams] = await Promise.all([
    billingDb.from('approved_users').select('trial_start, paid_at, command_manager, sd_attribution_method').eq('user_id', userId).maybeSingle<Gebruiker>(),
    billingDb.from('arnobot_subscriptions').select('*').eq('user_id', userId).returns<Sub[]>(),
    billingDb.from('arnobot_payments').select('*').eq('user_id', userId).returns<Dossier['betalingen']>(),
    billingDb.from('arnobot_team_members').select('team_id').eq('user_id', userId).limit(1),
    billingDb.from('arnobot_teams').select('id, name, manager_id, min_seats, cyclus, volgende_factuurdatum, geblokkeerd_at, stopt_op').eq('manager_id', userId).returns<Team[]>(),
  ])
  const g = verplicht('gebruiker', gebruiker)
  if (!g) return null
  const eigenTeams = (verplicht('teams', teams) ?? []).filter(t => !(TEST_TEAM_IDS as readonly string[]).includes(t.id))
  const facturen = eigenTeams.length
    ? verplicht('teamfacturen', await billingDb.from('arnobot_team_facturen').select('*').in('team_id', eigenTeams.map(t => t.id)).returns<TeamFactuurRow[]>()) ?? []
    : []
  return {
    gebruiker: g,
    subs: verplicht('abonnementen', subs) ?? [],
    betalingen: verplicht('betalingen', betalingen) ?? [],
    isGewoonTeamlid: (verplicht('teamlidmaatschap', lid) ?? []).length > 0 && g.command_manager !== true,
    teams: eigenTeams,
    facturen,
  }
}

const eigenBetalingTelt = (b: Dossier['betalingen'][number]) =>
  b.status === 'paid' && !b.terugbetaling_verwerkt_at && !(b.teruggeboekt_cent > 0) && !heeftAndereTerugbetaling(b, b.terugbetaald_cent ?? 0)

const teamFactuurTelt = (f: TeamFactuurRow) =>
  f.status === 'paid' && !f.reversed_at && !(f.terugbetaald_cent ?? 0) && !(f.teruggeboekt_cent ?? 0)

const teamMaandCent = (seats: number, cyclus: Cyclus) => (berekenTeamPrijsPerMaand(seats, cyclus) ?? 0) * 100

const subMaandCent = (s: Sub) => maandNettoCent(s.plan, s.cyclus, s.klant_type)

const proefEindeVan = (g: Gebruiker) =>
  g.trial_start ? new Date(Date.parse(g.trial_start) + TRIAL_DAGEN * DAG_MS).toISOString() : null

const heeftOoitAbonnement = (d: Dossier) => d.subs.some(s => s.status !== 'pending' && s.status !== 'abandoned')

async function klantFeiten(d: Dossier): Promise<KlantFeiten> {
  const betaalMomenten: KlantFeiten['betaalMomenten'] = []
  const periodes: BetaaldePeriode[] = []

  for (const b of d.betalingen) {
    const telt = eigenBetalingTelt(b)
    if (telt && b.betaald_at) betaalMomenten.push({ at: b.betaald_at, team: false })
    if (!b.plan || !b.cyclus || !b.klant_type || !b.periode_start || !b.periode_einde || !b.betaald_at) continue
    // Na een upgrade binnen hetzelfde jaar telt het abonnement zoals het nu is.
    const lopend = b.cyclus === 'jaarlijks'
      ? d.subs.find(s => s.id === b.subscription_id && (s.status === 'active' || s.status === 'cancelled') && s.cyclus === b.cyclus)
      : undefined
    const plan = (lopend?.plan ?? b.plan) as 'basis' | 'premium'
    periodes.push({
      plan, cyclus: b.cyclus, klantType: b.klant_type, periodeStart: b.periode_start, periodeEinde: b.periode_einde,
      betaaldAt: b.betaald_at, geldig: telt, maandNettoCent: maandNettoCent(plan, b.cyclus, b.klant_type),
    })
  }

  for (const f of d.facturen.filter(f => f.soort === 'regulier' && f.betaald_at)) {
    const team = d.teams.find(t => t.id === f.team_id)!
    const telt = teamFactuurTelt(f)
    if (telt) betaalMomenten.push({ at: f.betaald_at!, team: true })
    // Akkoord Arno: bij een team telt het aantal gebruikers op het moment van toekennen.
    const seats = await huidigSeats(team.id, team.min_seats ?? TEAM_MIN_GEBRUIKERS)
    periodes.push({
      plan: 'team', cyclus: f.cyclus, klantType: 'zakelijk', periodeStart: f.periode_start, periodeEinde: f.periode_einde,
      betaaldAt: f.betaald_at!, geldig: telt, maandNettoCent: teamMaandCent(seats, f.cyclus),
    })
  }

  return {
    proefEindeAt: proefEindeVan(d.gebruiker),
    betaalMomenten,
    periodes,
    handmatigBetaald: !!d.gebruiker.paid_at && !heeftOoitAbonnement(d) && !d.facturen.length,
    proefMogelijkVerlengd: d.gebruiker.sd_attribution_method === 'link' && betaalMomenten.some(m => m.team),
  }
}

async function aanbrengerFeiten(d: Dossier, nu: Date): Promise<AanbrengerFeiten> {
  const vandaag = nlVandaag(nu)
  // Alleen een team waarvoor echt betaald is, telt als abonnement van de manager.
  const betaaldeTeams = d.teams.filter(t => d.facturen.some(f => f.team_id === t.id && !!f.betaald_at))
  const gestopt = (t: Team) => !!t.stopt_op && t.stopt_op <= vandaag
  const lopendTeam = betaaldeTeams.find(t => !gestopt(t) && !t.geblokkeerd_at)
  const geblokkeerdTeam = betaaldeTeams.find(t => !gestopt(t) && !!t.geblokkeerd_at)

  const lopendeSub = d.subs
    .filter(s => s.status === 'active' || s.status === 'cancelled')
    .sort((a, b) => Date.parse(b.periode_einde ?? '0') - Date.parse(a.periode_einde ?? '0'))[0]

  const teamPrijs = async (t: Team) => teamMaandCent(await huidigSeats(t.id, t.min_seats ?? TEAM_MIN_GEBRUIKERS), t.cyclus ?? 'maandelijks')

  // Beëindigde abonnementen en teams, het laatste einde eerst.
  const eindes: { at: string; prijs: () => Promise<number> }[] = []
  for (const s of d.subs.filter(s => (s.status === 'ended' || s.status === 'refunded') && s.periode_einde)) {
    const terug = s.status === 'refunded' && s.updated_at && Date.parse(s.updated_at) < Date.parse(s.periode_einde!)
    eindes.push({ at: terug ? s.updated_at! : s.periode_einde!, prijs: async () => subMaandCent(s) })
  }
  for (const t of betaaldeTeams.filter(gestopt)) eindes.push({ at: `${t.stopt_op}T00:00:00.000Z`, prijs: () => teamPrijs(t) })
  const laatste = eindes.sort((a, b) => Date.parse(b.at) - Date.parse(a.at))[0]

  const loopt = !d.isGewoonTeamlid && (!!lopendTeam || !!lopendeSub)
  // Een manager betaalt zijn team: dat is dan zijn plafond, ook als er nog een oud solo-abonnement uitloopt.
  const maand = lopendTeam ? await teamPrijs(lopendTeam)
    : lopendeSub ? subMaandCent(lopendeSub)
      : geblokkeerdTeam ? await teamPrijs(geblokkeerdTeam)
        : laatste ? await laatste.prijs() : null

  const proefEinde = proefEindeVan(d.gebruiker)
  const termijn = d.teams.length ? TERMIJN_NA_TEAMPROEF_DAGEN : TERMIJN_NA_PROEF_DAGEN
  const ooit = !!lopendeSub || !!lopendTeam || !!geblokkeerdTeam || !!laatste

  return {
    stand: {
      loopt,
      laatsteEindeAt: d.isGewoonTeamlid
        // Bij een teamlid is alleen van belang of er ooit zelf betaald is.
        ? (ooit ? laatste?.at ?? lopendeSub?.periode_einde ?? nu.toISOString() : null)
        : laatste?.at ?? null,
      geblokkeerdSindsAt: !lopendTeam && !lopendeSub ? geblokkeerdTeam?.geblokkeerd_at ?? null : null,
      isGewoonTeamlid: d.isGewoonTeamlid,
      eersteBetalingUiterlijkAt: !ooit && proefEinde ? new Date(Date.parse(proefEinde) + termijn * DAG_MS).toISOString() : null,
    },
    handmatigBetaald: !!d.gebruiker.paid_at && !heeftOoitAbonnement(d) && !d.facturen.length && !d.isGewoonTeamlid,
    maandNettoCent: maand,
  }
}

const tabelOntbreekt = (e: { code?: string; message: string }) =>
  e.code === '42P01' || e.code === 'PGRST205' || /arnobot_referral_grootboek.*(does not exist|schema cache)/i.test(e.message)

/**
 * Beoordeelt alle referrals en het tegoed van alle aanbrengers. Met `schrijf` komen de nieuwe regels in het grootboek;
 * zonder is het een voorbeeld voor het overzicht. Vaker draaien is veilig: elke regel heeft een unieke sleutel.
 */
export async function draaiGrootboek(nu: Date, opties: { schrijf: boolean }): Promise<GrootboekRun> {
  const run: GrootboekRun = { migratieOntbreekt: false, referrals: [], regels: [], nieuw: [], fouten: [] }

  const proef = await billingDb.from('arnobot_referral_grootboek').select('event_key').limit(1)
  if (proef.error) {
    if (!tabelOntbreekt(proef.error)) throw new Error(`grootboek ophalen mislukt: ${proef.error.message}`)
    run.migratieOntbreekt = true
  } else {
    run.regels = await haalAlleRijen<GrootboekRegel>((van, tot) =>
      billingDb.from('arnobot_referral_grootboek').select('*').eq('meeloop', MEELOOP)
        .order('created_at', { ascending: true }).order('id').range(van, tot))
  }
  const schrijf = opties.schrijf && !run.migratieOntbreekt

  const referrals = await haalAlleRijen<ReferralRij>((van, tot) =>
    billingDb.from('arnobot_referrals').select('id, referrer_user_id, referred_user_id, created_at')
      .order('id', { ascending: true }).range(van, tot))

  const bekend = new Set(run.regels.map(r => r.event_key))
  const voegToe = async (regel: Omit<GrootboekRegel, 'meeloop'>) => {
    if (bekend.has(regel.event_key)) return
    const volledig: GrootboekRegel = { ...regel, meeloop: MEELOOP }
    if (schrijf) {
      const { error } = await billingDb.from('arnobot_referral_grootboek').insert(volledig)
      // 23505: een gelijktijdige run was ons voor.
      if (error) {
        if ((error as { code?: string }).code === '23505') return
        throw new Error(`grootboekregel niet opgeslagen: ${error.message}`)
      }
    }
    bekend.add(regel.event_key)
    run.regels.push(volledig)
    run.nieuw.push(volledig)
  }

  const dossiers = new Map<string, Promise<Dossier | null>>()
  const dossier = (userId: string) => {
    let d = dossiers.get(userId)
    if (!d) dossiers.set(userId, (d = laadDossier(userId)))
    return d
  }

  // 1. Per referral: is er iets toe te kennen of af te wijzen?
  for (const referral of referrals) {
    const { referrer_user_id: aanbrengerId, referred_user_id: klantId } = referral
    const id = String(referral.id)
    if (isInternalTestUser(aanbrengerId) || isInternalTestUser(klantId)) {
      run.referrals.push({ referral, stand: 'uitgesloten' })
      continue
    }
    if (bekend.has(`uitkomst:${id}`)) {
      run.referrals.push({ referral, stand: 'afgehandeld' })
      continue
    }
    try {
      const wederzijds = aanbrengerId === klantId
        || referrals.some(r => r.referrer_user_id === klantId && r.referred_user_id === aanbrengerId)
      const beoordeel = async (): Promise<Beoordeling> => {
        if (wederzijds) return { uitkomst: 'afwijzen', reden: 'wederzijdse verwijzing' }
        const [klant, aanbrenger] = await Promise.all([dossier(klantId), dossier(aanbrengerId)])
        if (!klant || !aanbrenger) return { uitkomst: 'handwerk', reden: `account van de ${klant ? 'aanbrenger' : 'nieuwe gebruiker'} bestaat niet meer` }
        return beoordeelReferral(await klantFeiten(klant), await aanbrengerFeiten(aanbrenger, nu), nu)
      }
      const beoordeling = await beoordeel()
      run.referrals.push({ referral, stand: 'beoordeeld', beoordeling })

      const basis = { referral_id: id, aanbrenger_user_id: aanbrengerId, klant_user_id: klantId, reden: beoordeling.reden }
      if (beoordeling.uitkomst === 'toekennen') {
        await voegToe({ ...basis, event_key: `uitkomst:${id}`, soort: 'toekenning', netto_cent: beoordeling.nettoCent, klant_maand_netto_cent: beoordeling.klantMaandNettoCent })
      } else if (beoordeling.uitkomst === 'afwijzen') {
        await voegToe({ ...basis, event_key: `uitkomst:${id}`, soort: 'afwijzing', netto_cent: 0, klant_maand_netto_cent: null })
      } else if (beoordeling.uitkomst === 'handwerk') {
        await voegToe({ ...basis, event_key: `handwerk:${id}`, soort: 'handwerk', netto_cent: 0, klant_maand_netto_cent: null })
      }
    } catch (e) {
      const fout = e instanceof Error ? e.message : String(e)
      run.referrals.push({ referral, stand: 'fout', fout })
      run.fouten.push(`referral ${id}: ${fout}`)
    }
  }

  // 2. Per toekenning die nog niet vervallen is: vervalt het, of kan het bedrag nu worden vastgesteld?
  for (const t of run.regels.filter(r => r.soort === 'toekenning')) {
    if (bekend.has(`verval:${t.referral_id}`)) continue
    try {
      const eigen = await dossier(t.aanbrenger_user_id)
      const feiten = eigen ? await aanbrengerFeiten(eigen, nu) : null
      if (feiten?.handmatigBetaald) continue
      const status = feiten ? tegoedStatus(feiten.stand, nu) : 'vervallen'
      const vastgesteld = run.regels.find(r => r.event_key === `vaststelling:${t.referral_id}`)
      const basis = { referral_id: t.referral_id, aanbrenger_user_id: t.aanbrenger_user_id, klant_user_id: t.klant_user_id, klant_maand_netto_cent: t.klant_maand_netto_cent }
      if (status === 'vervallen') {
        const staat = t.netto_cent ?? vastgesteld?.netto_cent ?? 0
        await voegToe({ ...basis, event_key: `verval:${t.referral_id}`, soort: 'verval', netto_cent: -staat || 0, reden: eigen ? 'abonnement van de aanbrenger is afgelopen of niet op tijd afgesloten' : 'account van de aanbrenger bestaat niet meer' })
      } else if (feiten && t.netto_cent === null && !vastgesteld && status !== 'wacht' && feiten.maandNettoCent !== null && t.klant_maand_netto_cent !== null) {
        await voegToe({ ...basis, event_key: `vaststelling:${t.referral_id}`, soort: 'vaststelling', netto_cent: tegoedNettoCent(t.klant_maand_netto_cent, feiten.maandNettoCent), reden: 'eerste abonnement van de aanbrenger' })
      }
    } catch (e) {
      run.fouten.push(`tegoed ${t.referral_id}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  return run
}

export function saldoPerAanbrenger(regels: GrootboekRegel[]): Map<string, number> {
  const uit = new Map<string, number>()
  for (const r of regels) uit.set(r.aanbrenger_user_id, (uit.get(r.aanbrenger_user_id) ?? 0) + (r.netto_cent ?? 0))
  return uit
}

/** Eén leesbare zin per nieuwe regel, voor de Telegram-melding. */
export function regelTekst(r: GrootboekRegel, aanbrenger: string, klant: string): string {
  const bedrag = r.netto_cent === null ? null : `${formatEuro(Math.abs(r.netto_cent))} excl. btw`
  switch (r.soort) {
    case 'toekenning': return `Zou toekennen aan ${aanbrenger} voor ${klant}: ${bedrag ?? 'bedrag volgt'} (${r.reden})`
    case 'afwijzing': return `Zou niets toekennen aan ${aanbrenger} voor ${klant}: ${r.reden}`
    case 'vaststelling': return `Bedrag zou vaststaan voor ${aanbrenger} (klant ${klant}): ${bedrag}`
    case 'verval': return `Zou vervallen bij ${aanbrenger} (klant ${klant}): ${bedrag} (${r.reden})`
    case 'handwerk': return `Zelf beoordelen: ${aanbrenger}, klant ${klant}: ${r.reden}`
  }
}

export const MIJLPALEN = [50, 100, 250]

/** De mijlpalen die er met deze run bij zijn gekomen (aantal toekenningen). */
export function nieuweMijlpalen(regels: GrootboekRegel[], nieuw: GrootboekRegel[]): number[] {
  const tel = (r: GrootboekRegel[]) => r.filter(x => x.soort === 'toekenning').length
  const na = tel(regels)
  const voor = na - tel(nieuw)
  return MIJLPALEN.filter(m => voor < m && na >= m)
}
