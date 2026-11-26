/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi } from 'vitest'

// PROEF: de echte creditnotastap voor een teamfactuur, met een komma in de referentie. Testdatabase en uitsluitend de
// Moneybird-sandbox. Mailen wordt opgevangen (een team is zakelijk, en e-mails uit de sandbox komen echt aan).
// Eerder nodig: een bevestigde teamuitkering uit referralKetenEcht (na de nacontrole in referralKeten).
//   RUN_LIVE_CREDITNOTA_TEAM=true node --env-file=.env.testomgeving node_modules/vitest/vitest.mjs run lib/billing/referralCreditnotaTeam.moneybird.live.test.ts
const SANDBOX = '504881921344406716'
const meld = (stap: string, uitkomst: unknown) => console.log(`CREDITTEAM ${stap}: ${JSON.stringify(uitkomst)}`)
const mails = vi.hoisted(() => [] as string[])

vi.mock('./moneybird', async origineel => {
  const echt = await origineel<typeof import('./moneybird')>()
  return {
    ...echt,
    verstuurFactuur: async (id: string, methode: 'Email' | 'Manual') => {
      if (methode === 'Email') mails.push(id)
      return echt.verstuurFactuur(id, 'Manual')
    },
  }
})

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

describe.skipIf(process.env.RUN_LIVE_CREDITNOTA_TEAM !== 'true')('proef: creditnota bij een teamfactuur', () => {
  it('precies een creditnota, en een onbekend concept wordt ondanks de komma gezien', { timeout: 300_000 }, async () => {
    if (process.env.NEXT_PUBLIC_SUPABASE_URL !== 'https://slvrlofthwmoyoyxfqbi.supabase.co') throw new Error('STOP: dit is niet de testdatabase.')
    await eisSandbox()
    process.env.REFERRAL_CREDITNOTA = 'true'
    const mb = await import('./moneybird')
    const { billingDb } = await import('./db')
    const { creditnotaStap } = await import('./referralCreditnota')

    const { data: gevonden, error } = await billingDb.from('arnobot_referral_acties').select('*')
      .eq('doel_soort', 'teamfactuur').eq('status', 'bevestigd').order('created_at', { ascending: false }).limit(1)
    if (error) throw new Error(error.message)
    expect(gevonden, 'geen bevestigde teamuitkering in de testdatabase').toHaveLength(1)
    const actieId = gevonden![0].id as string
    const factuurRij = (await billingDb.from('arnobot_team_facturen').select('*').eq('id', gevonden![0].doel_id).single()).data as any

    const merk = Date.now().toString(36)
    const contactId = await mb.zoekOfMaakContact({ userId: `user_keten_teamcredit_${merk}`, email: 'test@arno.bot', naam: 'Proef Team', bedrijfsnaam: `Proefteam ${merk}` })
    const nu = new Date()
    const nieuweFactuur = async () => {
      const { id } = await mb.maakConceptFactuur({
        contactId, referentie: `Proefteam ${merk}, periode 1 januari 2027 tot 1 februari 2027`, omschrijving: 'ArnoBot Team maandelijks',
        periodeStart: nu, periodeEinde: new Date(nu.getTime() + 30 * 24 * 60 * 60 * 1000), factuurDatum: nu,
        brutoCent: factuurRij.bedrag_cent, nettoCent: factuurRij.bedrag_cent - factuurRij.btw_cent, inclusiefBtw: false,
        taxRateId: await mb.btwTariefId(), ledgerAccountId: await mb.omzetGrootboekId(),
      })
      await mb.verstuurFactuur(id, 'Manual')
      await billingDb.from('arnobot_team_facturen').update({ moneybird_factuur_id: id }).eq('id', factuurRij.id)
      return id
    }
    const zetOpNodig = () => billingDb.from('arnobot_referral_acties').update({ credit_status: 'nodig', credit_id: null, bezig_tot: null, fout: null, gegevens: { ...gevonden![0].gegevens } }).eq('id', actieId)
    const lees = async () => (await billingDb.from('arnobot_referral_acties').select('*').eq('id', actieId).single()).data as any

    await nieuweFactuur()
    await zetOpNodig()
    const eerste = await creditnotaStap(await lees())
    const na = await lees()
    expect(eerste, na.fout ?? '').toBe('klaar')
    const credit = await mb.haalFactuur(na.credit_id)
    meld('1 teamcreditnota', { uitkomst: eerste, bedrag: credit.total_price_incl_tax, status: credit.state, referentie: credit.reference, mailGevraagd: mails.length })
    expect(Math.round(Number(credit.total_price_incl_tax) * 100)).toBe(-na.bruto_cent)
    expect(mails).toEqual([na.credit_id])

    // Op een tweede factuur van dit team staat al een concept dat de eigenaar zelf maakte: er mag niets bij komen.
    const factuur2 = await nieuweFactuur()
    const wees = await mb.maakCreditConcept(factuur2)
    await zetOpNodig()
    const metWees = await creditnotaStap(await lees())
    const na2 = await lees()
    const opFactuur2 = (await mb.zoekFacturenVanContact(contactId)).filter(f => f.original_sales_invoice_id === factuur2)
    meld('2 onbekend concept', { uitkomst: metWees, opFactuur: opFactuur2.map(f => `${f.state} ${f.total_price_incl_tax}`), fout: na2.fout?.slice(0, 120) })
    expect(metWees).toBe('handwerk')
    expect(opFactuur2.map(f => f.id)).toEqual([wees.id])
    const weg = await fetch(`https://moneybird.com/api/v2/${SANDBOX}/sales_invoices/${wees.id}.json`, { method: 'DELETE', headers: { Authorization: `Bearer ${process.env.MONEYBIRD_API_TOKEN}` } })
    expect(weg.status).toBe(204)
    expect(await creditnotaStap(await lees())).toBe('klaar')
    meld('3 na verwijderen', { uitkomst: 'klaar', bedrag: (await mb.haalFactuur((await lees()).credit_id)).total_price_incl_tax })
  })
})
