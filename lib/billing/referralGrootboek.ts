import { billingDb, type PayRow, type SubRow } from './db'
import { heeftAndereTerugbetaling, isVolledigTerugbetaald } from './terugbetaling'
import { lijstBetalingTerugbetalingen, mollieIngeschakeld } from './mollie'
import { huidigSeats, type TeamFactuurRow, type TeamRow } from './teamFacturatie'
import { formatEuro, mollieNaarCenten } from './geld'
import {
  TERMIJN_NA_PROEF_DAGEN, TERMIJN_NA_TEAMPROEF_DAGEN, VERVAL_NA_BLOKKADE_DAGEN, VERVAL_NA_EINDE_DAGEN, maandNettoCent, metJaarKorting, tegoedStatus, tijdigMomentTeam, vervalMoment,
  vervallenNaAanmelding,
  type BetaaldePeriode, type Dekking,
  kwalificatie,
} from './referralRegels'
import { TEAMBEGIN_ONZEKER, beoordeelReferral, type AanbrengerFeiten, type Beoordeling, type KlantFeiten } from './referralBeoordeling'
import { isTeruggedraaid, vervalBedrag } from './referralSaldo'
import { MEELOOP } from './referralStand'
import { teamPrijsPerMaandStrikt, TEAM_MIN_TEAMLEDEN, type Cyclus } from '@/lib/teamPricing'
import { TRIAL_DAGEN } from '@/lib/toegang'
import { eersteProefStart } from '@/lib/referralKenmerken'
import { isGratisAccount } from '@/lib/gratisAccount'
import { berekenBedrag } from './prijzen'
import { nlVandaag } from '@/lib/nlTijd'
import { isInternalTestUser, TEST_TEAM_IDS } from '@/lib/internalTestAccounts'
import { haalAlleRijen } from '@/lib/haalAlleRijen'

// Het grootboek van het referraltegoed (docs/REFERRAL_AUTOMATISERING.md). Alleen toevoegen: elke gebeurtenis is een
// regel met een unieke sleutel, het saldo is de som van de regels. Draait nu MEELOPEND: de regels hebben
// meeloop = true, er verandert niets aan referrals, tegoed, betalingen of toegang, en niemand krijgt bericht behalve
// Arno. Bij livegang worden de meeloopregels niet meegenomen. Tabel: docs/sql/2026-11-25-referral-grootboek.sql.

export { MEELOOP }
const HANDMATIG = 'handmatig besluit: '
const DAG_MS = 24 * 60 * 60 * 1000

// De laatste vier ontstaan alleen via de databasefuncties (docs/sql/2026-11-26-referral-verrekening.sql).
export type RegelSoort = 'toekenning' | 'afwijzing' | 'vaststelling' | 'verval' | 'handwerk'
  | 'verrekening' | 'vrijgave' | 'terugdraaiing' | 'herstel'

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
  // Alle vier vanaf docs/sql/2026-11-26-referral-verrekening.sql.
  /** Bij een toekenning: de betalingen eronder (Mollie-kenmerk, bij een team het id van de teamfactuur). */
  bron_ids?: string[] | null
  /** Bij een toekenning: wanneer de klant het tegoed verdiende. Leeg bij een handmatig besluit: dan telt created_at. */
  verdiend_at?: string | null
  actie_id?: string | null
  hoort_bij?: string | null
  mail_at?: string | null
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
  /** Als handwerk vastgelegd: de cron beslist hier nooit meer zelf over, alleen Arno (legBesluitVast). */
  | { referral: ReferralRij; stand: 'handwerk_open'; reden: string }
  | { referral: ReferralRij; stand: 'beoordeeld'; beoordeling: Beoordeling }
  | { referral: ReferralRij; stand: 'fout'; fout: string }

/**
 * De enige plek waar een regel het grootboek in gaat. Meeloopregels: een gewone invoeging. Echte regels: altijd via de
 * databasefunctie referral_boek, achter hetzelfde slot per aanbrenger als reserveren en terugdraaien. Zij rekent het
 * bedrag van een verval zelf uit; dat nemen we over.
 */
async function bewaarRegel(regel: GrootboekRegel): Promise<'geschreven' | 'bestond'> {
  if (!regel.meeloop) {
    const { data, error } = await billingDb.rpc('referral_boek', { p_regel: regel })
    if (error) throw new Error(`grootboekregel niet opgeslagen: ${error.message}`)
    const uit = data as { ok?: boolean; reden?: string; bestaand?: boolean; netto_cent?: number | null } | null
    if (!uit?.ok) throw new Error(`grootboekregel geweigerd: ${uit?.reden ?? 'onbekend'}`)
    if (uit.bestaand) return 'bestond'
    if (regel.soort === 'verval') regel.netto_cent = uit.netto_cent ?? 0
    return 'geschreven'
  }
  const invoer = { ...regel }
  let { error } = await billingDb.from('arnobot_referral_grootboek').insert(invoer)
  // Deze kolommen bestaan pas na docs/sql/2026-11-26-referral-verrekening.sql: zolang die niet is uitgevoerd gaat de
  // regel er zonder in. Er wordt per fout een kolom genoemd. Gaat het om iets anders, dan faalt de volgende poging ook.
  for (let poging = 0; error && poging < 2; poging++) {
    const kolom = (['bron_ids', 'verdiend_at'] as const).find(k => invoer[k] && error!.message.includes(k))
    if (!kolom) break
    delete invoer[kolom]
    error = (await billingDb.from('arnobot_referral_grootboek').insert({ ...invoer })).error
  }
  if (!error) return 'geschreven'
  // 23505: een gelijktijdige run was ons voor.
  if ((error as { code?: string }).code === '23505') return 'bestond'
  throw new Error(`grootboekregel niet opgeslagen: ${error.message}`)
}

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
  email: string | null
  voornaam?: string | null
  trial_reactivated_at?: string | null
  /** Vanaf docs/sql/2026-11-26-referral-ronde2.sql, zie lib/referralKenmerken.ts. */
  eerste_proef_start?: string | null
  ooit_teamlid_at?: string | null
  trial_start: string | null
  expires_at: string | null
  paid_at: string | null
  command_manager: boolean | null
  sd_attribution_method: string | null
  /** Vanaf docs/sql/2026-11-26-referral-ronde2.sql. Door Arno met de hand gezet. */
  lifetime_sinds?: string | null
  /** Vanaf docs/sql/2026-11-26-gratis-kenmerk.sql. */
  gratis_sinds?: string | null
}

