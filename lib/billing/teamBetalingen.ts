import * as Sentry from '@sentry/nextjs'
import { zetGratisKenmerk } from '@/lib/referralKenmerken'
import { billingDb } from './db'
import { mollieNaarCenten, formatEuro } from './geld'
import { archiveerBetaalLink, lijstBetaalLinkBetalingen, type MolliePayment } from './mollie'
import { notifyTelegram } from '@/lib/cron-notify'
import { ontblokkeerNaBetaling } from '@/lib/teamOpzegging'
import { TEST_TEAM_IDS } from '@/lib/internalTestAccounts'
import type { TeamFactuurRow } from './teamFacturatie'

// Wat er met een teamfactuur gebeurt na (of buiten) de betaling via Mollie: terugbetalingen en terugboekingen
// vastleggen, en de twee handmatige adminacties "betaald per bank" en "teruggedraaid". Niets hier verplaatst geld.
// De kolommen bestaan na docs/sql/2026-11-25-referral-teambetalingen.sql.

const DAG_MS = 24 * 60 * 60 * 1000
/** Zo lang na de betaling vragen we Mollie nog naar terugbetalingen en terugboekingen. */
export const NACONTROLE_DAGEN = 400

const nuIso = () => new Date().toISOString()

/** Legt vast hoe een factuur betaald is. Een fout hier mag de verwerking van de betaling nooit tegenhouden. */
export async function legBetaalwijzeVast(factuurId: string, molliePaymentId: string): Promise<void> {
  const { error } = await billingDb
    .from('arnobot_team_facturen')
    .update({ paid_via: 'mollie', mollie_payment_id: molliePaymentId })
    .eq('id', factuurId)
  if (error) console.error('[billing] betaalwijze teamfactuur niet vastgelegd', factuurId, error.message)
}

/** Wat er volgens Mollie van deze betaling terug is, in centen. */
export function terugBijMollie(p: MolliePayment): { terugbetaald: number; teruggeboekt: number } {
  return {
    terugbetaald: p.amountRefunded ? mollieNaarCenten(p.amountRefunded.value) : 0,
    teruggeboekt: p.amountChargedBack ? mollieNaarCenten(p.amountChargedBack.value) : 0,
  }
}

/** Betaald en niet volledig terug: het geld staat nog bij ons. */
function staatNog(p: MolliePayment): boolean {
  const terug = terugBijMollie(p)
  return p.status === 'paid' && terug.terugbetaald < mollieNaarCenten(p.amount.value) && terug.teruggeboekt === 0
}

/**
 * Verwerkt de actuele stand bij Mollie van een factuur die al betaald of teruggedraaid is. Meldt alleen bij een
 * verandering, dus vaker aanroepen is veilig. Een volledige terugbetaling of elke terugboeking zet de factuur op
 * teruggedraaid. De toegang van het team verandert hier niet: dat beslist Arno.
 */
