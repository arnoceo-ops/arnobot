import * as Sentry from '@sentry/nextjs'
import { billingDb } from './db'
import { haalBetaling, maakBetaalLink, maakKlant, SITE_URL } from './mollie'
import {
  btwTariefId,
  maakConceptFactuur,
  moneybirdIngeschakeld,
  registreerBetaling,
  verstuurFactuur,
  zoekOfMaakContact,
} from './moneybird'
import { verstuurTeamMail } from './teamMails'
import { notifyTelegram } from '@/lib/cron-notify'
import { isFakeDemoUser, isInternalTestUser } from '@/lib/internalTestAccounts'
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
}

/** Actueel ledenaantal van een team, nooit onder het afgesproken minimum. Nep-/testaccounts tellen nooit mee. */
export async function huidigSeats(teamId: string, minSeats: number): Promise<number> {
  const { data } = await billingDb
    .from('arnobot_team_members')
    .select('user_id')
    .eq('team_id', teamId)
    .returns<{ user_id: string }[]>()
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

async function verkrijgMollieEnMoneybirdKlant(team: TeamRow): Promise<{ mollieKlantId: string; contactId: string }> {
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

  return { mollieKlantId, contactId }
}

/** Maakt de factuurregel (arnobot_team_facturen), de Moneybird-factuur en de Mollie-betaallink. */
export async function maakTeamFactuur(team: TeamRow, input: {
  soort: 'regulier' | 'tussentijds'
  periodeStart: Date
  periodeEinde: Date
  seats: number
  nettoCent: number
  btwCent: number
}): Promise<void> {
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
    Sentry.captureException(error ?? new Error('insert arnobot_team_facturen mislukt'), { tags: { onderdeel: 'team-facturatie' } })
    await notifyTelegram(`Team-factuur aanmaken mislukt op arno.bot\n\nTeam: ${team.name}\nFout: ${error?.message}`)
    return
  }

  try {
    const omschrijving = `ArnoBot Team${input.soort === 'tussentijds' ? ' (tussentijdse uitbreiding)' : ''} ${cyclus}`

    if (factureringToegestaan()) {
      const { contactId } = await verkrijgMollieEnMoneybirdKlant(team)
      const factuur = await maakConceptFactuur({
        contactId,
        referentie: `team-${rij.id}`,
        omschrijving,
        periodeStart: input.periodeStart,
        periodeEinde: input.periodeEinde,
        factuurDatum: new Date(),
        brutoCent,
        nettoCent: input.nettoCent,
        inclusiefBtw: false,
        taxRateId: await btwTariefId(),
        ledgerAccountId: process.env.MONEYBIRD_LEDGER_ACCOUNT_ID,
        workflowId: process.env.MONEYBIRD_WORKFLOW_ID,
      })
      await billingDb.from('arnobot_team_facturen').update({ moneybird_factuur_id: factuur.id }).eq('id', rij.id)
      // Niet via Moneybirds eigen mail: die tekst gaat uit van een al-betaalde factuur. ArnoBot
      // mailt zelf met de betaallink (hieronder), de factuur blijft "open" in Moneybird tot betaling.
      await verstuurFactuur(factuur.id, 'Manual')
    }

    const link = await maakBetaalLink({
      brutoCent,
      omschrijving,
      redirectUrl: `${SITE_URL}/bot/team?betaling=terug`,
      metadata: { teamFactuurId: rij.id, teamId: team.id },
      idempotencyKey: `teamfactuur-${rij.id}`,
    })
    await billingDb
      .from('arnobot_team_facturen')
      .update({ mollie_payment_link_id: link.id, mollie_payment_link_url: link.url })
      .eq('id', rij.id)

    await verstuurTeamMail(team.manager_id, 'team_factuur', {
      teamNaam: team.name,
      bedragCent: brutoCent,
      seats: input.seats,
      betaalLink: link.url,
      tussentijds: input.soort === 'tussentijds',
    })
    await notifyTelegram(
      `Team-factuur aangemaakt op arno.bot\n\nTeam: ${team.name}\nSoort: ${input.soort}\nSeats: ${input.seats}\nBedrag: €${(brutoCent / 100).toFixed(2)}\nLink: ${link.url}`,
    )
  } catch (e) {
    Sentry.captureException(e, { tags: { onderdeel: 'team-facturatie' } })
    await notifyTelegram(`Team-factuur afronden mislukt op arno.bot\n\nTeam: ${team.name}\nFactuur-rij: ${rij.id}\nFout: ${e instanceof Error ? e.message : e}\nRond handmatig af.`)
  }

  // Volgende cyclusdatum altijd meteen vooruitzetten bij een reguliere factuur, ongeacht of al
  // betaald is: anders maakt de cron morgen een tweede factuur voor dezelfde periode.
  if (input.soort === 'regulier') {
    await billingDb
      .from('arnobot_teams')
      .update({ volgende_factuurdatum: input.periodeEinde.toISOString().slice(0, 10) })
      .eq('id', team.id)
  }
}

/** Verwerkt een betaalde/mislukte Mollie-betaling die via een Team-betaallink binnenkomt. */
export async function verwerkTeamBetaling(mollieId: string): Promise<void> {
  const mp = await haalBetaling(mollieId)
  const teamFactuurId = typeof mp.metadata?.teamFactuurId === 'string' ? mp.metadata.teamFactuurId : null
  if (!teamFactuurId) return

  const { data: rij } = await billingDb
    .from('arnobot_team_facturen')
    .select('*')
    .eq('id', teamFactuurId)
    .maybeSingle<TeamFactuurRow>()
  if (!rij || rij.status === 'paid') return

  if (mp.status !== 'paid') return

  const betaaldOp = mp.paidAt ? new Date(mp.paidAt) : new Date()
  const { data: geclaimd } = await billingDb
    .from('arnobot_team_facturen')
    .update({ status: 'paid', betaald_at: betaaldOp.toISOString(), updated_at: new Date().toISOString() })
    .eq('id', rij.id)
    .eq('status', 'open')
    .select('id')
  if ((geclaimd?.length ?? 0) !== 1) return // al verwerkt door een parallelle aanroep

  if (rij.moneybird_factuur_id && moneybirdIngeschakeld() && process.env.MONEYBIRD_BETALING_REGISTREREN === 'true') {
    try {
      await registreerBetaling({ factuurId: rij.moneybird_factuur_id, betaaldOp, brutoCent: rij.bedrag_cent, mollieId: mp.id })
    } catch (e) {
      Sentry.captureException(e, { tags: { onderdeel: 'team-facturatie-afletteren' } })
    }
  }

  // Betaling ontvangen: een eventuele blokkade van dit team meteen opheffen.
  await billingDb.from('arnobot_teams').update({ geblokkeerd_at: null }).eq('id', rij.team_id)

  await notifyTelegram(`Team-factuur betaald op arno.bot\n\nFactuur: ${rij.id}\nBedrag: €${(rij.bedrag_cent / 100).toFixed(2)}`)
}