type Sub = SubRow & { updated_at?: string | null }
type Team = TeamRow & { stopt_op?: string | null }
export type Betaling = PayRow & {
  plan?: BetaaldePeriode['plan'] | null; cyclus?: Cyclus | null; klant_type?: BetaaldePeriode['klantType'] | null
  periode_start?: string | null; periode_einde?: string | null
}

export interface Dossier {
  gebruiker: Gebruiker
  subs: Sub[]
  betalingen: Betaling[]
  isGewoonTeamlid: boolean
  teams: Team[]
  facturen: TeamFactuurRow[]
  /** Ooit met de knop BETAALD gezet: dan kan er buiten ons systeem betaald zijn en is de voorgeschiedenis niet volledig. */
  ooitMetDeHandBetaald: boolean
  /** Ooit gratis toegang gekregen (knop GRATIS): daar is niets over besloten, dus nooit automatisch tegen hem beslissen. */
  ooitGratisToegang: boolean
}

/** null: het account bestaat niet meer, ook als het alleen geanonimiseerd is. */
export async function laadDossier(userId: string): Promise<Dossier | null> {
  const [gebruiker, subs, betalingen, lid, teams, handLog] = await Promise.all([
    // Alle kolommen: lifetime_sinds bestaat pas na de SQL.
    billingDb.from('approved_users').select('*').eq('user_id', userId).maybeSingle<Gebruiker>(),
    billingDb.from('arnobot_subscriptions').select('*').eq('user_id', userId).returns<Sub[]>(),
    billingDb.from('arnobot_payments').select('*').eq('user_id', userId).returns<Betaling[]>(),
    billingDb.from('arnobot_team_members').select('team_id').eq('user_id', userId).limit(1),
    billingDb.from('arnobot_teams').select('id, name, manager_id, min_seats, cyclus, volgende_factuurdatum, geblokkeerd_at, stopt_op').eq('manager_id', userId).returns<Team[]>(),
    billingDb.from('arnobot_admin_log').select('actie').eq('doel_user_id', userId).in('actie', ['betaald_gezet', 'gratis_toegang', 'gratis_beeindigd']).limit(1000),
  ])
  const g = verplicht('gebruiker', gebruiker)
  // Anonimiseren bij een verwijderverzoek: de rij blijft staan, zonder naam en e-mailadres.
  if (!g || (!g.email && !g.voornaam)) return null
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
    ooitMetDeHandBetaald: (verplicht('adminlog', handLog) ?? []).some(r => r.actie === 'betaald_gezet'),
    // Een lege trial_start is het spoor van gratis toegang van voor het adminlog.
    ooitGratisToegang: !g.trial_start || !!g.gratis_sinds || (verplicht('adminlog', handLog) ?? []).some(r => r.actie !== 'betaald_gezet'),
  }
}

/** Betaald en niet helemaal teruggedraaid. Telt voor "op tijd betaald", ook na een deelterugbetaling. */
export const eigenBetalingStaat = (b: Betaling) =>
  b.status === 'paid' && !b.terugbetaling_verwerkt_at && !(b.teruggeboekt_cent > 0) && !isVolledigTerugbetaald(b, b.terugbetaald_cent ?? 0)

/** Telt als betaalde periode: er is niets van terug, behalve verrekend referraltegoed. */
export const eigenBetalingTelt = (b: Betaling) => eigenBetalingStaat(b) && !heeftAndereTerugbetaling(b, b.terugbetaald_cent ?? 0)

const teamFactuurStaat = (f: TeamFactuurRow) => f.status === 'paid' && !f.reversed_at && !(f.teruggeboekt_cent ?? 0)
// Referralgeld dat op de factuur is teruggestort maakt haar geen minder betaalde maand.
const teamFactuurTelt = (f: TeamFactuurRow) => teamFactuurStaat(f) && !heeftAndereTerugbetaling(f, f.terugbetaald_cent ?? 0)

const teamMaandCent = (seats: number, cyclus: Cyclus) => teamPrijsPerMaandStrikt(seats, cyclus) * 100

/** Maandprijs exclusief btw van wat er echt is afgesproken of betaald, niet de huidige prijslijst. */
function nettoPerMaand(r: { bedrag_cent: number; btw_cent: number }, cyclus: Cyclus): number {
  const cent = Math.round((r.bedrag_cent - r.btw_cent) / (cyclus === 'jaarlijks' ? 12 : 1))
  // Een ontbrekend bedrag mag nooit als tegoed in het grootboek komen.
  if (!Number.isFinite(cent)) throw new Error('bedrag of btw van een abonnement of betaling ontbreekt')
  return cent
}

const lopend = (s: Sub) => s.status === 'active' || s.status === 'cancelled'

/**
 * Een upgrade waarvan de bijbetaling niet is binnengekomen. Zonder betaalrij (bijbetaling van nul) telt Pro gewoon,
 * en een deelterugbetaling maakt een bijbetaling niet ongedaan. Is er al een Pro-periode betaald, dan is het ook Pro.
 */
function upgradeNietBetaald(d: Dossier, subId: string): boolean {
  const upgrades = d.betalingen.filter(b => b.soort === 'upgrade' && b.subscription_id === subId)
  return upgrades.length > 0 && !upgrades.some(eigenBetalingStaat)
    && !d.betalingen.some(b => b.subscription_id === subId && b.plan === 'premium' && eigenBetalingStaat(b))
}

const effectiefPlan = (d: Dossier, s: Sub): 'basis' | 'premium' =>
  s.plan === 'premium' && upgradeNietBetaald(d, s.id) ? 'basis' : s.plan

/**
 * Maandprijs van een abonnementsrij. Na een directe upgrade staat de rij op Pro terwijl bedrag en btw nog van Basic
 * zijn, tot de eerste Pro-incasso (overstap.ts, zetPlanOpPro). De Pro-prijs staat dan in gepland_*, en na opzeggen is
 * die gewist: dan geldt de prijslijst.
 */
function subMaandCent(d: Dossier, s: Sub): number {
  const plan = effectiefPlan(d, s)
  const basis = berekenBedrag('basis', s.cyclus, s.klant_type).brutoCent
  if (plan === 'premium' && s.bedrag_cent <= basis) {
    return s.gepland_plan === 'premium' && s.gepland_cyclus === s.cyclus && s.gepland_bedrag_cent != null && s.gepland_btw_cent != null
      ? nettoPerMaand({ bedrag_cent: s.gepland_bedrag_cent, btw_cent: s.gepland_btw_cent }, s.cyclus)
      : maandNettoCent('premium', s.cyclus, s.klant_type)
  }
  // Teruggevallen op Basic terwijl de rij al de Pro-prijs draagt.
  if (plan !== s.plan && s.bedrag_cent > basis) return maandNettoCent('basis', s.cyclus, s.klant_type)
  return nettoPerMaand(s, s.cyclus)
}

