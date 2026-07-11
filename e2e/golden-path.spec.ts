import { test, expect } from '@playwright/test'

// Niveau 2 (UI): /api/chat en /api/bot/session-end worden gemockt via page.route(), dus geen
// echte Anthropic/Voyage-aanroep en geen kosten. Test of de kern-gebruikersflow werkt: een
// bericht versturen, de streaming-respons zien verschijnen, en het gesprek sluiten met een
// samenvatting. Authenticatie komt uit e2e/auth.setup.ts via storageState.

const MOCK_ANSWER = 'Dit is een voorspelbaar mock-antwoord van Arno voor de golden path test.'

test('golden path: inloggen, bericht sturen, streaming zien, sluiten, samenvatting', async ({ page }) => {
  await page.route('**/api/chat', async route => {
    const body = `${MOCK_ANSWER}\n<<<ARNOBOT_META>>>${JSON.stringify({ log_id: 'e2e-mock-log-id' })}`
    await route.fulfill({
      status: 200,
      contentType: 'text/plain; charset=utf-8',
      body,
    })
  })

  await page.route('**/api/bot/session-end', async route => {
    // Kleine, bewuste vertraging: een echte samenvatting-aanroep duurt merkbaar, en zonder
    // die vertraging verdwijnt de laad-indicator te snel om betrouwbaar te testen.
    await new Promise(resolve => setTimeout(resolve, 800))
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ summary: 'Mock-samenvatting van het testgesprek.', blogs: [] }),
    })
  })

  await page.goto('/bot')

  const input = page.getByLabel('Je bericht')
  await expect(input).toBeVisible({ timeout: 15000 })
  await input.fill('Hoe ga ik om met een klant die de prijs te hoog vindt?')
  await page.getByRole('button', { name: /stuur/i }).click()

  // Antwoord moet verschijnen (via de gemockte stream).
  await expect(page.locator('.msg-arno-text').last()).toContainText(MOCK_ANSWER, { timeout: 15000 })

  // Invoerveld moet weer bruikbaar zijn na afloop van het antwoord (niet blijvend geblokkeerd).
  await expect(input).toBeEnabled()

  // Gesprek sluiten: knop toont draaiende bolletjes tijdens het samenvatten, dan de samenvatting.
  const closeButton = page.getByRole('button', { name: /sluit/i })
  await closeButton.click()
  await expect(page.locator('.btn-loading-dots')).toBeVisible()
  await expect(page.locator('.msg-arno-text').last()).toContainText('Mock-samenvatting van het testgesprek.', { timeout: 15000 })
})
