import { billingDb, type PayRow, type SubRow } from './db'
import { heeftAndereTerugbetaling, isVolledigTerugbetaald } from './terugbetaling'
import { lijstBetalingTerugbetalingen, mollieIngeschakeld } from './mollie'
import { huidigSeats, type TeamFactuurRow, type TeamRow } from './teamFacturatie'
import { formatEuro, mollieNaarCenten } from './geld'
import {
  TERMIJN_NA_PROEF_DAGEN, TERMIJN_NA_TEAMPROEF_DAGEN, maandNettoCent, metJaarKorting, tegoedStatus, tijdigMomentTeam, vervalMoment,
  vervallenNaAanmelding,
  type BetaaldePeriode, type Dekking,
} from './referralRegels'
import { beoordeelReferral, type AanbrengerFeiten, type Beoordeling, type KlantFeiten } from './referralBeoordeling'
import { berekenTeamPrijsPerMaand, TEAM_MIN_GEBRUIKERS, type Cyclus } from '@/lib/teamPricing'
import { TRIAL_DAGEN } from '@/lib/toegang'
import { eersteProefStart } from '@/lib/referralKenmerken'
import { berekenBedrag } from './prijzen'
import { nlVandaag } from '@/lib/nlTijd'
import { isInternalTestUser, TEST_TEAM_IDS } from '@/lib/internalTestAccounts'
import { haalAlleRijen } from '@/lib/haalAlleRijen'

// Het grootboek van het referraltegoed (docs/REFERRAL_AUTOMATISERING.md). Alleen toevoegen: elke gebeurtenis is een
// regel met een unieke sleutel, het saldo is de som van de regels. Draait nu MEELOPEND: de regels hebben
// meeloop = true, er verandert niets aan referrals, tegoed, betalingen of toegang, en niemand krijgt bericht behalve
// Arno. Bij livegang worden de meeloopregels niet meegenomen. Tabel: docs/sql/2026-11-25-referral-grootboek.sql.

export const MEELOOP = true
const HANDMATIG = 'handmatig besluit: '
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
  /** Als handwerk vastgelegd: de cron beslist hier nooit meer zelf over, alleen Arno (legBesluitVast). */
  | { referral: ReferralRij; stand: 'handwerk_open'; reden: string }
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
}

type Sub = SubRow & { updated_at?: string | null }
type Team = TeamRow & { stopt_op?: string | null }
type Betaling = PayRow & {
  plan?: BetaaldePeriode['plan'] | null; cyclus?: Cyclus | null; klant_type?: BetaaldePeriode['klantType'] | null
  periode_start?: string | null; periode_einde?: string | null
}

interface Dossier {
  gebruiker: Gebruiker
  subs: Sub[]
  betalingen: Betaling[]
  isGewoonTeamlid: boolean
  teams: Team[]
  facturen: TeamFactuurRow[]
  /** Ooit met de knop BETAALD gezet: dan kan er buiten ons systeem betaald zijn en is de voorgeschiedenis niet volledig. */
  ooitMetDeHandBetaald: boolean
}

