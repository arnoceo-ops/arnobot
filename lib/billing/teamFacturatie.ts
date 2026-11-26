import * as Sentry from '@sentry/nextjs'
import { billingDb } from './db'
import { mollieNaarCenten } from './geld'
import { betaaldeBetalingVanLink, lijstBetaalLinkBetalingen, maakBetaalLink, maakKlant, SITE_URL } from './mollie'
import { beeindigGratisVanManager, legBetaalwijzeVast, terugBijMollie, verwerkTeamNaBetaling } from './teamBetalingen'
import {
  btwTariefId,
  omzetGrootboekId,
  maakConceptFactuur,
  moneybirdIngeschakeld,
  registreerBetaling,
  teamFactuurMailTekst,
  teamFactuurVoorwaarden,
  verstuurFactuur,
  zoekOfMaakContact,
} from './moneybird'
import { verstuurTeamMail } from './teamMails'
import { notifyTelegram } from '@/lib/cron-notify'
import { isFakeDemoUser, isInternalTestUser, TEST_TEAM_IDS } from '@/lib/internalTestAccounts'
import { ontblokkeerNaBetaling } from '@/lib/teamOpzegging'
import {
  berekenTeamPrijsPerMaand,
  TEAM_PRIJS_PER_GEBRUIKER_JAARLIJKS,
  type Cyclus,
} from '@/lib/teamPricing'

// Team-betaalprotocol (fase 2b, zie docs/MOLLIE_PLAN.md): periodieke Moneybird-factuur +
// eenmalige Mollie-betaallink per cyclus, plus een eenmalige naar-rato tussenfactuur als een
// jaarlijks team tussentijds seats toevoegt. Team is altijd zakelijk (klant_type), geen
// particuliere variant.

const BTW_PCT = 0.21

/**
 * Zelfde bescherming als lib/billing/facturatie.ts: een Mollie-testsleutel (test_) maakt
 * standaard GEEN Moneybird-factuur, anders belanden nepfacturen in de echte administratie.
 */
function factureringToegestaan(): boolean {
  if (!moneybirdIngeschakeld()) return false
  const testmodus = process.env.MOLLIE_API_KEY?.startsWith('test_')
  return !testmodus || process.env.MONEYBIRD_OOK_IN_TESTMODUS === 'true'
}

export interface TeamRow {
  id: string
  name: string
  manager_id: string
  min_seats: number | null
  cyclus: Cyclus | null
  volgende_factuurdatum: string | null
  geblokkeerd_at: string | null
  /** Einddatum van een opgezegd team (lib/teamOpzegging.ts), leeg als het team niet is opgezegd. */
  stopt_op?: string | null
}

export interface TeamFactuurRow {
  id: string
  team_id: string
  periode_start: string
  periode_einde: string
  cyclus: Cyclus
  soort: 'regulier' | 'tussentijds'
  seats_aantal: number
  bedrag_cent: number
  btw_cent: number
  mollie_payment_link_id: string | null
  mollie_payment_link_url: string | null
  status: 'open' | 'paid' | 'overdue' | 'expired' | 'refunded'
  moneybird_factuur_id: string | null
  betaald_at: string | null
  herinnering_at: string | null
  created_at: string
  /** Vanaf docs/sql/2026-11-25-referral-teambetalingen.sql, zie lib/billing/teamBetalingen.ts. */
  paid_via?: 'mollie' | 'bank' | null
  mollie_payment_id?: string | null
  terugbetaald_cent?: number
  teruggeboekt_cent?: number
  reversed_at?: string | null
  /** Deel van terugbetaald_cent dat referralgeld is (docs/sql/2026-11-26-referral-verrekening.sql). */
  referral_refund_cent?: number
  /** Wanneer de factuur de klant echt heeft bereikt (docs/sql/2026-11-26-team-factuur-bezorgd.sql). Leeg: nooit herinneren of blokkeren. */
  bezorgd_at?: string | null
}

/** Actueel ledenaantal van een team, nooit onder het afgesproken minimum. Nep-/testaccounts tellen nooit mee. */
export async function huidigSeats(teamId: string, minSeats: number): Promise<number> {
  const { data, error } = await billingDb
    .from('arnobot_team_members')
    .select('user_id')
    .eq('team_id', teamId)
    .returns<{ user_id: string }[]>()
  // Stil het minimum teruggeven zou een te lage factuur (en te laag referraltegoed) geven.
  if (error) throw new Error(`teamleden tellen mislukt: ${error.message}`)
  const echt = (data ?? []).filter(m => !isFakeDemoUser(m.user_id) && !isInternalTestUser(m.user_id))
  return Math.max(echt.length, minSeats)
}

