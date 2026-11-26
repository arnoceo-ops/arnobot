import { describe, expect, it } from 'vitest'
import { chromium } from 'playwright'

// LIVE-proef van de Mollie-aannames onder het zelf omzetten naar zakelijk (docs/REFERRAL_CONTROLE_2026-11-26.md, N5),
// uitsluitend tegen Mollie in TESTMODUS. Raakt de database, Moneybird en de mail niet. Draait niet in de gewone testrun:
//   RUN_LIVE_KLANTTYPE=true node --env-file=.env.local node_modules/vitest/vitest.mjs run lib/billing/klanttype.mollie.live.test.ts
// Maakt een testklant met machtiging en testabonnementen en stopt die aan het einde weer.
const LIVE = process.env.RUN_LIVE_KLANTTYPE === 'true'
const SCHERM = process.env.PROEF_SCHERMMAP

const meld = (stap: string, uitkomst: unknown) => console.log(`PROEF ${stap}: ${JSON.stringify(uitkomst)}`)
const dag = (over: number) => new Date(Date.now() + over * 86_400_000).toISOString().slice(0, 10)
const wacht = (ms: number) => new Promise(r => setTimeout(r, ms))

describe.skipIf(!LIVE)('zelf omzetten: Mollie-aannames (testmodus)', () => {
  it('abonnement vervangen en betaallink met verloopdatum', { timeout: 600_000 }, async () => {
    const key = process.env.MOLLIE_API_KEY ?? ''
    if (!key.startsWith('test_')) throw new Error('Alleen met een test_-sleutel, stop.')
    const m = await import('./mollie')
    const ruw = async (pad: string, init?: RequestInit) => {
      const r = await fetch(`https://api.mollie.com/v2${pad}`, { ...init, headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...(init?.headers ?? {}) } })
      return { status: r.status, kop: r.headers, json: await r.json().catch(() => null) }
    }

    const merk = `proef-${Date.now()}`
    const klant = (await m.maakKlant({ naam: 'Proef klanttype', email: 'test@arno.bot', userId: merk })).id
    const mandaat = await ruw(`/customers/${klant}/mandates`, { method: 'POST', body: JSON.stringify({ method: 'directdebit', consumerName: 'Proef Klanttype', consumerAccount: 'NL55INGB0000000000' }) })
    meld('0 machtiging', { http: mandaat.status, status: mandaat.json?.status })
    const gemaakt: string[] = []
    const maak = async (extra: { bedrag: number; start: string; omschrijving: string; interval?: '1 month' | '12 months'; sleutel: string; metadata?: Record<string, unknown> }) => {
      const s = await m.maakAbonnement({ klantId: klant, brutoCent: extra.bedrag, interval: extra.interval ?? '1 month', times: null, startDatum: new Date(`${extra.start}T00:00:00.000Z`), omschrijving: extra.omschrijving, metadata: extra.metadata ?? {}, idempotencyKey: extra.sleutel })
      gemaakt.push(s.id)
      return s
    }
    const probeer = async (stap: string, f: () => Promise<unknown>) => {
      try { meld(stap, await f()) } catch (e) { meld(stap, { fout: e instanceof Error ? e.message : String(e) }) }
    }

    try {
      const start = dag(20)
      const oud = await maak({ bedrag: 5900, start, omschrijving: `ArnoBot Pro maandelijks ${merk}`, sleutel: `${merk}-oud` })
      meld('1 oud abonnement', { status: oud.status, nextPaymentDate: oud.nextPaymentDate, gevraagd: start })

      const nieuwInvoer = { bedrag: 7139, start, omschrijving: `ArnoBot Pro maandelijks ${merk} (zakelijk)`, sleutel: `${merk}-nieuw`, metadata: { klanttypeCorrectie: merk } }
      const nieuw = await maak(nieuwInvoer)
      const nieuwOpgehaald = await m.haalAbonnement(klant, nieuw.id)
      meld('2 nieuw naast oud', { status: nieuwOpgehaald.status, nextPaymentDate: nieuwOpgehaald.nextPaymentDate, bedrag: nieuwOpgehaald.amount?.value })

      const lijst = await m.lijstKlantAbonnementen(klant)
      meld('3 lijst', lijst.map(s => ({ id: s.id === oud.id ? 'oud' : s.id === nieuw.id ? 'nieuw' : s.id, status: s.status, next: s.nextPaymentDate, metadata: s.metadata, bedrag: s.amount?.value })))

      await m.stopAbonnement(klant, oud.id)
      meld('4 oud na stoppen', { status: (await m.haalAbonnement(klant, oud.id)).status, nieuw: (await m.haalAbonnement(klant, nieuw.id)).nextPaymentDate })

      await m.stopAbonnement(klant, nieuw.id)
      await probeer('5 dezelfde sleutel na stoppen', async () => {
        const nogEens = await maak(nieuwInvoer)
        return { zelfdeId: nogEens.id === nieuw.id, statusInAntwoord: nogEens.status, echteStatus: (await m.haalAbonnement(klant, nogEens.id)).status }
      })

      const dubbel = { bedrag: 7139, start, omschrijving: `ArnoBot dubbel ${merk}` }
      await maak({ ...dubbel, sleutel: `${merk}-dubbel-1` })
      await probeer('6 gelijke omschrijving tweemaal actief', async () => ({ aangemaakt: (await maak({ ...dubbel, sleutel: `${merk}-dubbel-2` })).status }))

      await probeer('7 jaarabonnement over 300 dagen', async () => {
        const gevraagd = dag(300)
        const j = await maak({ bedrag: 51909, start: gevraagd, interval: '12 months', omschrijving: `ArnoBot jaar ${merk}`, sleutel: `${merk}-jaar` })
        return { status: j.status, nextPaymentDate: j.nextPaymentDate, gevraagd }
      })

      // Betaallinks. Dezelfde vorm als de app (maakBetaalLink).
      const link = (sleutel: string, verlooptOp: Date) => m.maakBetaalLink({ brutoCent: 1239, omschrijving: `Proef correctie ${sleutel}`, redirectUrl: 'https://www.arno.bot/', webhookUrl: 'https://www.arno.bot/api/webhooks/mollie-correctie', idempotencyKey: sleutel, verlooptOp })
      const lang = await link(`${merk}-link-lang`, new Date(Date.now() + 24 * 3600_000))
      meld('8 betaallink met verloopdatum', { aangemaakt: true, expiresAt: (await ruw(`/payment-links/${lang.id}`)).json?.expiresAt })

      const browser = await chromium.launch()
      try {
        await probeer('9 verlopen betaallink', async () => {
          const kort = await link(`${merk}-link-kort`, new Date(Date.now() + 75_000))
          await wacht(100_000)
          const pg = await browser.newPage()
          await pg.goto(kort.url, { waitUntil: 'networkidle' })
          if (SCHERM) await pg.screenshot({ path: `${SCHERM}/verlopen.png`, fullPage: true })
          const tekst = (await pg.innerText('body')).replace(/\s+/g, ' ').slice(0, 300)
          const knoppen = (await pg.locator('button').allInnerTexts()).map(t => t.trim()).filter(Boolean).slice(0, 12)
          await pg.close()
          return { url: pg.url().replace(/\/[^/]+$/, '/…'), tekst, knoppen, betalingen: (await m.lijstBetaalLinkBetalingen(kort.id)).length }
        })

        await probeer('10 betalen en terugstorten', async () => {
          const pg = await browser.newPage()
          try {
            await pg.goto(lang.url, { waitUntil: 'networkidle' })
            // De testcheckout verschilt per methode: stap voor stap tot de keuze van de eindstatus.
            for (let i = 0; i < 6 && !(await pg.locator('input[name=final_state][value=paid]').count()); i++) {
              const ideal = pg.getByText('iDEAL', { exact: false }).first()
              const bank = pg.locator('button[name=issuer]:has-text("ING")')
              if (await bank.count()) await bank.first().click()
              else if (await ideal.count()) await ideal.click()
              else await pg.locator('button[type=submit]').first().click()
              await pg.waitForLoadState('networkidle')
              await wacht(1000)
            }
            if (SCHERM) await pg.screenshot({ path: `${SCHERM}/testcheckout.png`, fullPage: true })
            await pg.check('input[name=final_state][value=paid]')
            await pg.click('button:has-text("Ga verder"), button:has-text("Continue")')
            await pg.waitForLoadState('networkidle')
          } catch (e) {
            if (SCHERM) await pg.screenshot({ path: `${SCHERM}/vastgelopen.png`, fullPage: true })
            throw e
          } finally {
            await pg.close()
          }
          let betaling = (await m.lijstBetaalLinkBetalingen(lang.id)).find(p => p.status === 'paid')
          for (let i = 0; i < 20 && !betaling; i++) { await wacht(1500); betaling = (await m.lijstBetaalLinkBetalingen(lang.id)).find(p => p.status === 'paid') }
          if (!betaling) throw new Error('geen betaalde betaling op de link')
          const terug = await m.betaalTerug({ betalingId: betaling.id, brutoCent: 1239, omschrijving: 'proef terugstorten', idempotencyKey: `${merk}-terug` })
          const direct = (await m.lijstBetaalLinkBetalingen(lang.id)).find(p => p.id === betaling!.id)
          const stand = async () => ({
            amountRefunded: (await m.lijstBetaalLinkBetalingen(lang.id)).find(p => p.id === betaling!.id)?.amountRefunded?.value ?? null,
            lijst: (await m.lijstBetalingTerugbetalingen(betaling!.id)).map(r => ({ status: r.status, bedrag: r.amount.value })),
          })
          const meteen = await stand()
          await wacht(60_000)
          return { terugstorting: terug.status, direct: { status: direct?.status, amountRefunded: direct?.amountRefunded?.value ?? null }, meteen, naEenMinuut: await stand() }
        })
      } finally {
        await browser.close()
      }
    } finally {
      for (const id of new Set(gemaakt)) await m.stopAbonnement(klant, id).catch(() => {})
      const over = (await m.lijstKlantAbonnementen(klant)).filter(s => s.status === 'active' || s.status === 'pending')
      meld('11 opgeruimd', { nogLopend: over.length })
      expect(over).toHaveLength(0)
    }
  })
})
