// Dunne Moneybird-client (rauwe fetch, geen SDK) voor facturen bij Mollie-betalingen.
// Specificatie: https://github.com/moneybird/openapi (openapi.yml) en
// https://developer.moneybird.com/integration/creating-sales-invoices
//
// VOORBEREIDING: nog nooit tegen een echt Moneybird-account gedraaid. Alles staat uit zolang
// MONEYBIRD_API_TOKEN en MONEYBIRD_ADMINISTRATION_ID ontbreken. Zie docs/MOLLIE_PLAN.md, fase 2.

import { BEDRIJF } from '@/lib/bedrijf'

export function moneybirdIngeschakeld(): boolean {
  return !!process.env.MONEYBIRD_API_TOKEN && !!process.env.MONEYBIRD_ADMINISTRATION_ID
}

export class MoneybirdError extends Error {
  status: number
  constructor(status: number, detail: string) {
    super(`Moneybird ${status}: ${detail}`)
    this.status = status
  }
}

async function mb<T>(
  pad: string,
  init: { method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'; body?: unknown } = {},
): Promise<T> {
  const token = process.env.MONEYBIRD_API_TOKEN
  const admin = process.env.MONEYBIRD_ADMINISTRATION_ID
  if (!token || !admin) throw new MoneybirdError(0, 'Moneybird is niet geconfigureerd')
  const res = await fetch(`https://moneybird.com/api/v2/${admin}${pad}`, {
    method: init.method ?? 'GET',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    signal: AbortSignal.timeout(15000),
  })
  if (res.status === 204) return undefined as T
  const text = await res.text()
  if (!res.ok) throw new MoneybirdError(res.status, text.slice(0, 300))
  return (text ? JSON.parse(text) : null) as T
}

// ---------------------------------------------------------------------------
// Pure bouwstenen (gedekt door unit tests)
// ---------------------------------------------------------------------------

export interface FactuurKlant {
  /** Onze eigen gebruikers-id, opgeslagen als customer_id zodat we het contact terugvinden. */
  userId: string
  email: string
  /** Volledige naam van de persoon. */
  naam: string
  bedrijfsnaam?: string | null
  kvk?: string | null
  btw?: string | null
  adres?: { straat: string; postcode: string; plaats: string } | null
}

export function bouwContactBody(k: FactuurKlant) {
  const delen = k.naam.trim().split(/\s+/)
  const voornaam = delen[0] ?? ''
  const achternaam = delen.slice(1).join(' ')
  return {
    contact: {
      customer_id: k.userId,
      ...(k.bedrijfsnaam ? { company_name: k.bedrijfsnaam } : {}),
      firstname: voornaam,
      lastname: achternaam,
      email: k.email,
      send_invoices_to_email: k.email,
      country: 'NL',
      ...(k.adres ? { address1: k.adres.straat, zipcode: k.adres.postcode, city: k.adres.plaats } : {}),
      ...(k.btw ? { tax_number: k.btw } : {}),
      ...(k.kvk ? { chamber_of_commerce: k.kvk } : {}),
    },
  }
}

export interface FactuurInput {
  contactId: string
  /** Betaalreferentie, zichtbaar voor de klant (Mollie-betaal-id). */
  referentie: string
  omschrijving: string
  /** Betaalde periode, voor het uitsmeren van de omzet (jaarbetaling). */
  periodeStart: Date
  periodeEinde: Date
  factuurDatum: Date
  brutoCent: number
  nettoCent: number
  /** Particulier: prijs is inclusief btw. Zakelijk: prijs is exclusief btw. */
  inclusiefBtw: boolean
  taxRateId: string
  ledgerAccountId?: string
  /** Eigen workflow zonder betalingsherinneringen (de factuur is al betaald via Mollie). */
  workflowId?: string
}

const ymd = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, '')
const dateOnly = (d: Date) => d.toISOString().slice(0, 10)
const euro = (cent: number) => (cent / 100).toFixed(2)