/** Per jaar telt de volle prijs: de eerste betaling kan de referral fee al bevatten. */
function betaaldMaandCent(b: Betaling): number {
  if (b.cyclus === 'jaarlijks' && b.soort === 'eerste' && (b.plan === 'basis' || b.plan === 'premium') && b.klant_type
    && b.bedrag_cent === metJaarKorting(berekenBedrag(b.plan, 'jaarlijks', b.klant_type)).bedrag.brutoCent) {
    return maandNettoCent(b.plan, 'jaarlijks', b.klant_type)
  }
  return nettoPerMaand(b, b.cyclus!)
}

/** Het plan staat al op Pro terwijl de bijbetaling nog niet definitief is. */
const bijbetalingLoopt = (d: Dossier) => d.betalingen.some(b => b.soort === 'upgrade'
  && !['paid', 'failed', 'canceled', 'expired'].includes(b.status)
  && d.subs.some(s => s.id === b.subscription_id && lopend(s)))

export const teamGestopt = (t: Team, nu: Date) => !!t.stopt_op && t.stopt_op <= nlVandaag(nu)

/** Alleen een team waarvoor echt betaald is (en niet teruggedraaid), telt als abonnement van de manager. */
export const betaaldeTeamsVan = (d: Pick<Dossier, 'teams' | 'facturen'>) => d.teams.filter(t => d.facturen.some(f => f.team_id === t.id && teamFactuurStaat(f)))

const heeftTeruggedraaideFactuur = (d: Dossier, t: Team) =>
  d.facturen.some(f => f.team_id === t.id && (f.status === 'refunded' || !!f.reversed_at || (f.teruggeboekt_cent ?? 0) > 0))

/** Wanneer een abonnement echt ophield. Bij een terugbetaling eerder dan het einde van de betaalde periode. */
const subEindeAt = (s: Sub): string | null =>
  s.status === 'refunded' && s.updated_at && (!s.periode_einde || Date.parse(s.updated_at) < Date.parse(s.periode_einde)) ? s.updated_at
    : s.periode_einde

/**
 * Na de blokkade is weer een eigen abonnement afgesloten, of een eerder abonnement liep door tot voorbij het moment
 * waarop het teamtegoed zou vervallen: de blokkade bepaalt de stand dan niet meer.
 */
const blokkadeAchterhaald = (d: Dossier, t: Team) => !!t.geblokkeerd_at && d.subs.some(s => {
  if (s.status === 'pending' || s.status === 'abandoned') return false
  if (s.created_at && Date.parse(s.created_at) > Date.parse(t.geblokkeerd_at!)) return true
  const einde = subEindeAt(s)
  return s.status === 'active' || (!!einde && Date.parse(einde) > Date.parse(eindeNaBlokkade(t.geblokkeerd_at!)))
})

/**
 * Het einde van een geblokkeerd team in de voorgeschiedenis. Met de 14 dagen respijt erbij vervalt het tegoed dan precies
 * 30 dagen na de blokkade, ook als daarna weer iets is afgesloten.
 */
const eindeNaBlokkade = (geblokkeerdAt: string) =>
  new Date(Date.parse(geblokkeerdAt) + (VERVAL_NA_BLOKKADE_DAGEN - VERVAL_NA_EINDE_DAGEN) * DAG_MS).toISOString()

/** Teams zonder staande betaling die toch als tijdvak tellen: teruggedraaid, of daarna gestopt of weer solo geworden. */
const teamsZonderBetaling = (d: Dossier, nu: Date) => {
  const betaald = betaaldeTeamsVan(d)
  return d.teams.filter(t => !betaald.includes(t) && (heeftTeruggedraaideFactuur(d, t)
    || ((blokkadeAchterhaald(d, t) || teamGestopt(t, nu)) && d.facturen.some(f => f.team_id === t.id))))
}

/** Wanneer een team als abonnement eindigde: de stop of, als die eerder valt, de blokkade. null: het loopt nog. */
function teamEindeAt(d: Dossier, t: Team, nu: Date): string | null {
  const momenten: string[] = []
  if (teamGestopt(t, nu)) momenten.push(`${t.stopt_op}T00:00:00.000Z`)
  // Een betaald team dat alleen geblokkeerd is, eindigt hier niet: daarvoor geldt de 30 dagen in de stand van nu.
  if (t.geblokkeerd_at && (teamGestopt(t, nu) || blokkadeAchterhaald(d, t) || !betaaldeTeamsVan(d).includes(t))) {
    momenten.push(eindeNaBlokkade(t.geblokkeerd_at))
  }
  return momenten.sort((a, b) => Date.parse(a) - Date.parse(b))[0] ?? null
}

/**
 * Staat paid_at met de hand gezet (de knop BETAALD) en is er niets in ons systeem dat de toegang nu verklaart? Bij een
 * online betaling is paid_at precies het betaalmoment van die betaling.
 */
function handmatigOpBetaald(d: Dossier, nu: Date): boolean {
  const paidAt = d.gebruiker.paid_at
  if (!paidAt || d.isGewoonTeamlid) return false
  if (d.subs.some(lopend) || betaaldeTeamsVan(d).some(t => !teamGestopt(t, nu))) return false
  return !d.betalingen.some(b => !!b.betaald_at && Math.abs(Date.parse(b.betaald_at) - Date.parse(paidAt)) < 5 * 60 * 1000)
}

