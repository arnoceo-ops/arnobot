import { describe, expect, it } from 'vitest'
import { chromium } from 'playwright'
import { MANUAL_TEST_USER_ID } from '@/lib/internalTestAccounts'

// LIVE-test van de hele keten "zelf omzetten naar zakelijk" tegen Mollie in TESTMODUS en de echte Supabase met het
// interne testaccount test@arno.bot. Draait niet in de gewone testrun of CI:
//   RUN_LIVE_KLANTTYPE_KETEN=true node --env-file=.env.local node_modules/vitest/vitest.mjs run lib/billing/klanttype.keten.live.test.ts
// Moneybird en e-mail worden in deze test uitgeschakeld (variabelen gewist), Telegram gaat wel uit. Alles wat de test
// aanmaakt wordt weer verwijderd en de klantgegevens van het testaccount worden teruggezet.
const LIVE = process.env.RUN_LIVE_KLANTTYPE_KETEN === 'true'
const wacht = (ms: number) => new Promise(r => setTimeout(r, ms))
const meld = (stap: string, uitkomst: unknown) => console.log(`KETEN ${stap}: ${JSON.stringify(uitkomst)}`)

describe.skipIf(!LIVE)('zelf omzetten: hele keten (Mollie testmodus, testaccount)', () => {
  it('start, betaalt, zet om en laat precies een zakelijk abonnement achter', { timeout: 600_000 }, async () => {
    const key = process.env.MOLLIE_API_KEY ?? ''
    if (!key.startsWith('test_')) throw new Error('Alleen met een test_-sleutel, stop.')
    for (const naam of Object.keys(process.env)) if (/^(MONEYBIRD_|RESEND_)/.test(naam)) delete process.env[naam]

    const { billingDb } = await import('./db')
    const m = await import('./mollie')
    const { startKlanttypeCorrectie, verwerkKlanttypeCorrectie, rondOpenstaandeCorrectiesAf } = await import('./klanttypeCorrectie')
    const { stopMollieAbonnement } = await import('./verwerking')
    const { moneybirdIngeschakeld } = await import('./moneybird')
    expect(moneybirdIngeschakeld()).toBe(false)

    const gebruiker = MANUAL_TEST_USER_ID
    const { data: vooraf, error: tabelFout } = await billingDb.from('arnobot_klanttype_correcties').select('id').limit(5)
    expect(tabelFout).toBeNull()
    // Het vangnet verderop loopt over alle open correcties: alleen veilig op een lege tabel.
    expect(vooraf).toHaveLength(0)
    const { data: klantVoor, error: klantVoorFout } = await billingDb.from('arnobot_billing_customers').select('*').eq('user_id', gebruiker).maybeSingle()
    expect(klantVoorFout).toBeNull()
    const telRijen = async () => ({
      abonnementen: (await billingDb.from('arnobot_subscriptions').select('id').eq('user_id', gebruiker)).data?.length ?? -1,
      betalingen: (await billingDb.from('arnobot_payments').select('id').eq('user_id', gebruiker)).data?.length ?? -1,
    })
    const rijenVoor = await telRijen()
    meld('0 vooraf', { ...rijenVoor, klantrij: !!klantVoor })

    let klantId: string | null = null
    let subId: string | null = null
    let payId: string | null = null
    try {
      const merk = `keten-${Date.now()}`
      klantId = (await m.maakKlant({ naam: 'Keten klanttype', email: 'test@arno.bot', userId: merk })).id
      const mandaat = await fetch(`https://api.mollie.com/v2/customers/${klantId}/mandates`, { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ method: 'directdebit', consumerName: 'Keten Klanttype', consumerAccount: 'NL55INGB0000000000' }) })
      expect(mandaat.status).toBe(201)

      const start = new Date(Date.now() + 20 * 86_400_000).toISOString().slice(0, 10)
      const oud = await m.maakAbonnement({ klantId, brutoCent: 5900, interval: '1 month', times: null, startDatum: new Date(`${start}T00:00:00.000Z`), omschrijving: `ArnoBot Pro maandelijks ${merk}`, metadata: {}, idempotencyKey: `${merk}-oud` })

      const { data: sub, error: subFout } = await billingDb.from('arnobot_subscriptions').insert({
        user_id: gebruiker, plan: 'premium', cyclus: 'maandelijks', klant_type: 'particulier', status: 'active',
        bedrag_cent: 5900, btw_cent: 1024, mollie_customer_id: klantId, mollie_subscription_id: oud.id,
        periode_start: new Date(Date.now() - 10 * 86_400_000).toISOString(), periode_einde: `${start}T00:00:00.000Z`,
      }).select('*').single()
      expect(subFout).toBeNull()
      subId = sub!.id
      const { data: pay, error: payFout } = await billingDb.from('arnobot_payments').insert({
        user_id: gebruiker, subscription_id: subId, mollie_payment_id: `tr_${merk.replace('-', '')}`, soort: 'eerste', status: 'paid',
        bedrag_cent: 5900, btw_cent: 1024, betaald_at: new Date().toISOString(), verwerkt_at: new Date().toISOString(),
      }).select('*').single()
      expect(payFout).toBeNull()
      payId = pay!.id

      const gestart = await startKlanttypeCorrectie({
        userId: gebruiker, sub: sub!, payment: pay!, bedrijfsnaam: 'Voorbeeld BV', kvkNummer: '12345678',
        btwNummer: 'NL123456789B01', straat: 'Kerkstraat 1', postcode: '1234 AB', plaats: 'Utrecht',
      })
      meld('1 gestart', 'checkoutUrl' in gestart ? { link: true } : gestart)
      if (!('checkoutUrl' in gestart)) throw new Error(gestart.fout)

      const leesCorrectie = async () => (await billingDb.from('arnobot_klanttype_correcties').select('*').eq('subscription_id', subId!).single()).data!
      const leesSub = async () => (await billingDb.from('arnobot_subscriptions').select('*').eq('id', subId!).single()).data!
      const correctie = await leesCorrectie()

      await verwerkKlanttypeCorrectie(correctie.mollie_payment_id, null)
      meld('2 verwerken zonder betaling', { status: (await leesCorrectie()).status })

      const browser = await chromium.launch()
      try {
        const pg = await browser.newPage()
        await pg.goto(gestart.checkoutUrl, { waitUntil: 'networkidle' })
        for (let i = 0; i < 6 && !(await pg.locator('input[name=final_state][value=paid]').count()); i++) {
          const ideal = pg.getByText('iDEAL', { exact: false }).first()
          const bank = pg.locator('button[name=issuer]:has-text("ING")')
          if (await bank.count()) await bank.first().click()
          else if (await ideal.count()) await ideal.click()
          else await pg.locator('button[type=submit]').first().click()
          await pg.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})
          await wacht(1000)
        }
        await pg.check('input[name=final_state][value=paid]')
        await pg.click('button:has-text("Ga verder"), button:has-text("Continue")')
        await pg.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})
      } finally {
        await browser.close()
      }
      let betaald = false
      for (let i = 0; i < 20 && !betaald; i++) {
        betaald = (await m.lijstBetaalLinkBetalingen(correctie.mollie_payment_id)).some(p => p.status === 'paid')
        if (!betaald) await wacht(1500)
      }
      expect(betaald).toBe(true)

      // Het slot tegen de echte database. Eerst bezet: er mag niets gebeuren.
      const zetSlot = async (tot: string | null) => expect((await billingDb.from('arnobot_subscriptions').update({ klanttype_bezig_tot: tot }).eq('id', subId!)).error).toBeNull()
      await zetSlot(new Date(Date.now() + 5 * 60_000).toISOString())
      await verwerkKlanttypeCorrectie(correctie.mollie_payment_id, null)
      const bezet = await leesCorrectie()
      meld('3 slot bezet', { status: bezet.status, afgehandeld: !!bezet.afgehandeld_at, klantType: (await leesSub()).klant_type })
      expect(bezet.afgehandeld_at).toBeNull()
      expect((await leesSub()).klant_type).toBe('particulier')

      // De vrije-slot-update zoals de code hem doet: geeft de echte database de gewijzigde rij terug?
      await zetSlot(null)
      const vrij = await billingDb.from('arnobot_subscriptions').update({ klanttype_bezig_tot: new Date(Date.now() + 60_000).toISOString() }).eq('id', subId!).is('klanttype_bezig_tot', null).select('id')
      meld('4 vrij slot nemen', { fout: vrij.error?.message ?? null, rijen: vrij.data?.length })
      expect(vrij.data).toHaveLength(1)

      // Verlopen slot, en meteen twee gelijktijdige verwerkingen (webhook en cron tegelijk).
      await zetSlot(new Date(Date.now() - 60_000).toISOString())
      await Promise.all([verwerkKlanttypeCorrectie(correctie.mollie_payment_id, null), verwerkKlanttypeCorrectie(correctie.mollie_payment_id, null)])
      const na = await leesCorrectie()
      const subNa = await leesSub()
      meld('5 omgezet', { status: na.status, afgehandeld: !!na.afgehandeld_at, handwerk: na.handwerk_reden, gefactureerd: !!na.gefactureerd_at, klantType: subNa.klant_type, bedrag: subNa.bedrag_cent, btw: subNa.btw_cent, nieuwId: subNa.mollie_subscription_id !== oud.id, slot: subNa.klanttype_bezig_tot })
      expect(na.afgehandeld_at).toBeTruthy()
      expect(na.handwerk_reden).toBeNull()
      expect(subNa).toMatchObject({ klant_type: 'zakelijk', bedrag_cent: 7139, btw_cent: 1239, klanttype_bezig_tot: null })

      const lijst = await m.lijstKlantAbonnementen(klantId)
      const lopend = lijst.filter(s => s.status === 'active' || s.status === 'pending')
      meld('6 mollie', { totaal: lijst.length, lopend: lopend.map(s => ({ bedrag: s.amount?.value, next: s.nextPaymentDate, klopt: s.id === subNa.mollie_subscription_id })), oud: (await m.haalAbonnement(klantId, oud.id)).status })
      expect(lijst).toHaveLength(2)
      expect(lopend).toHaveLength(1)
      expect(lopend[0]).toMatchObject({ id: subNa.mollie_subscription_id, nextPaymentDate: start })

      // Herhaalde melding en het dagelijkse vangnet veranderen niets.
      await verwerkKlanttypeCorrectie(correctie.mollie_payment_id, null)
      const vangnet = await rondOpenstaandeCorrectiesAf(new Date())
      meld('7 herhaling en vangnet', { vangnet, lopend: (await m.lijstKlantAbonnementen(klantId)).filter(s => s.status === 'active').length })
      expect(vangnet.fouten).toBe(0)

      // Opzeggen na de omzetting: het stoppad werkt met de echte tabel.
      const gestopt = await stopMollieAbonnement(await leesSub())
      meld('8 stoppad', { gestopt, lopend: (await m.lijstKlantAbonnementen(klantId)).filter(s => s.status === 'active').length })
      expect(gestopt).toBe(true)
    } finally {
      if (klantId) {
        for (const s of await m.lijstKlantAbonnementen(klantId)) if (s.status === 'active' || s.status === 'pending') await m.stopAbonnement(klantId, s.id)
      }
      if (subId) await billingDb.from('arnobot_klanttype_correcties').delete().eq('subscription_id', subId)
      if (payId) await billingDb.from('arnobot_payments').delete().eq('id', payId).eq('user_id', gebruiker)
      if (subId) await billingDb.from('arnobot_subscriptions').delete().eq('id', subId).eq('user_id', gebruiker)
      if (klantVoor) await billingDb.from('arnobot_billing_customers').upsert(klantVoor, { onConflict: 'user_id' })
      else await billingDb.from('arnobot_billing_customers').delete().eq('user_id', gebruiker)
      const { data: klantNa } = await billingDb.from('arnobot_billing_customers').select('*').eq('user_id', gebruiker).maybeSingle()
      const { data: correctiesNa } = await billingDb.from('arnobot_klanttype_correcties').select('id').limit(5)
      meld('9 opgeruimd', { ...(await telRijen()), voor: rijenVoor, correcties: correctiesNa?.length, klantrijHersteld: JSON.stringify(klantNa) === JSON.stringify(klantVoor) })
    }
  })
})