export function bouwFactuurBody(f: FactuurInput) {
  return {
    sales_invoice: {
      contact_id: f.contactId,
      ...(f.workflowId ? { workflow_id: f.workflowId } : {}),
      reference: f.referentie,
      invoice_date: dateOnly(f.factuurDatum),
      // Al betaald via Mollie: geen betaaltermijn.
      first_due_interval: 0,
      currency: 'EUR',
      prices_are_incl_tax: f.inclusiefBtw,
      details_attributes: [
        {
          description: f.omschrijving,
          price: euro(f.inclusiefBtw ? f.brutoCent : f.nettoCent),
          amount: 1,
          period: `${ymd(f.periodeStart)}..${ymd(f.periodeEinde)}`,
          tax_rate_id: f.taxRateId,
          ...(f.ledgerAccountId ? { ledger_account_id: f.ledgerAccountId } : {}),
        },
      ],
    },
  }
}

// ---------------------------------------------------------------------------
// API-aanroepen
// ---------------------------------------------------------------------------

interface MbContact { id: string }
interface MbInvoice { id: string; invoice_id?: string | null; state?: string }
interface MbTaxRate { id: string; percentage: string }

/** Zoekt het contact op onze eigen gebruikers-id, of maakt het aan. */
export async function zoekOfMaakContact(k: FactuurKlant): Promise<string> {
  try {
    const bestaand = await mb<MbContact>(`/contacts/customer_id/${encodeURIComponent(k.userId)}.json`)
    // Gegevens kunnen sinds de vorige betaling zijn veranderd (adres, bedrijf): bijwerken.
    if (k.adres || k.bedrijfsnaam) {
      await mb(`/contacts/${bestaand.id}.json`, { method: 'PATCH', body: bouwContactBody(k) })
    }
    return bestaand.id
  } catch (e) {
    if (!(e instanceof MoneybirdError) || e.status !== 404) throw e
  }
  const nieuw = await mb<MbContact>('/contacts.json', { method: 'POST', body: bouwContactBody(k) })
  return nieuw.id
}

let tariefCache: string | null = null

/** Het 21%-tarief voor verkoopfacturen, uit env of opgezocht bij Moneybird. */
export async function btwTariefId(): Promise<string> {
  if (process.env.MONEYBIRD_TAX_RATE_ID) return process.env.MONEYBIRD_TAX_RATE_ID
  if (tariefCache) return tariefCache
  const lijst = await mb<MbTaxRate[]>('/tax_rates.json?filter=' + encodeURIComponent('percentage:21,tax_rate_type:sales_invoice,active:true'))
  const gevonden = lijst.find(t => Number(t.percentage) === 21)
  if (!gevonden) throw new MoneybirdError(404, 'Geen 21% btw-tarief voor verkoopfacturen gevonden')
  tariefCache = gevonden.id
  return gevonden.id
}

/** Maakt de factuur aan als concept. */
export async function maakConceptFactuur(f: FactuurInput): Promise<{ id: string }> {
  const factuur = await mb<MbInvoice>('/sales_invoices.json', { method: 'POST', body: bouwFactuurBody(f) })
  return { id: factuur.id }
}

/**
 * Verstuurt de factuur. 'Email' mailt hem naar de klant, 'Manual' zet hem alleen op "open"
 * zonder mail (nodig om er een betaling op te kunnen registreren voordat de klant hem ziet).
 */
export async function verstuurFactuur(
  id: string,
  methode: 'Email' | 'Manual',
  emailBericht?: string,
): Promise<{ factuurnummer: string | null }> {
  const v = await mb<MbInvoice>(`/sales_invoices/${id}/send_invoice.json`, {
    method: 'PATCH',
    body: { sales_invoice_sending: { delivery_method: methode, ...(emailBericht ? { email_message: emailBericht } : {}) } },
  })
  return { factuurnummer: v.invoice_id ?? null }
}

/** Betaling op de factuur registreren (de nieuwe endpoint, de oude register_payment vervalt eind 2026). */
export async function registreerBetaling(input: {
  factuurId: string
  betaaldOp: Date
  brutoCent: number
  mollieId: string
}): Promise<void> {
  await mb(`/sales_invoices/${input.factuurId}/payments.json`, {
    method: 'POST',
    body: {
      payment: {
        payment_date: dateOnly(input.betaaldOp),
        price: euro(input.brutoCent),
        transaction_identifier: input.mollieId,
        manual_payment_action: 'payment_without_proof',
      },
    },
  })
}