export async function klantFeiten(d: Dossier, aangemeldAt: string | null, nu: Date): Promise<KlantFeiten> {
  const betaalMomenten: KlantFeiten['betaalMomenten'] = []
  const periodes: BetaaldePeriode[] = []

  for (const b of d.betalingen) {
    if (eigenBetalingStaat(b) && b.betaald_at) betaalMomenten.push({ at: b.betaald_at, team: false })
    if (!b.plan || !b.cyclus || !b.klant_type || !b.periode_start || !b.periode_einde || !b.betaald_at) continue
    // Na een upgrade binnen hetzelfde jaar telt het abonnement zoals het nu is, maar pas als de bijbetaling binnen is.
    const nuSub = b.cyclus === 'jaarlijks'
      ? d.subs.find(s => s.id === b.subscription_id && lopend(s) && s.cyclus === b.cyclus)
      : undefined
    const plan = (nuSub ? effectiefPlan(d, nuSub) : b.plan) as 'basis' | 'premium'
    // Per jaar telt de volle prijs van het abonnement: de betaling zelf kan de referral fee al bevatten.
    const rij = b.cyclus === 'jaarlijks'
      ? d.subs.find(s => s.id === b.subscription_id && s.cyclus === b.cyclus && effectiefPlan(d, s) === plan)
      : undefined
    periodes.push({
      plan, cyclus: b.cyclus, klantType: b.klant_type, periodeStart: b.periode_start, periodeEinde: b.periode_einde,
      betaaldAt: b.betaald_at, geldig: eigenBetalingTelt(b), maandNettoCent: rij ? subMaandCent(d, rij) : betaaldMaandCent(b),
      bronId: b.mollie_payment_id,
    })
  }

  const regulier = d.facturen.filter(f => f.soort === 'regulier' && f.betaald_at)
  const seatsPerTeam = new Map<string, number>()
  for (const f of regulier) {
    const team = d.teams.find(t => t.id === f.team_id)!
    if (teamFactuurStaat(f)) betaalMomenten.push({ at: tijdigMomentTeam(f.created_at, f.betaald_at!), team: true })
    // Akkoord Arno: bij een team telt het aantal gebruikers op het moment van toekennen.
    let seats = seatsPerTeam.get(team.id)
    if (seats === undefined) seatsPerTeam.set(team.id, (seats = await huidigSeats(team.id, team.min_seats ?? TEAM_MIN_TEAMLEDEN)))
    periodes.push({
      plan: 'team', cyclus: f.cyclus, klantType: 'zakelijk', periodeStart: f.periode_start, periodeEinde: f.periode_einde,
      betaaldAt: f.betaald_at!, geldig: teamFactuurTelt(f), maandNettoCent: teamMaandCent(seats, f.cyclus), bronId: f.id,
    })
  }

  const proefStart = eersteProefStart(d.gebruiker, aangemeldAt)

  return {
    aangemeldAt,
    // De eerste echte proef (die start na de intake), nooit een tweede.
    proefEindeAt: proefStart ? new Date(Date.parse(proefStart) + TRIAL_DAGEN * DAG_MS).toISOString() : null,
    betaalMomenten,
    periodes,
    handmatigBetaald: handmatigOpBetaald(d, nu),
    // Eerder met de hand: dan kan er op tijd per bank betaald zijn. Telt alleen waar we anders zouden afwijzen.
    ooitMetDeHandBetaald: d.ooitMetDeHandBetaald,
    proefMogelijkVerlengd: d.gebruiker.sd_attribution_method === 'link' && betaalMomenten.some(m => m.team),
    bijbetalingLoopt: bijbetalingLoopt(d),
  }
}

/** De tijdvakken waarin de aanbrenger zelf betaalde: eigen abonnementen en betaalde teams. */
function dekkingVan(d: Dossier, nu: Date, alleenBetaaldeFacturen = false): Dekking[] {
  const uit: Dekking[] = []
  for (const s of d.subs.filter(s => s.status !== 'pending' && s.status !== 'abandoned')) {
    const start = s.created_at ?? s.periode_start
    if (!start) continue
    const einde = s.status === 'active' ? null : subEindeAt(s) ?? s.updated_at ?? start
    uit.push({ start, einde, team: false })
  }
  // Teams zonder staande betaling tellen niet in de strenge variant.
  for (const t of [...betaaldeTeamsVan(d), ...(alleenBetaaldeFacturen ? [] : teamsZonderBetaling(d, nu))]) {
    // De vroegste van periodestart en aanmaakdag van de factuur: te laat betalen verschuift het begin niet.
    // Alle facturen: een later teruggedraaide of onbetaalde eerste factuur maakt het team niet later begonnen. Maakt zo
    // een factuur het verschil, dan beslist Arno: daarvoor rekent aanbrengerFeiten ook de strenge variant uit.
    const starts = d.facturen.filter(f => f.team_id === t.id && (!alleenBetaaldeFacturen || teamFactuurStaat(f)))
      .flatMap(f => [f.periode_start, f.created_at, f.betaald_at])
      .filter((x): x is string => !!x)
      .sort((a, b) => Date.parse(a) - Date.parse(b))
    if (starts[0]) uit.push({ start: starts[0], einde: teamEindeAt(d, t, nu), team: true })
  }
  return uit
}