export async function verwerkTeamNaBetaling(rij: TeamFactuurRow, betalingen: MolliePayment[]): Promise<boolean> {
  const betaald = betalingen.filter(p => p.status === 'paid')

  if (rij.paid_via === 'bank') {
    // Al per bank betaald en daarna toch via de link: dan is er twee keer betaald.
    // Alleen geld dat nog bij ons staat: een teruggestorte of teruggeboekte betaling is niet dubbel betaald.
    const dubbel = betaald.find(staatNog)
    if (!dubbel) return false
    // Het betaal-id vastleggen is de claim: zo komt dit één keer binnen, ook als er via de bank wordt teruggestort.
    const { data: geclaimd, error: claimFout } = await billingDb
      .from('arnobot_team_facturen')
      .update({ mollie_payment_id: dubbel.id, updated_at: nuIso() })
      .eq('id', rij.id)
      .is('mollie_payment_id', null)
      .select('id')
    if (claimFout) throw new Error(`dubbele teambetaling niet vastgelegd: ${claimFout.message}`)
    if ((geclaimd?.length ?? 0) !== 1) return false
    await notifyTelegram(`Teamfactuur dubbel betaald op arno.bot\n\nFactuur: ${rij.id}\nDeze stond al op betaald per bank en is nu ook via Mollie betaald (${dubbel.id}, ${formatEuro(mollieNaarCenten(dubbel.amount.value))}).\nStort een van de twee terug.`)
    return true
  }

  const mp = rij.mollie_payment_id
    ? betaald.find(p => p.id === rij.mollie_payment_id)
    : betaald.find(p => mollieNaarCenten(p.amount.value) === rij.bedrag_cent)
  if (!mp) return false
  if (!rij.mollie_payment_id) await legBetaalwijzeVast(rij.id, mp.id)

  const { terugbetaald, teruggeboekt } = terugBijMollie(mp)
  const oudTerugbetaald = rij.terugbetaald_cent ?? 0
  const oudTeruggeboekt = rij.teruggeboekt_cent ?? 0
  if (terugbetaald === oudTerugbetaald && teruggeboekt === oudTeruggeboekt) return false

  const volledig = terugbetaald >= rij.bedrag_cent || teruggeboekt > 0
  const draaiNuTerug = volledig && !rij.reversed_at
  // Mislukt of geannuleerd na een volledige terugdraaiing door Mollie: het geld is er toch, de factuur is weer betaald.
  // Een met de hand gezette terugdraaiing (bedragen 0) blijft staan.
  const wasVolledig = oudTerugbetaald >= rij.bedrag_cent || oudTeruggeboekt > 0
  const herstel = !volledig && wasVolledig && !!rij.reversed_at
  const gedaald = terugbetaald < oudTerugbetaald || teruggeboekt < oudTeruggeboekt

  const schrijf = (extra: Record<string, unknown>) => billingDb
    .from('arnobot_team_facturen')
    .update({ terugbetaald_cent: terugbetaald, teruggeboekt_cent: teruggeboekt, ...extra, updated_at: nuIso() })
    .eq('id', rij.id)
    // Alleen als niemand ons voor was: zo komt elke verandering één keer binnen.
    .eq('terugbetaald_cent', oudTerugbetaald)
    .eq('teruggeboekt_cent', oudTeruggeboekt)
    .select('id')

  let { data, error } = await schrijf(
    draaiNuTerug ? { status: 'refunded', reversed_at: nuIso() } : herstel ? { status: 'paid', reversed_at: null } : {},
  )
  // 23505: er is intussen een vervangende factuur voor deze periode. Dan alleen de bedragen vastleggen.
  const vervangen = herstel && (error as { code?: string } | null)?.code === '23505'
  if (vervangen) ({ data, error } = await schrijf({}))
  if (error) throw new Error(`Terugbetaling teamfactuur niet vastgelegd: ${error.message}`)
  if ((data?.length ?? 0) !== 1) return false

  let wat: string
  let actie: string
  if (gedaald) {
    wat = 'Terugbetaling of terugboeking op een teamfactuur is niet doorgegaan'
    actie = vervangen
      ? 'Er is al een vervangende factuur voor deze periode, dus deze blijft op teruggedraaid. Controleer of er niet dubbel is gefactureerd.'
      : herstel
        ? 'De factuur staat weer op betaald. Had je al een creditnota gemaakt, draai die dan terug. Een blokkade van het team is niet opgeheven: kijk bij Admin, Teams.'
        : 'Controleer in Mollie wat er nu terug is en of je creditnota nog klopt.'
  } else {
    wat = teruggeboekt > oudTeruggeboekt ? 'CHARGEBACK op een teamfactuur' : volledig ? 'Teamfactuur volledig terugbetaald' : 'Teamfactuur gedeeltelijk terugbetaald'
    actie = volledig
      ? 'De factuur staat op teruggedraaid. De toegang van het team is niet veranderd. Maak de creditnota met de hand in Moneybird en beslis zelf over blokkeren.'
      : 'Maak de creditnota voor dit deel met de hand in Moneybird.'
  }
  await notifyTelegram(`${wat} (arno.bot)\n\nFactuur: ${rij.id}\nBetaling: ${mp.id}\nTerugbetaald: ${formatEuro(terugbetaald)}\nTeruggeboekt: ${formatEuro(teruggeboekt)}\n${actie}`)
  return true
}

/**
 * Dagelijkse nacontrole naast de webhook: vraagt per betaalde teamfactuur de betaling op via de betaallink. Zo komen
 * ook terugbetalingen uit het Mollie-dashboard en gemiste meldingen binnen.
 */
export async function controleerBetaaldeTeamFacturen(nu: Date): Promise<{ gecontroleerd: number; gewijzigd: number; fouten: number }> {
  const uit = { gecontroleerd: 0, gewijzigd: 0, fouten: 0 }
  const { data, error } = await billingDb
    .from('arnobot_team_facturen')
    .select('*')
    .in('status', ['paid', 'refunded'])
    .not('mollie_payment_link_id', 'is', null)
    .gte('betaald_at', new Date(nu.getTime() - NACONTROLE_DAGEN * DAG_MS).toISOString())
    .returns<TeamFactuurRow[]>()
  if (error) throw new Error(`Betaalde teamfacturen ophalen mislukt: ${error.message}`)

  for (const rij of (data ?? []).filter(r => !(TEST_TEAM_IDS as readonly string[]).includes(r.team_id))) {
    // Zonder de migratie is er niets om vast te leggen.
    if (rij.terugbetaald_cent === undefined) break
    try {
      uit.gecontroleerd++
      if (await verwerkTeamNaBetaling(rij, await lijstBetaalLinkBetalingen(rij.mollie_payment_link_id!))) uit.gewijzigd++
    } catch (e) {
      uit.fouten++
      Sentry.captureException(e, { tags: { onderdeel: 'team-facturatie-nacontrole' }, extra: { factuurId: rij.id } })
    }
  }
  return uit
}

export type HandmatigResultaat =
  | { ok: true; teamId: string; bedragCent: number; waarschuwing?: string }
  /** alViaMollie: de betaallink waarop al betaald blijkt te zijn; de aanroeper laat die betaling verwerken. */
  | { ok: false; status: number; fout: string; alViaMollie?: string }

