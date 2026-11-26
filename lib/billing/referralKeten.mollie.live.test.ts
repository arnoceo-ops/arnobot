/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi } from 'vitest'
import { chromium, type Browser } from 'playwright'

// KETENPROEF referral: echte code, echte testdatabase (project arnobot-test), echt Mollie in TESTMODUS.
// De webhookcode wordt hier rechtstreeks aangeroepen. NIET bewezen: dat Mollie de webhook zelf aflevert.
// Mail en Telegram worden alleen opgevangen. Draait niet in de gewone testrun:
//   RUN_LIVE_KETEN=true node --env-file=.env.testomgeving node_modules/vitest/vitest.mjs run lib/billing/referralKeten.mollie.live.test.ts
const LIVE = process.env.RUN_LIVE_KETEN === 'true'
const TESTDATABASE = 'https://slvrlofthwmoyoyxfqbi.supabase.co'
/** Sleutels die in deze proef niet geladen mogen zijn: dan draait hij met (een deel van) de echte instellingen. */
const VERBODEN = ['TELEGRAM_BOT_TOKEN', 'RESEND_API_KEY', 'MONEYBIRD_API_TOKEN', 'MONEYBIRD_OOK_IN_TESTMODUS', 'CLERK_SECRET_KEY']

const opgevangen = vi.hoisted(() => ({ mails: [] as { to: string; subject: string }[], telegram: [] as string[] }))
vi.mock('@/lib/mail', () => ({
  verstuurMail: async (m: { to: string; subject: string }) => { opgevangen.mails.push({ to: m.to, subject: m.subject }); return { data: { id: 'proef' }, error: null } },
  telMail: async () => {},
}))
vi.mock('@/lib/cron-notify', () => ({
  notifyTelegram: async (t: string) => { opgevangen.telegram.push(t); return true },
  notifyCronFailure: async (naam: string, e: unknown) => { opgevangen.telegram.push(`cron ${naam}: ${String(e)}`) },
}))

/** Gooit voordat er ook maar iets geladen of aangeraakt is. */
function eisTestomgeving(): string {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL !== TESTDATABASE) throw new Error('STOP: dit is niet de testdatabase arnobot-test.')
  const key = process.env.MOLLIE_API_KEY ?? ''
  if (!key.startsWith('test_')) throw new Error('STOP: alleen met een Mollie test_-sleutel.')
  const geladen = VERBODEN.filter(n => !!process.env[n])
  if (geladen.length) throw new Error(`STOP: deze instellingen horen niet in de testomgeving: ${geladen.join(', ')}`)
  return key
}

const DAG = 24 * 60 * 60 * 1000
/** Mollie geeft ons actiekenmerk terug in de lijst met terugbetalingen: daarop leunt het hervatten. */
async function eisEigenKenmerk(db: any, userId: string, refund: any): Promise<void> {
  const { data } = await db.from('arnobot_referral_acties').select('id').eq('user_id', userId)
  expect((data as { id: string }[]).map(a => a.id)).toContain(refund.metadata?.referralActie)
}
const meld = (stap: string, uitkomst: unknown) => console.log(`KETEN ${stap}: ${JSON.stringify(uitkomst)}`)
const wacht = (ms: number) => new Promise(r => setTimeout(r, ms))