export async function aanbrengerFeiten(d: Dossier, nu: Date): Promise<AanbrengerFeiten> {
  const betaaldeTeams = betaaldeTeamsVan(d)
  const gestopt = (t: Team) => teamGestopt(t, nu)
  const lopendTeam = betaaldeTeams.find(t => !gestopt(t) && !t.geblokkeerd_at)
  const geblokkeerdTeam = betaaldeTeams.find(t => !gestopt(t) && !!t.geblokkeerd_at && !blokkadeAchterhaald(d, t))
  // Facturatie staat aan en er is nog niets betaald: de eerste factuur komt nog of staat open (ook solo naar Team).
  const heeftOpenFactuur = (t: Team) => d.facturen.some(f => f.team_id === t.id && (f.status === 'open' || f.status === 'overdue'))
  const onbetaald = d.teams.filter(t => !gestopt(t) && !betaaldeTeams.includes(t))
  // Ook na een teruggedraaide factuur: de toegang blokkeren we niet vanzelf, dus tot een blokkade of stop wacht alles.
  const teamInAfwachting = !lopendTeam && onbetaald.some(t => !t.geblokkeerd_at
    && (heeftOpenFactuur(t) || heeftTeruggedraaideFactuur(d, t) || (t.min_seats !== null && !!t.volgende_factuurdatum)))
  // Geblokkeerd om een onbetaalde of teruggedraaide eerste factuur: telt niet als betalend, het tegoed staat wel stil.
  const geblokkeerdOnbetaald = onbetaald.find(t => !!t.geblokkeerd_at && !blokkadeAchterhaald(d, t)
    && (heeftOpenFactuur(t) || heeftTeruggedraaideFactuur(d, t)))

  const lopendeSub = d.subs
    .filter(lopend)
    .sort((a, b) => Date.parse(b.periode_einde ?? '0') - Date.parse(a.periode_einde ?? '0'))[0]

  const teamPrijs = async (t: Team) => teamMaandCent(await huidigSeats(t.id, t.min_seats ?? TEAM_MIN_TEAMLEDEN), t.cyclus ?? 'maandelijks')

  // Beëindigde abonnementen en teams, het laatste einde eerst.
  const eindes: { at: string; prijs: () => Promise<number> }[] = []
  for (const s of d.subs.filter(s => (s.status === 'ended' || s.status === 'refunded') && s.periode_einde)) {
    eindes.push({ at: subEindeAt(s)!, prijs: async () => subMaandCent(d, s) })
  }
  for (const t of betaaldeTeams.filter(gestopt)) eindes.push({ at: teamEindeAt(d, t, nu)!, prijs: () => teamPrijs(t) })
  const laatsteEerst = (a: { at: string }, b: { at: string }) => Date.parse(b.at) - Date.parse(a.at)
  /** Het laatste einde van iets waarvoor echt betaald is: telt voor "zelf betaald" en voor zijn maandprijs. */
  const laatste = eindes.sort(laatsteEerst)[0]
  // Ook een gestopt team zonder staande betaling is een einde voor de vervaltermijn: anders rekent de stand met de
  // allang verlopen eerste termijn.
  const laatsteEindeStand = [
    ...(laatste ? [laatste] : []),
    ...teamsZonderBetaling(d, nu).filter(gestopt).map(t => ({ at: teamEindeAt(d, t, nu)! })),
  ].sort(laatsteEerst)[0]

  const loopt = !d.isGewoonTeamlid && (!!lopendTeam || !!lopendeSub)
  // Een manager betaalt zijn team: dat is dan zijn plafond, ook als er nog een oud solo-abonnement uitloopt.
  const maand = lopendTeam ? await teamPrijs(lopendTeam)
    : lopendeSub ? subMaandCent(d, lopendeSub)
      : geblokkeerdTeam ? await teamPrijs(geblokkeerdTeam)
        : laatste ? await laatste.prijs() : null

  // De uiterste dag voor een eerste abonnement. Een verlengde teamproef schuift de teamtermijn mee.
  const g = d.gebruiker
  const proefStart = eersteProefStart(g, g.trial_start)
  const proefEinde = proefStart ? Date.parse(proefStart) + TRIAL_DAGEN * DAG_MS : null
  // expires_at is een verlengde teamproef zolang er niet betaald en niet herstart is.
  const verlengd = !g.paid_at && !g.trial_reactivated_at && g.expires_at ? Date.parse(g.expires_at) : null
  const teamEinde = verlengd ?? proefEinde
  const na = (basis: number | null, dagen: number) => (basis === null ? null : new Date(basis + dagen * DAG_MS).toISOString())
  const eersteUiterlijk = { solo: na(proefEinde, TERMIJN_NA_PROEF_DAGEN), team: na(teamEinde, TERMIJN_NA_TEAMPROEF_DAGEN) }
  const ooitBetaald = !!lopendeSub || !!lopendTeam || !!geblokkeerdTeam || !!laatste
  const ooit = ooitBetaald || !!laatsteEindeStand
  const uiterlijkZonderAbonnement = d.teams.length ? eersteUiterlijk.team : eersteUiterlijk.solo

  const historie = {
    dekking: dekkingVan(d, nu), eersteUiterlijk, uiterlijkZonderAbonnement, teamInAfwachting: teamInAfwachting || !!geblokkeerdOnbetaald,
    isGewoonTeamlid: d.isGewoonTeamlid, lifetimeSinds: g.lifetime_sinds ?? null,
  }

  return {
    stand: {
      loopt,
      laatsteEindeAt: d.isGewoonTeamlid
        // Bij een teamlid is alleen van belang of er ooit zelf betaald is.
        ? (ooitBetaald ? laatste?.at ?? lopendeSub?.periode_einde ?? nu.toISOString() : null)
        : laatsteEindeStand?.at ?? null,
      geblokkeerdSindsAt: !lopendTeam && !lopendeSub ? (geblokkeerdTeam ?? geblokkeerdOnbetaald)?.geblokkeerd_at ?? null : null,
      isGewoonTeamlid: d.isGewoonTeamlid,
      eersteBetalingUiterlijkAt: ooit ? null : uiterlijkZonderAbonnement,
      teamInAfwachting,
      lifetime: !!g.lifetime_sinds,
    },
    historie,
    strengeHistorie: { ...historie, dekking: dekkingVan(d, nu, true) },
    // Alleen gratis_sinds beslist (Lifetime gaat voor), ook voor wie teamlid is geworden (regel eigenaar 26-11-2026).
    gratis: isGratisAccount(g),
    // Bij Lifetime vervalt niets: een BETAALD-vlag hoeft dan niets tegen te houden.
    handmatigBetaald: !g.lifetime_sinds && handmatigOpBetaald(d, nu),
    // Als gewoon teamlid is de stand wel zeker; daarna niet meer te zien wanneer dat was.
    historieOnvolledig: d.ooitMetDeHandBetaald || d.ooitGratisToegang || (!d.isGewoonTeamlid && !!g.ooit_teamlid_at),
    betaaldeTeamfactuur: d.facturen.some(f => f.status === 'paid' || !!f.betaald_at),
    maandNettoCent: maand,
    bijbetalingLoopt: bijbetalingLoopt(d),
  }
}

/**
 * Per betaling wat als referralbedrag geboekt staat maar zeker nog niet naar Mollie is gestuurd. Dat verklaart geen
 * terugbetaling die Mollie noemt. Zonder de actietabel is er niets gereserveerd.
 */
async function nogNietVerstuurd(betalingen: { id: string; referral_refund_cent?: number | null }[]): Promise<Map<string, number>> {
  const uit = new Map<string, number>()
  const ids = betalingen.filter(b => (b.referral_refund_cent ?? 0) > 0).map(b => b.id)
  if (!ids.length) return uit
  const { data, error } = await billingDb.from('arnobot_referral_acties').select('doel_id, bruto_cent, status, gegevens')
    .in('doel_soort', ['betaling', 'teamfactuur']).in('doel_id', ids).in('status', ['gereserveerd', 'bezig']).limit(1000)
  if (error) {
    if (tabelOntbreekt(error)) return uit
    throw new Error(`referralacties ophalen mislukt: ${error.message}`)
  }
  for (const a of (data ?? []) as { doel_id: string; bruto_cent: number; status: string; gegevens?: { post_geprobeerd_at?: string | null } | null }[]) {
    if (a.status === 'gereserveerd' || !a.gegevens?.post_geprobeerd_at) uit.set(a.doel_id, (uit.get(a.doel_id) ?? 0) + a.bruto_cent)
  }
  return uit
}

/**
 * Loopt er bij de klant een terugbetaling die onze database nog niet kent? amountRefunded op de betaling blijft 0 zolang
 * een terugbetaling loopt (gemeten in testmodus, 26-11-2026), de lijst met terugbetalingen toont haar wel. Een
 * toekenning is definitief, dus dit gaat er vlak voor. Een fout bij Mollie wordt doorgegeven: morgen opnieuw.
 */
