import { billingDb, type PayRow } from './db'
import {
  betaalTerug, haalBetaling, lijstBetalingTerugbetalingen, mollieIngeschakeld, MollieError, type MollieRefund,
} from './mollie'
import { formatEuro, mollieNaarCenten } from './geld'
import { heeftAndereTerugbetaling } from './terugbetaling'
import { tabelOntbreekt } from './tabel'
import { schakelaarAan } from './referralSchakelaars'
import { wieIs } from './wie'
import { notifyTelegram } from '@/lib/cron-notify'
import { isInternalTestUser } from '@/lib/internalTestAccounts'

// De terugstortmachine (docs/REFERRAL_BOUWPLAN_R3.md, B0): reserveren in de database, de rij claimen, eerst bij Mollie
// kijken wat er al is, dan pas terugstorten, en pas bij Mollie-status 'refunded' bevestigen. SQL:
// docs/sql/2026-11-26-referral-verrekening.sql.
//
// Twee vaste regels. Nooit blind opnieuw versturen: Mollie onthoudt een idempotency-key maar een uur, dus de lijst met
// terugbetalingen (met ons actiekenmerk in de metadata) is leidend. En nooit vrijgeven als niet zeker is dat er geen geld
// is verplaatst: dan blijft de reservering staan, krijgt de actie 'vastgelopen' en hoort Arno het.
//
// NOG NIET AANGESLOTEN: niets maakt acties aan en geen cron roept dit aan. Dat Mollie de metadata in de lijst teruggeeft
// is nog niet beproefd (bouwplan, onderdeel C).

export const WACHT_NA_BETALING_DAGEN = 7
export const WACHTRIJ_MELDEN_NA_DAGEN = 7
/** Zo vaak een duidelijke weigering van Mollie (er is zeker niets verplaatst) voordat de actie vastloopt. */
export const MAX_POGINGEN_GEWEIGERD = 3
/** Zo vaak een onduidelijke uitkomst voordat een mens moet kijken. */
export const MAX_POGINGEN_ONBEKEND = 5

const DAG_MS = 24 * 60 * 60 * 1000
export const TERUGSTORT_SOORTEN = ['tegoed_terugstorten', 'voordeel_jaar', 'voordeel_maand'] as const
const OPEN_STATUSSEN = ['gereserveerd', 'bezig', 'verzonden']

export interface ActieGegevens {
  /** Wat de klant bij de terugbetaling te zien krijgt. De aanroeper levert hem aan: deze machine verzint geen tekst. */
  omschrijving?: string
  /** Gezet vlak voor het versturen. Blijft staan zolang niet zeker is dat die poging niets heeft verplaatst. */
  post_geprobeerd_at?: string | null
  verzonden_at?: string
  wachtrij_gemeld_at?: string
  niet_gevonden?: number
  boeking_teruggezet?: boolean
}

export interface ActieRij {
  id: string
  soort: string
  user_id: string
  referral_id: string | null
  doel_soort: string
  doel_id: string
  bruto_cent: number
  netto_cent: number
  status: string
  bezig_tot: string | null
  pogingen: number
  fout: string | null
  mollie_refund_id: string | null
  gegevens: ActieGegevens
  credit_status: 'nvt' | 'nodig' | 'bezig' | 'klaar'
}

type DbFout = { code?: string; message: string }
const sqlOntbreekt = (e: DbFout) => ['42P01', '42883', 'PGRST202', 'PGRST205'].includes(e.code ?? '') || tabelOntbreekt(e)

function verplicht<T>(wat: string, r: { data: T; error: DbFout | null }): T {
  if (r.error) throw new Error(`${wat} mislukt: ${r.error.message}`)
  return r.data
}

// ── Stap 1: reserveren ──

export type ReserveerInvoer = { actieId: string; userId: string; betalingId: string; omschrijving: string } & (
  | { soort: 'tegoed_terugstorten'; maxNettoCent?: number; terugwerkend?: boolean }
  | { soort: 'voordeel_jaar' | 'voordeel_maand'; referralId: string; brutoCent: number }
)