/** null: het account bestaat niet meer, ook als het alleen geanonimiseerd is. */
async function laadDossier(userId: string): Promise<Dossier | null> {
  const [gebruiker, subs, betalingen, lid, teams, handLog] = await Promise.all([
    // Alle kolommen: lifetime_sinds bestaat pas na de SQL.
    billingDb.from('approved_users').select('*').eq('user_id', userId).maybeSingle<Gebruiker>(),
    billingDb.from('arnobot_subscriptions').select('*').eq('user_id', userId).returns<Sub[]>(),
    billingDb.from('arnobot_payments').select('*').eq('user_id', userId).returns<Betaling[]>(),
    billingDb.from('arnobot_team_members').select('team_id').eq('user_id', userId).limit(1),
    billingDb.from('arnobot_teams').select('id, name, manager_id, min_seats, cyclus, volgende_factuurdatum, geblokkeerd_at, stopt_op').eq('manager_id', userId).returns<Team[]>(),
    billingDb.from('arnobot_admin_log').select('actie').eq('doel_user_id', userId).eq('actie', 'betaald_gezet').limit(1),
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
    ooitMetDeHandBetaald: (verplicht('adminlog', handLog) ?? []).length > 0,
  }
}

/** Betaald en niet helemaal teruggedraaid. Telt voor "op tijd betaald", ook na een deelterugbetaling. */
const eigenBetalingStaat = (b: Betaling) =>
  b.status === 'paid' && !b.terugbetaling_verwerkt_at && !(b.teruggeboekt_cent > 0) && !isVolledigTerugbetaald(b, b.terugbetaald_cent ?? 0)

/** Telt als betaalde periode: er is niets van terug, behalve verrekend referraltegoed. */
const eigenBetalingTelt = (b: Betaling) => eigenBetalingStaat(b) && !heeftAndereTerugbetaling(b, b.terugbetaald_cent ?? 0)

const teamFactuurStaat = (f: TeamFactuurRow) => f.status === 'paid' && !f.reversed_at && !(f.teruggeboekt_cent ?? 0)
const teamFactuurTelt = (f: TeamFactuurRow) => teamFactuurStaat(f) && !(f.terugbetaald_cent ?? 0)

const teamMaandCent = (seats: number, cyclus: Cyclus) => (berekenTeamPrijsPerMaand(seats, cyclus) ?? 0) * 100

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

const teamGestopt = (t: Team, nu: Date) => !!t.stopt_op && t.stopt_op <= nlVandaag(nu)

/** Alleen een team waarvoor echt betaald is (en niet teruggedraaid), telt als abonnement van de manager. */
const betaaldeTeamsVan = (d: Dossier) => d.teams.filter(t => d.facturen.some(f => f.team_id === t.id && teamFactuurStaat(f)))

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

async function klantFeiten(d: Dossier, aangemeldAt: string | null, nu: Date): Promise<KlantFeiten> {
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
    })
  }

  const regulier = d.facturen.filter(f => f.soort === 'regulier' && f.betaald_at)
  const seatsPerTeam = new Map<string, number>()
  for (const f of regulier) {
    const team = d.teams.find(t => t.id === f.team_id)!
    if (teamFactuurStaat(f)) betaalMomenten.push({ at: tijdigMomentTeam(f.created_at, f.betaald_at!), team: true })
    // Akkoord Arno: bij een team telt het aantal gebruikers op het moment van toekennen.
    let seats = seatsPerTeam.get(team.id)
    if (seats === undefined) seatsPerTeam.set(team.id, (seats = await huidigSeats(team.id, team.min_seats ?? TEAM_MIN_GEBRUIKERS)))
    periodes.push({
      plan: 'team', cyclus: f.cyclus, klantType: 'zakelijk', periodeStart: f.periode_start, periodeEinde: f.periode_einde,
      betaaldAt: f.betaald_at!, geldig: teamFactuurTelt(f), maandNettoCent: teamMaandCent(seats, f.cyclus),
    })
  }

  const proefStart = eersteProefStart(d.gebruiker, aangemeldAt)

  return {
    aangemeldAt,
    // De eerste echte proef (die start na de intake), nooit een tweede.
    proefEindeAt: proefStart ? new Date(Date.parse(proefStart) + TRIAL_DAGEN * DAG_MS).toISOString() : null,
    betaalMomenten,
    periodes,
    // Ook eerder met de hand: dan kan er op tijd per bank betaald zijn.
    handmatigBetaald: handmatigOpBetaald(d, nu) || d.ooitMetDeHandBetaald,
    proefMogelijkVerlengd: d.gebruiker.sd_attribution_method === 'link' && betaalMomenten.some(m => m.team),
    bijbetalingLoopt: bijbetalingLoopt(d),
  }
}

