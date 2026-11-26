import * as Sentry from '@sentry/nextjs'
import { billingDb, type PayRow } from './db'
import {
  MoneybirdError, boekTerugbetaling, creditBedragregel, creditMailTekst, haalFactuur, maakCreditConcept, moneybirdIngeschakeld,
  verstuurFactuur, zetCreditBedrag, zoekFacturenOpReferentie, type MbCreditfactuur,
} from './moneybird'
import { schakelaarAan } from './referralSchakelaars'
import type { ActieRij } from './referralTerugstorten'

// De creditnota bij een referralterugstorting: precies het teruggestorte bedrag, hervatbaar en nooit dubbel.
// Moneybird kent geen idempotentiesleutel. Daarom: het id van het concept wordt meteen bewaard, elke creditnota krijgt
// een eigen referentie waarop een hervatte run zoekt, en een creditnota op de factuur die we niet kunnen thuisbrengen
// (concept of verstuurd, ook een die de eigenaar zelf maakte) leidt tot een vraag in plaats van een tweede.
// Zolang een mens moet kijken blijft de actie op 'nodig': zij wordt elke ronde opnieuw beoordeeld en nooit vanzelf
// 'klaar'.

export type CreditnotaStap =
  | 'niet-nodig' | 'uit' | 'wacht-op-factuur' | 'geen-factuur-testmodus' | 'niet-geclaimd' | 'klaar'
  /** Er gaat niets meer uit tot een mens heeft gekeken. De reden staat in `fout` op de actie. */
  | 'handwerk'
  /** Een aanroep mislukte; de volgende ronde gaat verder waar deze bleef. */
  | 'mislukt'

const CLAIM_MINUTEN = 10

type Gegevens = ActieRij['gegevens'] & {
  /** Gezet vlak voor het mailen. */
  credit_mail_at?: string
  /** Gezet als Moneybird het mailen bevestigde. Staat alleen het eerste, dan is de uitkomst onbekend. */
  credit_mail_ok_at?: string
}
type Actie = ActieRij & { credit_id?: string | null; gegevens: Gegevens }

/**
 * 'ongedaan' hoort erbij: dan is het tegoed teruggegeven omdat de hele betaling is terugbetaald, maar ons deel van het
 * geld is wel verplaatst en moet nog gecrediteerd worden (de beheerder crediteert alleen het restant).
 */
export const CREDIT_ACTIESTATUSSEN = ['bevestigd', 'ongedaan']

/** De referentie staat op de creditnota. Per actie uniek, zodat twee uitkeringen op een betaling er elk een krijgen. */
export const creditReferentie = (betaalkenmerk: string, actieId: string) => `${betaalkenmerk}-R-${actieId.slice(0, 8)}`

/** Voor de eigenaar, in de Supabase SQL Editor: deze creditnota is geregeld, niets meer maken. */
export const creditAfboeken = (actieId: string) =>
  `update arnobot_referral_acties set credit_status = 'klaar', bezig_tot = null where id = '${actieId}';`

const cent = (bedrag: string) => Math.round(Number(bedrag) * 100)

class Handwerk extends Error {}

async function bewaar(a: Actie, patch: Partial<Actie>): Promise<void> {
  const { data, error } = await billingDb.from('arnobot_referral_acties')
    .update({ ...patch, updated_at: new Date().toISOString() }).eq('id', a.id).eq('status', a.status).select('id')
  if (error) throw new Error(`actie bijwerken mislukt: ${error.message}`)
  if (data?.length !== 1) throw new Error(`referralactie ${a.id} is intussen gewijzigd`)
  Object.assign(a, patch)
}

/**
 * Alleen wie de actie in de verwachte stand aantreft gaat verder. Een claim van een afgebroken run verloopt. Daarna telt
 * de rij zoals zij NU is: wie eerder las kan oude gegevens hebben (en zou dan bijvoorbeeld nog eens mailen).
 */