export type ReserveerUitkomst =
  /** De schakelaar staat uit: er is niets gevraagd of vastgelegd. */
  | { stand: 'uit' }
  | { stand: 'geweigerd'; reden: string }
  | { stand: 'gereserveerd'; brutoCent: number; nettoCent: number; bestaand: boolean }

/** Wanneer en hoeveel er gereserveerd moet worden (verlenging, tegoed actief, geen open vraag) beslist de aanroeper. */
export async function reserveerTerugstorting(invoer: ReserveerInvoer): Promise<ReserveerUitkomst> {
  if (!schakelaarAan('REFERRAL_TERUGSTORTEN')) return { stand: 'uit' }
  if (isInternalTestUser(invoer.userId)) return { stand: 'geweigerd', reden: 'testaccount' }
  const omschrijving = invoer.omschrijving.trim()
  if (!omschrijving) return { stand: 'geweigerd', reden: 'omschrijving_ontbreekt' }
  const gegevens: ActieGegevens = { omschrijving }
  const { data, error } = invoer.soort === 'tegoed_terugstorten'
    ? await billingDb.rpc('referral_reserveer', {
      p_actie: invoer.actieId, p_user: invoer.userId, p_doel: invoer.betalingId, p_max_netto: invoer.maxNettoCent ?? null,
      p_gegevens: gegevens, p_terugwerkend: invoer.terugwerkend ?? false,
    })
    : await billingDb.rpc('referral_reserveer_voordeel', {
      p_actie: invoer.actieId, p_user: invoer.userId, p_soort: invoer.soort, p_referral: invoer.referralId,
      p_doel: invoer.betalingId, p_bruto: invoer.brutoCent, p_gegevens: gegevens,
    })
  if (error) {
    if (sqlOntbreekt(error)) return { stand: 'geweigerd', reden: 'sql_ontbreekt' }
    throw new Error(`referral reserveren mislukt: ${error.message}`)
  }
  const r = data as { ok: boolean; reden?: string; bruto_cent: number; netto_cent: number; bestaand?: boolean }
  return r.ok
    ? { stand: 'gereserveerd', brutoCent: r.bruto_cent, nettoCent: r.netto_cent, bestaand: !!r.bestaand }
    : { stand: 'geweigerd', reden: r.reden ?? 'onbekend' }
}

// ── Stap 2 tot en met 6: uitvoeren ──

export type UitvoerUitkomst =
  | 'niets-te-doen' | 'niet-geclaimd' | 'testaccount'
  /** Schakelaar uit en nog niets verstuurd. */
  | 'zou-doen'
  | 'wacht-7-dagen' | 'schakelaar-uit' | 'later-opnieuw' | 'onbekend'
  | 'verzonden' | 'bevestigd' | 'vrijgegeven' | 'vastgelopen'

const mislukt = (status: string) => status === 'failed' || status === 'canceled'

/** Ons actiekenmerk uit de metadata van een terugbetaling. */
function kenmerk(r: MollieRefund): string | null {
  let m = r.metadata
  if (typeof m === 'string') {
    try { m = JSON.parse(m) } catch { return null }
  }
  const k = (m as { referralActie?: unknown } | null | undefined)?.referralActie
  return typeof k === 'string' ? k : null
}

const wachttijdVoorbij = (b: PayRow, nu: Date) =>
  !!b.betaald_at && nu.getTime() - Date.parse(b.betaald_at) >= WACHT_NA_BETALING_DAGEN * DAG_MS

async function leesActie(id: string): Promise<ActieRij | null> {
  return verplicht('actie ophalen', await billingDb.from('arnobot_referral_acties').select('*').eq('id', id).maybeSingle<ActieRij>())
}

async function leesBetaling(a: ActieRij): Promise<PayRow | null> {
  return verplicht('betaling ophalen',
    await billingDb.from('arnobot_payments').select('*').eq('id', a.doel_id).eq('user_id', a.user_id).maybeSingle<PayRow>())
}

/** Wijzigt de actie alleen als zij nog de status heeft die wij kennen. Lukt dat niet, dan stopt deze run. */
async function bewaar(a: ActieRij, patch: Partial<ActieRij>): Promise<void> {
  const rijen = verplicht('actie bijwerken', await billingDb.from('arnobot_referral_acties')
    .update({ ...patch, updated_at: new Date().toISOString() }).eq('id', a.id).eq('status', a.status).select('id'))
  if (rijen?.length !== 1) throw new Error(`referralactie ${a.id} is intussen gewijzigd`)
  Object.assign(a, patch)
}

