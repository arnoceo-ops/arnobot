/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from 'vitest'

// PROEF: lukt in Moneybird een creditnota voor een heel bedrag en voor een deelbedrag (bouwplan A12)? Uitsluitend in de
// sandbox-administratie arnobot-test. Er wordt niets gemaild. Draait niet in de gewone testrun:
//   RUN_LIVE_CREDITNOTA=true node --env-file=.env.testomgeving node_modules/vitest/vitest.mjs run lib/billing/referralCreditnota.moneybird.live.test.ts
const SANDBOX = '504881921344406716'
const meld = (stap: string, uitkomst: unknown) => console.log(`CREDIT ${stap}: ${JSON.stringify(uitkomst)}`)

/** Gooit voordat er iets bij Moneybird gebeurt. Pas daarna krijgt de app-code de sandboxsleutel. */
async function eisSandbox(): Promise<void> {
  if (process.env.MONEYBIRD_API_TOKEN || process.env.MONEYBIRD_ADMINISTRATION_ID) throw new Error('STOP: er zijn gewone Moneybird-instellingen geladen.')
  if (process.env.MONEYBIRD_TEST_ADMINISTRATION_ID !== SANDBOX) throw new Error('STOP: dit is niet de sandbox arnobot-test.')
  const token = process.env.MONEYBIRD_TEST_API_TOKEN
  if (!token) throw new Error('STOP: geen sandboxsleutel.')
  const r = await fetch('https://moneybird.com/api/v2/administrations.json', { headers: { Authorization: `Bearer ${token}` } })
  const lijst = (await r.json()) as { id: string }[]
  if (!Array.isArray(lijst) || lijst.length !== 1 || String(lijst[0].id) !== SANDBOX) throw new Error('STOP: de sleutel kan niet uitsluitend bij de sandbox.')
  process.env.MONEYBIRD_API_TOKEN = token
  process.env.MONEYBIRD_ADMINISTRATION_ID = SANDBOX
}

describe.skipIf(process.env.RUN_LIVE_CREDITNOTA !== 'true')('proef: creditnota in de Moneybird-sandbox', () => {
  it('hele bedrag en deelbedrag, tot op de cent', { timeout: 300_000 }, async () => {
    await eisSandbox()
    const mb = await import('./moneybird')
    const api = async (pad: string, init?: { method: string; body?: unknown }) => {
      const r = await fetch(`https://moneybird.com/api/v2/${SANDBOX}${pad}`, {
        method: init?.method ?? 'GET',
        headers: { Authorization: `Bearer ${process.env.MONEYBIRD_API_TOKEN}`, 'Content-Type': 'application/json' },
        body: init?.body ? JSON.stringify(init.body) : undefined,
      })
      const tekst = await r.text()
      let json: any = null
      try { json = tekst ? JSON.parse(tekst) : null } catch { /* geen JSON */ }
      return { status: r.status, json, tekst: tekst.slice(0, 300) }
    }
    const beeld = async (id: string) => {
      const f = (await api(`/sales_invoices/${id}.json`)).json
      return {
        nummer: f.invoice_id, status: f.state, incl: f.total_price_incl_tax, excl: f.total_price_excl_tax,
        openstaand: f.total_unpaid, regels: f.details.map((d: any) => ({ aantal: d.amount, prijs: d.price })),
        betalingen: f.payments.map((p: any) => p.price), referentie: f.reference,
      }
    }

    const merk = Date.now().toString(36)
    const contactId = await mb.zoekOfMaakContact({ userId: `user_keten_credit_${merk}`, email: 'test@arno.bot', naam: 'Proef Klant', particulier: true })
    const tarief = await mb.btwTariefId()
    const grootboek = await mb.omzetGrootboekId()

    const betaaldeFactuur = async (label: string, brutoCent: number) => {
      const nu = new Date()
      const einde = new Date(nu.getTime() + 30 * 24 * 60 * 60 * 1000)
      const { id } = await mb.maakConceptFactuur({
        contactId, referentie: `tr_proef${label}${merk}`, omschrijving: `Proef ${label}`, periodeStart: nu, periodeEinde: einde, factuurDatum: nu,
        brutoCent, nettoCent: Math.round(brutoCent / 1.21), inclusiefBtw: true, taxRateId: tarief, ledgerAccountId: grootboek,
      })
      await mb.verstuurFactuur(id, 'Manual')
      await mb.registreerBetaling({ factuurId: id, betaaldOp: nu, brutoCent, mollieId: `tr_proef${label}${merk}` })
      return id
    }

    // 1. Het hele bedrag, met de bestaande functie van de app.
    const heel = await betaaldeFactuur('maand', 2900)
    meld('1 factuur', await beeld(heel))
    const creditHeel = await mb.maakCreditnota(heel, { terugbetalingRegistreren: true, brutoCent: 2900, betaaldOp: new Date(), mollieId: `re_heel${merk}`, mailen: false })
    const beeldHeel = await beeld(creditHeel.id)
    meld('2 creditnota heel', beeldHeel)
    expect(beeldHeel.incl).toBe('-29.0')

    // 2. Een deelbedrag: de jaarkorting van 19,00 op een jaarfactuur van 228,00.
    const jaar = await betaaldeFactuur('jaar', 22800)
    const dup = await api(`/sales_invoices/${jaar}/duplicate_creditinvoice.json`, { method: 'PATCH', body: {} })
    meld('3 concept', { http: dup.status, ...(await beeld(dup.json.id)) })
    const regel = (await api(`/sales_invoices/${dup.json.id}.json`)).json.details[0]
    // Het teken staat in de prijs of in het aantal: volg wat Moneybird zelf deed.
    const prijs = String(regel.price).startsWith('-') ? '-19.00' : '19.00'
    const wijzig = await api(`/sales_invoices/${dup.json.id}.json`, { method: 'PATCH', body: { sales_invoice: { details_attributes: [{ id: regel.id, price: prijs }] } } })
    meld('4 regel aangepast', { http: wijzig.status, fout: wijzig.status >= 300 ? wijzig.tekst : null, ...(await beeld(dup.json.id)) })
    await mb.verstuurFactuur(dup.json.id, 'Manual')
    const betaling = await api(`/sales_invoices/${dup.json.id}/payments.json`, {
      method: 'POST',
      body: { payment: { payment_date: new Date().toISOString().slice(0, 10), price: '-19.00', transaction_identifier: `re_deel${merk}`, manual_payment_action: 'payment_without_proof' } },
    })
    meld('5 terugbetaling geboekt', { http: betaling.status, fout: betaling.status >= 300 ? betaling.tekst : null })
    meld('6 creditnota deel', await beeld(dup.json.id))
    meld('7 oorspronkelijke factuur', await beeld(jaar))

    // 3. Kan een hervatte run een eerder gemaakte creditnota terugvinden?
    for (const filter of [`reference:tr_proefjaar${merk}`]) {
      const z = await api(`/sales_invoices.json?filter=${encodeURIComponent(filter)}`)
      meld('8 zoeken op referentie', { filter, http: z.status, aantal: Array.isArray(z.json) ? z.json.length : null, treffers: Array.isArray(z.json) ? z.json.map((x: any) => `${x.invoice_id} ${x.total_price_incl_tax} ${x.reference}`) : z.tekst })
    }
  })
})