async function claim(a: Actie, nu: Date): Promise<boolean> {
  if (a.credit_status === 'bezig' && a.bezig_tot && Date.parse(a.bezig_tot) > nu.getTime()) return false
  const bezigTot = new Date(nu.getTime() + CLAIM_MINUTEN * 60 * 1000).toISOString()
  let vraag = billingDb.from('arnobot_referral_acties').update({ credit_status: 'bezig', bezig_tot: bezigTot })
    .eq('id', a.id).eq('status', a.status).eq('credit_status', a.credit_status)
  if (a.credit_status === 'bezig' && a.bezig_tot) vraag = vraag.eq('bezig_tot', a.bezig_tot)
  const { data, error } = await vraag.select('*')
  if (error) throw new Error(`creditnota claimen mislukt: ${error.message}`)
  if (data?.length !== 1) return false
  Object.assign(a, data[0] as Actie)
  return true
}

/**
 * Staat er op deze factuur een creditnota die nog de referentie van de factuur zelf heeft en niet bij een van onze
 * acties hoort? Dat kan een eigen concept van een afgebroken run zijn, of een creditnota die de eigenaar maakte. Dan
 * maken en versturen we niets. Niet te zien: een met de hand gemaakte creditnota waarvan de referentie is aangepast.
 */
async function eisGeenOnbekendeCredit(a: Actie, factuurId: string, betaalkenmerk: string): Promise<void> {
  const opFactuur = (await zoekFacturenOpReferentie(betaalkenmerk)).filter(f => f.original_sales_invoice_id === factuurId)
  if (!opFactuur.length) return
  const { data, error } = await billingDb.from('arnobot_referral_acties').select('id, credit_id').eq('doel_id', a.doel_id)
  if (error) throw new Error(`referralacties ophalen mislukt: ${error.message}`)
  const vanOns = new Set([a.credit_id, ...((data ?? []) as { credit_id: string | null }[]).map(r => r.credit_id)].filter(Boolean))
  const onbekend = opFactuur.filter(f => !vanOns.has(f.id))
  if (!onbekend.length) return
  const welke = onbekend.map(f => `${f.state === 'draft' ? 'concept' : 'verstuurd'} ${f.total_price_incl_tax}`).join(', ')
  throw new Handwerk(`op deze factuur staat al een creditnota die niet van deze uitkering te herkennen is (${welke}). `
    + 'Is het een concept: VERWIJDER het, verstuur het niet (het kan de hele factuur crediteren); de volgende ronde maakt dan zelf de juiste. '
    + `Is het een verstuurde creditnota: controleer of ${(a.bruto_cent / 100).toFixed(2)} euro van deze uitkering daarmee gecrediteerd is. `
    + `Zo niet, maak die creditnota dan zelf. Boek daarna af met: ${creditAfboeken(a.id)}`)
}

/** De creditnota van deze actie: de bewaarde, de teruggevondene of een nieuwe. */
async function zoekOfMaak(a: Actie, factuurId: string, betaalkenmerk: string): Promise<MbCreditfactuur> {
  if (a.credit_id) {
    try {
      return await haalFactuur(a.credit_id)
    } catch (e) {
      if (!(e instanceof MoneybirdError) || e.status !== 404) throw e
      // Verwijderd in Moneybird: dan bestaat zij niet meer en is er dus ook niets gemaild dat nog telt.
      const { credit_mail_at: _at, credit_mail_ok_at: _ok, ...rest } = a.gegevens
      await bewaar(a, { credit_id: null, gegevens: rest })
    }
  }
  const referentie = creditReferentie(betaalkenmerk, a.id)
  const eigen = (await zoekFacturenOpReferentie(referentie)).filter(f => f.original_sales_invoice_id === factuurId)
  if (eigen.length > 1) throw new Handwerk(`er zijn ${eigen.length} creditnota's met referentie ${referentie}`)
  if (eigen.length === 1) {
    await bewaar(a, { credit_id: eigen[0].id })
    return haalFactuur(eigen[0].id)
  }
  await eisGeenOnbekendeCredit(a, factuurId, betaalkenmerk)
  const nieuw = await maakCreditConcept(factuurId)
  await bewaar(a, { credit_id: nieuw.id })
  return nieuw
}

