import * as Sentry from '@sentry/nextjs'
import { billingDb, type PayRow, type SubRow } from './db'
import { mollieNaarCenten } from './geld'
import { betaaldeBetalingVanLink, klantBestaat, maakBetaalLink, maakKlant, SITE_URL } from './mollie'
import {
  btwTariefId,
  omzetGrootboekId,
  maakConceptFactuur,
  maakCreditnota,
  moneybirdIngeschakeld,
  verstuurFactuur,
  zoekOfMaakContact,
} from './moneybird'
import { verstuurBillingMail } from './mails'
import { controleerStart, zakelijkBedragVan, zetAbonnementZakelijk } from './klanttypeOmzetten'
import { nieuwMelden } from '@/lib/capaciteit'
import { isInternalTestUser } from '@/lib/internalTestAccounts'
import { stopCorrectieAbonnementen } from './verwerking'
import { tabelOntbreekt } from './tabel'
import { redenGeenZelfCorrectie } from './referralKorting'
import { notifyTelegram } from '@/lib/cron-notify'

// Zelf-bediening: een particulier die eigenlijk zakelijk had moeten afrekenen, corrigeert dit
// zelf (app/bot/account/zakelijk-corrigeren). Geen nieuwe schakelaar voor testmodus: deze flow
// loopt altijd via Mollie (ook test_), Moneybird-facturering blijft wel achter dezelfde
// bestaande testmodus-check staan, zelfde reden als overal elders (geen nepfacturen).
function factureringToegestaan(): boolean {
  if (!moneybirdIngeschakeld()) return false
  const testmodus = process.env.MOLLIE_API_KEY?.startsWith('test_')
  return !testmodus || process.env.MONEYBIRD_OOK_IN_TESTMODUS === 'true'
}

export interface KlanttypeCorrectieRow {
  id: string
  user_id: string
  subscription_id: string
  verschil_cent: number
  btw_cent: number
  mollie_payment_id: string | null
  status: 'open' | 'paid'
  bedrijfsnaam: string
  kvk_nummer: string
  btw_nummer: string
  straat: string
  postcode: string
  plaats: string
  moneybird_factuur_id: string | null
  /** Het zakelijke abonnementsbedrag, vastgelegd bij het starten. */
  nieuw_bedrag_cent: number
  nieuw_btw_cent: number
  plan: SubRow['plan']
  cyclus: SubRow['cyclus']
  omzetting_gestart_at: string | null
  nieuw_mollie_subscription_id: string | null
  afgehandeld_at: string | null
  /** Gevuld als er niet is omgezet: Arno regelt het met de hand. */
  handwerk_reden: string | null
  gefactureerd_at: string | null
  created_at: string
}

/**
 * Wie zelf mag omzetten. Tot Arno de functie openzet (KLANTTYPE_OPEN=true) alleen de eigenaar en de interne
 * testaccounts. Het afronden van een betaalde correctie hangt hier niet van af.
 */
export function klanttypeCorrectieBeschikbaarVoor(userId: string): boolean {
  if (process.env.KLANTTYPE_OPEN === 'true') return true
  const eigenaar = process.env.ARNOBOT_OWNER_USER_ID
  return isInternalTestUser(userId) || (!!eigenaar && eigenaar === userId)
}

/** De meest recente betaalde particuliere factuur van de gebruiker, met het te crediteren Moneybird-id. */
export async function vindTeCorrigerenAbonnement(userId: string): Promise<{ sub: SubRow; payment: PayRow } | null> {
  const { data: subs } = await billingDb
    .from('arnobot_subscriptions')
    .select('*')
    .eq('user_id', userId)
    .eq('klant_type', 'particulier')
    .in('status', ['active', 'cancelled'])
    .order('created_at', { ascending: false })
    .returns<SubRow[]>()
  for (const sub of subs ?? []) {
    const { data: payment } = await billingDb
      .from('arnobot_payments')
      .select('*')
      .eq('subscription_id', sub.id)
      .eq('status', 'paid')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle<PayRow>()
    if (payment) return { sub, payment }
  }
  return null
}