function centen(euroBedrag: number): number {
  return Math.round(euroBedrag * 100)
}

/** Reguliere factuur voor een volledige cyclus: platformtarief + seats × prijs/seat, altijd excl. btw (zakelijk). */
export function berekenReguliereBedrag(seats: number, cyclus: Cyclus): { nettoCent: number; btwCent: number; brutoCent: number } {
  const perMaand = berekenTeamPrijsPerMaand(seats, cyclus) ?? 0
  const nettoEuro = cyclus === 'jaarlijks' ? perMaand * 12 : perMaand
  const nettoCent = centen(nettoEuro)
  const btwCent = Math.round(nettoCent * BTW_PCT)
  return { nettoCent, btwCent, brutoCent: nettoCent + btwCent }
}

/**
 * Eenmalige tussenfactuur bij een jaarlijks team dat seats toevoegt: alleen de NIEUWE seats,
 * naar rato over de resterende dagen tot de jaarvernieuwing. Het platformtarief en de al
 * gefactureerde seats worden niet opnieuw aangerekend.
 */
export function berekenTussentijdsBedrag(
  extraSeats: number,
  resterendeDagen: number,
  totaalDagenPeriode: number,
): { nettoCent: number; btwCent: number; brutoCent: number } {
  const volJaarPerSeat = TEAM_PRIJS_PER_GEBRUIKER_JAARLIJKS * 12
  const ratio = totaalDagenPeriode > 0 ? Math.max(0, Math.min(1, resterendeDagen / totaalDagenPeriode)) : 0
  const nettoCent = centen(extraSeats * volJaarPerSeat * ratio)
  const btwCent = Math.round(nettoCent * BTW_PCT)
  return { nettoCent, btwCent, brutoCent: nettoCent + btwCent }
}

const datumNl = (d: Date) => d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Amsterdam' })

/** Moet gelijk zijn aan BETAALTERMIJN_DAGEN in app/api/cron/team-facturatie/route.ts (herinnering en blokkade tellen vanaf de vervaldatum). */
const TEAM_BETAALTERMIJN_DAGEN = 14

