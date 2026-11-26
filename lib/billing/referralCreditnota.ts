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
// een eigen referentie waarop een hervatte run zoekt, en een concept dat we niet kunnen thuisbrengen leidt tot een
// vraag aan de eigenaar in plaats van een tweede creditnota.

export type CreditnotaStap =
  | 'niet-nodig' | 'uit' | 'wacht-op-factuur' | 'geen-factuur-testmodus' | 'niet-geclaimd' | 'klaar'
  /** Er is niets verstuurd dat niet klopt; een mens moet kijken. De reden staat in `fout` op de actie. */
  | 'handwerk'
  /** Een aanroep mislukte; de volgende ronde gaat verder waar deze bleef. */
  | 'mislukt'

const CLAIM_MINUTEN = 10

type Gegevens = ActieRij['gegevens'] & { credit_mail_at?: string }
type Actie = ActieRij & { credit_id?: string | null; gegevens: Gegevens }

/** De referentie staat op de creditnota. Per actie uniek, zodat twee uitkeringen op een betaling er elk een krijgen. */
export const creditReferentie = (betaalkenmerk: string, actieId: string) => `${betaalkenmerk}-R-${actieId.slice(0, 8)}`

const cent = (bedrag: string) => Math.round(Number(bedrag) * 100)

class Handwerk extends Error {}

async function bewaar(a: Actie, patch: Partial<Actie>): Promise<void> {
  const { data, error } = await billingDb.from('arnobot_referral_acties')
    .update({ ...patch, updated_at: new Date().toISOString() }).eq('id', a.id).eq('status', 'bevestigd').select('id')
  if (error) throw new Error(`actie bijwerken mislukt: ${error.message}`)
  if (data?.length !== 1) throw new Error(`referralactie ${a.id} is intussen gewijzigd`)
  Object.assign(a, patch)
}

/** Alleen wie de actie in de verwachte stand aantreft gaat verder. Een claim van een afgebroken run verloopt. */
async function claim(a: Actie, nu: Date): Promise<boolean> {
  if (a.credit_status === 'bezig' && a.bezig_tot && Date.parse(a.bezig_tot) > nu.getTime()) return false
  const bezigTot = new Date(nu.getTime() + CLAIM_MINUTEN * 60 * 1000).toISOString()
  let vraag = billingDb.from('arnobot_referral_acties').update({ credit_status: 'bezig', bezig_tot: bezigTot })
    .eq('id', a.id).eq('status', 'bevestigd').eq('credit_status', a.credit_status)
  if (a.credit_status === 'bezig' && a.bezig_tot) vraag = vraag.eq('bezig_tot', a.bezig_tot)
  const { data, error } = await vraag.select('id')
  if (error) throw new Error(`creditnota claimen mislukt: ${error.message}`)
  if (data?.length !== 1) return false
  Object.assign(a, { credit_status: 'bezig', bezig_tot: bezigTot })
  return true
}

/** De creditnota van deze actie: de bewaarde, de teruggevondene of een nieuwe. */
async function zoekOfMaak(a: Actie, factuurId: string, betaalkenmerk: string): Promise<MbCreditfactuur> {
  if (a.credit_id) return haalFactuur(a.credit_id)
  const referentie = creditReferentie(betaalkenmerk, a.id)
  const eigen = (await zoekFacturenOpReferentie(referentie)).filter(f => f.original_sales_invoice_id === factuurId)
  if (eigen.length > 1) throw new Handwerk(`er zijn ${eigen.length} creditnota's met referentie ${referentie}`)
  if (eigen.length === 1) {
    await bewaar(a, { credit_id: eigen[0].id })
    return haalFactuur(eigen[0].id)
  }
  // Brak een vorige run af tussen aanmaken en bewaren, dan staat er een concept met de referentie van de factuur zelf.
  // Of dat van ons is, is niet zeker (de eigenaar kan het zelf gemaakt hebben): niets overnemen en niets bijmaken.
  const onbekend = (await zoekFacturenOpReferentie(betaalkenmerk))
    .filter(f => f.original_sales_invoice_id === factuurId && f.state === 'draft')
  if (onbekend.length) throw new Handwerk('op deze factuur staat al een conceptcreditnota die niet van deze uitkering te herkennen is: verwijder of verstuur dat concept in Moneybird')
  const nieuw = await maakCreditConcept(factuurId)
  await bewaar(a, { credit_id: nieuw.id })
  return nieuw
}

async function maak(a: Actie, betaling: PayRow, factuurId: string, nu: Date): Promise<void> {
  let credit = await zoekOfMaak(a, factuurId, betaling.mollie_payment_id)
  if (credit.state === 'draft') {
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
  const mailen = sub?.klant_type === 'zakelijk' && !a.gegevens.credit_mail_at
  const registreren = process.env.MONEYBIRD_BETALING_REGISTREREN === 'true'
  let concept = credit.state === 'draft'

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
  if (mailen) {
    const { data: gebruiker } = await billingDb.from('approved_users').select('voornaam').eq('user_id', a.user_id).maybeSingle<{ voornaam: string | null }>()
    // Eerst vastleggen: liever een gemiste mail (met melding) dan een klant die hem twee keer krijgt.
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
      throw new Handwerk(`niet zeker of de creditnota gemaild is: kijk in Moneybird (${e instanceof Error ? e.message : e})`)
    }
  } else if (concept) {
    await verstuurFactuur(credit.id, 'Manual')
  }
}

export async function creditnotaStap(actie: ActieRij, nu: Date = new Date()): Promise<CreditnotaStap> {
  const a = actie as Actie
  if (a.status !== 'bevestigd' || (a.credit_status !== 'nodig' && a.credit_status !== 'bezig')) return 'niet-nodig'
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
  try {
    await maak(a, betaling, factuurId, nu)
    await bewaar(a, { credit_status: 'klaar', bezig_tot: null, fout: null })
    return 'klaar'
  } catch (e) {
    const reden = e instanceof Error ? e.message : String(e)
    if (!(e instanceof Handwerk)) Sentry.captureException(e, { tags: { onderdeel: 'referral-creditnota' }, extra: { actie: a.id } })
    await bewaar(a, { credit_status: 'nodig', bezig_tot: null, fout: `creditnota: ${reden}` })
    return e instanceof Handwerk ? 'handwerk' : 'mislukt'
  }
}
