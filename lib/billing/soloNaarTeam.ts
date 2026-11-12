import * as Sentry from '@sentry/nextjs'
import { billingDb, type SubRow } from './db'
import { haalAbonnement } from './mollie'
import { heeftOpenstaandeBetaling } from './openstaandeBetaling'
import { berekenBedrag, planNaam } from './prijzen'
import { berekenReguliereBedrag, huidigSeats } from './teamFacturatie'
import { verstuurBillingMail } from './mails'
import { stopEnBevestig } from './verwerking'
import { notifyTelegram } from '@/lib/cron-notify'

// Een zakelijke solo-klant met een lopend maandabonnement wordt Team (docs/OVERSTAP_PLAN.md, "Solo-maand naar
// Team"). Besluit Arno (2026-11-12): het solo-abonnement loopt uit tot het einde van de betaalde maand, de
// Mollie-incasso stopt direct en het Team start op die datum met een Moneybird-factuur. Team wordt per periode
// gefactureerd (geen incasso), dus zonder deze stap zou de solo-incasso naast de Team-factuur doorlopen.
//
// Bewust NIET meldOpzegging (opzeggen.ts): voor zakelijk maandelijks laat opzeggingIngaat het abonnement nog een
// periode doorlopen en stopt het Mollie-abonnement dan niet direct.

/** Minimaal aantal dagen tot de volgende incasso (zelfde grens als de overstap). */
export const MIN_DAGEN_VOORAF = 4
/** Hoeveel dagen Mollies volgende incassodatum mag afwijken van onze `periode_einde`. */
export const MAX_AFWIJKING_DAGEN = 3

const DAG_MS = 24 * 60 * 60 * 1000
const dag = (d: Date) => d.toISOString().slice(0, 10)
/** Liggen twee datums (YYYY-MM-DD) binnen de toegestane marge van elkaar? */
const binnenMarge = (a: string, b: string) =>
  Math.abs(new Date(`${a}T00:00:00.000Z`).getTime() - new Date(`${b}T00:00:00.000Z`).getTime()) / DAG_MS <= MAX_AFWIJKING_DAGEN

interface TeamRij {
  id: string
  name: string
  manager_id: string
  min_seats: number | null
  cyclus: 'maandelijks' | 'jaarlijks' | null
  volgende_factuurdatum: string | null
}

export interface SoloNaarTeamInvoer {
  minSeats: number
  cyclus: 'maandelijks' | 'jaarlijks'
}

export interface SoloNaarTeamVoorbeeld {
  ok: true
  teamNaam: string
  managerId: string
  soloOmschrijving: string
  soloNettoCent: number
  /** Datum (YYYY-MM-DD) waarop het solo-abonnement eindigt en de eerste Team-factuur wordt aangemaakt. */
  ingaatOp: string
  seats: number
  cyclus: 'maandelijks' | 'jaarlijks'
  teamNettoCent: number
  /** Het solo-abonnement is hier al voor gestopt en het Team staat klaar: uitvoeren verandert niets meer. */
  alGeregeld: boolean
  /** Mollie is al gestopt maar de rij nog niet bijgewerkt (eerdere poging liep halverwege vast): hervatten. */
  hervat: boolean
}

export type SoloNaarTeamUitkomst = SoloNaarTeamVoorbeeld | { ok: false; status: number; fout: string }

const weiger = (status: number, fout: string): { ok: false; status: number; fout: string } => ({ ok: false, status, fout })

/**
 * Loopt er een solo-abonnement dat is gestopt omdat de klant Team wordt, en is dat Team al geactiveerd voor
 * facturatie? Dan mag de klant het niet opzeggen of intrekken: opzeggen zet `cancelled_at` op het hele account
 * (dat zou de toegang via het Team na de einddatum afsluiten) en intrekken zou een nieuw solo-abonnement
 * naast het Team maken. Geeft de einddatum, of null.
 */
export async function soloStoptVoorTeam(userId: string, nu: Date = new Date()): Promise<string | null> {
  const { data: sub } = await billingDb
    .from('arnobot_subscriptions')
    .select('status, opzegging_ingaat_at')
    .eq('user_id', userId)
    .eq('status', 'cancelled')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<Pick<SubRow, 'status' | 'opzegging_ingaat_at'>>()
  if (!sub?.opzegging_ingaat_at || new Date(sub.opzegging_ingaat_at).getTime() <= nu.getTime()) return null

  const { data: team } = await billingDb
    .from('arnobot_teams')
    .select('id')
    .eq('manager_id', userId)
    .not('min_seats', 'is', null)
    .not('cyclus', 'is', null)
    .not('volgende_factuurdatum', 'is', null)
    .limit(1)
    .maybeSingle<{ id: string }>()
  return team ? sub.opzegging_ingaat_at : null
}

