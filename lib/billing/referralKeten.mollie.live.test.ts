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
const meld = (stap: string, uitkomst: unknown) => console.log(`KETEN ${stap}: ${JSON.stringify(uitkomst)}`)
const wacht = (ms: number) => new Promise(r => setTimeout(r, ms))

describe.skipIf(!LIVE)('ketenproef: gratis vierde maand (testmodus, testdatabase)', () => {
  it('vier betaalde maanden, precies een terugstorting, abonnement blijft lopen', { timeout: 600_000 }, async () => {
    const key = eisTestomgeving()
    // Een gereserveerd voorbeelddomein: Mollie krijgt een geldig adres, en niets van ons ontvangt het.
    process.env.MOLLIE_TEST_WEBHOOK_URL = 'https://example.com/arnobot-testwebhook'
    process.env.REFERRAL_TERUGSTORTEN = 'true'

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

      // De belangrijkste vraag: een terugstorting van de hele maand mag het abonnement en de toegang niet beeindigen.
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

// NACONTROLE op de laatste ketenproef, zonder iets leeg te maken. Draai later opnieuw tot Mollie "refunded" meldt:
//   RUN_LIVE_KETEN_NACHECK=true node --env-file=.env.testomgeving node_modules/vitest/vitest.mjs run lib/billing/referralKeten.mollie.live.test.ts
describe.skipIf(process.env.RUN_LIVE_KETEN_NACHECK !== 'true')('ketenproef: nacontrole', () => {
  it('na een echte terugbetaling blijft het abonnement lopen', { timeout: 120_000 }, async () => {
    eisTestomgeving()
    process.env.REFERRAL_TERUGSTORTEN = 'true'
    const { billingDb } = await import('./db')
    const m = await import('./mollie')
    const { POST: webhook } = await import('@/app/api/webhooks/mollie/route')
    const { verwerkOpenTerugstortingen } = await import('./referralTerugstorten')

    const { data: acties, error } = await billingDb.from('arnobot_referral_acties').select('*').order('created_at')
    if (error) throw new Error(error.message)
    expect(acties!.length).toBeGreaterThan(0)
    const ronde = await verwerkOpenTerugstortingen(new Date(Date.now() + 8 * DAG))
    expect(ronde.fouten).toEqual([])

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
    }
  })
})