async function verkrijgMollieEnMoneybirdKlant(team: TeamRow): Promise<{ mollieKlantId: string; contactId: string; voornaam: string | null }> {
  const { data: klant } = await billingDb
    .from('arnobot_billing_customers')
    .select('mollie_customer_id, bedrijfsnaam, kvk_nummer, btw_nummer, straat, postcode, plaats')
    .eq('user_id', team.manager_id)
    .maybeSingle<{
      mollie_customer_id: string | null
      bedrijfsnaam: string | null
      kvk_nummer: string | null
      btw_nummer: string | null
      straat: string | null
      postcode: string | null
      plaats: string | null
    }>()

  const { data: manager } = await billingDb
    .from('approved_users')
    .select('voornaam, email')
    .eq('user_id', team.manager_id)
    .maybeSingle<{ voornaam: string | null; email: string | null }>()
  if (!manager?.email) throw new Error(`Geen e-mailadres voor teambaas ${team.manager_id}`)
  if (!klant?.bedrijfsnaam) {
    throw new Error(`Bedrijfsgegevens ontbreken voor team "${team.name}". Vul ze in via /bot/admin/teams vóór facturatie.`)
  }

  const mollieKlantId = klant.mollie_customer_id
    ?? (await maakKlant({ naam: klant.bedrijfsnaam, email: manager.email, userId: team.manager_id })).id

  await billingDb.from('arnobot_billing_customers').upsert(
    {
      user_id: team.manager_id,
      mollie_customer_id: mollieKlantId,
      klant_type: 'zakelijk',
      bedrijfsnaam: klant.bedrijfsnaam,
      kvk_nummer: klant.kvk_nummer,
      btw_nummer: klant.btw_nummer,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  )

  const contactId = await zoekOfMaakContact({
    userId: team.manager_id,
    email: manager.email,
    naam: manager.voornaam || manager.email,
    bedrijfsnaam: klant.bedrijfsnaam,
    kvk: klant.kvk_nummer,
    btw: klant.btw_nummer,
    adres: klant.straat && klant.postcode && klant.plaats ? { straat: klant.straat, postcode: klant.postcode, plaats: klant.plaats } : null,
  })

  return { mollieKlantId, contactId, voornaam: manager.voornaam }
}

export type TeamFactuurUitkomst = { ok: true } | { ok: false; reden: 'bestond_al' | 'niet_aangemaakt' | 'niet_afgerond' }

/** Zet de volgende factuurdatum vooruit. Mislukt dat, dan botst de volgende run op de unieke index en herstelt hij het alsnog. */
async function zetVolgendeFactuurdatum(teamId: string, datum: string): Promise<void> {
  const { error } = await billingDb.from('arnobot_teams').update({ volgende_factuurdatum: datum }).eq('id', teamId)
  if (error) Sentry.captureException(new Error(error.message), { tags: { onderdeel: 'team-facturatie-datum' }, extra: { teamId } })
}

/**
 * Er staat al een reguliere factuur voor deze periode (unieke index), bijvoorbeeld na een afgebroken run of een
 * teruggezette factuurdatum. De datum schuift door naar het einde van die factuur, anders komt er nooit meer een volgende.
 */
async function herstelNaBestaandeFactuur(team: TeamRow, periodeStart: string): Promise<boolean> {
  const { data } = await billingDb
    .from('arnobot_team_facturen')
    .select('*')
    .eq('team_id', team.id)
    .eq('periode_start', periodeStart)
    .eq('soort', 'regulier')
    .in('status', ['open', 'paid', 'overdue'])
    .limit(1)
    .returns<TeamFactuurRow[]>()
  const bestaand = data?.[0]
  if (!bestaand) return false
  await zetVolgendeFactuurdatum(team.id, bestaand.periode_einde)
  await notifyTelegram(`Teamfactuur bestond al op arno.bot\n\nTeam: ${team.name}\nPeriode vanaf ${periodeStart} had al factuur ${bestaand.id}. Er is geen nieuwe gemaakt en de volgende factuurdatum staat nu op ${bestaand.periode_einde}.${!bestaand.mollie_payment_link_url ? '\nLET OP: die factuur heeft geen betaallink. Rond hem met de hand af.' : bestaand.status === 'open' && !bestaand.bezorgd_at ? '\nLET OP: die factuur staat niet als bezorgd. Controleer of de klant hem heeft en rond hem met de hand af.' : ''}`)
  return true
}

/** Legt vast dat de klant de factuur heeft. Zonder dit vinkje volgen nooit een herinnering of blokkade. */
async function markeerBezorgd(factuurId: string): Promise<void> {
  const { error } = await billingDb.from('arnobot_team_facturen').update({ bezorgd_at: new Date().toISOString() }).eq('id', factuurId)
  if (!error) return
  Sentry.captureException(new Error(error.message), { tags: { onderdeel: 'team-facturatie-bezorgd' }, extra: { factuurId } })
  await notifyTelegram(`Teamfactuur verstuurd, maar niet als bezorgd vastgelegd op arno.bot\n\nFactuur: ${factuurId}\nEr volgt geen automatische herinnering of blokkade. Houd de betaling zelf in de gaten.`)
}

/** Maakt de factuurregel (arnobot_team_facturen), de Moneybird-factuur en de Mollie-betaallink. */
export async function maakTeamFactuur(team: TeamRow, input: {
  soort: 'regulier' | 'tussentijds'
  periodeStart: Date
  periodeEinde: Date
  seats: number
  nettoCent: number
  btwCent: number
  /** Testteam: wel de Mollie-betaallink, geen Moneybird-factuur (geen nepfactuur in de echte administratie). */
  zonderBoekhouding?: boolean
}): Promise<TeamFactuurUitkomst> {
  const brutoCent = input.nettoCent + input.btwCent
  const cyclus = team.cyclus ?? 'maandelijks'

  const { data: rij, error } = await billingDb
    .from('arnobot_team_facturen')
    .insert({
      team_id: team.id,
      periode_start: input.periodeStart.toISOString().slice(0, 10),
      periode_einde: input.periodeEinde.toISOString().slice(0, 10),
      cyclus,
      soort: input.soort,
      seats_aantal: input.seats,
      bedrag_cent: brutoCent,
      btw_cent: input.btwCent,
      status: 'open',
    })
    .select('id')
    .single<{ id: string }>()
  if (error || !rij) {
    const dubbel = (error as { code?: string } | null)?.code === '23505' && input.soort === 'regulier'
    if (dubbel && (await herstelNaBestaandeFactuur(team, input.periodeStart.toISOString().slice(0, 10)))) return { ok: false, reden: 'bestond_al' }
    Sentry.captureException(error ?? new Error('insert arnobot_team_facturen mislukt'), { tags: { onderdeel: 'team-facturatie' } })
    await notifyTelegram(`Team-factuur aanmaken mislukt op arno.bot\n\nTeam: ${team.name}\nFout: ${error?.message}`)
    return { ok: false, reden: 'niet_aangemaakt' }
  }

  // Volgende cyclusdatum meteen vooruitzetten, vóór Mollie, Moneybird en de mail: breekt de functie daar af, dan mag de
  // cron morgen niet opnieuw dezelfde periode factureren.
  if (input.soort === 'regulier') await zetVolgendeFactuurdatum(team.id, input.periodeEinde.toISOString().slice(0, 10))

  try {
    const omschrijving = `ArnoBot Team${input.soort === 'tussentijds' ? ' (tussentijdse uitbreiding)' : ''} ${cyclus}`

    // Eerst de betaallink: die staat in de mail van Moneybird die de factuur bij de klant bezorgt.
    const link = await maakBetaalLink({
      brutoCent,
      omschrijving,
      redirectUrl: `${SITE_URL}/bot/team?betaling=terug`,
      webhookUrl: `${SITE_URL}/api/webhooks/mollie-team?r=${rij.id}`,
      idempotencyKey: `teamfactuur-${rij.id}`,
    })
    const { error: linkFout } = await billingDb
      .from('arnobot_team_facturen')
      .update({ mollie_payment_link_id: link.id, mollie_payment_link_url: link.url })
      .eq('id', rij.id)
    // Zonder opgeslagen link kan een betaling nooit aan deze factuur worden gekoppeld.
    if (linkFout) throw new Error(`betaallink niet opgeslagen: ${linkFout.message}`)

    let bezorgdViaMoneybird = false
    if (factureringToegestaan() && !input.zonderBoekhouding) {
      const { contactId, voornaam } = await verkrijgMollieEnMoneybirdKlant(team)
      const factuur = await maakConceptFactuur({
        contactId,
        // Het Kenmerk staat op de factuur en in de mail: leesbaar voor de klant, geen interne id.
        referentie: `${team.name}, ${input.soort === 'tussentijds' ? 'tussentijdse uitbreiding, ' : ''}periode ${datumNl(input.periodeStart)} tot ${datumNl(input.periodeEinde)}`,
        omschrijving,
        periodeStart: input.periodeStart,
        periodeEinde: input.periodeEinde,
        factuurDatum: new Date(),
        brutoCent,
        nettoCent: input.nettoCent,
        inclusiefBtw: false,
        taxRateId: await btwTariefId(),
        ledgerAccountId: await omzetGrootboekId(),
        workflowId: process.env.MONEYBIRD_WORKFLOW_ID,
        // Nog niet betaald: een betaaltermijn en eigen voorwaarden, niet de workflow-tekst "al betaald".
        betaaltermijnDagen: TEAM_BETAALTERMIJN_DAGEN,
        betaalvoorwaarden: teamFactuurVoorwaarden(TEAM_BETAALTERMIJN_DAGEN),
      })
      await billingDb.from('arnobot_team_facturen').update({ moneybird_factuur_id: factuur.id }).eq('id', rij.id)
      // De factuur gaat als bijlage per mail naar de teambaas (zakelijk, voorwaarden artikel 4), met de
      // betaallink erin. De factuur blijft "open" in Moneybird tot de betaling binnen is.
      await verstuurFactuur(factuur.id, 'Email', teamFactuurMailTekst(voornaam, link.url, TEAM_BETAALTERMIJN_DAGEN))
      bezorgdViaMoneybird = true
      // Meteen vastleggen: breekt er hierna iets af, dan heeft de klant de factuur wel.
      await markeerBezorgd(rij.id)
    }

    const eigenMail = await verstuurTeamMail(team.manager_id, 'team_factuur', {
      teamNaam: team.name,
      bedragCent: brutoCent,
      seats: input.seats,
      betaalLink: link.url,
      tussentijds: input.soort === 'tussentijds',
    })
    // Zonder Moneybird (testsleutel, testteam) is onze eigen mail de enige bezorging.
    if (!bezorgdViaMoneybird) {
      if (!eigenMail) throw new Error('de mail met de betaallink is niet verstuurd')
      await markeerBezorgd(rij.id)
    }
    await notifyTelegram(
      `Team-factuur aangemaakt op arno.bot\n\nTeam: ${team.name}\nSoort: ${input.soort}\nSeats: ${input.seats}\nBedrag: €${(brutoCent / 100).toFixed(2)}\nLink: ${link.url}${eigenMail ? '' : '\nLET OP: onze eigen mail is niet verstuurd, de factuur uit Moneybird wel.'}`,
    )
  } catch (e) {
    Sentry.captureException(e, { tags: { onderdeel: 'team-facturatie' } })
    await notifyTelegram(`Team-factuur afronden mislukt op arno.bot\n\nTeam: ${team.name}\nFactuur-rij: ${rij.id}\nFout: ${e instanceof Error ? e.message : e}\nRond handmatig af. Is de factuur niet bezorgd, dan volgt er ook later geen automatische herinnering of blokkade, ook niet als je hem zelf nog stuurt.`)
    return { ok: false, reden: 'niet_afgerond' }
  }
  return { ok: true }
}

/**
 * Verwerkt een Mollie-melding over een Team-betaallink. `webhookId` is het betaling- (tr_) of
 * betaallink-id (pl_) uit de webhook, `hintRijId` het `?r=` uit onze eigen webhook-URL. Beide
 * worden alleen gebruikt om de factuur te vinden: de betaling zelf wordt altijd bij Mollie
 * bevestigd als betaald en als horend bij de betaallink van déze factuur.
 * 'betaald': deze aanroep zette een open factuur op betaald. 'terugbetaald': er was betaald, maar het geld is al terug.
 * 'afwijkend': het bedrag klopt niet, er is niets verwerkt.
 */
export type TeamBetalingUitkomst = 'betaald' | 'terugbetaald' | 'afwijkend' | 'niets'

export async function verwerkTeamBetaling(webhookId: string, hintRijId: string | null): Promise<TeamBetalingUitkomst> {
  let rij: TeamFactuurRow | null = null
  // Elke databasefout gooit: de webhook geeft dan een 500 (Mollie probeert het opnieuw) en de cron slaat herinnering en
  // blokkade voor deze factuur over. Stil 'niets' zou een betaalde klant laten blokkeren.
  if (webhookId.startsWith('pl_')) {
    const { data, error } = await billingDb
      .from('arnobot_team_facturen')
      .select('*')
      .eq('mollie_payment_link_id', webhookId)
      .maybeSingle<TeamFactuurRow>()
    if (error) throw new Error(`teamfactuur opzoeken mislukt: ${error.message}`)
    rij = data
  } else if (hintRijId) {
    const { data, error } = await billingDb
      .from('arnobot_team_facturen')
      .select('*')
      .eq('id', hintRijId)
      .maybeSingle<TeamFactuurRow>()
    if (error) throw new Error(`teamfactuur opzoeken mislukt: ${error.message}`)
    rij = data
  }
  if (!rij || !rij.mollie_payment_link_id) return 'niets'
  // Al betaald of teruggedraaid: Mollie meldt zich dan voor een terugbetaling, terugboeking of tweede betaling.
  if (rij.status === 'paid' || rij.status === 'refunded') {
    // Zonder de migratie bestaan de kolommen nog niet en valt er niets vast te leggen.
    if (rij.terugbetaald_cent === undefined) return 'niets'
    await verwerkTeamNaBetaling(rij, await lijstBetaalLinkBetalingen(rij.mollie_payment_link_id))
    return 'niets'
  }

  const mp = await betaaldeBetalingVanLink(rij.mollie_payment_link_id, webhookId)
  if (!mp) return 'niets'
  if (mollieNaarCenten(mp.amount.value) !== rij.bedrag_cent) {
    Sentry.captureMessage('Team-betaling met afwijkend bedrag genegeerd', { level: 'error', tags: { onderdeel: 'team-facturatie' }, extra: { factuurId: rij.id, betaling: mp.id } })
    return 'afwijkend'
  }

  const betaaldOp = mp.paidAt ? new Date(mp.paidAt) : new Date()
  // Al volledig terugbetaald of teruggeboekt voordat wij de betaling zagen: dat is geen betaalde factuur en heft niets op.
  const terug = terugBijMollie(mp)
  if (terug.terugbetaald >= rij.bedrag_cent || terug.teruggeboekt > 0) {
    const nu = new Date().toISOString()
    const { data: gedraaid, error: draaiFout } = await billingDb
      .from('arnobot_team_facturen')
      .update({ status: 'refunded', betaald_at: betaaldOp.toISOString(), reversed_at: nu, terugbetaald_cent: terug.terugbetaald, teruggeboekt_cent: terug.teruggeboekt, updated_at: nu })
      .eq('id', rij.id)
      .eq('status', 'open')
      .select('id')
    if (draaiFout) throw new Error(`teruggedraaide teambetaling niet vastgelegd: ${draaiFout.message}`)
    if ((gedraaid?.length ?? 0) !== 1) return 'niets'
    await legBetaalwijzeVast(rij.id, mp.id)
    await notifyTelegram(`Teamfactuur betaald en meteen weer teruggedraaid (arno.bot)\n\nFactuur: ${rij.id}\nBetaling: ${mp.id}\nDe factuur staat op teruggedraaid. De toegang van het team is niet veranderd. Regel de creditnota en beslis zelf over blokkeren.`)
    return 'terugbetaald'
  }

  const { data: geclaimd, error: claimFout } = await billingDb
    .from('arnobot_team_facturen')
    .update({ status: 'paid', betaald_at: betaaldOp.toISOString(), updated_at: new Date().toISOString() })
    .eq('id', rij.id)
    .eq('status', 'open')
    .select('id')
  if (claimFout) throw new Error(`betaalde teamfactuur niet vastgelegd: ${claimFout.message}`)
  if ((geclaimd?.length ?? 0) !== 1) return 'niets' // al verwerkt door een parallelle aanroep
  await legBetaalwijzeVast(rij.id, mp.id)

  if (rij.moneybird_factuur_id && moneybirdIngeschakeld() && process.env.MONEYBIRD_BETALING_REGISTREREN === 'true') {
    try {
      await registreerBetaling({ factuurId: rij.moneybird_factuur_id, betaaldOp, brutoCent: rij.bedrag_cent, mollieId: mp.id })
    } catch (e) {
      Sentry.captureException(e, { tags: { onderdeel: 'team-facturatie-afletteren' } })
    }
  }

  // Betaling ontvangen: een eventuele blokkade van dit team meteen opheffen, behalve bij een team dat is gestopt na opzegging
  // (een late betaling van een oude factuur zet het niet weer open).
  await ontblokkeerNaBetaling(rij.team_id, new Date().toISOString().slice(0, 10))
  await beeindigGratisVanManager(rij.team_id)

  await notifyTelegram(`Team-factuur betaald op arno.bot\n\nFactuur: ${rij.id}\nBedrag: €${(rij.bedrag_cent / 100).toFixed(2)}`)
  return 'betaald'
}

/**
 * Vangnet voor een gemiste webhook: vraagt voor elke open factuur bij Mollie of er al betaald is. Draait in de cron
 * vóór de herinnering en de blokkade, zodat een betaalde klant die nooit krijgt.
 */
export async function haalGemisteTeamBetalingenIn(): Promise<{ ingehaald: number; fouten: number; nietGecontroleerd: string[]; afwijkend: string[] }> {
  // Voor een factuur in nietGecontroleerd of afwijkend weten we niet of er betaald is: daar volgt geen herinnering of blokkade.
  const uit = { ingehaald: 0, fouten: 0, nietGecontroleerd: [] as string[], afwijkend: [] as string[] }
  const { data, error } = await billingDb
    .from('arnobot_team_facturen')
    .select('id, team_id, mollie_payment_link_id')
    .eq('status', 'open')
    .not('mollie_payment_link_id', 'is', null)
    .returns<Pick<TeamFactuurRow, 'id' | 'team_id' | 'mollie_payment_link_id'>[]>()
  if (error) throw new Error(`Open teamfacturen ophalen mislukt: ${error.message}`)

  for (const rij of (data ?? []).filter(r => !(TEST_TEAM_IDS as readonly string[]).includes(r.team_id))) {
    try {
      const uitkomst = await verwerkTeamBetaling(rij.mollie_payment_link_id!, null)
      if (uitkomst === 'betaald') uit.ingehaald++
      if (uitkomst === 'afwijkend') uit.afwijkend.push(rij.id)
    } catch (e) {
      uit.fouten++
      uit.nietGecontroleerd.push(rij.id)
      Sentry.captureException(e, { tags: { onderdeel: 'team-facturatie-inhalen' }, extra: { factuurId: rij.id } })
    }
  }
  return uit
}