async function onbekendeTerugbetaling(d: Dossier): Promise<boolean> {
  if (!mollieIngeschakeld()) return false
  const staand = d.betalingen.filter(eigenBetalingTelt)
  // Bij een bankfactuur is het Mollie-kenmerk dat van de dubbele betaling: dat die terugging zegt niets over de factuur.
  const facturen = d.facturen.filter(f => teamFactuurTelt(f) && !!f.mollie_payment_id && f.paid_via !== 'bank')
  const nietVerstuurd = await nogNietVerstuurd([...staand, ...facturen])
  const verklaard = (r: { id: string; referral_refund_cent?: number | null }) => Math.max(0, (r.referral_refund_cent ?? 0) - (nietVerstuurd.get(r.id) ?? 0))
  const betalingen = [
    ...staand.map(b => ({ id: b.mollie_payment_id, tegoed: verklaard(b) })),
    ...facturen.map(f => ({ id: f.mollie_payment_id!, tegoed: verklaard(f) })),
  ]
  for (const b of betalingen) {
    const terug = (await lijstBetalingTerugbetalingen(b.id))
      .filter(r => r.status !== 'failed' && r.status !== 'canceled')
      .reduce((som, r) => som + mollieNaarCenten(r.amount.value), 0)
    if (terug > b.tegoed) return true
  }
  return false
}

export type VervalOordeel = { stand: 'nee' } | { stand: 'vervalt' } | { stand: 'twijfel'; waarom: string; behouden: number }