/** De tijdvakken waarin de aanbrenger zelf betaalde: eigen abonnementen en betaalde teams. */
function dekkingVan(d: Dossier, nu: Date): Dekking[] {
  const uit: Dekking[] = []
  for (const s of d.subs.filter(s => s.status !== 'pending' && s.status !== 'abandoned')) {
    const start = s.created_at ?? s.periode_start
    if (!start) continue
    const einde = s.status === 'active' ? null
      : s.status === 'refunded' && s.updated_at && (!s.periode_einde || Date.parse(s.updated_at) < Date.parse(s.periode_einde)) ? s.updated_at
        : s.periode_einde ?? s.updated_at ?? start
    uit.push({ start, einde, team: false })
  }
  for (const t of betaaldeTeamsVan(d)) {
    // De vroegste van periodestart en aanmaakdag van de factuur: te laat betalen verschuift het begin niet.
    const starts = d.facturen.filter(f => f.team_id === t.id && teamFactuurStaat(f))
      .flatMap(f => [f.periode_start, f.created_at, f.betaald_at])
      .filter((x): x is string => !!x)
      .sort((a, b) => Date.parse(a) - Date.parse(b))
    if (starts[0]) uit.push({ start: starts[0], einde: teamGestopt(t, nu) ? `${t.stopt_op}T00:00:00.000Z` : null, team: true })
  }
  return uit
}

async function aanbrengerFeiten(d: Dossier, nu: Date): Promise<AanbrengerFeiten> {
  const betaaldeTeams = betaaldeTeamsVan(d)
  const gestopt = (t: Team) => teamGestopt(t, nu)
  const lopendTeam = betaaldeTeams.find(t => !gestopt(t) && !t.geblokkeerd_at)
  const geblokkeerdTeam = betaaldeTeams.find(t => !gestopt(t) && !!t.geblokkeerd_at)
  // Facturatie staat aan en er is nog niets betaald: de eerste factuur komt nog of staat open (ook solo naar Team).
  const heeftOpenFactuur = (t: Team) => d.facturen.some(f => f.team_id === t.id && (f.status === 'open' || f.status === 'overdue'))
  const onbetaald = d.teams.filter(t => !gestopt(t) && !betaaldeTeams.includes(t))
  const teamInAfwachting = !lopendTeam
    && onbetaald.some(t => !t.geblokkeerd_at && (heeftOpenFactuur(t) || (t.min_seats !== null && !!t.volgende_factuurdatum)))
  // Geblokkeerd om een onbetaalde eerste factuur: telt niet als betalend, het tegoed staat wel stil.
  const geblokkeerdOnbetaald = onbetaald.find(t => !!t.geblokkeerd_at && heeftOpenFactuur(t))

  const lopendeSub = d.subs
    .filter(lopend)
    .sort((a, b) => Date.parse(b.periode_einde ?? '0') - Date.parse(a.periode_einde ?? '0'))[0]

  const teamPrijs = async (t: Team) => teamMaandCent(await huidigSeats(t.id, t.min_seats ?? TEAM_MIN_GEBRUIKERS), t.cyclus ?? 'maandelijks')

  // Beëindigde abonnementen en teams, het laatste einde eerst.
  const eindes: { at: string; prijs: () => Promise<number> }[] = []
  for (const s of d.subs.filter(s => (s.status === 'ended' || s.status === 'refunded') && s.periode_einde)) {
    const terug = s.status === 'refunded' && s.updated_at && Date.parse(s.updated_at) < Date.parse(s.periode_einde!)
    eindes.push({ at: terug ? s.updated_at! : s.periode_einde!, prijs: async () => subMaandCent(d, s) })
  }
  for (const t of betaaldeTeams.filter(gestopt)) eindes.push({ at: `${t.stopt_op}T00:00:00.000Z`, prijs: () => teamPrijs(t) })
  const laatste = eindes.sort((a, b) => Date.parse(b.at) - Date.parse(a.at))[0]

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
  const ooit = !!lopendeSub || !!lopendTeam || !!geblokkeerdTeam || !!laatste
  const uiterlijkZonderAbonnement = d.teams.length ? eersteUiterlijk.team : eersteUiterlijk.solo

  return {
    stand: {
      loopt,
      laatsteEindeAt: d.isGewoonTeamlid
        // Bij een teamlid is alleen van belang of er ooit zelf betaald is.
        ? (ooit ? laatste?.at ?? lopendeSub?.periode_einde ?? nu.toISOString() : null)
        : laatste?.at ?? null,
      geblokkeerdSindsAt: !lopendTeam && !lopendeSub ? (geblokkeerdTeam ?? geblokkeerdOnbetaald)?.geblokkeerd_at ?? null : null,
      isGewoonTeamlid: d.isGewoonTeamlid,
      eersteBetalingUiterlijkAt: ooit ? null : uiterlijkZonderAbonnement,
      teamInAfwachting,
      lifetime: !!g.lifetime_sinds,
    },
    historie: {
      dekking: dekkingVan(d, nu), eersteUiterlijk, uiterlijkZonderAbonnement, teamInAfwachting: teamInAfwachting || !!geblokkeerdOnbetaald,
      isGewoonTeamlid: d.isGewoonTeamlid, lifetimeSinds: g.lifetime_sinds ?? null,
    },
    // Bij Lifetime vervalt niets: een BETAALD-vlag hoeft dan niets tegen te houden.
    handmatigBetaald: !g.lifetime_sinds && handmatigOpBetaald(d, nu),
    // Als gewoon teamlid is de stand wel zeker; daarna niet meer te zien wanneer dat was.
    historieOnvolledig: d.ooitMetDeHandBetaald || (!d.isGewoonTeamlid && !!g.ooit_teamlid_at),
    maandNettoCent: maand,
    bijbetalingLoopt: bijbetalingLoopt(d),
  }
}