const CREDIT_VOORWAARDEN = `Dit bedrag is teruggestort naar de rekening waarmee je betaalde. Het kan een paar werkdagen duren voordat het bedrag op je rekening is bijgeschreven. Vragen? Mail naar ${BEDRIJF.emailFacturen}.`

/**
 * De aanhef zetten we zelf in de mail: bij een zakelijk contact vult de Moneybird-tag de
 * bedrijfsnaam in ("Hey Acme B.V."), terwijl we de voornaam van de gebruiker wel kennen.
 * Accolades eruit, zodat een naam nooit een Moneybird-tag kan worden.
 */
function aanhef(voornaam?: string | null): string {
  const schoon = (voornaam ?? '').replace(/[{}\n\r]/g, '').trim()
  return schoon ? `Hey ${schoon},` : ''
}

export function factuurMailTekst(voornaam?: string | null): string {
  return [
    ...(aanhef(voornaam) ? [aanhef(voornaam), ''] : []),
    'In de bijlage vind je factuur {document.invoice_id} voor je ArnoBot-abonnement. Deze is al betaald, je hoeft niets over te maken.',
    '',
    `Vragen? Mail naar ${BEDRIJF.emailFacturen}.`,
    '',
    'Groet,',
    'ArnoBot',
  ].join('\n')
}

export function creditMailTekst(voornaam?: string | null): string {
  return [
    ...(aanhef(voornaam) ? [aanhef(voornaam), ''] : []),
    'In de bijlage vind je creditfactuur {document.invoice_id} voor je terugbetaling. Het bedrag is teruggestort naar de rekening waarmee je betaalde. Het kan een paar werkdagen duren voordat het bedrag op je rekening is bijgeschreven.',
    '',
    `Vragen? Mail naar ${BEDRIJF.emailFacturen}.`,
    '',
    'Groet,',
    'ArnoBot',
  ].join('\n')
}

/**
 * Creditnota voor een eerder gemaakte factuur (bij terugbetaling). Mét `terugbetalingRegistreren`
 * wordt de creditnota eerst op "open" gezet zonder mail, dan de terugstorting (negatieve
 * betaling) erop geregistreerd en pas daarna gemaild, zodat hij op betaald staat.
 * De "verrekenen met de originele factuur"-stap werkt niet als de originele factuur al is betaald.
 */
export async function maakCreditnota(
  factuurId: string,
  opties: { terugbetalingRegistreren: boolean; brutoCent: number; betaaldOp: Date; mollieId: string; voornaam?: string | null; mailen: boolean },
): Promise<{ id: string }> {
  const credit = await mb<MbInvoice>(`/sales_invoices/${factuurId}/duplicate_creditinvoice.json`, { method: 'PATCH', body: {} })
  // De tekst uit de workflow zegt "al betaald, je hoeft niets over te maken", dat klopt niet voor een
  // terugbetaling. Het concept is nog aan te passen voordat het wordt verstuurd.
  await mb(`/sales_invoices/${credit.id}.json`, {
    method: 'PATCH',
    body: { sales_invoice: { payment_conditions: CREDIT_VOORWAARDEN } },
  })
  if (opties.terugbetalingRegistreren) {
    await verstuurFactuur(credit.id, 'Manual')
    await mb(`/sales_invoices/${credit.id}/payments.json`, {
      method: 'POST',
      body: {
        payment: {
          payment_date: dateOnly(opties.betaaldOp),
          price: `-${euro(opties.brutoCent)}`,
          transaction_identifier: opties.mollieId,
          manual_payment_action: 'payment_without_proof',
        },
      },
    })
  }
  // Particulieren krijgen een betaalbevestiging van ArnoBot, geen gemailde creditfactuur: dan alleen
  // op "open" zetten (voor de administratie), zonder mail.
  if (opties.mailen) await verstuurFactuur(credit.id, 'Email', creditMailTekst(opties.voornaam))
  else if (!opties.terugbetalingRegistreren) await verstuurFactuur(credit.id, 'Manual')
  return { id: credit.id }
}
