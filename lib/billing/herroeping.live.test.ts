import { describe, expect, it } from 'vitest'
import { chromium } from 'playwright'
import { MANUAL_TEST_USER_ID } from '@/lib/internalTestAccounts'

// LIVE-test van de herroeping tegen Mollie in TESTMODUS (test_-sleutel, geen echt geld) en de echte
// Supabase met het interne testaccount test@arno.bot. Draait NIET in de gewone testrun of CI: alleen met
//   RUN_LIVE_HERROEPING=true node --env-file=.env.local node_modules/vitest/vitest.mjs run lib/billing/herroeping.live.test.ts
// Wat er gebeurt: een Mollie-testbetaling aanmaken en via de testcheckout op "Betaald" zetten, een
// abonnement- en betalingsrij voor het testaccount invoegen, dan de echte terugbetaalstappen van
// voerHerroepingUit uitvoeren (betaalTerug, markeerTerugbetaald, verwerkMolliebetaling). Daarna worden
// de ingevoegde rijen verwijderd en de toegang van het testaccount hersteld. Er gaat één mail naar
// test@arno.bot en één Telegram-melding uit. Moneybird wordt niet geraakt (geen factuur-id op de rij).
const LIVE = process.env.RUN_LIVE_HERROEPING === 'true'

describe.skipIf(!LIVE)('herroeping live (Mollie testmodus)', () => {
  it('betaalt een eerste betaling terug en beëindigt de toegang, en ruimt daarna op', async () => {
    const key = process.env.MOLLIE_API_KEY ?? ''
    if (!key.startsWith('test_')) throw new Error('Alleen met een test_-sleutel, stop.')

    const { billingDb } = await import('./db')
    const { betaalTerug } = await import('./mollie')
    const { markeerTerugbetaald, verwerkMolliebetaling } = await import('./verwerking')
    const { zoekHerroepbaar } = await import('./herroeping')

    const mollie = (pad: string, init?: RequestInit) =>
      fetch(`https://api.mollie.com/v2${pad}`, { ...init, headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' } }).then(r => r.json())

    const { data: voor } = await billingDb.from('approved_users').select('expires_at, plan, is_active, paid_at, cancelled_at').eq('user_id', MANUAL_TEST_USER_ID).maybeSingle()
    expect(voor).toBeTruthy()

    let subId: string | null = null
    let payId: string | null = null
    try {
      // 1. Mollie-testbetaling aanmaken en op Betaald zetten via de testcheckout.
      const p = await mollie('/payments', {
        method: 'POST',
        body: JSON.stringify({ amount: { currency: 'EUR', value: '77.00' }, description: 'ArnoBot herroeping livetest', redirectUrl: 'https://www.arno.bot/', method: 'ideal' }),
      })
      expect(p.id).toMatch(/^tr_/)
      const browser = await chromium.launch()
      try {
        const pg = await browser.newPage()
        await pg.goto(p._links.checkout.href, { waitUntil: 'networkidle' })
        await pg.click('button[name=issuer]:has-text("ING")')
        await pg.waitForLoadState('networkidle')
        await pg.check('input[name=final_state][value=paid]')
        await pg.click('button:has-text("Ga verder")')
        await pg.waitForLoadState('networkidle')
      } finally {
        await browser.close()
      }
      let betaald = false
      for (let i = 0; i < 15 && !betaald; i++) {
        betaald = (await mollie(`/payments/${p.id}`)).status === 'paid'
        if (!betaald) await new Promise(r => setTimeout(r, 1000))
      }
      expect(betaald).toBe(true)

      // 2. Rijen voor het testaccount invoegen zoals een echte eerste betaling ze achterlaat.
      const nu = new Date()
      const { data: sub, error: subFout } = await billingDb.from('arnobot_subscriptions').insert({
        user_id: MANUAL_TEST_USER_ID, plan: 'basis', cyclus: 'maandelijks', klant_type: 'particulier', status: 'active',
        bedrag_cent: 7700, btw_cent: 1336, mollie_customer_id: 'cst_herroeping_livetest',
        periode_start: nu.toISOString(), periode_einde: new Date(nu.getTime() + 30 * 86_400_000).toISOString(),
      }).select('id').single()
      expect(subFout).toBeNull()
      subId = sub!.id
      const { data: pay, error: payFout } = await billingDb.from('arnobot_payments').insert({
        user_id: MANUAL_TEST_USER_ID, subscription_id: subId, mollie_payment_id: p.id, soort: 'eerste', status: 'paid',
        bedrag_cent: 7700, btw_cent: 1336, betaald_at: nu.toISOString(), verwerkt_at: nu.toISOString(),
      }).select('id').single()
      expect(payFout).toBeNull()
      payId = pay!.id

      // 3. De selectie vindt precies deze betaling (echte kolomnamen en filters).
      const gevonden = await zoekHerroepbaar(MANUAL_TEST_USER_ID)
      expect(gevonden.betaling?.id).toBe(payId)
      expect(gevonden.herroepbaar).toMatchObject({ soort: 'eerste', bedragCent: 7700 })

      // 4. De echte terugbetaalstappen, in dezelfde volgorde als voerHerroepingUit.
      const refund = await betaalTerug({ betalingId: p.id, brutoCent: 7700, omschrijving: 'Herroeping livetest ArnoBot', idempotencyKey: `herroeping-${payId}` })
      expect(refund.id).toMatch(/^re_/)
      await markeerTerugbetaald(payId!)
      await verwerkMolliebetaling(p.id)

      // 5. Gevolgen: Mollie neemt de terugbetaling aan (in testmodus blijft hij 'pending', afronden duurt
      // uren), terwijl abonnement en toegang direct stoppen. terugbetaald_cent volgt pas via de webhook.
      const refunds = await mollie(`/payments/${p.id}/refunds`)
      const status = refunds._embedded?.refunds?.[0]?.status
      console.log('[live] Mollie-terugbetaling:', refunds._embedded?.refunds?.[0]?.id, status, refunds._embedded?.refunds?.[0]?.amount?.value)
      const { data: payNa } = await billingDb.from('arnobot_payments').select('terugbetaling_verwerkt_at').eq('id', payId).single()
      const { data: subNa } = await billingDb.from('arnobot_subscriptions').select('status').eq('id', subId).single()
      const { data: userNa } = await billingDb.from('approved_users').select('expires_at').eq('user_id', MANUAL_TEST_USER_ID).single()
      console.log('[live] terugbetaling_verwerkt_at gezet:', !!payNa?.terugbetaling_verwerkt_at, '| abonnement:', subNa?.status, '| expires_at na:', userNa?.expires_at)
      expect(refunds._embedded?.refunds).toHaveLength(1)
      expect(['queued', 'pending', 'processing', 'refunded']).toContain(status)
      expect(refunds._embedded.refunds[0].amount.value).toBe('77.00')
      expect(payNa?.terugbetaling_verwerkt_at).toBeTruthy()
      expect(subNa?.status).toBe('refunded')
      expect(new Date(userNa!.expires_at as string).getTime()).toBeLessThan(Date.now())

      // 6. Daarna is er niets meer te herroepen voor deze betaling.
      const nogmaals = await zoekHerroepbaar(MANUAL_TEST_USER_ID)
      expect(nogmaals.betaling).toBeNull()
      // Ook als het abonnement doorloopt (zoals bij een teruggedraaide upgrade) komt dezelfde betaling niet terug,
      // terwijl Mollie de terugbetaling nog niet heeft afgerond (terugbetaald_cent is dan nog 0).
      await billingDb.from('arnobot_subscriptions').update({ status: 'active' }).eq('id', subId)
      expect((await zoekHerroepbaar(MANUAL_TEST_USER_ID)).betaling?.id).not.toBe(payId)
    } finally {
      if (payId) await billingDb.from('arnobot_payments').delete().eq('id', payId)
      if (subId) await billingDb.from('arnobot_subscriptions').delete().eq('id', subId)
      if (voor) await billingDb.from('approved_users').update(voor).eq('user_id', MANUAL_TEST_USER_ID)
      const { data: nu } = await billingDb.from('approved_users').select('expires_at, plan, is_active, paid_at, cancelled_at').eq('user_id', MANUAL_TEST_USER_ID).single()
      console.log('[live] testaccount hersteld:', JSON.stringify(nu) === JSON.stringify(voor))
    }
  }, 180_000)
})