/** Is het tegoed van deze toekenning vervallen, zeker of niet zeker? */
export function vervalOordeel(
  feiten: AanbrengerFeiten, regels: GrootboekRegel[], t: GrootboekRegel, aangemeld: string | null | undefined, nu: Date,
): VervalOordeel {
  // Na een handmatig besluit (toekennen of tegoed behouden) telt alleen wat daarna gebeurt: Arno heeft het verleden al
  // beoordeeld.
  const behouden = behoudRegels(regels, t.referral_id)
  const besluitAt = [t.reden.startsWith(HANDMATIG) ? t.created_at : null, ...behouden.map(r => r.created_at)]
    .filter((x): x is string => !!x)
    .sort((a, b) => Date.parse(b) - Date.parse(a))[0] ?? null
  const vanaf = besluitAt && aangemeld && Date.parse(besluitAt) > Date.parse(aangemeld) ? besluitAt : aangemeld
  const moment = vervalMoment(feiten.stand)
  const nuVervallen = tegoedStatus(feiten.stand, nu) === 'vervallen'
    && (!besluitAt || (moment !== null && moment > Date.parse(besluitAt)))
  const zeker = nuVervallen || (!!vanaf && vervallenNaAanmelding(feiten.historie, vanaf, nu))
  if (!zeker && !(vanaf && feiten.strengeHistorie && vervallenNaAanmelding(feiten.strengeHistorie, vanaf, nu))) return { stand: 'nee' }
  const waarom = !zeker ? TEAMBEGIN_ONZEKER
    : feiten.historieOnvolledig ? 'de aanbrenger stond met de hand op betaald, had gratis toegang of was teamlid'
      // Wie teamlid is en als manager teamfacturen betaalde, heeft geld betaald dat hier niet als eigen betaling telt.
      : feiten.stand.isGewoonTeamlid && feiten.betaaldeTeamfactuur ? 'het teamlid betaalde als manager teamfacturen'
        : null
  return waarom ? { stand: 'twijfel', waarom, behouden: behouden.length } : { stand: 'vervalt' }
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

  // In de echte stand mag er geen meeloopregel meer bestaan: dan is de overgang in de database niet gedaan, en zou alles
  // opnieuw beoordeeld worden, ook wat de eigenaar met de hand besliste.
  if (!MEELOOP && !run.migratieOntbreekt) {
    const oud = await billingDb.from('arnobot_referral_grootboek').select('event_key').eq('meeloop', true).limit(1)
    if (oud.error) throw new Error(`grootboek ophalen mislukt: ${oud.error.message}`)
    if (oud.data?.length) {
      run.fouten.push('REFERRAL_GROOTBOEK_ECHT staat aan terwijl er nog meeloopregels zijn: voer eerst de overgang in de database uit. Er is niets beoordeeld of geschreven.')
      return run
    }
  }

  const referrals = await haalAlleRijen<ReferralRij>((van, tot) =>
    billingDb.from('arnobot_referrals').select('id, referrer_user_id, referred_user_id, created_at')
      .order('id', { ascending: true }).range(van, tot))

  const bekend = new Set(run.regels.map(r => r.event_key))
  const voegToe = async (regel: Omit<GrootboekRegel, 'meeloop'>) => {
    if (bekend.has(regel.event_key)) return
    const volledig: GrootboekRegel = { ...regel, meeloop: MEELOOP }
    if (schrijf && await bewaarRegel(volledig) === 'bestond') return
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
    const open = run.regels.find(r => r.event_key === `handwerk:${id}`)
    if (open) {
      run.referrals.push({ referral, stand: 'handwerk_open', reden: open.reden })
      continue
    }
    try {
      const wederzijds = aanbrengerId === klantId
        || referrals.some(r => r.referrer_user_id === klantId && r.referred_user_id === aanbrengerId)
      const beoordeel = async (): Promise<Beoordeling> => {
        if (wederzijds) return { uitkomst: 'afwijzen', reden: 'wederzijdse verwijzing' }
        const [klant, aanbrenger] = await Promise.all([dossier(klantId), dossier(aanbrengerId)])
        if (!klant || !aanbrenger) return { uitkomst: 'handwerk', reden: `account van de ${klant ? 'aanbrenger' : 'nieuwe gebruiker'} bestaat niet meer` }
        const uitkomst = beoordeelReferral(await klantFeiten(klant, referral.created_at, nu), await aanbrengerFeiten(aanbrenger, nu), nu)
        if (uitkomst.uitkomst === 'toekennen' && await onbekendeTerugbetaling(klant)) {
          return { uitkomst: 'wacht', reden: 'bij de klant loopt een terugbetaling' }
        }
        return uitkomst
      }
      const beoordeling = await beoordeel()
      run.referrals.push({ referral, stand: 'beoordeeld', beoordeling })

      const basis = { referral_id: id, aanbrenger_user_id: aanbrengerId, klant_user_id: klantId, reden: beoordeling.reden }
      if (beoordeling.uitkomst === 'toekennen') {
        await voegToe({
          ...basis, event_key: `uitkomst:${id}`, soort: 'toekenning', netto_cent: beoordeling.nettoCent, klant_maand_netto_cent: beoordeling.klantMaandNettoCent,
          ...(beoordeling.bronIds ? { bron_ids: beoordeling.bronIds } : {}),
          ...(beoordeling.verdiendAt ? { verdiend_at: beoordeling.verdiendAt } : {}),
        })
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

  run.fouten.push(...await legOntbrekendeBronnenVast(run.regels, schrijf))

  // 2. Per toekenning die nog niet vervallen is: vervalt het? Heeft de aanbrenger nog geen bedrag, dan wordt dat pas
  // bij de eerste verrekening vastgesteld (soort 'vaststelling', nog niet gebouwd).
  for (const t of run.regels.filter(r => r.soort === 'toekenning')) {
    if (bekend.has(`verval:${t.referral_id}`)) continue
    try {
      const eigen = await dossier(t.aanbrenger_user_id)
      const feiten = eigen ? await aanbrengerFeiten(eigen, nu) : null
      if (feiten?.handmatigBetaald) continue
      const aangemeld = referrals.find(r => String(r.id) === t.referral_id)?.created_at
      const basis = {
        referral_id: t.referral_id, aanbrenger_user_id: t.aanbrenger_user_id, klant_user_id: t.klant_user_id,
        klant_maand_netto_cent: t.klant_maand_netto_cent,
      }
      if (feiten) {
        const oordeel = vervalOordeel(feiten, run.regels, t, aangemeld, nu)
        if (oordeel.stand === 'nee') continue
        if (oordeel.stand === 'twijfel') {
          // Niet zeker: niets laten vervallen, een keer aan Arno vragen. Na "behouden" is een volgende keer een nieuwe vraag.
          const nummer = oordeel.behouden ? `:${oordeel.behouden + 1}` : ''
          await voegToe({ ...basis, event_key: `${VERVAL_VRAAG}${t.referral_id}${nummer}`, soort: 'handwerk', netto_cent: 0, reden: `tegoed lijkt te vervallen, maar ${oordeel.waarom}` })
          continue
        }
      }
      await voegToe({
        ...basis, event_key: `verval:${t.referral_id}`, soort: 'verval',
        netto_cent: vervalBedrag(run.regels, t.referral_id), reden: eigen ? 'abonnement van de aanbrenger is afgelopen of niet op tijd afgesloten' : 'account van de aanbrenger bestaat niet meer',
      })
    } catch (e) {
      run.fouten.push(`tegoed ${t.referral_id}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  return run
}

export interface HandmatigBesluit {
  besluit: 'toekennen' | 'afwijzen'
  /** Bedrag in centen exclusief btw, verplicht bij toekennen. */
  nettoCent: number | null
  toelichting: string
}

export type BesluitUitkomst =
  | { ok: true; regel: GrootboekRegel; mijlpalen: Mijlpaal[] }
  | { ok: false; status: number; fout: string }

/** Legt Arno's besluit vast over een referral die als handwerk is aangemerkt. Eén keer, daarna definitief. */
export async function legBesluitVast(referralId: string, invoer: HandmatigBesluit): Promise<BesluitUitkomst> {
  const toelichting = invoer.toelichting.trim()
  if (!toelichting) return { ok: false, status: 400, fout: 'Geef een toelichting' }
  const nettoCent = invoer.besluit === 'toekennen' ? invoer.nettoCent : 0
  if (invoer.besluit === 'toekennen' && !(Number.isInteger(nettoCent) && nettoCent! > 0 && nettoCent! <= 1_000_000)) {
    return { ok: false, status: 400, fout: 'Vul een bedrag in' }
  }

  const regels = await opgeslagenRegels()
  const open = regels.find(r => r.event_key === `handwerk:${referralId}`)
  if (!open) return { ok: false, status: 404, fout: 'Deze referral wacht niet op een besluit' }
  if (regels.some(r => r.event_key === `uitkomst:${referralId}`)) return { ok: false, status: 409, fout: 'Over deze referral is al beslist' }

  const regel: GrootboekRegel = {
    event_key: `uitkomst:${referralId}`, meeloop: MEELOOP, soort: invoer.besluit === 'toekennen' ? 'toekenning' : 'afwijzing',
    referral_id: referralId, aanbrenger_user_id: open.aanbrenger_user_id, klant_user_id: open.klant_user_id,
    netto_cent: nettoCent, reden: `${HANDMATIG}${toelichting.slice(0, 300)}`,
    klant_maand_netto_cent: invoer.besluit === 'toekennen' ? nettoCent : null,
    ...(invoer.besluit === 'toekennen' ? await bewijsOnderBesluit(open.klant_user_id) : {}),
  }
  return schrijfBesluit(regel, regels)
}

/**
 * Haalt de klant op grond van zijn betalingen zelf de drempel, dan krijgt ook een handmatige toekenning die betalingen
 * mee: alleen dan kan zij later uitbetaald en teruggedraaid worden. Niet te bepalen is geen reden om te weigeren.
 */
async function bewijsOnderBesluit(klantId: string): Promise<Pick<GrootboekRegel, 'bron_ids' | 'verdiend_at'>> {
  try {
    const dossier = await laadDossier(klantId)
    if (!dossier) return {}
    const nu = new Date()
    const feiten = await klantFeiten(dossier, null, nu)
    const gehaald = kwalificatie(feiten.periodes, nu, feiten.gratisPeriodes)
    const bronnen = gehaald?.bronnen.map(p => p.bronId).filter((x): x is string => !!x) ?? []
    return bronnen.length ? { bron_ids: bronnen, verdiend_at: gehaald!.verdiendAt } : {}
  } catch {
    return {}
  }
}

/**
 * Een handmatige toekenning van voor de drempel heeft geen betalingskenmerken: zonder die wordt zij nooit uitbetaald (en
 * door 'oudste eerst' latere toekenningen ook niet) en nooit teruggedraaid. Haalt de klant de drempel later, dan worden
 * ze EEN keer vastgelegd, alleen in de lege kolom. Daarna staan ze vast: opnieuw uitrekenen zou na een terugbetaling
 * andere betalingen eronder schuiven. Alleen handmatige besluiten; een automatische toekenning zonder kenmerken is een
 * fout die zichtbaar moet blijven. Voor de planner, de machine en de nacontrole telt alleen wat opgeslagen is.
 */
async function legOntbrekendeBronnenVast(regels: GrootboekRegel[], schrijf: boolean): Promise<string[]> {
  const fouten: string[] = []
  for (const t of regels.filter(r => r.soort === 'toekenning' && !r.bron_ids?.length && r.reden?.startsWith(HANDMATIG))) {
    const bewijs = await bewijsOnderBesluit(t.klant_user_id)
    if (!bewijs.bron_ids || !schrijf) continue
    // Beide samen: alleen de kenmerken zou verlengingen tussen verdienen en besluit laten wegvallen.
    const { error } = await billingDb.from('arnobot_referral_grootboek').update({ bron_ids: bewijs.bron_ids, verdiend_at: bewijs.verdiend_at })
      .eq('event_key', t.event_key).eq('meeloop', t.meeloop).is('bron_ids', null)
    // De kolom bestaat pas na de verrekenings-SQL.
    if (error && !/bron_ids|verdiend_at/.test(error.message)) fouten.push(`betalingskenmerken ${t.referral_id} niet opgeslagen: ${error.message}`)
    else if (!error) Object.assign(t, bewijs)
  }
  return fouten
}

const VERVAL_VRAAG = 'verval-handwerk:'

const behoudRegels = (regels: GrootboekRegel[], referralId: string) =>
  regels.filter(r => r.referral_id === referralId && r.event_key.startsWith('verval-behoud:'))

/** De vraag "laten vervallen of behouden?" die nog op Arno wacht. */
export function openVervalVraag(regels: GrootboekRegel[], referralId: string): GrootboekRegel | null {
  if (regels.some(r => r.event_key === `verval:${referralId}`)) return null
  const beantwoord = behoudRegels(regels, referralId).length
  const sleutel = `${VERVAL_VRAAG}${referralId}${beantwoord ? `:${beantwoord + 1}` : ''}`
  return regels.find(r => r.event_key === sleutel) ?? null
}

export interface VervalBesluit {
  besluit: 'vervallen' | 'behouden'
  toelichting: string
}

/** Legt Arno's besluit vast over een tegoed dat lijkt te vervallen. "Vervallen" is definitief. */
export async function legVervalBesluitVast(referralId: string, invoer: VervalBesluit): Promise<BesluitUitkomst> {
  const toelichting = invoer.toelichting.trim()
  if (!toelichting) return { ok: false, status: 400, fout: 'Geef een toelichting' }
  const regels = await opgeslagenRegels()
  const toekenning = regels.find(r => r.event_key === `uitkomst:${referralId}` && r.soort === 'toekenning')
  if (!toekenning || !openVervalVraag(regels, referralId)) return { ok: false, status: 404, fout: 'Hierover wacht geen besluit' }

  const vervalt = invoer.besluit === 'vervallen'
  return schrijfBesluit({
    event_key: vervalt ? `verval:${referralId}` : `verval-behoud:${referralId}:${behoudRegels(regels, referralId).length + 1}`,
    meeloop: MEELOOP, soort: vervalt ? 'verval' : 'handwerk', referral_id: referralId,
    aanbrenger_user_id: toekenning.aanbrenger_user_id, klant_user_id: toekenning.klant_user_id,
    netto_cent: vervalt ? vervalBedrag(regels, referralId) : 0,
    reden: `${HANDMATIG}${toelichting.slice(0, 300)}`, klant_maand_netto_cent: toekenning.klant_maand_netto_cent,
  }, regels)
}

const opgeslagenRegels = () => haalAlleRijen<GrootboekRegel>((van, tot) =>
  billingDb.from('arnobot_referral_grootboek').select('*').eq('meeloop', MEELOOP)
    .order('created_at', { ascending: true }).order('id').range(van, tot))

async function schrijfBesluit(regel: GrootboekRegel, regels: GrootboekRegel[]): Promise<BesluitUitkomst> {
  try {
    if (await bewaarRegel(regel) === 'bestond') return { ok: false, status: 409, fout: 'Over deze referral is al beslist' }
  } catch (e) {
    return { ok: false, status: 500, fout: `Opslaan mislukt: ${e instanceof Error ? e.message : String(e)}` }
  }
  return { ok: true, regel, mijlpalen: nieuweMijlpalen([...regels, regel], [regel]) }
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
    case 'toekenning': return `${r.meeloop ? 'Zou toekennen' : 'Toegekend'} aan ${aanbrenger} voor ${klant}: ${bedrag ?? 'bedrag volgt'} (${r.reden})`
    case 'afwijzing': return `${r.meeloop ? 'Zou niets toekennen' : 'Niets toegekend'} aan ${aanbrenger} voor ${klant}: ${r.reden}`
    case 'vaststelling': return `${r.meeloop ? 'Bedrag zou vaststaan' : 'Bedrag staat vast'} voor ${aanbrenger} (klant ${klant}): ${bedrag}`
    case 'verval': return `${r.meeloop ? 'Zou vervallen' : 'Vervallen'} bij ${aanbrenger} (klant ${klant}): ${bedrag} (${r.reden})`
    case 'handwerk': return `Zelf beoordelen: ${aanbrenger}, klant ${klant}: ${r.reden}`
    case 'verrekening': return `Verrekend bij ${aanbrenger} (klant ${klant}): ${bedrag} (${r.reden})`
    case 'vrijgave': return `Verrekening teruggezet bij ${aanbrenger} (klant ${klant}): ${bedrag} (${r.reden})`
    case 'terugdraaiing': return `Teruggedraaid bij ${aanbrenger} (klant ${klant}): ${bedrag} (${r.reden})`
    case 'herstel': return `Hersteld bij ${aanbrenger} (klant ${klant}): ${bedrag} (${r.reden})`
  }
}

export const MIJLPALEN = [50, 100, 250]

export interface Mijlpaal {
  aanbrengerId: string
  aantal: number
}

/**
 * De mijlpalen die een aanbrenger er met deze regels bij heeft gehaald (aantal toekenningen per persoon). Een
 * teruggedraaide toekenning telt niet mee, tot zij hersteld is. `regels` is het hele grootboek, inclusief `nieuw`.
 */
export function nieuweMijlpalen(regels: GrootboekRegel[], nieuw: GrootboekRegel[]): Mijlpaal[] {
  const tel = (r: GrootboekRegel[], id: string) =>
    r.filter(x => x.soort === 'toekenning' && x.aanbrenger_user_id === id && !isTeruggedraaid(regels, x.referral_id)).length
  return [...new Set(nieuw.filter(r => r.soort === 'toekenning').map(r => r.aanbrenger_user_id))].flatMap(aanbrengerId => {
    const na = tel(regels, aanbrengerId)
    const voor = na - tel(nieuw, aanbrengerId)
    return MIJLPALEN.filter(m => voor < m && na >= m).map(aantal => ({ aanbrengerId, aantal }))
  })
}