async function maak(a: Actie, betaling: PayRow, factuurId: string, nu: Date): Promise<void> {
  let credit = await zoekOfMaak(a, factuurId, betaling.mollie_payment_id)
  if (credit.state === 'draft') {
    // Ook bij hervatten: intussen kan er met de hand een creditnota bij zijn gekomen.
    await eisGeenOnbekendeCredit(a, factuurId, betaling.mollie_payment_id)
    const regelId = creditBedragregel(credit)
    if (!regelId) throw new Handwerk('de conceptcreditnota heeft niet precies een bedragregel')
    credit = await zetCreditBedrag(credit.id, { regelId, brutoCent: a.bruto_cent, referentie: creditReferentie(betaling.mollie_payment_id, a.id) })
  }
  // De laatste controle voor er iets de deur uit gaat.
  if (cent(credit.total_price_incl_tax) !== -a.bruto_cent) {
    throw new Handwerk(`de creditnota staat op ${credit.total_price_incl_tax} in plaats van ${(-a.bruto_cent / 100).toFixed(2)}`)
  }

  const { data: sub, error } = betaling.subscription_id
    ? await billingDb.from('arnobot_subscriptions').select('klant_type').eq('id', betaling.subscription_id).maybeSingle<{ klant_type: string }>()
    : { data: null, error: null }
  if (error) throw new Error(`abonnement ophalen mislukt: ${error.message}`)
  // Zoals bij elke creditnota: zakelijk per mail, particulier alleen in de administratie.
  const zakelijk = sub?.klant_type === 'zakelijk'
  const registreren = process.env.MONEYBIRD_BETALING_REGISTREREN === 'true'
  let concept = credit.state === 'draft'

  const onbekendeMail = () => new Handwerk(`niet zeker of de creditnota (${credit.total_price_incl_tax}) naar de klant is gemaild. `
    + `Kijk in Moneybird. Niet gemaild: verstuur haar daar. Daarna in beide gevallen afboeken met: ${creditAfboeken(a.id)}`)
  if (zakelijk && a.gegevens.credit_mail_at && !a.gegevens.credit_mail_ok_at) {
    // Staat zij nog als concept, dan is er zeker niets verstuurd en mag het opnieuw. Anders is het niet te weten.
    if (!concept) throw onbekendeMail()
    const { credit_mail_at: _weg, ...rest } = a.gegevens
    await bewaar(a, { gegevens: rest })
  }

  if (registreren) {
    if (concept) {
      await verstuurFactuur(credit.id, 'Manual')
      concept = false
    }
    const kenmerk = a.mollie_refund_id ?? a.id
    if (!credit.payments.some(p => p.transaction_identifier === kenmerk)) {
      await boekTerugbetaling(credit.id, { brutoCent: a.bruto_cent, betaaldOp: nu, kenmerk })
    }
  }
  if (zakelijk && !a.gegevens.credit_mail_ok_at) {
    const { data: gebruiker } = await billingDb.from('approved_users').select('voornaam').eq('user_id', a.user_id).maybeSingle<{ voornaam: string | null }>()
    // Eerst vastleggen: liever een vraag aan de eigenaar dan een klant die de mail twee keer krijgt.
    await bewaar(a, { gegevens: { ...a.gegevens, credit_mail_at: nu.toISOString() } })
    try {
      await verstuurFactuur(credit.id, 'Email', creditMailTekst(gebruiker?.voornaam))
    } catch (e) {
      // Een duidelijke weigering: er is niets verstuurd, de volgende ronde probeert het opnieuw.
      if (e instanceof MoneybirdError && e.status >= 400 && e.status < 500) {
        const { credit_mail_at: _weg, ...rest } = a.gegevens
        await bewaar(a, { gegevens: rest })
        throw e
      }
      throw onbekendeMail()
    }
    await bewaar(a, { gegevens: { ...a.gegevens, credit_mail_ok_at: nu.toISOString() } })
  } else if (concept) {
    await verstuurFactuur(credit.id, 'Manual')
  }
}

/** De referentie van de creditnota voor wat er na de referraluitkering(en) nog van een betaling terugging. */
export const restReferentie = (betaalkenmerk: string) => `${betaalkenmerk}-REST`

/**
 * Een betaling waarop al referralgeld zat wordt alsnog helemaal terugbetaald: de uitkeringen krijgen hun eigen
 * creditnota, hier wordt alleen het restant gecrediteerd. Opnieuw aanroepen maakt nooit een tweede: gezocht wordt op de
 * eigen referentie. Gooit met een leesbare reden als een mens het moet doen.
 */