async function meld(a: ActieRij, betaling: PayRow | null, kop: string, uitleg: string): Promise<void> {
  await notifyTelegram(`${kop} (referral, arno.bot)\n\nWie: ${await wieIs(a.user_id)}\nBedrag: ${formatEuro(a.bruto_cent)}\nBetaling: ${betaling?.mollie_payment_id ?? a.doel_id}\nActie: ${a.id}\n${uitleg}`)
}

/** Een mens moet kijken. De reservering blijft geboekt: het is niet zeker dat er niets is verplaatst. */
async function loopVast(a: ActieRij, betaling: PayRow | null, reden: string): Promise<'vastgelopen'> {
  await bewaar(a, { status: 'vastgelopen', bezig_tot: null, fout: reden })
  await meld(a, betaling, 'Terugstorting vastgelopen', `${reden}.\nDe reservering blijft staan en niets probeert het opnieuw. Kijk in Mollie of dit bedrag is teruggestort.`)
  return 'vastgelopen'
}

/** Alleen aanroepen als zeker is dat er geen geld is verplaatst. */
async function geefVrij(a: ActieRij, betaling: PayRow, eind: 'vrijgegeven' | 'vastgelopen', reden: string): Promise<'vrijgegeven' | 'vastgelopen' | 'niet-geclaimd'> {
  const r = verplicht('actie vrijgeven', await billingDb.rpc('referral_vrijgeven', { p_actie: a.id, p_van: a.status, p_eind: eind, p_reden: reden }))
  if (!(r as { ok?: boolean } | null)?.ok) return 'niet-geclaimd'
  if (eind === 'vastgelopen') {
    await meld(a, betaling, 'Terugstorting vastgelopen', `${reden}.\nEr is niets teruggestort en de reservering is teruggezet. Niets probeert het vanzelf opnieuw.`)
  } else if (betaling.terugbetaling_verwerkt_at) {
    // Wie intussen terugbetaalde, kan dit bedrag hebben overgeslagen omdat het onderweg was.
    await meld(a, betaling, 'Controleer of nabetalen nodig is', `${reden}.\nDeze referralterugstorting gaat niet door en de betaling is intussen op een andere manier terugbetaald. Reken in Mollie na of de klant dit bedrag nog moet krijgen.`)
  } else {
    await meld(a, betaling, 'Terugstorting niet doorgegaan', `${reden}.\nDe reservering is teruggezet.`)
  }
  return eind
}

/** Nog niets verstuurd: terug naar gereserveerd, dan kan de beheerder haar gewoon vrijgeven. */
async function legTerug(a: ActieRij, extra: Partial<ActieRij> = {}): Promise<void> {
  await bewaar(a, { status: 'gereserveerd', bezig_tot: null, ...extra })
}

/** Stap 6: een terugbetaling die bij Mollie bestaat, overnemen. */
async function neemOver(a: ActieRij, betaling: PayRow, r: { id: string; status: string; amount?: MollieRefund['amount']; createdAt?: string }, nu: Date): Promise<UitvoerUitkomst> {
  if (r.amount && mollieNaarCenten(r.amount.value) !== a.bruto_cent) {
    return loopVast(a, betaling, `Mollie noemt ${r.amount.value} voor terugbetaling ${r.id}, niet het gereserveerde bedrag`)
  }
  if (mislukt(r.status)) return geefVrij(a, betaling, 'vrijgegeven', `terugbetaling ${r.id} is bij Mollie ${r.status}`)
  if (r.status === 'refunded') {
    // De creditnota is een aparte stap. De mail aan de klant is nog niet gebouwd (mail_at blijft leeg).
    await bewaar(a, { status: 'bevestigd', mollie_refund_id: r.id, credit_status: 'nodig', bezig_tot: null, fout: null })
    return 'bevestigd'
  }
  const gegevens: ActieGegevens = { ...a.gegevens, verzonden_at: a.gegevens.verzonden_at ?? r.createdAt ?? nu.toISOString() }
  const langInWachtrij = r.status === 'queued' && !gegevens.wachtrij_gemeld_at
    && nu.getTime() - Date.parse(gegevens.verzonden_at!) > WACHTRIJ_MELDEN_NA_DAGEN * DAG_MS
  if (langInWachtrij) gegevens.wachtrij_gemeld_at = nu.toISOString()
  await bewaar(a, { status: 'verzonden', mollie_refund_id: r.id, gegevens, bezig_tot: null, fout: null })
  if (langInWachtrij) {
    await meld(a, betaling, 'Terugstorting staat lang in de wachtrij', `Al meer dan ${WACHTRIJ_MELDEN_NA_DAGEN} dagen. Waarschijnlijk is het saldo bij Mollie te laag.`)
  }
  return 'verzonden'
}