const opslaanFout = (e: { message: string }) => `Opslaan mislukt: ${e.message}`

/** Een manager die voor zijn team betaalt is geen gratis account meer. Gooit nooit: de betaling is al verwerkt. */
export async function beeindigGratisVanManager(teamId: string): Promise<void> {
  try {
    const { data, error } = await billingDb.from('arnobot_teams').select('manager_id').eq('id', teamId).maybeSingle<{ manager_id: string }>()
    if (error) throw new Error(error.message)
    if (data?.manager_id) await zetGratisKenmerk(billingDb, data.manager_id, false)
  } catch (e) {
    Sentry.captureException(e, { level: 'error', tags: { onderdeel: 'team-facturatie-gratis' }, extra: { teamId } })
  }
}

async function leesFactuur(factuurId: string): Promise<TeamFactuurRow | null> {
  const { data } = await billingDb.from('arnobot_team_facturen').select('*').eq('id', factuurId).maybeSingle<TeamFactuurRow>()
  return data
}

/** Een open factuur is per bankoverschrijving betaald. De Mollie-betaallink wordt onbetaalbaar gemaakt. */
export async function zetBetaaldPerBank(factuurId: string, betaaldOp: Date): Promise<HandmatigResultaat> {
  const rij = await leesFactuur(factuurId)
  if (!rij) return { ok: false, status: 404, fout: 'Factuur niet gevonden' }
  if (!['open', 'overdue', 'expired'].includes(rij.status)) return { ok: false, status: 409, fout: 'Deze factuur staat niet open' }
  if (rij.created_at && betaaldOp.toISOString().slice(0, 10) < rij.created_at.slice(0, 10)) {
    return { ok: false, status: 400, fout: 'De betaaldatum ligt vóór de factuurdatum' }
  }

  // Eerst bij Mollie kijken: is er al via de link betaald (gemiste melding), dan is dit geen bankbetaling.
  if (rij.mollie_payment_link_id) {
    let betalingen: MolliePayment[]
    try {
      betalingen = await lijstBetaalLinkBetalingen(rij.mollie_payment_link_id)
    } catch (e) {
      Sentry.captureException(e, { tags: { onderdeel: 'team-facturatie-betaallink' }, extra: { factuurId: rij.id } })
      return { ok: false, status: 502, fout: 'Mollie is nu niet te controleren. Probeer het later opnieuw.' }
    }
    if (betalingen.some(staatNog)) {
      return { ok: false, status: 409, fout: 'Deze factuur is al via de Mollie-betaallink betaald. Die betaling wordt nu verwerkt, ververs de pagina.', alViaMollie: rij.mollie_payment_link_id }
    }
  }

  const { data, error } = await billingDb
    .from('arnobot_team_facturen')
    .update({ status: 'paid', betaald_at: betaaldOp.toISOString(), paid_via: 'bank', updated_at: nuIso() })
    .eq('id', rij.id)
    .eq('status', rij.status)
    .select('id')
  if (error) return { ok: false, status: 500, fout: opslaanFout(error) }
  if ((data?.length ?? 0) !== 1) return { ok: false, status: 409, fout: 'De factuur is net gewijzigd. Ververs de pagina.' }

  await ontblokkeerNaBetaling(rij.team_id, nuIso().slice(0, 10))
  await beeindigGratisVanManager(rij.team_id)

  let waarschuwing: string | undefined
  if (rij.mollie_payment_link_id) {
    try {
      await archiveerBetaalLink(rij.mollie_payment_link_id)
    } catch (e) {
      Sentry.captureException(e, { tags: { onderdeel: 'team-facturatie-betaallink' }, extra: { factuurId: rij.id } })
      waarschuwing = 'De betaallink kon niet worden uitgezet. Archiveer hem zelf in Mollie, anders kan de klant nog een keer betalen.'
    }
  }
  return { ok: true, teamId: rij.team_id, bedragCent: rij.bedrag_cent, waarschuwing }
}

/** Een betaalde factuur is buiten Mollie om teruggedraaid (teruggestort of teruggeboekt). Alleen vastleggen. */
export async function zetTeruggedraaid(factuurId: string): Promise<HandmatigResultaat> {
  const rij = await leesFactuur(factuurId)
  if (!rij) return { ok: false, status: 404, fout: 'Factuur niet gevonden' }
  if (rij.status !== 'paid') return { ok: false, status: 409, fout: 'Alleen een betaalde factuur kan worden teruggedraaid' }

  const { data, error } = await billingDb
    .from('arnobot_team_facturen')
    .update({ status: 'refunded', reversed_at: nuIso(), updated_at: nuIso() })
    .eq('id', rij.id)
    .eq('status', 'paid')
    .select('id')
  if (error) return { ok: false, status: 500, fout: opslaanFout(error) }
  if ((data?.length ?? 0) !== 1) return { ok: false, status: 409, fout: 'De factuur is net gewijzigd. Ververs de pagina.' }
  return { ok: true, teamId: rij.team_id, bedragCent: rij.bedrag_cent }
}
