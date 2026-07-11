import { test, expect } from '@playwright/test'

// Niveau 3: GEEN page.route()-mock voor /api/chat. De aanvraag doorloopt de echte route:
// auth, rate limiting, moderatie-check, RAG-opzoeking (embedding + rerank), en het
// hoofdantwoord, allemaal echt uitgevoerd. Alleen de externe Anthropic/Voyage-aanroepen zelf
// zijn omgeleid naar lokale mock-servers (ANTHROPIC_BASE_URL/VOYAGE_BASE_URL, zie
// playwright.config.ts + e2e/global-setup.ts). Dit test de eigen keten, niet AI-kwaliteit.
//
// Let op bij snel handmatig herhaald draaien: de echte dual-session-lock (max 1 actief
// gesprek per gebruiker, 10 minuten TTL in Redis, zie chat/route.ts) slaat na een eerste
// geslaagde run terecht aan bij een volgende run kort erna met een andere sessionId. Dat is
// geen bug, dat bewijst dat die functie ook echt werkt. In CI (nightly-cadans) speelt dit
// niet, alleen bij handmatige iteratie binnen dezelfde 10 minuten.

test('echte backend-keten verwerkt een chatbericht met gemockte Anthropic/Voyage-aanroepen', async ({ page }) => {
  await page.goto('/bot')
  await page.getByLabel('Je bericht').fill('Hoe ga ik om met een klant die de prijs te hoog vindt?')
  await page.getByRole('button', { name: /stuur/i }).click()

  // Het antwoord komt van de lokale mock-Anthropic-server, niet van page.route: bewijst dat
  // auth, rate limiting, moderatie-check en RAG-pipeline de aanvraag succesvol hebben
  // afgehandeld en bij de (gemockte) modelaanroep zijn uitgekomen.
  await expect(page.locator('.msg-arno-text').last()).toContainText(
    'Dit is een voorspelbaar mock-antwoord van de lokale Anthropic-mock-server.',
    { timeout: 20000 }
  )
})