export async function maakRestCreditnota(invoer: {
  factuurId: string; betaalkenmerk: string; brutoCent: number; zakelijk: boolean; voornaam?: string | null; nu?: Date
}): Promise<void> {
  const referentie = restReferentie(invoer.betaalkenmerk)
  const vanFactuur = (lijst: MbCreditfactuur[]) => lijst.filter(f => f.original_sales_invoice_id === invoer.factuurId)
  const eigen = vanFactuur(await zoekFacturenOpReferentie(referentie))
  if (eigen.length > 1) throw new Handwerk(`er zijn ${eigen.length} creditnota's met referentie ${referentie}`)
  if (eigen.length === 1 && eigen[0].state !== 'draft') return
  if (!eigen.length && vanFactuur(await zoekFacturenOpReferentie(invoer.betaalkenmerk)).length) {
    throw new Handwerk('op deze factuur staat al een creditnota die niet van de referral is: controleer wat er gecrediteerd is')
  }
  let credit = eigen.length ? await haalFactuur(eigen[0].id) : await maakCreditConcept(invoer.factuurId)
  const regelId = creditBedragregel(credit)
  if (!regelId) throw new Handwerk('de conceptcreditnota heeft niet precies een bedragregel')
  credit = await zetCreditBedrag(credit.id, { regelId, brutoCent: invoer.brutoCent, referentie })
  if (cent(credit.total_price_incl_tax) !== -invoer.brutoCent) {
    throw new Handwerk(`de creditnota staat op ${credit.total_price_incl_tax} in plaats van ${(-invoer.brutoCent / 100).toFixed(2)}`)
  }
  if (process.env.MONEYBIRD_BETALING_REGISTREREN === 'true') {
    await verstuurFactuur(credit.id, 'Manual')
    await boekTerugbetaling(credit.id, { brutoCent: invoer.brutoCent, betaaldOp: invoer.nu ?? new Date(), kenmerk: referentie })
    if (invoer.zakelijk) await verstuurFactuur(credit.id, 'Email', creditMailTekst(invoer.voornaam))
  } else {
    await verstuurFactuur(credit.id, invoer.zakelijk ? 'Email' : 'Manual', invoer.zakelijk ? creditMailTekst(invoer.voornaam) : undefined)
  }
}

const teDoen = (a: Pick<ActieRij, 'status' | 'credit_status'>) =>
  CREDIT_ACTIESTATUSSEN.includes(a.status) && (a.credit_status === 'nodig' || a.credit_status === 'bezig')

export async function creditnotaStap(actie: ActieRij, nu: Date = new Date()): Promise<CreditnotaStap> {
  const a = { ...actie } as Actie
  if (!teDoen(a)) return 'niet-nodig'
  if (!schakelaarAan('REFERRAL_CREDITNOTA') || !moneybirdIngeschakeld()) return 'uit'
  const { data: betaling, error } = await billingDb.from('arnobot_payments').select('*').eq('id', a.doel_id).eq('user_id', a.user_id).maybeSingle<PayRow>()
  if (error) throw new Error(`betaling ophalen mislukt: ${error.message}`)
  const factuurId = betaling?.moneybird_factuur_id
  if (!betaling || !factuurId || factuurId === 'bezig') return 'wacht-op-factuur'
  if (factuurId === 'testmodus') {
    await bewaar(a, { credit_status: 'nvt' })
    return 'geen-factuur-testmodus'
  }
  if (!(await claim(a, nu))) return 'niet-geclaimd'
  // Na het claimen telt de verse rij: een andere run kan haar intussen hebben afgemaakt.
  if (!teDoen(a)) return 'niet-nodig'
  try {
    await maak(a, betaling, factuurId, nu)
    await bewaar(a, { credit_status: 'klaar', bezig_tot: null, fout: null })
    return 'klaar'
  } catch (e) {
    const reden = e instanceof Error ? e.message : String(e)
    if (!(e instanceof Handwerk)) Sentry.captureException(e, { tags: { onderdeel: 'referral-creditnota' }, extra: { actie: a.id } })
    await bewaar(a, { credit_status: 'nodig', bezig_tot: null, fout: `creditnota: ${reden}` })
    Object.assign(actie, { fout: a.fout, credit_status: a.credit_status })
    return e instanceof Handwerk ? 'handwerk' : 'mislukt'
  }
}