/**
 * Wat zou er gebeuren? Controleert alles opnieuw tegen de bron (nooit op basis van een eerder voorbeeldscherm) en
 * wijzigt niets. Wordt ook door `voerSoloNaarTeamUit` gebruikt, zodat voorbeeld en uitvoering niet kunnen afwijken.
 */
export async function bekijkSoloNaarTeam(teamId: string, invoer: SoloNaarTeamInvoer, nu: Date = new Date()): Promise<SoloNaarTeamUitkomst> {
  if (!Number.isInteger(invoer.minSeats) || invoer.minSeats < 1) return weiger(400, 'Ongeldig aantal seats')
  if (invoer.cyclus !== 'maandelijks' && invoer.cyclus !== 'jaarlijks') return weiger(400, 'Ongeldige cyclus')

  const { data: team } = await billingDb
    .from('arnobot_teams')
    .select('id, name, manager_id, min_seats, cyclus, volgende_factuurdatum')
    .eq('id', teamId)
    .maybeSingle<TeamRij>()
  if (!team) return weiger(404, 'Team niet gevonden')

  // De teambaas moet echt manager van dit team zijn en command_manager hebben: anders loopt de toegang niet via het team.
  const { data: lid } = await billingDb
    .from('arnobot_team_members')
    .select('role')
    .eq('team_id', team.id)
    .eq('user_id', team.manager_id)
    .maybeSingle<{ role: string }>()
  const { data: gebruiker } = await billingDb
    .from('approved_users')
    .select('command_manager')
    .eq('user_id', team.manager_id)
    .maybeSingle<{ command_manager: boolean | null }>()
  if (lid?.role !== 'manager' || gebruiker?.command_manager !== true) {
    return weiger(409, 'De teambaas is nog geen manager van dit team met command_manager. Regel dat eerst (TEAM_ONBOARDING.md, stap 4 en 5).')
  }

  const { data: sub } = await billingDb
    .from('arnobot_subscriptions')
    .select('*')
    .eq('user_id', team.manager_id)
    .in('status', ['active', 'cancelled'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<SubRow>()
  if (!sub || !sub.periode_einde) return weiger(404, 'Deze teambaas heeft geen online solo-abonnement. Er is niets over te nemen: stel het Team gewoon in zoals gewoonlijk.')
  if (sub.klant_type !== 'zakelijk' || sub.cyclus !== 'maandelijks') {
    return weiger(409, 'Alleen een zakelijk maandabonnement kan automatisch naar Team. Voor een jaarabonnement of particulier geldt de handmatige checklist (SOLO_JAAR_NAAR_TEAM.md).')
  }

  const periodeEinde = new Date(sub.periode_einde)
  const bedrag = berekenBedrag(sub.plan, 'maandelijks', 'zakelijk')
  const seats = await huidigSeats(team.id, invoer.minSeats)
  const teamNettoCent = berekenReguliereBedrag(seats, invoer.cyclus).nettoCent
  const basis = {
    ok: true as const,
    teamNaam: team.name,
    managerId: team.manager_id,
    soloOmschrijving: `${planNaam(sub.plan)} maandelijks`,
    soloNettoCent: bedrag.nettoCent,
    seats,
    cyclus: invoer.cyclus,
    teamNettoCent,
  }

  // Al geregeld door een eerdere uitvoering: rij gestopt voor Team, Team staat klaar op de einddatum.
  const einddag = dag(periodeEinde)
  if (
    sub.status === 'cancelled' && sub.mollie_sub_geannuleerd_at &&
    sub.opzegging_ingaat_at && dag(new Date(sub.opzegging_ingaat_at)) === einddag &&
    team.min_seats === invoer.minSeats && team.cyclus === invoer.cyclus &&
    team.volgende_factuurdatum && binnenMarge(team.volgende_factuurdatum, einddag)
  ) {
    return { ...basis, ingaatOp: team.volgende_factuurdatum, alGeregeld: true, hervat: false }
  }
  if (sub.status !== 'active') {
    return weiger(409, 'Het solo-abonnement is al opgezegd door de klant of eerder gestopt. Zet de teamdatum zo nodig met de hand in het formulier.')
  }
  if (sub.gepland_at || sub.gepland_mollie_subscription_id) {
    return weiger(409, 'Er staat een overstap of upgrade gepland op dit abonnement. Laat de klant die eerst intrekken of wacht tot hij is ingegaan.')
  }
  if (!sub.mollie_subscription_id) return weiger(409, 'Dit abonnement heeft geen Mollie-abonnement. Regel het met de hand.')
  if (team.volgende_factuurdatum && !binnenMarge(team.volgende_factuurdatum, einddag)) {
    // Het team heeft al een eigen factuurdatum, niet bij het einde van het solo-abonnement: niet stilletjes overschrijven.
    return weiger(409, `Dit team heeft al een volgende factuurdatum (${team.volgende_factuurdatum}). Haal die eerst weg als het Team pas na het solo-abonnement moet starten.`)
  }

  // Mollie is al gestopt maar de rij niet bijgewerkt: hervatten, zonder nogmaals bij Mollie te stoppen.
  if (sub.mollie_sub_geannuleerd_at) {
    return { ...basis, ingaatOp: team.volgende_factuurdatum ?? einddag, alGeregeld: false, hervat: true }
  }

  let ms: Awaited<ReturnType<typeof haalAbonnement>>
  try {
    ms = await haalAbonnement(sub.mollie_customer_id, sub.mollie_subscription_id)
  } catch (e) {
    Sentry.captureException(e, { tags: { onderdeel: 'billing-solo-naar-team' } })
    return weiger(502, 'Mollie is nu niet te bereiken. Probeer het zo opnieuw.')
  }
  if (ms.status !== 'active' || !ms.nextPaymentDate) return weiger(409, 'Het Mollie-abonnement is niet actief of heeft geen volgende incasso. Regel het met de hand.')
  const ingang = new Date(`${ms.nextPaymentDate}T00:00:00.000Z`)
  if (Math.abs(ingang.getTime() - periodeEinde.getTime()) / DAG_MS > MAX_AFWIJKING_DAGEN) {
    return weiger(409, `Mollies volgende incasso (${ms.nextPaymentDate}) wijkt af van het einde van de betaalde periode (${einddag}). Controleer eerst of er een betaling openstaat.`)
  }
  if ((ingang.getTime() - nu.getTime()) / DAG_MS < MIN_DAGEN_VOORAF) {
    return weiger(409, `De volgende incasso is op ${ms.nextPaymentDate}, binnen ${MIN_DAGEN_VOORAF} dagen. Wacht tot die betaling is gedaan: het Team start dan een periode later.`)
  }
  try {
    if (await heeftOpenstaandeBetaling(sub)) return weiger(409, 'Er staat een betaling open of onderweg. Probeer het opnieuw zodra die is afgerond.')
  } catch (e) {
    Sentry.captureException(e, { tags: { onderdeel: 'billing-solo-naar-team' } })
    return weiger(502, 'Kan niet controleren of er een betaling onderweg is. Probeer het zo opnieuw.')
  }
  return { ...basis, ingaatOp: ms.nextPaymentDate, alGeregeld: false, hervat: false }
}

/**
 * Voert de overgang uit. Volgorde: team klaarzetten (doet pas iets op de ingangsdatum), Mollie stoppen en bij
 * Mollie bevestigen, dan de rij op 'cancelled' met einde = periode_einde, zonder `approved_users.cancelled_at`.
 * Herstartbaar: een eerdere poging die halverwege stopte (Mollie gestopt, rij nog actief) wordt hervat.
 */
export async function voerSoloNaarTeamUit(teamId: string, invoer: SoloNaarTeamInvoer, nu: Date = new Date()): Promise<SoloNaarTeamUitkomst> {
  const v = await bekijkSoloNaarTeam(teamId, invoer, nu)
  if (!v.ok || v.alGeregeld) return v

  const { data: team } = await billingDb
    .from('arnobot_teams')
    .select('id, name, manager_id, min_seats, cyclus, volgende_factuurdatum')
    .eq('id', teamId)
    .maybeSingle<TeamRij>()
  const { data: sub } = await billingDb
    .from('arnobot_subscriptions')
    .select('*')
    .eq('user_id', v.managerId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<SubRow>()
  if (!team || !sub || !sub.periode_einde) return weiger(409, 'Er is intussen iets gewijzigd. Bekijk het voorbeeld opnieuw.')

  const vorig = { min_seats: team.min_seats, cyclus: team.cyclus, volgende_factuurdatum: team.volgende_factuurdatum }
  const zetTeam = (waarden: Record<string, unknown>) =>
    billingDb.from('arnobot_teams').update(waarden).eq('id', team.id)
  const herstelTeam = async () => { await zetTeam(vorig) }

  // 1. Team klaarzetten. Ongevaarlijk tot de ingangsdatum (de cron reageert pas dan).
  const { error: teamFout } = await zetTeam({ min_seats: invoer.minSeats, cyclus: invoer.cyclus, volgende_factuurdatum: v.ingaatOp })
  if (teamFout) {
    Sentry.captureException(new Error(teamFout.message), { tags: { onderdeel: 'billing-solo-naar-team' } })
    return weiger(502, 'Het team kon niet worden ingesteld, er is niets gewijzigd. Probeer het zo opnieuw.')
  }

  // 2. Het Mollie-abonnement stoppen en bij Mollie bevestigen (alleen als dat nog niet gebeurd is).
  if (!v.hervat) {
    if (!(await stopEnBevestig(sub, sub.mollie_subscription_id as string, 'huidig'))) {
      await herstelTeam()
      return weiger(502, 'Het solo-abonnement kon niet bij Mollie worden gestopt, er is niets gewijzigd. Probeer het zo opnieuw.')
    }
    // Een betaling die tijdens het stoppen is aangemaakt zou de periode nog een maand opschuiven terwijl het Team al
    // op de oude datum start. Dan het Team weer terugzetten; een nieuwe poging hervat zodra de betaling is afgerond.
    let onderweg = false
    try { onderweg = await heeftOpenstaandeBetaling({ ...sub, mollie_sub_geannuleerd_at: nu.toISOString() }) } catch { onderweg = true }
    if (onderweg) {
      await herstelTeam()
      await notifyTelegram(`SOLO NAAR TEAM: BETALING ONDERWEG NA STOPPEN op arno.bot\n\nTeam: ${team.name}\nUser: ${v.managerId}\nHet Mollie-abonnement is gestopt maar er staat een betaling open of onderweg. Het Team is teruggezet. Probeer de actie opnieuw zodra die betaling is afgerond.`)
      return weiger(409, 'Er kwam een betaling onderweg tijdens het stoppen. Het Team is teruggezet. Probeer het opnieuw zodra die betaling is afgerond.')
    }
  }

  // 3. De rij: gestopt voor Team, einde = het einde van de betaalde periode. Geen cancelled_at op het account.
  const { data: bijgewerkt, error: rijFout } = await billingDb
    .from('arnobot_subscriptions')
    .update({
      status: 'cancelled',
      opzegging_aangevraagd_at: nu.toISOString(),
      opzegging_ingaat_at: sub.periode_einde,
      updated_at: nu.toISOString(),
    })
    .eq('id', sub.id)
    .eq('status', 'active')
    .select('id')
    .returns<{ id: string }[]>()
  if (rijFout || bijgewerkt?.length !== 1) {
    if (rijFout) Sentry.captureException(new Error(rijFout.message), { tags: { onderdeel: 'billing-solo-naar-team' } })
    await notifyTelegram(`SOLO NAAR TEAM HALF AFGEROND op arno.bot\n\nTeam: ${team.name}\nUser: ${v.managerId}\nMollie is gestopt en het Team staat klaar, maar de abonnementsrij (${sub.id}) kon niet op cancelled worden gezet. Voer de actie opnieuw uit: die hervat.`)
    return weiger(502, 'Bijna klaar: het Mollie-abonnement is gestopt en het Team staat klaar, maar de abonnementsrij is niet bijgewerkt. Voer de actie opnieuw uit, die hervat.')
  }

  await verstuurBillingMail(v.managerId, 'solo_naar_team', {
    datum: new Date(sub.periode_einde).toISOString(),
    bedragCent: v.teamNettoCent,
    perPeriode: v.cyclus === 'jaarlijks' ? 'per jaar' : 'per maand',
  })
  await notifyTelegram(`Solo naar Team op arno.bot\n\nTeam: ${team.name}\nUser: ${v.managerId}\nSolo: ${v.soloOmschrijving}, stopt op ${v.ingaatOp}\nTeam: ${v.seats} seats, ${v.cyclus}, eerste factuur op ${v.ingaatOp}, €${(v.teamNettoCent / 100).toFixed(2)} excl. BTW`).catch(() => {})
  return { ...v, hervat: v.hervat }
}