/**
 * Loopt er bij de klant een terugbetaling die onze database nog niet kent? amountRefunded op de betaling blijft 0 zolang
 * een terugbetaling loopt (gemeten in testmodus, 26-11-2026), de lijst met terugbetalingen toont haar wel. Een
 * toekenning is definitief, dus dit gaat er vlak voor. Een fout bij Mollie wordt doorgegeven: morgen opnieuw.
 */
async function onbekendeTerugbetaling(d: Dossier): Promise<boolean> {
  if (!mollieIngeschakeld()) return false
  const betalingen = [
    ...d.betalingen.filter(eigenBetalingTelt).map(b => ({ id: b.mollie_payment_id, tegoed: b.referral_refund_cent ?? 0 })),
    ...d.facturen.filter(f => teamFactuurTelt(f) && !!f.mollie_payment_id).map(f => ({ id: f.mollie_payment_id!, tegoed: 0 })),
  ]
  for (const b of betalingen) {
    const terug = (await lijstBetalingTerugbetalingen(b.id))
      .filter(r => r.status !== 'failed' && r.status !== 'canceled')
      .reduce((som, r) => som + mollieNaarCenten(r.amount.value), 0)
    if (terug > b.tegoed) return true
  }
  return false
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

  // 2. Per toekenning die nog niet vervallen is: vervalt het? Heeft de aanbrenger nog geen bedrag, dan wordt dat pas
  // bij de eerste verrekening vastgesteld (soort 'vaststelling', nog niet gebouwd).
  for (const t of run.regels.filter(r => r.soort === 'toekenning')) {
    if (bekend.has(`verval:${t.referral_id}`)) continue
    try {
      const eigen = await dossier(t.aanbrenger_user_id)
      const feiten = eigen ? await aanbrengerFeiten(eigen, nu) : null
      if (feiten?.handmatigBetaald) continue
      const aangemeld = referrals.find(r => String(r.id) === t.referral_id)?.created_at
      // Bij een handmatige toekenning telt alleen wat na dat besluit gebeurt: Arno heeft het verleden al beoordeeld.
      const besluitAt = t.reden.startsWith(HANDMATIG) ? t.created_at ?? null : null
      const vanaf = besluitAt && aangemeld && Date.parse(besluitAt) > Date.parse(aangemeld) ? besluitAt : aangemeld
      const basis = {
        referral_id: t.referral_id, aanbrenger_user_id: t.aanbrenger_user_id, klant_user_id: t.klant_user_id,
        klant_maand_netto_cent: t.klant_maand_netto_cent,
      }
      if (feiten) {
        const moment = vervalMoment(feiten.stand)
        const nuVervallen = tegoedStatus(feiten.stand, nu) === 'vervallen'
          && (!besluitAt || (moment !== null && moment > Date.parse(besluitAt)))
        if (!nuVervallen && !(vanaf && vervallenNaAanmelding(feiten.historie, vanaf, nu))) continue
        if (feiten.historieOnvolledig) {
          // Niet zeker: niets laten vervallen, een keer aan Arno melden.
          await voegToe({ ...basis, event_key: `verval-handwerk:${t.referral_id}`, soort: 'handwerk', netto_cent: 0, reden: 'tegoed lijkt te vervallen, maar de aanbrenger stond met de hand op betaald of was teamlid' })
          continue
        }
      }
      const staat = t.netto_cent ?? run.regels.find(r => r.event_key === `vaststelling:${t.referral_id}`)?.netto_cent ?? 0
      await voegToe({
        ...basis, event_key: `verval:${t.referral_id}`, soort: 'verval',
        netto_cent: -staat || 0, reden: eigen ? 'abonnement van de aanbrenger is afgelopen of niet op tijd afgesloten' : 'account van de aanbrenger bestaat niet meer',
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

  const regels = await haalAlleRijen<GrootboekRegel>((van, tot) =>
    billingDb.from('arnobot_referral_grootboek').select('*').eq('meeloop', MEELOOP)
      .order('created_at', { ascending: true }).order('id').range(van, tot))
  const open = regels.find(r => r.event_key === `handwerk:${referralId}`)
  if (!open) return { ok: false, status: 404, fout: 'Deze referral wacht niet op een besluit' }
  if (regels.some(r => r.event_key === `uitkomst:${referralId}`)) return { ok: false, status: 409, fout: 'Over deze referral is al beslist' }

  const regel: GrootboekRegel = {
    event_key: `uitkomst:${referralId}`, meeloop: MEELOOP, soort: invoer.besluit === 'toekennen' ? 'toekenning' : 'afwijzing',
    referral_id: referralId, aanbrenger_user_id: open.aanbrenger_user_id, klant_user_id: open.klant_user_id,
    netto_cent: nettoCent, reden: `${HANDMATIG}${toelichting.slice(0, 300)}`,
    klant_maand_netto_cent: invoer.besluit === 'toekennen' ? nettoCent : null,
  }
  const { error } = await billingDb.from('arnobot_referral_grootboek').insert(regel)
  if (error) {
    if ((error as { code?: string }).code === '23505') return { ok: false, status: 409, fout: 'Over deze referral is al beslist' }
    return { ok: false, status: 500, fout: `Opslaan mislukt: ${error.message}` }
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
    case 'toekenning': return `Zou toekennen aan ${aanbrenger} voor ${klant}: ${bedrag ?? 'bedrag volgt'} (${r.reden})`
    case 'afwijzing': return `Zou niets toekennen aan ${aanbrenger} voor ${klant}: ${r.reden}`
    case 'vaststelling': return `Bedrag zou vaststaan voor ${aanbrenger} (klant ${klant}): ${bedrag}`
    case 'verval': return `Zou vervallen bij ${aanbrenger} (klant ${klant}): ${bedrag} (${r.reden})`
    case 'handwerk': return `Zelf beoordelen: ${aanbrenger}, klant ${klant}: ${r.reden}`
  }
}

export const MIJLPALEN = [50, 100, 250]

export interface Mijlpaal {
  aanbrengerId: string
  aantal: number
}

/** De mijlpalen die een aanbrenger er met deze regels bij heeft gehaald (aantal toekenningen per persoon). */
export function nieuweMijlpalen(regels: GrootboekRegel[], nieuw: GrootboekRegel[]): Mijlpaal[] {
  const tel = (r: GrootboekRegel[], id: string) => r.filter(x => x.soort === 'toekenning' && x.aanbrenger_user_id === id).length
  return [...new Set(nieuw.filter(r => r.soort === 'toekenning').map(r => r.aanbrenger_user_id))].flatMap(aanbrengerId => {
    const na = tel(regels, aanbrengerId)
    const voor = na - tel(nieuw, aanbrengerId)
    return MIJLPALEN.filter(m => voor < m && na >= m).map(aantal => ({ aanbrengerId, aantal }))
  })
}
