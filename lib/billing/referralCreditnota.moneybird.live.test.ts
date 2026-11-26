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
    const { data: acties, error } = await billingDb.from('arnobot_referral_acties').select('*').eq('status', 'bevestigd').order('created_at')
    if (error) throw new Error(error.message)
    // Alleen een particulier: bij zakelijk mailt de stap, en e-mails uit de sandbox komen echt aan.
    let gekozen: any = null
    let betaling: any = null
    for (const a of acties as any[]) {
      const p = (await billingDb.from('arnobot_payments').select('*').eq('id', a.doel_id).single()).data as any
      const s = (await billingDb.from('arnobot_subscriptions').select('klant_type').eq('id', p.subscription_id).single()).data as any
      if (s.klant_type === 'particulier') { gekozen = a; betaling = p; break }
    }
    expect(gekozen, 'geen bevestigde particuliere uitkering in de testdatabase: draai eerst de ketenproef').not.toBeNull()
    const actieId = gekozen.id as string

    const merk = Date.now().toString(36)
    const contactId = await mb.zoekOfMaakContact({ userId: `user_keten_stap_${merk}`, email: 'test@arno.bot', naam: 'Proef Stap', particulier: true })
    const nu = new Date()
    // Eigen referentie per run, zodat facturen van eerdere runs niet meetellen.
    const kenmerk = `tr_proefstap${merk}`
    await billingDb.from('arnobot_payments').update({ mollie_payment_id: kenmerk }).eq('id', betaling.id)
    const nieuweFactuur = async () => {
      const { id } = await mb.maakConceptFactuur({
        contactId, referentie: kenmerk, omschrijving: 'Proef creditnotastap', periodeStart: nu, periodeEinde: new Date(nu.getTime() + 30 * 24 * 60 * 60 * 1000),
        factuurDatum: nu, brutoCent: betaling.bedrag_cent, nettoCent: betaling.bedrag_cent - betaling.btw_cent, inclusiefBtw: true,
        taxRateId: await mb.btwTariefId(), ledgerAccountId: await mb.omzetGrootboekId(),
      })
      await mb.verstuurFactuur(id, 'Manual')
      await billingDb.from('arnobot_payments').update({ moneybird_factuur_id: id }).eq('id', betaling.id)
      return id
    }
    try {
    const factuurId = await nieuweFactuur()

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

    // Het echte crashvenster: het concept bestaat, maar het kenmerk is niet bewaard en de referentie is nog die van de
    // factuur. Er mag niets bij komen; na verwijderen maakt de stap zelf de juiste.
    const factuur2 = await nieuweFactuur()
    const wees = await mb.maakCreditConcept(factuur2)
    await zetOpNodig()
    const metWees = await creditnotaStap(await lees())
    const na3 = await lees()
    const opFactuur2 = (await mb.zoekFacturenOpReferentie(kenmerk)).filter(f => f.original_sales_invoice_id === factuur2)
    meld('stap 3 onbekend concept', { uitkomst: metWees, opFactuur: opFactuur2.map(f => `${f.state} ${f.total_price_incl_tax}`), fout: na3.fout?.slice(0, 90) })
    expect(metWees).toBe('handwerk')
    expect(na3.credit_status).toBe('nodig')
    expect(opFactuur2.map(f => f.id)).toEqual([wees.id])
    const weg = await fetch(`https://moneybird.com/api/v2/${SANDBOX}/sales_invoices/${wees.id}.json`, { method: 'DELETE', headers: { Authorization: `Bearer ${process.env.MONEYBIRD_API_TOKEN}` } })
    expect(weg.status).toBe(204)
    const daarna = await creditnotaStap(await lees())
    const na4 = await lees()
    expect(daarna, na4.fout ?? '').toBe('klaar')
    expect(Math.round(Number((await mb.haalFactuur(na4.credit_id)).total_price_incl_tax) * 100)).toBe(-na4.bruto_cent)
    meld('stap 4 na verwijderen', { uitkomst: daarna })
    } finally {
      await billingDb.from('arnobot_payments').update({ mollie_payment_id: betaling.mollie_payment_id }).eq('id', betaling.id)
    }
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
    for (const u of uitkomsten) {
      expect(u.http).toBe(200)
      if (u.manier === 'incl') expect(u.kreeg, JSON.stringify(u)).toBe(u.gevraagd)
    }
    // En met de functie die de app gebruikt, op een bedrag dat niet als netto maal 1,21 bestaat.
    const eigenDup = await mb.maakCreditConcept(id)
    const gezet = await mb.zetCreditBedrag(eigenDup.id, { regelId: mb.creditBedragregel(eigenDup)!, brutoCent: 1000, referentie: `tr_proefzak${merk}-app` })
    expect(Number(gezet.total_price_incl_tax)).toBe(-10)
    expect(gezet.original_sales_invoice_id).toBe(id)
    await api(`/sales_invoices/${eigenDup.id}.json`, { method: 'DELETE' })

    // Terugvinden: een concept met een eigen kenmerk in de referentie, voor en na het op open zetten.
    const eigen = `ref-actie-${merk}`
    const dup = await api(`/sales_invoices/${id}/duplicate_creditinvoice.json`, { method: 'PATCH', body: {} })
    const zoek = async (waarop: string) => {
      const z = await api(`/sales_invoices.json?filter=${encodeURIComponent(`reference:${waarop}`)}`)
      return Array.isArray(z.json) ? z.json.map((x: any) => `${x.id === dup.json.id ? 'creditnota' : x.id === id ? 'origineel' : 'ander'} ${x.state} ${x.total_price_incl_tax}`) : z.tekst
    }
    const opOud = await zoek(`tr_proefzak${merk}`)
    meld('zoeken concept op oude referentie', opOud)
    // Hierop leunt het herkennen van een onbekende creditnota: het concept houdt de referentie van de factuur.
    expect(opOud).toContain('creditnota draft -275.88')
    await api(`/sales_invoices/${dup.json.id}.json`, { method: 'PATCH', body: { sales_invoice: { reference: `tr_proefzak${merk} ${eigen}` } } })
    expect(await zoek(eigen)).toEqual([])
    expect(await zoek(`tr_proefzak${merk} ${eigen}`)).toEqual(['creditnota draft -275.88'])
    await api(`/sales_invoices/${dup.json.id}.json`, { method: 'PATCH', body: { sales_invoice: { reference: eigen } } })
    meld('zoeken concept, referentie is alleen het kenmerk', await zoek(eigen))
    await mb.verstuurFactuur(dup.json.id, 'Manual')
    expect(await zoek(eigen)).toHaveLength(1)
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
