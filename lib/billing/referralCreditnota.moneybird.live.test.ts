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

describe.skipIf(process.env.RUN_LIVE_CREDITNOTA !== 'true')('proef: de echte creditnotastap met testdatabase en sandbox', () => {
  it('maakt precies een creditnota, ook na een verloren kenmerk', { timeout: 300_000 }, async () => {
    if (process.env.NEXT_PUBLIC_SUPABASE_URL !== 'https://slvrlofthwmoyoyxfqbi.supabase.co') throw new Error('STOP: dit is niet de testdatabase.')
    await eisSandbox()
    process.env.REFERRAL_CREDITNOTA = 'true'
    const mb = await import('./moneybird')
    const { billingDb } = await import('./db')
    const { creditnotaStap } = await import('./referralCreditnota')

    // Een bevestigde uitkering uit de ketenproef.
    const { data: acties, error } = await billingDb.from('arnobot_referral_acties').select('*').eq('status', 'bevestigd').order('created_at').limit(1)
    if (error) throw new Error(error.message)
    expect(acties).toHaveLength(1)
    const actieId = acties![0].id as string
    const betaling = (await billingDb.from('arnobot_payments').select('*').eq('id', acties![0].doel_id).single()).data as any

    const merk = Date.now().toString(36)
    const contactId = await mb.zoekOfMaakContact({ userId: `user_keten_stap_${merk}`, email: 'test@arno.bot', naam: 'Proef Stap', particulier: true })
    const nu = new Date()
    const { id: factuurId } = await mb.maakConceptFactuur({
      contactId, referentie: betaling.mollie_payment_id, omschrijving: 'Proef creditnotastap', periodeStart: nu, periodeEinde: new Date(nu.getTime() + 30 * 24 * 60 * 60 * 1000),
      factuurDatum: nu, brutoCent: betaling.bedrag_cent, nettoCent: betaling.bedrag_cent - betaling.btw_cent, inclusiefBtw: true,
      taxRateId: await mb.btwTariefId(), ledgerAccountId: await mb.omzetGrootboekId(),
    })
    await mb.verstuurFactuur(factuurId, 'Manual')
    await billingDb.from('arnobot_payments').update({ moneybird_factuur_id: factuurId }).eq('id', betaling.id)

    const zetOpNodig = () => billingDb.from('arnobot_referral_acties').update({ credit_status: 'nodig', credit_id: null, bezig_tot: null, fout: null }).eq('id', actieId)
    const lees = async () => (await billingDb.from('arnobot_referral_acties').select('*').eq('id', actieId).single()).data as any
    await zetOpNodig()

    const eerste = await creditnotaStap(await lees())
    const na = await lees()
    expect(eerste, na.fout ?? '').toBe('klaar')
    const credit = await mb.haalFactuur(na.credit_id)
    meld('stap 1', { uitkomst: eerste, bedrag: credit.total_price_incl_tax, status: credit.state, referentie: credit.reference })
    expect(Math.round(Number(credit.total_price_incl_tax) * 100)).toBe(-na.bruto_cent)

    // Storing: het kenmerk is niet bewaard. De volgende ronde moet dezelfde creditnota terugvinden.
    await zetOpNodig()
    const tweede = await creditnotaStap(await lees())
    const na2 = await lees()
    const alle = (await mb.zoekFacturenOpReferentie(credit.reference!)).filter(f => f.original_sales_invoice_id === factuurId)
    meld('stap 2 na verloren kenmerk', { uitkomst: tweede, zelfde: na2.credit_id === na.credit_id, aantalCreditnotas: alle.length, fout: na2.fout })
    expect(tweede).toBe('klaar')
    expect(na2.credit_id).toBe(na.credit_id)
    expect(alle).toHaveLength(1)
  })
})