describe.skipIf(!LIVE)('ketenproef: gratis vierde maand (testmodus, testdatabase)', () => {
  it('vier betaalde maanden, precies een terugstorting, abonnement blijft lopen', { timeout: 600_000 }, async () => {
    const key = eisTestomgeving()
    // Een gereserveerd voorbeelddomein: Mollie krijgt een geldig adres, en niets van ons ontvangt het.
    process.env.MOLLIE_TEST_WEBHOOK_URL = 'https://example.com/arnobot-testwebhook'
    process.env.REFERRAL_TERUGSTORTEN = 'true'
    process.env.REFERRAL_TEGOED_VERREKENEN = 'true'

    const { billingDb } = await import('./db')
    const m = await import('./mollie')
    const { POST: webhook } = await import('@/app/api/webhooks/mollie/route')
    const { planReferral } = await import('./referralPlanner')
    const { verwerkOpenTerugstortingen } = await import('./referralTerugstorten')
    expect(m.MOLLIE_WEBHOOK_URL).toBe('https://example.com/arnobot-testwebhook')

    const ruw = async (pad: string, init?: RequestInit) => {
      const r = await fetch(`https://api.mollie.com/v2${pad}`, { ...init, headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' } })
      return { status: r.status, json: (await r.json().catch(() => null)) as any }
    }
    const moet = async <T>(wat: string, vraag: PromiseLike<{ data: T; error: { message: string } | null }>) => {
      const r = await vraag
      if (r.error) throw new Error(`${wat}: ${r.error.message}`)
      return r.data
    }
    const roepWebhook = async (id: string) =>
      (await webhook(new Request('https://proef.invalid/api/webhooks/mollie', { method: 'POST', body: `id=${id}` }) as any)).status

    const merk = Date.now().toString(36)
    const aanbrenger = `user_keten_aanbrenger_${merk}`
    const klant = `user_keten_klant_${merk}`
    const nu = Date.now()
    const aangemeld = new Date(nu - 10 * DAG).toISOString()
    for (const [id, naam] of [[aanbrenger, 'Proefaanbrenger'], [klant, 'Proefklant']]) {
      await moet('gebruiker', billingDb.from('approved_users').insert({ user_id: id, email: `${id}@example.com`, voornaam: naam, trial_start: aangemeld }))
    }
    await moet('referral', billingDb.from('arnobot_referrals').insert({ referrer_user_id: aanbrenger, referred_user_id: klant, code_used: `PROEF-${merk}`, created_at: aangemeld }))

    const mollieKlant = (await m.maakKlant({ naam: 'Proef Keten', email: 'proef@example.com', userId: klant })).id
    const mandaat = await ruw(`/customers/${mollieKlant}/mandates`, { method: 'POST', body: JSON.stringify({ method: 'directdebit', consumerName: 'Proef Keten', consumerAccount: 'NL55INGB0000000000' }) })
    expect(mandaat.status).toBe(201)

    // Het abonnement liep zogenaamd al: de vier betalingen verlengen steeds een maand, tot ongeveer nu.
    const start = new Date(nu); start.setUTCMonth(start.getUTCMonth() - 3)
    const begin = new Date(start); begin.setUTCMonth(begin.getUTCMonth() - 1)
    const sub = (await moet('abonnement', billingDb.from('arnobot_subscriptions').insert({
      user_id: klant, plan: 'basis', cyclus: 'maandelijks', klant_type: 'particulier', status: 'active', bedrag_cent: 2900, btw_cent: 503,
      mollie_customer_id: mollieKlant, periode_start: begin.toISOString(), periode_einde: start.toISOString(), created_at: begin.toISOString(),
    }).select('*').single())) as any

    let browser: Browser | null = null
    try {
      browser = await chromium.launch()
      const betaalMaand = async (nr: number) => {
        const p = await m.maakLosseHerhaalBetaling({ klantId: mollieKlant, brutoCent: 2900, omschrijving: `Keten ${merk} maand ${nr}`, metadata: { subscriptionRowId: sub.id }, idempotencyKey: `keten-${merk}-${nr}` })
        let nuStand = (await ruw(`/payments/${p.id}`)).json
        if (nuStand.status !== 'paid') {
          const link = nuStand._links?.changePaymentState?.href
          if (!link) throw new Error(`maand ${nr}: status ${nuStand.status} en geen testlink om hem op betaald te zetten`)
          const pagina = await browser!.newPage()
          await pagina.goto(link, { waitUntil: 'networkidle' })
          await pagina.check('input[name=final_state][value=paid]')
          await pagina.click('button:has-text("Ga verder"), button:has-text("Continue")')
          await pagina.waitForLoadState('networkidle')
          await pagina.close()
          for (let i = 0; i < 20 && nuStand.status !== 'paid'; i++) { await wacht(1500); nuStand = (await ruw(`/payments/${p.id}`)).json }
        }
        expect(nuStand.status).toBe('paid')
        expect(await roepWebhook(p.id)).toBe(200)
        return p.id
      }

      const kenmerken: string[] = []
      for (let nr = 1; nr <= 4; nr++) kenmerken.push(await betaalMaand(nr))
      const rijen = (await moet('betalingen', billingDb.from('arnobot_payments').select('*').eq('user_id', klant).order('periode_start'))) as any[]
      meld('1 vier maanden', rijen.map(r => ({ status: r.status, cent: r.bedrag_cent, van: r.periode_start?.slice(0, 10), tot: r.periode_einde?.slice(0, 10) })))
      expect(rijen).toHaveLength(4)

      // De wachttijd na een betaling is voorbij: we plannen alsof het 8 dagen later is.
      const later = new Date(Date.now() + 8 * DAG)
      const omschrijvingen = { voordeel_maand: `Proef gratis maand ${merk}` }
      const plan = await planReferral(later, { uitvoeren: true, omschrijvingen })
      const eigenPlan = plan.voornemens.filter(v => v.userId === klant)
      meld('2 plan', { voornemens: eigenPlan.map(v => ({ soort: v.soort, stand: v.stand, cent: v.brutoCent, reden: v.reden })), fouten: plan.fouten })
      expect(plan.fouten).toEqual([])
      expect(eigenPlan.filter(v => v.stand === 'gereserveerd')).toHaveLength(1)

      const eerste = await verwerkOpenTerugstortingen(later)
      meld('3 terugstorten', { uitkomsten: eerste.uitkomsten, fouten: eerste.fouten })
      expect(eerste.fouten).toEqual([])

      const vierde = kenmerken[3]
      const lijst = await m.lijstBetalingTerugbetalingen(vierde)
      meld('4 bij Mollie', lijst.map((r: any) => ({ status: r.status, bedrag: r.amount.value, heeftMetadata: !!r.metadata, metadata: r.metadata })))
      expect(lijst).toHaveLength(1)
      expect(lijst[0].amount.value).toBe('29.00')
      await eisEigenKenmerk(billingDb, klant, lijst[0])

      // Let op: zolang de terugbetaling 'pending' is meldt Mollie 0,00 terug en bewijst dit weinig. Of een gemelde
      // terugbetaling van de hele maand het abonnement met rust laat, toetst de nacontrole (bij 'refunded').
      expect(await roepWebhook(vierde)).toBe(200)
      const subNa = (await moet('abonnement na', billingDb.from('arnobot_subscriptions').select('*').eq('id', sub.id).single())) as any
      const betalingNa = (await moet('betaling na', billingDb.from('arnobot_payments').select('*').eq('mollie_payment_id', vierde).single())) as any
      const gebruikerNa = (await moet('gebruiker na', billingDb.from('approved_users').select('*').eq('user_id', klant).single())) as any
      meld('5 na de webhook', {
        abonnement: subNa.status, terugbetaald: betalingNa.terugbetaald_cent, referralbedrag: betalingNa.referral_refund_cent,
        alsVolledigVerwerkt: betalingNa.terugbetaling_verwerkt_at, toegangTot: gebruikerNa.expires_at,
      })
      expect(subNa.status).toBe('active')
      expect(betalingNa.terugbetaling_verwerkt_at).toBeNull()
      expect(Date.parse(gebruikerNa.expires_at)).toBeGreaterThan(Date.now())

      // Nog een ronde, ruim een dag later: er komt geen tweede terugstorting.
      const nogLater = new Date(later.getTime() + DAG)
      const plan2 = await planReferral(nogLater, { uitvoeren: true, omschrijvingen })
      const tweede = await verwerkOpenTerugstortingen(nogLater)
      const lijst2 = await m.lijstBetalingTerugbetalingen(vierde)
      const acties = (await moet('acties', billingDb.from('arnobot_referral_acties').select('*').eq('user_id', klant))) as any[]
      meld('6 tweede ronde', {
        nieuwGereserveerd: plan2.voornemens.filter(v => v.userId === klant && v.stand === 'gereserveerd').length, uitkomsten: tweede.uitkomsten,
        terugstortingen: lijst2.map((r: any) => r.status), acties: acties.map(a => ({ soort: a.soort, status: a.status, credit: a.credit_status })),
      })
      expect(plan2.voornemens.filter(v => v.userId === klant && v.stand === 'gereserveerd')).toHaveLength(0)
      expect(lijst2).toHaveLength(1)
    } finally {
      meld('7 opgevangen berichten', { mails: opgevangen.mails.map(x => x.subject), telegram: opgevangen.telegram.map(t => t.split('\n')[0]) })
      await browser?.close()
    }
  })
})

describe.skipIf(!LIVE)('ketenproef: jaarkorting na maandbetalingen (testmodus, testdatabase)', () => {
  it('twee betaalde maanden en dan een jaar: een twaalfde terug, abonnement blijft lopen', { timeout: 600_000 }, async () => {
    const key = eisTestomgeving()
    // Een gereserveerd voorbeelddomein: Mollie krijgt een geldig adres, en niets van ons ontvangt het.
    process.env.MOLLIE_TEST_WEBHOOK_URL = 'https://example.com/arnobot-testwebhook'
    process.env.REFERRAL_TERUGSTORTEN = 'true'
    process.env.REFERRAL_TEGOED_VERREKENEN = 'true'

    const { billingDb } = await import('./db')
    const m = await import('./mollie')
    const { POST: webhook } = await import('@/app/api/webhooks/mollie/route')
    const { planReferral } = await import('./referralPlanner')
    const { verwerkOpenTerugstortingen } = await import('./referralTerugstorten')
    const { berekenBedrag } = await import('./prijzen')
    const { jaarKortingCent } = await import('./referralRegels')
    expect(m.MOLLIE_WEBHOOK_URL).toBe('https://example.com/arnobot-testwebhook')

    const ruw = async (pad: string, init?: RequestInit) => {
      const r = await fetch(`https://api.mollie.com/v2${pad}`, { ...init, headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' } })
      return { status: r.status, json: (await r.json().catch(() => null)) as any }
    }
    const moet = async <T>(wat: string, vraag: PromiseLike<{ data: T; error: { message: string } | null }>) => {
      const r = await vraag
      if (r.error) throw new Error(`${wat}: ${r.error.message}`)
      return r.data
    }
    const roepWebhook = async (id: string) =>
      (await webhook(new Request('https://proef.invalid/api/webhooks/mollie', { method: 'POST', body: `id=${id}` }) as any)).status

    const merk = Date.now().toString(36)
    const aanbrenger = `user_keten_aanbrenger_j${merk}`
    const klant = `user_keten_klant_j${merk}`
    const nu = Date.now()
    const aangemeld = new Date(nu - 10 * DAG).toISOString()
    for (const [id, naam] of [[aanbrenger, 'Proefaanbrenger'], [klant, 'Proefklant']]) {
      await moet('gebruiker', billingDb.from('approved_users').insert({ user_id: id, email: `${id}@example.com`, voornaam: naam, trial_start: aangemeld }))
    }
    await moet('referral', billingDb.from('arnobot_referrals').insert({ referrer_user_id: aanbrenger, referred_user_id: klant, code_used: `PROEF-J-${merk}`, created_at: aangemeld }))

    const mollieKlant = (await m.maakKlant({ naam: 'Proef Keten', email: 'proef@example.com', userId: klant })).id
    const mandaat = await ruw(`/customers/${mollieKlant}/mandates`, { method: 'POST', body: JSON.stringify({ method: 'directdebit', consumerName: 'Proef Keten', consumerAccount: 'NL55INGB0000000000' }) })
    expect(mandaat.status).toBe(201)

    // Het abonnement liep zogenaamd al: de vier betalingen verlengen steeds een maand, tot ongeveer nu.
    const start = new Date(nu); start.setUTCMonth(start.getUTCMonth() - 1)
    const begin = new Date(start); begin.setUTCMonth(begin.getUTCMonth() - 1)
    const sub = (await moet('abonnement', billingDb.from('arnobot_subscriptions').insert({
      user_id: klant, plan: 'basis', cyclus: 'maandelijks', klant_type: 'particulier', status: 'active', bedrag_cent: 2900, btw_cent: 503,
      mollie_customer_id: mollieKlant, periode_start: begin.toISOString(), periode_einde: start.toISOString(), created_at: begin.toISOString(),
    }).select('*').single())) as any

    let browser: Browser | null = null
    try {
      browser = await chromium.launch()
      const betaalMaand = async (nr: number, cent = 2900) => {
        const p = await m.maakLosseHerhaalBetaling({ klantId: mollieKlant, brutoCent: cent, omschrijving: `Keten jaar ${merk} betaling ${nr}`, metadata: { subscriptionRowId: sub.id }, idempotencyKey: `keten-j-${merk}-${nr}` })
        let nuStand = (await ruw(`/payments/${p.id}`)).json
        if (nuStand.status !== 'paid') {
          const link = nuStand._links?.changePaymentState?.href
          if (!link) throw new Error(`maand ${nr}: status ${nuStand.status} en geen testlink om hem op betaald te zetten`)
          const pagina = await browser!.newPage()
          await pagina.goto(link, { waitUntil: 'networkidle' })
          await pagina.check('input[name=final_state][value=paid]')
          await pagina.click('button:has-text("Ga verder"), button:has-text("Continue")')
          await pagina.waitForLoadState('networkidle')
          await pagina.close()
          for (let i = 0; i < 20 && nuStand.status !== 'paid'; i++) { await wacht(1500); nuStand = (await ruw(`/payments/${p.id}`)).json }
        }
        expect(nuStand.status).toBe('paid')
        expect(await roepWebhook(p.id)).toBe(200)
        return p.id
      }

      const kenmerken: string[] = []
      for (let nr = 1; nr <= 2; nr++) kenmerken.push(await betaalMaand(nr))
      // De rij zoals na een overstap naar jaar. De overstap zelf (gepland abonnement bij Mollie) zit niet in deze proef.
      const jaar = berekenBedrag('basis', 'jaarlijks', 'particulier')
      await moet('naar jaar', billingDb.from('arnobot_subscriptions').update({ cyclus: 'jaarlijks', bedrag_cent: jaar.brutoCent, btw_cent: jaar.btwCent }).eq('id', sub.id))
      kenmerken.push(await betaalMaand(3, jaar.brutoCent))
      const korting = jaarKortingCent(jaar.brutoCent)
      const rijen = (await moet('betalingen', billingDb.from('arnobot_payments').select('*').eq('user_id', klant).order('periode_start'))) as any[]
      meld('1 betalingen', rijen.map(r => ({ status: r.status, cyclus: r.cyclus, cent: r.bedrag_cent, van: r.periode_start?.slice(0, 10), tot: r.periode_einde?.slice(0, 10) })))
      expect(rijen.map(r => r.cyclus)).toEqual(['maandelijks', 'maandelijks', 'jaarlijks'])

      // De wachttijd na een betaling is voorbij: we plannen alsof het 8 dagen later is.
      const later = new Date(Date.now() + 8 * DAG)
      const omschrijvingen = { voordeel_jaar: `Proef jaarkorting ${merk}` }
      const plan = await planReferral(later, { uitvoeren: true, omschrijvingen })
      const eigenPlan = plan.voornemens.filter(v => v.userId === klant)
      meld('2 plan', { voornemens: eigenPlan.map(v => ({ soort: v.soort, stand: v.stand, cent: v.brutoCent, reden: v.reden })), fouten: plan.fouten })
      expect(plan.fouten).toEqual([])
      expect(eigenPlan.filter(v => v.stand === 'gereserveerd')).toHaveLength(1)

      const eerste = await verwerkOpenTerugstortingen(later)
      meld('3 terugstorten', { uitkomsten: eerste.uitkomsten, fouten: eerste.fouten })
      expect(eerste.fouten).toEqual([])

      const jaarbetaling = kenmerken[2]
      const lijst = await m.lijstBetalingTerugbetalingen(jaarbetaling)
      meld('4 bij Mollie', lijst.map((r: any) => ({ status: r.status, bedrag: r.amount.value, heeftMetadata: !!r.metadata, metadata: r.metadata })))
      expect(lijst).toHaveLength(1)
      expect(lijst[0].amount.value).toBe((korting / 100).toFixed(2))
      await eisEigenKenmerk(billingDb, klant, lijst[0])

      // Een deel terug mag het abonnement en de toegang niet beeindigen.
      expect(await roepWebhook(jaarbetaling)).toBe(200)
      const subNa = (await moet('abonnement na', billingDb.from('arnobot_subscriptions').select('*').eq('id', sub.id).single())) as any
      const betalingNa = (await moet('betaling na', billingDb.from('arnobot_payments').select('*').eq('mollie_payment_id', jaarbetaling).single())) as any
      const gebruikerNa = (await moet('gebruiker na', billingDb.from('approved_users').select('*').eq('user_id', klant).single())) as any
      meld('5 na de webhook', {
        abonnement: subNa.status, terugbetaald: betalingNa.terugbetaald_cent, referralbedrag: betalingNa.referral_refund_cent,
        alsVolledigVerwerkt: betalingNa.terugbetaling_verwerkt_at, toegangTot: gebruikerNa.expires_at,
      })
      expect(subNa.status).toBe('active')
      expect(betalingNa.terugbetaling_verwerkt_at).toBeNull()
      expect(Date.parse(gebruikerNa.expires_at)).toBeGreaterThan(Date.now())

      // Nog een ronde, ruim een dag later: er komt geen tweede terugstorting.
      const nogLater = new Date(later.getTime() + DAG)
      const plan2 = await planReferral(nogLater, { uitvoeren: true, omschrijvingen })
      const tweede = await verwerkOpenTerugstortingen(nogLater)
      const lijst2 = await m.lijstBetalingTerugbetalingen(jaarbetaling)
      const acties = (await moet('acties', billingDb.from('arnobot_referral_acties').select('*').eq('user_id', klant))) as any[]
      meld('6 tweede ronde', {
        nieuwGereserveerd: plan2.voornemens.filter(v => v.userId === klant && v.stand === 'gereserveerd').length, uitkomsten: tweede.uitkomsten,
        terugstortingen: lijst2.map((r: any) => r.status), acties: acties.map(a => ({ soort: a.soort, status: a.status, credit: a.credit_status })),
      })
      expect(plan2.voornemens.filter(v => v.userId === klant && v.stand === 'gereserveerd')).toHaveLength(0)
      expect(lijst2).toHaveLength(1)
    } finally {
      meld('7 opgevangen berichten', { mails: opgevangen.mails.map(x => x.subject), telegram: opgevangen.telegram.map(t => t.split('\n')[0]) })
      await browser?.close()
    }
  })
})

describe.skipIf(!LIVE)('ketenproef: tegoed van de aanbrenger verrekenen (testmodus, testdatabase)', () => {
  it('niets op een eerdere verlenging, wel op de verlenging na het verdienen, en maar een keer', { timeout: 600_000 }, async () => {
    const key = eisTestomgeving()
    process.env.MOLLIE_TEST_WEBHOOK_URL = 'https://example.com/arnobot-testwebhook'
    process.env.REFERRAL_TERUGSTORTEN = 'true'
    process.env.REFERRAL_TEGOED_VERREKENEN = 'true'

    const { billingDb } = await import('./db')
    const m = await import('./mollie')
    const { POST: webhook } = await import('@/app/api/webhooks/mollie/route')
    const { planReferral } = await import('./referralPlanner')
    const { verwerkOpenTerugstortingen } = await import('./referralTerugstorten')
    const { draaiGrootboek } = await import('./referralGrootboek')
    const { berekenBedrag } = await import('./prijzen')
    const { verrekening } = await import('./referralRegels')
    expect(m.MOLLIE_WEBHOOK_URL).toBe('https://example.com/arnobot-testwebhook')

    const ruw = async (pad: string, init?: RequestInit) => {
      const r = await fetch(`https://api.mollie.com/v2${pad}`, { ...init, headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' } })
      return { status: r.status, json: (await r.json().catch(() => null)) as any }
    }
    const moet = async <T>(wat: string, vraag: PromiseLike<{ data: T; error: { message: string } | null }>) => {
      const r = await vraag
      if (r.error) throw new Error(`${wat}: ${r.error.message}`)
      return r.data
    }
    const roepWebhook = async (id: string) =>
      (await webhook(new Request('https://proef.invalid/api/webhooks/mollie', { method: 'POST', body: `id=${id}` }) as any)).status

    const merk = Date.now().toString(36)
    const aanbrenger = `user_keten_aanbrenger_t${merk}`
    const klant = `user_keten_klant_t${merk}`
    const nu = Date.now()
    const aangemeld = new Date(nu - 10 * DAG).toISOString()
    for (const [id, naam, proef] of [[aanbrenger, 'Proefaanbrenger', new Date(nu - 100 * DAG).toISOString()], [klant, 'Proefklant', aangemeld]]) {
      await moet('gebruiker', billingDb.from('approved_users').insert({ user_id: id, email: `${id}@example.com`, voornaam: naam, trial_start: proef }))
    }
    const referral = (await moet('referral', billingDb.from('arnobot_referrals')
      .insert({ referrer_user_id: aanbrenger, referred_user_id: klant, code_used: `PROEF-T-${merk}`, created_at: aangemeld }).select('*').single())) as any

    const metAbonnement = async (userId: string, cyclus: 'maandelijks' | 'jaarlijks', klantType: 'particulier' | 'zakelijk', maandenTerug: number) => {
      const mollieKlant = (await m.maakKlant({ naam: 'Proef Keten', email: 'proef@example.com', userId })).id
      const mandaat = await ruw(`/customers/${mollieKlant}/mandates`, { method: 'POST', body: JSON.stringify({ method: 'directdebit', consumerName: 'Proef Keten', consumerAccount: 'NL55INGB0000000000' }) })
      expect(mandaat.status).toBe(201)
      const einde = new Date(nu); einde.setUTCMonth(einde.getUTCMonth() - maandenTerug)
      const begin = new Date(einde); begin.setUTCMonth(begin.getUTCMonth() - 1)
      const bedrag = berekenBedrag('basis', cyclus, klantType)
      const sub = (await moet('abonnement', billingDb.from('arnobot_subscriptions').insert({
        user_id: userId, plan: 'basis', cyclus, klant_type: klantType, status: 'active', bedrag_cent: bedrag.brutoCent, btw_cent: bedrag.btwCent,
        mollie_customer_id: mollieKlant, periode_start: begin.toISOString(), periode_einde: einde.toISOString(), created_at: begin.toISOString(),
      }).select('*').single())) as any
      return { mollieKlant, sub, bedrag }
    }
    const eigen = await metAbonnement(aanbrenger, 'maandelijks', 'particulier', 1)
    const ander = await metAbonnement(klant, 'jaarlijks', 'zakelijk', 0)

    let browser: Browser | null = null
    try {
      browser = await chromium.launch()
      const betaal = async (wie: typeof eigen, label: string) => {
        const p = await m.maakLosseHerhaalBetaling({ klantId: wie.mollieKlant, brutoCent: wie.bedrag.brutoCent, omschrijving: `Keten tegoed ${merk} ${label}`, metadata: { subscriptionRowId: wie.sub.id }, idempotencyKey: `keten-t-${merk}-${label}` })
        let stand = (await ruw(`/payments/${p.id}`)).json
        if (stand.status !== 'paid') {
          const pagina = await browser!.newPage()
          await pagina.goto(stand._links.changePaymentState.href, { waitUntil: 'networkidle' })
          await pagina.check('input[name=final_state][value=paid]')
          await pagina.click('button:has-text("Ga verder"), button:has-text("Continue")')
          await pagina.waitForLoadState('networkidle')
          await pagina.close()
          for (let i = 0; i < 20 && stand.status !== 'paid'; i++) { await wacht(1500); stand = (await ruw(`/payments/${p.id}`)).json }
        }
        expect(stand.status).toBe('paid')
        expect(await roepWebhook(p.id)).toBe(200)
        return (await moet('betaalrij', billingDb.from('arnobot_payments').select('*').eq('mollie_payment_id', p.id).single())) as any
      }

      // Volgorde in de tijd: eerst een verlenging van de aanbrenger, dan verdient de klant het tegoed, dan weer een verlenging.
      const ervoor = await betaal(eigen, 'aanbrenger-ervoor')
      await wacht(3000)
      const vanKlant = await betaal(ander, 'klant-jaar')
      await wacht(3000)
      const erna = await betaal(eigen, 'aanbrenger-erna')

      // De echte beoordeling zegt wat er hoort. Zolang het grootboek meeloopt boekt zij niets echts, dus dat doen we via de
      // echte databasefunctie.
      const run = await draaiGrootboek(new Date(), { schrijf: false })
      const regel = run.nieuw.find(r => r.referral_id === referral.id)
      meld('1 beoordeling', { fouten: run.fouten, regel: regel && { soort: regel.soort, netto: regel.netto_cent, reden: regel.reden, verdiend: regel.verdiend_at, bronnen: regel.bron_ids?.length } })
      expect(regel?.soort).toBe('toekenning')
      expect(Date.parse(regel!.verdiend_at!)).toBe(Date.parse(vanKlant.betaald_at))
      expect(regel!.bron_ids).toEqual([vanKlant.mollie_payment_id])
      const geboekt = (await moet('boeken', billingDb.rpc('referral_boek', { p_regel: {
        soort: 'toekenning', referral_id: referral.id, aanbrenger_user_id: aanbrenger, klant_user_id: klant, netto_cent: regel!.netto_cent,
        klant_maand_netto_cent: regel!.klant_maand_netto_cent, bron_ids: regel!.bron_ids, verdiend_at: regel!.verdiend_at, reden: regel!.reden,
      } }))) as any
      const opgeslagen = (await moet('regel', billingDb.from('arnobot_referral_grootboek').select('*').eq('referral_id', referral.id).eq('soort', 'toekenning').single())) as any
      meld('2 geboekt', { ok: geboekt.ok, verdiend: opgeslagen.verdiend_at, aangemaakt: opgeslagen.created_at })
      // De regel is NA de tweede verlenging aangemaakt: op de oude aanmaakdag-regel zou die verlenging afvallen.
      expect(Date.parse(opgeslagen.created_at)).toBeGreaterThan(Date.parse(erna.betaald_at))
      expect(Date.parse(opgeslagen.verdiend_at)).toBe(Date.parse(vanKlant.betaald_at))

      // De database zelf weigert de verlenging van voor het verdienen. Een weigering wijzigt niets.
      const geweigerd = (await moet('reserveer eerder', billingDb.rpc('referral_reserveer', { p_actie: crypto.randomUUID(), p_user: aanbrenger, p_doel: String(ervoor.id) }))) as any
      meld('3 database op de eerdere verlenging', geweigerd)
      expect(geweigerd).toMatchObject({ ok: false, reden: 'geen_saldo' })

      const later = new Date(Date.now() + 8 * DAG)
      const omschrijvingen = { tegoed_terugstorten: `Proef referraltegoed ${merk}` }
      const verwacht = verrekening(regel!.netto_cent!, erna.bedrag_cent)
      const plan = await planReferral(later, { uitvoeren: true, omschrijvingen })
      const vanAanbrenger = plan.voornemens.filter(v => v.userId === aanbrenger)
      meld('4 plan', { verwacht, voornemens: vanAanbrenger.map(v => ({ stand: v.stand, cent: v.brutoCent, opDeLaatste: v.betalingId === erna.id, reden: v.reden })), fouten: plan.fouten })
      expect(plan.fouten).toEqual([])
      expect(vanAanbrenger.filter(v => v.stand === 'gereserveerd').map(v => [v.betalingId, v.brutoCent])).toEqual([[erna.id, verwacht.brutoCent]])

      const ronde = await verwerkOpenTerugstortingen(later)
      expect(ronde.fouten).toEqual([])
      const lijst = await m.lijstBetalingTerugbetalingen(erna.mollie_payment_id)
      const eerdere = await m.lijstBetalingTerugbetalingen(ervoor.mollie_payment_id)
      meld('5 bij Mollie', { opDeLaatste: lijst.map((r: any) => `${r.amount.value} ${r.status}`), opDeEerdere: eerdere.length })
      expect(lijst.map((r: any) => r.amount.value)).toEqual([(verwacht.brutoCent / 100).toFixed(2)])
      expect(eerdere).toHaveLength(0)

      expect(await roepWebhook(erna.mollie_payment_id)).toBe(200)
      const subNa = (await moet('abonnement na', billingDb.from('arnobot_subscriptions').select('*').eq('id', eigen.sub.id).single())) as any
      const rest = (await moet('rest', billingDb.rpc('referral_rest', { p_referral: referral.id }))) as number
      meld('6 na de webhook', { abonnement: subNa.status, restTegoed: rest })
      expect(subNa.status).toBe('active')
      expect(rest).toBe(regel!.netto_cent! - verwacht.verbruiktNettoCent)

      const nogLater = new Date(later.getTime() + DAG)
      const plan2 = await planReferral(nogLater, { uitvoeren: true, omschrijvingen })
      await verwerkOpenTerugstortingen(nogLater)
      expect(plan2.voornemens.filter(v => v.userId === aanbrenger && v.stand === 'gereserveerd')).toHaveLength(0)
      expect(await m.lijstBetalingTerugbetalingen(erna.mollie_payment_id)).toHaveLength(1)
      meld('7 tweede ronde', { nieuw: 0 })
    } finally {
      await browser?.close()
    }
  })
})

describe.skipIf(!LIVE)('ketenproef: de klant boekt terug (testmodus, testdatabase)', () => {
  it('voor de uitkering gaat zij niet door; erna wordt het tegoed een schuld', { timeout: 600_000 }, async () => {
    const key = eisTestomgeving()
    process.env.MOLLIE_TEST_WEBHOOK_URL = 'https://example.com/arnobot-testwebhook'
    process.env.REFERRAL_TERUGSTORTEN = 'true'
    process.env.REFERRAL_TEGOED_VERREKENEN = 'true'

    const { billingDb } = await import('./db')
    const m = await import('./mollie')
    const { POST: webhook } = await import('@/app/api/webhooks/mollie/route')
    const { planReferral } = await import('./referralPlanner')
    const { verwerkOpenTerugstortingen } = await import('./referralTerugstorten')
    const { draaiGrootboek } = await import('./referralGrootboek')
    const { draaiNacontrole } = await import('./referralNacontrole')
    const { berekenBedrag } = await import('./prijzen')

    const ruw = async (pad: string, init?: RequestInit) => {
      const r = await fetch(`https://api.mollie.com/v2${pad}`, { ...init, headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' } })
      return { status: r.status, json: (await r.json().catch(() => null)) as any }
    }
    const moet = async <T>(wat: string, vraag: PromiseLike<{ data: T; error: { message: string } | null }>) => {
      const r = await vraag
      if (r.error) throw new Error(`${wat}: ${r.error.message}`)
      return r.data
    }
    const roepWebhook = async (id: string) =>
      (await webhook(new Request('https://proef.invalid/api/webhooks/mollie', { method: 'POST', body: `id=${id}` }) as any)).status
    const browser = await chromium.launch()

    /** Klikt op de testpagina van Mollie een keuze aan. */
    const testpagina = async (url: string, keuze: string) => {
      const pagina = await browser.newPage()
      await pagina.goto(url, { waitUntil: 'networkidle' })
      await pagina.check(keuze)
      await pagina.click('button:has-text("Ga verder"), button:has-text("Continue")')
      await pagina.waitForLoadState('networkidle')
      await pagina.close()
    }

    /** Een aanbrenger en een klant, met een toekenning die klaar staat en een verlenging van de aanbrenger erna. */
    const paar = async (label: string) => {
      const merk = `${label}${Date.now().toString(36)}`
      const aanbrenger = `user_keten_aanbrenger_${merk}`
      const klant = `user_keten_klant_${merk}`
      const nu = Date.now()
      const aangemeld = new Date(nu - 10 * DAG).toISOString()
      for (const [id, naam, proef] of [[aanbrenger, 'Proefaanbrenger', new Date(nu - 100 * DAG).toISOString()], [klant, 'Proefklant', aangemeld]]) {
        await moet('gebruiker', billingDb.from('approved_users').insert({ user_id: id, email: `${id}@example.com`, voornaam: naam, trial_start: proef }))
      }
      const referral = (await moet('referral', billingDb.from('arnobot_referrals')
        .insert({ referrer_user_id: aanbrenger, referred_user_id: klant, code_used: `PROEF-${merk}`, created_at: aangemeld }).select('*').single())) as any

      const metAbonnement = async (userId: string, cyclus: 'maandelijks' | 'jaarlijks', klantType: 'particulier' | 'zakelijk', maandenTerug: number) => {
        const mollieKlant = (await m.maakKlant({ naam: 'Proef Keten', email: 'proef@example.com', userId })).id
        const mandaat = await ruw(`/customers/${mollieKlant}/mandates`, { method: 'POST', body: JSON.stringify({ method: 'directdebit', consumerName: 'Proef Keten', consumerAccount: 'NL55INGB0000000000' }) })
        expect(mandaat.status).toBe(201)
        const einde = new Date(nu); einde.setUTCMonth(einde.getUTCMonth() - maandenTerug)
        const begin = new Date(einde); begin.setUTCMonth(begin.getUTCMonth() - 1)
        const bedrag = berekenBedrag('basis', cyclus, klantType)
        const sub = (await moet('abonnement', billingDb.from('arnobot_subscriptions').insert({
          user_id: userId, plan: 'basis', cyclus, klant_type: klantType, status: 'active', bedrag_cent: bedrag.brutoCent, btw_cent: bedrag.btwCent,
          mollie_customer_id: mollieKlant, periode_start: begin.toISOString(), periode_einde: einde.toISOString(), created_at: begin.toISOString(),
        }).select('*').single())) as any
        return { mollieKlant, sub, bedrag }
      }
      const eigen = await metAbonnement(aanbrenger, 'maandelijks', 'particulier', 1)
      const ander = await metAbonnement(klant, 'jaarlijks', 'zakelijk', 0)

      const betaal = async (wie: typeof eigen, naam: string) => {
        const p = await m.maakLosseHerhaalBetaling({ klantId: wie.mollieKlant, brutoCent: wie.bedrag.brutoCent, omschrijving: `Keten terug ${merk} ${naam}`, metadata: { subscriptionRowId: wie.sub.id }, idempotencyKey: `keten-c-${merk}-${naam}` })
        let stand = (await ruw(`/payments/${p.id}`)).json
        await testpagina(stand._links.changePaymentState.href, 'input[name=final_state][value=paid]')
        for (let i = 0; i < 20 && stand.status !== 'paid'; i++) { await wacht(1500); stand = (await ruw(`/payments/${p.id}`)).json }
        expect(stand.status).toBe('paid')
        expect(await roepWebhook(p.id)).toBe(200)
        return (await moet('betaalrij', billingDb.from('arnobot_payments').select('*').eq('mollie_payment_id', p.id).single())) as any
      }
      const vanKlant = await betaal(ander, 'klant')
      await wacht(3000)
      const verlenging = await betaal(eigen, 'aanbrenger')

      const run = await draaiGrootboek(new Date(), { schrijf: false })
      const regel = run.nieuw.find(r => r.referral_id === referral.id)
      expect(regel?.soort).toBe('toekenning')
      await moet('boeken', billingDb.rpc('referral_boek', { p_regel: {
        soort: 'toekenning', referral_id: referral.id, aanbrenger_user_id: aanbrenger, klant_user_id: klant, netto_cent: regel!.netto_cent,
        klant_maand_netto_cent: regel!.klant_maand_netto_cent, bron_ids: regel!.bron_ids, verdiend_at: regel!.verdiend_at, reden: regel!.reden,
      } }))

      /** De bank haalt de betaling van de klant terug; daarna komt de webhook. */
      const klantBoektTerug = async () => {
        const stand = (await ruw(`/payments/${vanKlant.mollie_payment_id}`)).json
        await testpagina(stand._links.changePaymentState.href, 'input[name=action][value=create-chargeback]')
        let bedrag = '0.00'
        for (let i = 0; i < 20 && bedrag === '0.00'; i++) { await wacht(1500); bedrag = (await ruw(`/payments/${vanKlant.mollie_payment_id}`)).json.amountChargedBack?.value ?? '0.00' }
        expect(bedrag).not.toBe('0.00')
        expect(await roepWebhook(vanKlant.mollie_payment_id)).toBe(200)
        return (await moet('klantabonnement', billingDb.from('arnobot_subscriptions').select('*').eq('id', ander.sub.id).single())) as any
      }
      const rest = async () => (await moet('rest', billingDb.rpc('referral_rest', { p_referral: referral.id }))) as number
      const acties = async () => (await moet('acties', billingDb.from('arnobot_referral_acties').select('*').eq('user_id', aanbrenger))) as any[]
      const opVerlenging = async () => (await moet('verlenging', billingDb.from('arnobot_payments').select('*').eq('id', verlenging.id).single())) as any
      const aanbrengerStatus = async () => ((await moet('aanbrengerabonnement', billingDb.from('arnobot_subscriptions').select('*').eq('id', eigen.sub.id).single())) as any).status
      return { aanbrenger, referral, verlenging, netto: regel!.netto_cent!, klantBoektTerug, rest, acties, opVerlenging, aanbrengerStatus }
    }

    const later = new Date(Date.now() + 8 * DAG)
    const omschrijvingen = { tegoed_terugstorten: 'Proef referraltegoed bij terugboeking' }
    const planVoor = async (userId: string) => {
      const plan = await planReferral(later, { uitvoeren: true, omschrijvingen })
      expect(plan.fouten).toEqual([])
      return plan.voornemens.filter(v => v.userId === userId)
    }

    try {
      // 1. Terugboeking terwijl de uitkering gereserveerd is maar nog niet verstuurd.
      const a = await paar('c1')
      expect((await planVoor(a.aanbrenger)).filter(v => v.stand === 'gereserveerd')).toHaveLength(1)
      const klantSubA = await a.klantBoektTerug()
      const controleA = await draaiNacontrole(later, { meeloop: false })
      const rondeA = await verwerkOpenTerugstortingen(later)
      const naA = {
        abonnementKlant: klantSubA.status, geboekt: controleA.geboekt.filter(r => r.referral_id === a.referral.id).map(r => `${r.soort} ${r.netto_cent}`),
        acties: (await a.acties()).map(x => x.status), restTegoed: await a.rest(), geboektOpVerlenging: (await a.opVerlenging()).referral_refund_cent,
        terugbetalingenBijMollie: (await m.lijstBetalingTerugbetalingen(a.verlenging.mollie_payment_id)).length,
        abonnementAanbrenger: await a.aanbrengerStatus(), fouten: [...controleA.fouten, ...rondeA.fouten],
      }
      meld('1 terugboeking voor het versturen', naA)
      expect(naA.fouten).toEqual([])
      expect(naA.abonnementKlant).not.toBe('active')
      expect(naA.acties).toEqual(['vrijgegeven'])
      expect(naA.restTegoed).toBe(0)
      expect(naA.geboektOpVerlenging).toBe(0)
      expect(naA.terugbetalingenBijMollie).toBe(0)
      expect(naA.abonnementAanbrenger).toBe('active')
      expect((await planVoor(a.aanbrenger)).filter(v => v.stand === 'gereserveerd')).toHaveLength(0)

      // 2. Terugboeking nadat de uitkering al verstuurd is.
      const b = await paar('c2')
      expect((await planVoor(b.aanbrenger)).filter(v => v.stand === 'gereserveerd')).toHaveLength(1)
      await verwerkOpenTerugstortingen(later)
      expect(await m.lijstBetalingTerugbetalingen(b.verlenging.mollie_payment_id)).toHaveLength(1)
      await b.klantBoektTerug()
      const controleB = await draaiNacontrole(later, { meeloop: false })
      const naB = {
        geboekt: controleB.geboekt.filter(r => r.referral_id === b.referral.id).map(r => `${r.soort} ${r.netto_cent}`),
        restTegoed: await b.rest(), acties: (await b.acties()).map(x => x.status), abonnementAanbrenger: await b.aanbrengerStatus(),
        terugbetalingenBijMollie: (await m.lijstBetalingTerugbetalingen(b.verlenging.mollie_payment_id)).length, fouten: controleB.fouten,
      }
      meld('2 terugboeking na het versturen', naB)
      expect(naB.fouten).toEqual([])
      expect(naB.restTegoed).toBe(-b.netto)
      expect(naB.abonnementAanbrenger).toBe('active')
      expect(naB.terugbetalingenBijMollie).toBe(1)
      expect((await planVoor(b.aanbrenger)).filter(v => v.stand === 'gereserveerd')).toHaveLength(0)

      // Nog een nacontrole boekt niets dubbel.
      const nogEens = await draaiNacontrole(later, { meeloop: false })
      expect(nogEens.geboekt.filter(r => [a.referral.id, b.referral.id].includes(r.referral_id))).toEqual([])
      expect(await b.rest()).toBe(-b.netto)
      meld('3 tweede nacontrole', { nieuw: 0 })
    } finally {
      await browser.close()
    }
  })
})

// NACONTROLE op de laatste ketenproef, zonder iets leeg te maken. Draai later opnieuw tot Mollie "refunded" meldt:
//   RUN_LIVE_KETEN_NACHECK=true node --env-file=.env.testomgeving node_modules/vitest/vitest.mjs run lib/billing/referralKeten.mollie.live.test.ts
describe.skipIf(process.env.RUN_LIVE_KETEN_NACHECK !== 'true')('ketenproef: nacontrole', () => {
  it('elke verzonden uitkering: abonnement loopt, en zodra Mollie refunded meldt is zij bevestigd en geboekt', { timeout: 120_000 }, async () => {
    eisTestomgeving()
    process.env.MOLLIE_TEST_WEBHOOK_URL = 'https://example.com/arnobot-testwebhook'
    process.env.REFERRAL_TERUGSTORTEN = 'true'
    process.env.REFERRAL_TEGOED_VERREKENEN = 'true'
    const { billingDb } = await import('./db')
    const m = await import('./mollie')
    const { POST: webhook } = await import('@/app/api/webhooks/mollie/route')
    const { verwerkOpenTerugstortingen } = await import('./referralTerugstorten')

    const { data: acties, error } = await billingDb.from('arnobot_referral_acties').select('*').in('status', ['verzonden', 'bevestigd']).order('created_at')
    if (error) throw new Error(error.message)
    expect(acties!.length).toBeGreaterThan(0)
    const ronde = await verwerkOpenTerugstortingen(new Date(Date.now() + 8 * DAG))
    expect(ronde.fouten).toEqual([])
    let afgerond = 0

    for (const actie of acties as any[]) {
      const betaling = async () => (await billingDb.from('arnobot_payments').select('*').eq('id', actie.doel_id).single()).data as any
      const kenmerk = (await betaling()).mollie_payment_id as string
      const status = await webhook(new Request('https://proef.invalid/api/webhooks/mollie', { method: 'POST', body: `id=${kenmerk}` }) as any)
      const bijMollie = await m.haalBetaling(kenmerk)
      const terug = await m.lijstBetalingTerugbetalingen(kenmerk)
      const rij = await betaling()
      const sub = (await billingDb.from('arnobot_subscriptions').select('*').eq('user_id', actie.user_id).single()).data as any
      const na = (await billingDb.from('arnobot_referral_acties').select('*').eq('id', actie.id).single()).data as any
      meld(`nacontrole ${actie.soort}`, {
        terugstorting: terug.map((r: any) => `${r.amount.value} ${r.status}`), amountRefunded: bijMollie.amountRefunded?.value ?? null,
        actie: na.status, creditnota: na.credit_status, webhook: status.status, abonnement: sub.status,
        terugbetaaldInDatabase: rij.terugbetaald_cent, alsVolledigVerwerkt: rij.terugbetaling_verwerkt_at,
      })
      expect(status.status).toBe(200)
      expect(sub.status).toBe('active')
      expect(rij.terugbetaling_verwerkt_at).toBeNull()
      expect(terug).toHaveLength(1)
      if (terug[0].status === 'refunded') {
        afgerond++
        expect(na.status).toBe('bevestigd')
        expect(rij.terugbetaald_cent).toBe(actie.bruto_cent)
        expect(bijMollie.amountRefunded?.value).toBe((actie.bruto_cent / 100).toFixed(2))
      }
    }
    // Zonder een enkele afgeronde terugbetaling is er niets over 'refunded' bewezen.
    expect(afgerond).toBeGreaterThan(0)
  })
})