/** Van ons, en niet van ons: terugbetalingen op deze betaling die geen andere actie van ons verklaart. */
async function sorteer(a: ActieRij, refunds: MollieRefund[]) {
  const vanOns = refunds.filter(r => kenmerk(r) === a.id || (!!a.mollie_refund_id && r.id === a.mollie_refund_id))
  const overig = refunds.filter(r => !vanOns.includes(r) && !mislukt(r.status))
  if (!overig.length) return { vanOns, vreemd: overig }
  const anderen = (verplicht('andere acties ophalen', await billingDb.from('arnobot_referral_acties').select('id, mollie_refund_id')
    .eq('doel_id', a.doel_id).in('status', ['bezig', 'verzonden', 'bevestigd', 'vastgelopen']).limit(100)) ?? []) as { id: string; mollie_refund_id: string | null }[]
  const bekend = anderen.filter(x => x.id !== a.id)
  return { vanOns, vreemd: overig.filter(r => !bekend.some(x => x.id === kenmerk(r) || x.mollie_refund_id === r.id)) }
}

/** Stap 5 mislukte. */
async function naFout(a: ActieRij, betaling: PayRow, e: unknown, eerderOnbekend: boolean, nu: Date): Promise<UitvoerUitkomst> {
  const status = e instanceof MollieError ? e.status : 0
  const fout = e instanceof Error ? e.message : String(e)
  const geweigerd = status >= 400 && status < 500 && status !== 408 && status !== 409 && status !== 429
  const { post_geprobeerd_at: _weg, ...zonderPoging } = a.gegevens

  if (status === 429 && !eerderOnbekend) {
    // Te veel aanvragen: Mollie heeft niets gedaan.
    await legTerug(a, { fout, gegevens: zonderPoging })
    return 'later-opnieuw'
  }
  if (!geweigerd) {
    // Time-out, 409, 5xx of een onbekend antwoord: niet vrijgeven. De volgende run kijkt eerst in de lijst.
    await bewaar(a, { pogingen: a.pogingen + (status === 429 ? 0 : 1), fout })
    return 'onbekend'
  }

  const { vanOns, vreemd } = await sorteer(a, await lijstBetalingTerugbetalingen(betaling.mollie_payment_id))
  const staat = vanOns.find(r => !mislukt(r.status))
  if (staat) return neemOver(a, betaling, staat, nu)
  const pogingen = a.pogingen + 1
  if (eerderOnbekend) {
    // Deze poging is geweigerd, maar van een eerdere weten we het niet.
    if (vreemd.length) return loopVast(a, betaling, `Mollie weigert (${fout}) en er staat een terugbetaling die niet te herkennen is, na een eerdere poging met onbekende uitkomst`)
    await bewaar(a, { pogingen, fout })
    return 'onbekend'
  }
  if (vreemd.length) return geefVrij(a, betaling, 'vrijgegeven', 'er staat een andere terugbetaling op deze betaling')
  if (pogingen >= MAX_POGINGEN_GEWEIGERD) {
    await bewaar(a, { pogingen })
    return geefVrij(a, betaling, 'vastgelopen', `Mollie weigerde ${pogingen} keer: ${fout}`)
  }
  // Zeker niets verplaatst. De reservering blijft tot de volgende poging.
  await legTerug(a, { pogingen, fout, gegevens: zonderPoging })
  return 'later-opnieuw'
}

