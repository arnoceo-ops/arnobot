import { describe, expect, it } from 'vitest'
import { bouwContactBody, bouwFactuurBody, creditMailTekst, factuurMailTekst } from './moneybird'

const basis = {
  contactId: '123',
  referentie: 'tr_abc123',
  omschrijving: 'ArnoBot Pro maandelijks',
  periodeStart: new Date('2026-10-09T13:52:10Z'),
  periodeEinde: new Date('2026-11-09T13:52:10Z'),
  factuurDatum: new Date('2026-10-09T13:52:10Z'),
  taxRateId: '999',
}

describe('Moneybird contact', () => {
  it('splitst naam in voor- en achternaam en zet de eigen id als customer_id', () => {
    const { contact } = bouwContactBody({ userId: 'user_1', email: 'a@b.nl', naam: 'Anton Dirk Diepeveen' })
    expect(contact.customer_id).toBe('user_1')
    expect(contact.firstname).toBe('Anton')
    expect(contact.lastname).toBe('Dirk Diepeveen')
    expect(contact.send_invoices_to_email).toBe('a@b.nl')
  })
  it('neemt bedrijfs-, btw- en KvK-gegevens alleen mee als ze er zijn', () => {
    const particulier = bouwContactBody({ userId: 'u', email: 'a@b.nl', naam: 'Sanne' }).contact as Record<string, unknown>
    expect(particulier.company_name).toBeUndefined()
    expect(particulier.tax_number).toBeUndefined()
    const zakelijk = bouwContactBody({ userId: 'u', email: 'a@b.nl', naam: 'Sanne', bedrijfsnaam: 'Test BV', btw: 'NL123456789B01', kvk: '12345678' }).contact
    expect(zakelijk).toMatchObject({ company_name: 'Test BV', tax_number: 'NL123456789B01', chamber_of_commerce: '12345678' })
  })
  it('zet het adres erbij als dat bekend is', () => {
    const { contact } = bouwContactBody({ userId: 'u', email: 'a@b.nl', naam: 'Sanne', adres: { straat: 'Oudegracht 161', postcode: '3511 AL', plaats: 'Utrecht' } })
    expect(contact).toMatchObject({ address1: 'Oudegracht 161', zipcode: '3511 AL', city: 'Utrecht' })
  })
})

describe('Moneybird factuur', () => {
  it('particulier: prijs inclusief btw, het getoonde bedrag', () => {
    const { sales_invoice } = bouwFactuurBody({ ...basis, brutoCent: 5900, nettoCent: 4876, inclusiefBtw: true })
    expect(sales_invoice.prices_are_incl_tax).toBe(true)
    expect(sales_invoice.details_attributes[0].price).toBe('59.00')
  })
  it('zakelijk: prijs exclusief btw, btw komt er door het tarief bij', () => {
    const { sales_invoice } = bouwFactuurBody({ ...basis, brutoCent: 7139, nettoCent: 5900, inclusiefBtw: false })
    expect(sales_invoice.prices_are_incl_tax).toBe(false)
    expect(sales_invoice.details_attributes[0].price).toBe('59.00')
  })
  it('smeert de omzet uit over de betaalde periode en is al betaald (geen betaaltermijn)', () => {
    const { sales_invoice } = bouwFactuurBody({ ...basis, brutoCent: 5900, nettoCent: 4876, inclusiefBtw: true })
    expect(sales_invoice.details_attributes[0].period).toBe('20261009..20261109')
    expect(sales_invoice.first_due_interval).toBe(0)
    expect(sales_invoice.invoice_date).toBe('2026-10-09')
    expect(sales_invoice.reference).toBe('tr_abc123')
  })
  it('gebruikt een eigen workflow (zonder herinneringen) als die is ingesteld', () => {
    const met = bouwFactuurBody({ ...basis, brutoCent: 5900, nettoCent: 4876, inclusiefBtw: true, workflowId: '77' }).sales_invoice as Record<string, unknown>
    expect(met.workflow_id).toBe('77')
    const zonder = bouwFactuurBody({ ...basis, brutoCent: 5900, nettoCent: 4876, inclusiefBtw: true }).sales_invoice as Record<string, unknown>
    expect(zonder.workflow_id).toBeUndefined()
  })
  it('zet het grootboekrekening-id alleen als het is ingesteld', () => {
    const zonder = bouwFactuurBody({ ...basis, brutoCent: 5900, nettoCent: 4876, inclusiefBtw: true }).sales_invoice.details_attributes[0] as Record<string, unknown>
    expect(zonder.ledger_account_id).toBeUndefined()
    const met = bouwFactuurBody({ ...basis, brutoCent: 5900, nettoCent: 4876, inclusiefBtw: true, ledgerAccountId: '55' }).sales_invoice.details_attributes[0] as Record<string, unknown>
    expect(met.ledger_account_id).toBe('55')
  })
})

describe('Moneybird mailtekst', () => {
  it('begint met de voornaam, ook bij een zakelijke klant', () => {
    expect(factuurMailTekst('Sanne').startsWith('Hey Sanne,')).toBe(true)
    expect(creditMailTekst('Sanne').startsWith('Hey Sanne,')).toBe(true)
  })
  it('begint zonder naam direct met de tekst, zonder aanhef', () => {
    expect(factuurMailTekst(null).startsWith('In de bijlage')).toBe(true)
    expect(factuurMailTekst('  ').startsWith('In de bijlage')).toBe(true)
    expect(creditMailTekst(null).startsWith('In de bijlage')).toBe(true)
  })
  it('laat een naam nooit een Moneybird-tag worden', () => {
    expect(factuurMailTekst('{document.total_price}')).not.toContain('{document.total_price}')
  })
  it('verwijst naar het factuurmailadres, nooit naar een onverwerkte placeholder', () => {
    for (const t of [factuurMailTekst('Sanne'), creditMailTekst('Sanne')]) {
      expect(t).toContain('admin@arno.bot')
      expect(t).not.toContain('${')
    }
  })
  it('bewaart de factuurnummer-tag', () => {
    expect(factuurMailTekst('Sanne')).toContain('{document.invoice_id}')
  })
})