/**
 * Verwerkt een Mollie-melding over een correctie-betaallink. `webhookId` is het betaling- (tr_)
 * of betaallink-id (pl_), `hintRijId` het `?r=` uit onze eigen webhook-URL. Beide dienen alleen
 * om de rij te vinden: de betaling zelf wordt bij Mollie bevestigd als betaald en als horend
 * bij de betaallink van déze correctie (die staat in `mollie_payment_id`).
 * Elke databasefout gooit: de webhook geeft dan 500 en Mollie probeert het opnieuw.
 */
export async function verwerkKlanttypeCorrectie(webhookId: string, hintRijId: string | null): Promise<void> {
  let rij: KlanttypeCorrectieRow | null = null
  if (webhookId.startsWith('pl_')) {
    const { data, error } = await billingDb
      .from('arnobot_klanttype_correcties')
      .select('*')
      .eq('mollie_payment_id', webhookId)
      .maybeSingle<KlanttypeCorrectieRow>()
    if (error) throw new Error(`correctie opzoeken mislukt: ${error.message}`)
    rij = data
  } else if (hintRijId) {
    const { data, error } = await billingDb
      .from('arnobot_klanttype_correcties')
      .select('*')
      .eq('id', hintRijId)
      .maybeSingle<KlanttypeCorrectieRow>()
    if (error) throw new Error(`correctie opzoeken mislukt: ${error.message}`)
    rij = data
  }
  if (!rij || !rij.mollie_payment_id) return

  const mp = await betaaldeBetalingVanLink(rij.mollie_payment_id, webhookId)
  if (!mp) return
  if (rij.afgehandeld_at) {
    // Het verschil zelf is teruggeboekt of terugbetaald: dat ziet verder niemand.
    const terug = [mp.amountRefunded, mp.amountChargedBack].some(b => !!b && mollieNaarCenten(b.value) > 0)
    if (terug && (await nieuwMelden(`klanttype:terug:${rij.id}`, 'mijlpaal'))) {
      await notifyTelegram(`Correctiebetaling teruggedraaid op arno.bot\n\nUser: ${rij.user_id}\nBetaling: ${mp.id}\nHet abonnement en de facturen zijn niet aangepast. Beoordeel met de hand.`)
    }
    return
  }
  if (mollieNaarCenten(mp.amount.value) !== rij.verschil_cent) {
    Sentry.captureMessage('Correctiebetaling met afwijkend bedrag genegeerd', { level: 'error', tags: { onderdeel: 'klanttype-correctie' }, extra: { correctieId: rij.id, betaling: mp.id } })
    return
  }

  if (rij.status === 'open') {
    const { error } = await billingDb
      .from('arnobot_klanttype_correcties')
      .update({ status: 'paid', betaald_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', rij.id)
      .eq('status', 'open')
    if (error) throw new Error(`betaalde correctie niet vastgelegd: ${error.message}`)
  }

  // Een slot per abonnement: webhook en cron, of twee correcties, nooit tegelijk. Bezet: de houder maakt het af, en
  // breekt die af, dan pakt de cron het op.
  if (!(await neemSlot(rij.subscription_id))) return
  const teruggestort = [mp.amountRefunded, mp.amountChargedBack].some(b => !!b && mollieNaarCenten(b.value) > 0)
  try {
    await rondCorrectieAf(rij.id, mp.id, teruggestort)
  } finally {
    await geefSlotVrij(rij.subscription_id)
  }
}

/** Na zoveel minuten vervalt een slot dat door een afgebroken aanroep is blijven staan. */
const SLOT_MINUTEN = 10

async function neemSlot(abonnementId: string): Promise<boolean> {
  const nu = new Date()
  const zet = () => billingDb
    .from('arnobot_subscriptions')
    .update({ klanttype_bezig_tot: new Date(nu.getTime() + SLOT_MINUTEN * 60_000).toISOString() })
    .eq('id', abonnementId)
  // Twee losse updates en bewust geen or-filter: dat gaat in oudere versies van PostgREST mis op een kolom die de
  // update zelf wijzigt. Eerst een vrij slot, anders een verlopen slot.
  for (const poging of [() => zet().is('klanttype_bezig_tot', null).select('id'), () => zet().lt('klanttype_bezig_tot', nu.toISOString()).select('id')]) {
    const { data, error } = await poging()
    if (error) throw new Error(`slot op het abonnement nemen mislukt: ${error.message}`)
    if ((data?.length ?? 0) === 1) return true
  }
  return false
}

async function geefSlotVrij(abonnementId: string): Promise<void> {
  const { error } = await billingDb.from('arnobot_subscriptions').update({ klanttype_bezig_tot: null }).eq('id', abonnementId)
  if (error) Sentry.captureException(new Error(error.message), { tags: { onderdeel: 'klanttype-correctie-slot' } })
}

/** Vinkt de correctie af. Alleen wie dit als eerste doet, mag factureren en mailen. */
async function vinkAf(rijId: string, handwerkReden: string | null = null): Promise<boolean> {
  const { data, error } = await billingDb
    .from('arnobot_klanttype_correcties')
    .update({ afgehandeld_at: new Date().toISOString(), handwerk_reden: handwerkReden, updated_at: new Date().toISOString() })
    .eq('id', rijId)
    .is('afgehandeld_at', null)
    .select('id')
  if (error) throw new Error(`correctie niet afgevinkt: ${error.message}`)
  return (data?.length ?? 0) === 1
}

const meldHandwerk = (rij: KlanttypeCorrectieRow, betaalId: string, reden: string) =>
  notifyTelegram(`Klanttype-correctie betaald, NIET omgezet op arno.bot\n\nUser: ${rij.user_id}\nBetaling: ${betaalId}\nBedrag: €${(rij.verschil_cent / 100).toFixed(2)}\nReden: ${reden}\nEr is niet gefactureerd. Stort het verschil terug of regel het met de hand.`)

/** Het vervolg op een betaalde correctie: abonnement omzetten, daarna een keer factureren en mailen. */
async function rondCorrectieAf(rijId: string, betaalId: string, teruggestort: boolean): Promise<void> {
  // Opnieuw lezen onder het slot: een eerdere houder kan al klaar zijn.
  const { data: rij, error: rijFout } = await billingDb
    .from('arnobot_klanttype_correcties')
    .select('*')
    .eq('id', rijId)
    .maybeSingle<KlanttypeCorrectieRow>()
  if (rijFout) throw new Error(`correctie opzoeken mislukt: ${rijFout.message}`)
  if (!rij || rij.afgehandeld_at) return

  if (teruggestort) {
    // Een abonnement van een eerdere poging mag niet blijven lopen.
    const { data: sub, error } = await billingDb.from('arnobot_subscriptions').select('*').eq('id', rij.subscription_id).maybeSingle<SubRow>()
    if (error) throw new Error(`abonnement opzoeken mislukt: ${error.message}`)
    if (sub && !(await stopCorrectieAbonnementen(sub))) throw new Error('abonnement van een eerdere poging niet te stoppen')
    if (await vinkAf(rij.id, 'het verschil is terugbetaald of teruggeboekt')) {
      await notifyTelegram(`Klanttype-correctie afgebroken op arno.bot\n\nUser: ${rij.user_id}\nBetaling: ${betaalId}\nHet verschil is terugbetaald of teruggeboekt. Er is niet omgezet en niet gefactureerd.`)
    }
    return
  }

  const { data: eerder, error: eerderFout } = await billingDb
    .from('arnobot_klanttype_correcties')
    .select('id, handwerk_reden')
    .eq('subscription_id', rij.subscription_id)
    .not('afgehandeld_at', 'is', null)
    .limit(20)
  if (eerderFout) throw new Error(`eerdere correcties opzoeken mislukt: ${eerderFout.message}`)
  if (eerder?.some(c => !c.handwerk_reden)) {
    const reden = 'dubbel betaald, het abonnement was al omgezet'
    if (await vinkAf(rij.id, reden)) await meldHandwerk(rij, betaalId, reden)
    return
  }

  const uitkomst = await zetAbonnementZakelijk(rij)
  if (uitkomst.stand === 'wacht') {
    if (await nieuwMelden(`klanttype:wacht:${rij.id}`, 'waarschuwing')) {
      await notifyTelegram(`Klanttype-correctie betaald, nog niet omgezet op arno.bot\n\nUser: ${rij.user_id}\nReden: ${uitkomst.reden}\nDe billing-cron probeert het dagelijks opnieuw. Er is nog niet gefactureerd. Wil je afbreken, stort dan het verschil terug in Mollie: de app zet daarna niet meer om.`)
    }
    return
  }
  if (uitkomst.stand === 'handwerk') {
    if (await vinkAf(rij.id, uitkomst.reden)) await meldHandwerk(rij, betaalId, uitkomst.reden)
    return
  }
  if (!(await vinkAf(rij.id))) return

  try {
    await factureerCorrectie(rij, betaalId)
  } catch (e) {
    Sentry.captureException(e, { tags: { onderdeel: 'klanttype-correctie-facturatie' } })
    await notifyTelegram(`Klanttype-correctie: facturatie niet afgerond op arno.bot\n\nUser: ${rij.user_id}\nReden: ${e instanceof Error ? e.message : e}\nHet abonnement is omgezet. Controleer creditnota en factuur in Moneybird en rond met de hand af.`)
  }
  // Ook na een gemelde fout: gefactureerd_at leeg betekent alleen "afgebroken zonder melding" (zie de cron).
  const { error } = await billingDb.from('arnobot_klanttype_correcties').update({ gefactureerd_at: new Date().toISOString() }).eq('id', rij.id)
  if (error) Sentry.captureException(new Error(error.message), { tags: { onderdeel: 'klanttype-correctie-gefactureerd' } })
}

/** Klantgegevens, creditnota, nieuwe factuur en bevestiging. Wordt precies een keer aangeroepen. */
async function factureerCorrectie(rij: KlanttypeCorrectieRow, betaalId: string): Promise<void> {
  const { data: sub, error: subFout } = await billingDb
    .from('arnobot_subscriptions')
    .select('*')
    .eq('id', rij.subscription_id)
    .maybeSingle<SubRow>()
  if (subFout || !sub) throw new Error(`abonnement niet gelezen: ${subFout?.message ?? 'niet gevonden'}`)

  const nettoCent = rij.nieuw_bedrag_cent - rij.nieuw_btw_cent
  const oudBedragCent = rij.nieuw_bedrag_cent - rij.verschil_cent

  // Ging er tussen het starten en het omzetten nog een incasso af, dan was die op het particuliere bedrag.
  const { data: tussendoor } = await billingDb
    .from('arnobot_payments')
    .select('id')
    .eq('subscription_id', rij.subscription_id)
    .eq('soort', 'herhaling')
    .eq('status', 'paid')
    .eq('bedrag_cent', oudBedragCent)
    .gt('created_at', rij.created_at)
    .limit(1)
  if (tussendoor?.length) {
    await notifyTelegram(`Klanttype-correctie: tussendoor geïncasseerd op arno.bot\n\nUser: ${rij.user_id}\nTussen het starten en het omzetten is nog een betaling op het particuliere bedrag gedaan. Controleer de factuur en het verschil met de hand.`)
  }

  const { data: bestaandeKlant } = await billingDb
    .from('arnobot_billing_customers')
    .select('mollie_customer_id')
    .eq('user_id', rij.user_id)
    .maybeSingle<{ mollie_customer_id: string }>()
  const { data: gebruiker, error: gebruikerFout } = await billingDb
    .from('approved_users')
    .select('voornaam, email')
    .eq('user_id', rij.user_id)
    .maybeSingle<{ voornaam: string | null; email: string | null }>()
  if (gebruikerFout) throw new Error(`gebruiker niet gelezen: ${gebruikerFout.message}`)

  // Een bewaarde klant kan bij Mollie ontbreken (test en live door elkaar): dan een nieuwe aanmaken, zoals bij afrekenen.
  const bewaardeKlant = bestaandeKlant?.mollie_customer_id
  const bewaardeBestaat = bewaardeKlant ? await klantBestaat(bewaardeKlant) : false
  const mollieKlantId = bewaardeKlant && bewaardeBestaat
    ? bewaardeKlant
    : (gebruiker?.email ? (await maakKlant({ naam: rij.bedrijfsnaam, email: gebruiker.email, userId: rij.user_id, vervangt: bewaardeKlant })).id : null)

  const { error: klantFout } = await billingDb.from('arnobot_billing_customers').upsert(
    {
      user_id: rij.user_id,
      ...(mollieKlantId ? { mollie_customer_id: mollieKlantId } : {}),
      klant_type: 'zakelijk',
      bedrijfsnaam: rij.bedrijfsnaam,
      kvk_nummer: rij.kvk_nummer,
      btw_nummer: rij.btw_nummer,
      straat: rij.straat,
      postcode: rij.postcode,
      plaats: rij.plaats,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  )
  if (klantFout) await notifyTelegram(`Klanttype-correctie: bedrijfsgegevens niet opgeslagen op arno.bot\n\nUser: ${rij.user_id}\nFout: ${klantFout.message}`)

  await notifyTelegram(`Klanttype-correctie betaald op arno.bot\n\nUser: ${rij.user_id}\nBedrijf: ${rij.bedrijfsnaam}\nVerschil: €${(rij.verschil_cent / 100).toFixed(2)}`)

  if (!factureringToegestaan()) return
  if (!gebruiker?.email) throw new Error('geen e-mailadres bekend, er is niet gefactureerd')

  // Is er tussen het starten en betalen van de correctie geüpgraded, dan kloppen de bedragen niet: handwerk.
  const reden = await redenGeenZelfCorrectie(sub.id)
  if (reden) throw new Error(`${reden === 'upgrade' ? 'upgrade' : 'referral fee'} op dit abonnement: controleer bedrag, creditnota en factuur met de hand`)

  const { data: oudeBetaling, error: oudeFout } = await billingDb
    .from('arnobot_payments')
    .select('*')
    .eq('subscription_id', sub.id)
    .eq('status', 'paid')
    .not('moneybird_factuur_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string; moneybird_factuur_id: string; mollie_payment_id: string; referral_refund_cent?: number | null }>()
  if (oudeFout) throw new Error(`eerdere betaling niet gelezen: ${oudeFout.message}`)
  if (!oudeBetaling) await notifyTelegram(`Klanttype-correctie: geen eerdere factuur om te crediteren op arno.bot\n\nUser: ${rij.user_id}\nDe nieuwe zakelijke factuur wordt wel gemaakt. Controleer in Moneybird.`)

  // Met verrekend referraltegoed zou een volledige creditnota te veel crediteren: dan stoppen en handwerk.
  if ((oudeBetaling?.referral_refund_cent ?? 0) > 0) throw new Error(`referraltegoed verrekend op ${oudeBetaling?.mollie_payment_id}: creditnota met de hand`)

  if (oudeBetaling?.moneybird_factuur_id) {
    // Eerst vastleggen welke betaling wordt gecrediteerd: een latere terugbetaling mag dat niet nog eens doen.
    const { error: merkFout } = await billingDb.from('arnobot_klanttype_correcties').update({ gecrediteerde_betaling_id: oudeBetaling.id }).eq('id', rij.id)
    if (merkFout) throw new Error(`gecrediteerde betaling niet vastgelegd: ${merkFout.message}`)
    await maakCreditnota(oudeBetaling.moneybird_factuur_id, {
      terugbetalingRegistreren: false,
      brutoCent: oudBedragCent,
      betaaldOp: new Date(),
      mollieId: rij.mollie_payment_id ?? betaalId,
      voornaam: gebruiker.voornaam,
      mailen: true,
    })
  }

  const contactId = await zoekOfMaakContact({
    userId: rij.user_id,
    email: gebruiker.email,
    naam: gebruiker.voornaam || gebruiker.email,
    bedrijfsnaam: rij.bedrijfsnaam,
    kvk: rij.kvk_nummer,
    btw: rij.btw_nummer,
    adres: { straat: rij.straat, postcode: rij.postcode, plaats: rij.plaats },
  })

  const periodeStart = sub.periode_start ? new Date(sub.periode_start) : new Date()
  const periodeEinde = sub.periode_einde ? new Date(sub.periode_einde) : new Date()
  const factuur = await maakConceptFactuur({
    contactId,
    referentie: `correctie-${rij.id}`,
    omschrijving: `ArnoBot ${sub.plan === 'premium' ? 'Pro' : 'Basic'} ${sub.cyclus} (gecorrigeerd naar zakelijk)`,
    periodeStart,
    periodeEinde,
    factuurDatum: new Date(),
    brutoCent: rij.nieuw_bedrag_cent,
    nettoCent,
    inclusiefBtw: false,
    taxRateId: await btwTariefId(),
    ledgerAccountId: await omzetGrootboekId(),
    workflowId: process.env.MONEYBIRD_WORKFLOW_ID,
  })
  await billingDb.from('arnobot_klanttype_correcties').update({ moneybird_factuur_id: factuur.id }).eq('id', rij.id)
  await verstuurFactuur(factuur.id, 'Email')

  await verstuurBillingMail(rij.user_id, 'betaling_bevestiging', {
    planNaam: `${sub.plan === 'premium' ? 'Pro' : 'Basic'} (zakelijk)`,
    bedragCent: rij.nieuw_bedrag_cent,
    btwCent: rij.nieuw_btw_cent,
    datum: sub.periode_einde ?? new Date().toISOString(),
    eerste: false,
    betaalId,
  })
}

/** Start de correctie: maakt de rij en de Mollie-betaallink voor het verschilbedrag. */
export async function startKlanttypeCorrectie(input: {
  userId: string
  sub: SubRow
  payment: PayRow
  bedrijfsnaam: string
  kvkNummer: string
  btwNummer: string
  straat: string
  postcode: string
  plaats: string
}): Promise<{ checkoutUrl: string } | { fout: string }> {
  const nieuweBedrag = zakelijkBedragVan(input.sub.bedrag_cent)
  const verschilCent = nieuweBedrag.brutoCent - input.sub.bedrag_cent
  if (verschilCent <= 0) return { fout: 'Er is geen verschil te corrigeren voor dit abonnement' }

  let controle: Awaited<ReturnType<typeof controleerStart>>
  try {
    controle = await controleerStart(input.sub)
  } catch (e) {
    Sentry.captureException(e, { tags: { onderdeel: 'klanttype-correctie-controle' } })
    return { fout: 'Dat lukt nu even niet. Probeer het later opnieuw.' }
  }
  if (!controle.ok) return { fout: controle.fout }

  const { data: rij, error } = await billingDb
    .from('arnobot_klanttype_correcties')
    .insert({
      user_id: input.userId,
      subscription_id: input.sub.id,
      verschil_cent: verschilCent,
      btw_cent: Math.max(0, nieuweBedrag.btwCent - input.payment.btw_cent),
      nieuw_bedrag_cent: nieuweBedrag.brutoCent,
      nieuw_btw_cent: nieuweBedrag.btwCent,
      plan: input.sub.plan,
      cyclus: input.sub.cyclus,
      bedrijfsnaam: input.bedrijfsnaam,
      kvk_nummer: input.kvkNummer,
      btw_nummer: input.btwNummer,
      straat: input.straat,
      postcode: input.postcode,
      plaats: input.plaats,
    })
    .select('id')
    .single<{ id: string }>()
  if (error || !rij) return { fout: 'Aanmaken van de correctie is niet gelukt' }

  try {
    const link = await maakBetaalLink({
      brutoCent: verschilCent,
      omschrijving: 'ArnoBot, correctie particulier naar zakelijk',
      redirectUrl: `${SITE_URL}/bot/account/zakelijk-corrigeren?betaling=terug`,
      webhookUrl: `${SITE_URL}/api/webhooks/mollie-correctie?r=${rij.id}`,
      idempotencyKey: `correctie-${rij.id}`,
      verlooptOp: controle.linkVerlooptOp,
    })
    const { error: linkFout } = await billingDb.from('arnobot_klanttype_correcties').update({ mollie_payment_id: link.id }).eq('id', rij.id)
    // Zonder opgeslagen link is een betaling nooit aan deze correctie te koppelen.
    if (linkFout) throw new Error(`betaallink niet opgeslagen: ${linkFout.message}`)
    return { checkoutUrl: link.url }
  } catch (e) {
    Sentry.captureException(e, { tags: { onderdeel: 'klanttype-correctie-start' } })
    return { fout: 'Betaling starten is niet gelukt, probeer het later opnieuw of mail admin@arno.bot' }
  }
}

/** Zo lang kijkt de billing-cron nog of een onbetaalde correctie toch betaald is (gemiste webhook). */
const NAKIJKEN_DAGEN = 14

/**
 * Dagelijks vangnet: rondt betaalde maar nog niet afgehandelde correcties af, haalt een gemiste webhook in en meldt
 * facturatie die zonder melding is afgebroken. Zonder de tabel (SQL nog niet uitgevoerd) gebeurt er niets.
 */
export async function rondOpenstaandeCorrectiesAf(nu: Date = new Date()): Promise<{ nagekeken: number; fouten: number }> {
  const uit = { nagekeken: 0, fouten: 0 }
  const { data, error } = await billingDb
    .from('arnobot_klanttype_correcties')
    .select('*')
    .is('afgehandeld_at', null)
    .not('mollie_payment_id', 'is', null)
    // Betaalde eerst ('paid' voor 'open'), zodat verlaten pogingen ze nooit verdringen.
    .order('status', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(100)
    .returns<KlanttypeCorrectieRow[]>()
  if (error) {
    if (!tabelOntbreekt(error)) throw new Error(`open correcties ophalen mislukt: ${error.message}`)
    return uit
  }
  const vers = nu.getTime() - NAKIJKEN_DAGEN * 24 * 60 * 60 * 1000
  for (const rij of (data ?? []).filter(r => r.status === 'paid' || Date.parse(r.created_at) > vers)) {
    try {
      uit.nagekeken++
      await verwerkKlanttypeCorrectie(rij.mollie_payment_id!, null)
    } catch (e) {
      uit.fouten++
      Sentry.captureException(e, { tags: { onderdeel: 'klanttype-correctie-inhalen' }, extra: { correctieId: rij.id } })
      if (rij.status === 'paid' && (await nieuwMelden(`klanttype:fout:${rij.id}`, 'waarschuwing'))) {
        await notifyTelegram(`Klanttype-correctie afronden mislukt op arno.bot\n\nUser: ${rij.user_id}\nFout: ${e instanceof Error ? e.message : e}`)
      }
    }
  }

  const { data: stil, error: stilFout } = await billingDb
    .from('arnobot_klanttype_correcties')
    .select('*')
    .not('afgehandeld_at', 'is', null)
    .is('handwerk_reden', null)
    .is('gefactureerd_at', null)
    .lt('afgehandeld_at', new Date(nu.getTime() - 60 * 60_000).toISOString())
    .limit(50)
    .returns<KlanttypeCorrectieRow[]>()
  if (stilFout) throw new Error(`correcties zonder facturatie ophalen mislukt: ${stilFout.message}`)
  for (const rij of stil ?? []) {
    if (await nieuwMelden(`klanttype:niet-gefactureerd:${rij.id}`, 'waarschuwing')) {
      await notifyTelegram(`Klanttype-correctie omgezet, facturatie niet bevestigd op arno.bot\n\nUser: ${rij.user_id}\nControleer creditnota en factuur in Moneybird en zet daarna gefactureerd_at op de correctie (${rij.id}).`)
    }
  }
  return uit
}