/** Voert een actie zo ver mogelijk uit. Vaker aanroepen is veilig. Gooit bij een storing; dan morgen opnieuw. */
export async function voerTerugstortingUit(actieId: string, nu: Date = new Date()): Promise<UitvoerUitkomst> {
  const gevonden = await leesActie(actieId)
  if (!gevonden || gevonden.doel_soort !== 'betaling' || !OPEN_STATUSSEN.includes(gevonden.status)
    || !(TERUGSTORT_SOORTEN as readonly string[]).includes(gevonden.soort)) return 'niets-te-doen'
  if (isInternalTestUser(gevonden.user_id)) return 'testaccount'
  if (!mollieIngeschakeld()) return 'niets-te-doen'
  if (gevonden.status === 'gereserveerd') {
    if (!schakelaarAan('REFERRAL_TERUGSTORTEN')) return 'zou-doen'
    const b = await leesBetaling(gevonden)
    if (b && !wachttijdVoorbij(b, nu)) return 'wacht-7-dagen'
  }

  // Stap 2: claimen, achter het slot per gebruiker.
  const a = verplicht('actie claimen', await billingDb.rpc('referral_claim', { p_actie: actieId, p_van: gevonden.status })) as ActieRij | null
  if (!a) return 'niet-geclaimd'
  const betaling = await leesBetaling(a)
  if (!betaling) return loopVast(a, null, 'de betaling is niet meer te vinden')

  // Stap 3: eerst kijken wat er bij Mollie al is. Nooit blind opnieuw.
  const refunds = await lijstBetalingTerugbetalingen(betaling.mollie_payment_id)
  const { vanOns, vreemd } = await sorteer(a, refunds)
  const lopend = vanOns.filter(r => !mislukt(r.status))
  if (lopend.length > 1) return loopVast(a, betaling, 'er staan meer terugbetalingen met dit actiekenmerk: mogelijk dubbel teruggestort')
  if (lopend.length === 1) return neemOver(a, betaling, lopend[0], nu)
  if (vanOns.length) return geefVrij(a, betaling, 'vrijgegeven', `de terugbetaling is bij Mollie ${vanOns[0].status}`)
  if (a.status === 'verzonden') {
    const keer = (a.gegevens.niet_gevonden ?? 0) + 1
    if (keer >= MAX_POGINGEN_ONBEKEND) return loopVast(a, betaling, `terugbetaling ${a.mollie_refund_id} staat niet meer in de lijst van Mollie`)
    await bewaar(a, { gegevens: { ...a.gegevens, niet_gevonden: keer }, bezig_tot: null })
    return 'onbekend'
  }

  // Stap 4: mag er nu nog teruggestort worden?
  const eerderOnbekend = !!a.gegevens.post_geprobeerd_at
  const mp = await haalBetaling(betaling.mollie_payment_id)
  const bezwaar = betaling.status !== 'paid' || mp.status !== 'paid' ? 'de betaling staat niet (meer) op betaald'
    : betaling.terugbetaling_verwerkt_at ? 'de betaling wordt of is al terugbetaald'
      : betaling.teruggeboekt_cent > 0 || (!!mp.amountChargedBack && mollieNaarCenten(mp.amountChargedBack.value) > 0) ? 'de betaling is teruggeboekt'
        : vreemd.length || heeftAndereTerugbetaling(betaling, betaling.terugbetaald_cent ?? 0) ? 'er staat een andere terugbetaling op deze betaling'
          : mp.amountRemaining && mollieNaarCenten(mp.amountRemaining.value) < a.bruto_cent ? 'er is bij Mollie niet genoeg over om terug te storten'
            : null
  if (bezwaar) {
    return eerderOnbekend
      ? loopVast(a, betaling, `${bezwaar}, en een eerdere poging heeft een onbekende uitkomst`)
      : geefVrij(a, betaling, 'vrijgegeven', bezwaar)
  }
  if ((betaling.referral_refund_cent ?? 0) < a.bruto_cent) return loopVast(a, betaling, 'de reservering staat niet op de betaling geboekt')
  if (!schakelaarAan('REFERRAL_TERUGSTORTEN')) {
    if (!eerderOnbekend) await legTerug(a)
    return 'schakelaar-uit'
  }
  if (!wachttijdVoorbij(betaling, nu)) {
    if (!eerderOnbekend) await legTerug(a)
    return 'wacht-7-dagen'
  }
  if (eerderOnbekend && a.pogingen >= MAX_POGINGEN_ONBEKEND) return loopVast(a, betaling, `na ${a.pogingen} pogingen nog onduidelijk of er is teruggestort`)
  if (!a.gegevens.omschrijving) {
    return eerderOnbekend ? loopVast(a, betaling, 'de omschrijving ontbreekt') : geefVrij(a, betaling, 'vastgelopen', 'de omschrijving ontbreekt')
  }

  // Stap 5. Eerst vastleggen dat er een poging komt: valt de run hierna weg, dan geldt de uitkomst als onbekend.
  await bewaar(a, { gegevens: { ...a.gegevens, post_geprobeerd_at: a.gegevens.post_geprobeerd_at ?? nu.toISOString() } })
  let antwoord: { id: string; status: string }
  try {
    antwoord = await betaalTerug({
      betalingId: betaling.mollie_payment_id,
      brutoCent: a.bruto_cent,
      omschrijving: a.gegevens.omschrijving!,
      idempotencyKey: `referral-${a.id}`,
      metadata: { referralActie: a.id },
    })
  } catch (e) {
    return naFout(a, betaling, e, eerderOnbekend, nu)
  }
  return neemOver(a, betaling, { id: antwoord.id, status: antwoord.status }, nu)
}