describe.skipIf(process.env.RUN_LIVE_CREDITNOTA !== 'true')('proef: zakelijke deelcreditnota en terugvinden', () => {
  it('prijzen exclusief of inclusief btw op de creditnota, en zoeken op een eigen kenmerk', { timeout: 300_000 }, async () => {
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
    const merk = Date.now().toString(36)
    const contactId = await mb.zoekOfMaakContact({ userId: `user_keten_zakelijk_${merk}`, email: 'test@arno.bot', naam: 'Proef Zakelijk', bedrijfsnaam: 'Proefbedrijf' })
    const nu = new Date()
    const { id } = await mb.maakConceptFactuur({
      contactId, referentie: `tr_proefzak${merk}`, omschrijving: 'Proef zakelijk jaar', periodeStart: nu, periodeEinde: new Date(nu.getTime() + 365 * 24 * 60 * 60 * 1000),
      factuurDatum: nu, brutoCent: 27588, nettoCent: 22800, inclusiefBtw: false, taxRateId: await mb.btwTariefId(), ledgerAccountId: await mb.omzetGrootboekId(),
    })
    await mb.verstuurFactuur(id, 'Manual')

    // Bedragen die voorkomen (jaarkorting, tegoed) en bedragen die niet als "netto maal 1,21" bestaan (1,00 en 10,00).
    const uitkomsten: Record<string, unknown>[] = []
    for (const [manier, bruto] of [['excl', 2299], ['excl', 100], ['incl', 2299], ['incl', 100], ['incl', 1000], ['incl', 2900], ['incl', 1]] as const) {
      const dup = await api(`/sales_invoices/${id}/duplicate_creditinvoice.json`, { method: 'PATCH', body: {} })
      const regel = dup.json.details.filter((d: any) => Number(d.amount) === -1)[0]
      const prijs = ((manier === 'excl' ? Math.round(bruto / 1.21) : bruto) / 100).toFixed(2)
      const r = await api(`/sales_invoices/${dup.json.id}.json`, {
        method: 'PATCH',
        body: { sales_invoice: { ...(manier === 'incl' ? { prices_are_incl_tax: true } : {}), details_attributes: [{ id: regel.id, price: prijs }] } },
      })
      const f = (await api(`/sales_invoices/${dup.json.id}.json`)).json
      uitkomsten.push({ manier, gevraagd: -bruto / 100, kreeg: Number(f.total_price_incl_tax), excl: Number(f.total_price_excl_tax), http: r.status, status: f.state })
      await api(`/sales_invoices/${dup.json.id}.json`, { method: 'DELETE' })
    }
    meld('zakelijk', uitkomsten)

    // Terugvinden: een concept met een eigen kenmerk in de referentie, voor en na het op open zetten.
    const eigen = `ref-actie-${merk}`
    const dup = await api(`/sales_invoices/${id}/duplicate_creditinvoice.json`, { method: 'PATCH', body: {} })
    const zoek = async (waarop: string) => {
      const z = await api(`/sales_invoices.json?filter=${encodeURIComponent(`reference:${waarop}`)}`)
      return Array.isArray(z.json) ? z.json.map((x: any) => `${x.id === dup.json.id ? 'creditnota' : x.id === id ? 'origineel' : 'ander'} ${x.state} ${x.total_price_incl_tax}`) : z.tekst
    }
    meld('zoeken concept op oude referentie', await zoek(`tr_proefzak${merk}`))
    await api(`/sales_invoices/${dup.json.id}.json`, { method: 'PATCH', body: { sales_invoice: { reference: `tr_proefzak${merk} ${eigen}` } } })
    meld('zoeken concept op eigen kenmerk', await zoek(eigen))
    meld('zoeken concept op hele nieuwe referentie', await zoek(`tr_proefzak${merk} ${eigen}`))
    await api(`/sales_invoices/${dup.json.id}.json`, { method: 'PATCH', body: { sales_invoice: { reference: eigen } } })
    meld('zoeken concept, referentie is alleen het kenmerk', await zoek(eigen))
    await mb.verstuurFactuur(dup.json.id, 'Manual')
    meld('zoeken na op open zetten', await zoek(eigen))
    // Wat weet de creditnota zelf over de oorspronkelijke factuur?
    const volledig = (await api(`/sales_invoices/${dup.json.id}.json`)).json
    meld('velden die naar het origineel wijzen', Object.fromEntries(Object.entries(volledig).filter(([k, v]) => /original|credit|parent/i.test(k) && v !== null).map(([k, v]) => [k, v === id ? 'origineel' : v])))
  })
})

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
      try {
        await mb.registreerBetaling({ factuurId: id, betaaldOp: nu, brutoCent, mollieId: `tr_proef${label}${merk}` })
      } catch (e) {
        // De sandbox staat betalingen zonder bewijs niet toe: de factuur blijft dan open. De creditnota is wat we toetsen.
        meld(`betaling ${label} niet geboekt`, e instanceof Error ? e.message : String(e))
      }
      return id
    }

    // 1. Het hele bedrag, met de bestaande functie van de app.
    const heel = await betaaldeFactuur('maand', 2900)
    meld('1 factuur', await beeld(heel))
    const creditHeel = await mb.maakCreditnota(heel, { terugbetalingRegistreren: false, brutoCent: 2900, betaaldOp: new Date(), mollieId: `re_heel${merk}`, mailen: false })
    const beeldHeel = await beeld(creditHeel.id)
    meld('2 creditnota heel', beeldHeel)
    expect(Number(beeldHeel.incl)).toBe(-29)
    meld('2b oorspronkelijke factuur na creditnota heel', await beeld(heel))

    // 2. Een deelbedrag: de jaarkorting van 19,00 op een jaarfactuur van 228,00.
    const jaar = await betaaldeFactuur('jaar', 22800)
    const dup = await api(`/sales_invoices/${jaar}/duplicate_creditinvoice.json`, { method: 'PATCH', body: {} })
    meld('3 concept', { http: dup.status, ...(await beeld(dup.json.id)) })
    // Moneybird zet er een regel zonder aantal boven (tekstregel). De bedragregel is die met aantal -1: het teken staat in
    // het aantal, de prijs blijft positief. Een prijs op de tekstregel telt als bedrag erbij.
    const bedragregels = (await api(`/sales_invoices/${dup.json.id}.json`)).json.details.filter((d: any) => Number(d.amount) === -1)
    expect(bedragregels).toHaveLength(1)
    const regel = bedragregels[0]
    const prijs = '19.00'
    const wijzig = await api(`/sales_invoices/${dup.json.id}.json`, { method: 'PATCH', body: { sales_invoice: { details_attributes: [{ id: regel.id, price: prijs }] } } })
    meld('4 regel aangepast', { http: wijzig.status, fout: wijzig.status >= 300 ? wijzig.tekst : null, ...(await beeld(dup.json.id)) })
    await mb.verstuurFactuur(dup.json.id, 'Manual')
    const betaling = await api(`/sales_invoices/${dup.json.id}/payments.json`, {
      method: 'POST',
      body: { payment: { payment_date: new Date().toISOString().slice(0, 10), price: '-19.00', transaction_identifier: `re_deel${merk}`, manual_payment_action: 'payment_without_proof' } },
    })
    meld('5 terugbetaling geboekt', { http: betaling.status, fout: betaling.status >= 300 ? betaling.tekst : null })
    const deel = await beeld(dup.json.id)
    meld('6 creditnota deel', deel)
    expect(Number(deel.incl)).toBe(-19)
    expect(Number(deel.excl)).toBe(-15.7)
    meld('7 oorspronkelijke factuur', await beeld(jaar))

    // 3. Kan een hervatte run een eerder gemaakte creditnota terugvinden?
    for (const filter of [`reference:tr_proefjaar${merk}`]) {
      const z = await api(`/sales_invoices.json?filter=${encodeURIComponent(filter)}`)
      meld('8 zoeken op referentie', { filter, http: z.status, aantal: Array.isArray(z.json) ? z.json.length : null, treffers: Array.isArray(z.json) ? z.json.map((x: any) => `${x.invoice_id} ${x.total_price_incl_tax} ${x.reference}`) : z.tekst })
    }
  })
})