// ── Creditnota: een aparte stap, nog niet gebouwd ──

export type CreditnotaStap = 'niet-nodig' | 'uit' | 'wacht-op-factuur' | 'geen-factuur-testmodus' | 'niet-gebouwd'

/**
 * Doet bewust geen enkele aanroep bij Moneybird: of daar een deelbedrag te crediteren is, is niet beproefd (bouwplan A12
 * en C). De actie houdt credit_status 'nodig' tot de hervatbare deelcreditnota er is (bouwvolgorde stap 5).
 */
export async function creditnotaStap(a: ActieRij): Promise<CreditnotaStap> {
  if (a.status !== 'bevestigd' || a.credit_status !== 'nodig') return 'niet-nodig'
  if (!schakelaarAan('REFERRAL_CREDITNOTA')) return 'uit'
  const factuur = (await leesBetaling(a))?.moneybird_factuur_id
  if (!factuur || factuur === 'bezig') return 'wacht-op-factuur'
  if (factuur === 'testmodus') {
    await bewaar(a, { credit_status: 'nvt' })
    return 'geen-factuur-testmodus'
  }
  return 'niet-gebouwd'
}

// ── Alle openstaande acties ──

export interface TerugstortRonde {
  /** De SQL is niet uitgevoerd: er valt niets te doen. */
  sqlOntbreekt: boolean
  uitkomsten: { actieId: string; uitkomst: UitvoerUitkomst }[]
  fouten: string[]
}

/** Voor de toekomstige cron (referral-uitvoeren): een voor een, een fout bij de een houdt de ander niet tegen. */
export async function verwerkOpenTerugstortingen(nu: Date = new Date()): Promise<TerugstortRonde> {
  const ronde: TerugstortRonde = { sqlOntbreekt: false, uitkomsten: [], fouten: [] }
  const { data, error } = await billingDb.from('arnobot_referral_acties').select('id')
    .eq('doel_soort', 'betaling').in('soort', [...TERUGSTORT_SOORTEN]).in('status', OPEN_STATUSSEN)
    .order('updated_at', { ascending: true }).limit(200)
  if (error) {
    if (sqlOntbreekt(error)) return { ...ronde, sqlOntbreekt: true }
    throw new Error(`referralacties ophalen mislukt: ${error.message}`)
  }
  for (const { id } of (data ?? []) as { id: string }[]) {
    try {
      ronde.uitkomsten.push({ actieId: id, uitkomst: await voerTerugstortingUit(id, nu) })
    } catch (e) {
      ronde.fouten.push(`actie ${id}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  return ronde
}
