import { test, expect } from '@playwright/test'
import {
  mockChatMarkdown,
  mockChatEmpty,
  mockChatDroppedMidStream,
  mockChatRateLimit,
  mockChatServerError,
  mockChatNetworkFailure,
} from './mocks/chatScenarios'

// Fouttoleranties van de chat-UI, elk gemockt op netwerkniveau (geen echte AI-aanroep). Elk
// scenario is losstaand: geen afhankelijkheid tussen tests, elke test stelt zijn eigen mock in.

test('markdown in het antwoord wordt als echte opmaak getoond, geen letterlijke sterretjes', async ({ page }) => {
  await mockChatMarkdown(page)
  await page.goto('/bot')
  await page.getByLabel('Je bericht').fill('Test markdown')
  await page.locator('.spar-send').click()

  const answer = page.locator('.msg-arno-text').last()
  await expect(answer.locator('strong')).toContainText('vetgedrukt')
  await expect(answer.locator('em')).toContainText('cursief')
  await expect(answer).not.toContainText('**')
})

test('lege respons toont een fallback-melding in plaats van een blanco bericht', async ({ page }) => {
  await mockChatEmpty(page)
  await page.goto('/bot')
  await page.getByLabel('Je bericht').fill('Test lege respons')
  await page.locator('.spar-send').click()

  await expect(page.locator('.msg-arno-text').last()).toContainText('Geen antwoord ontvangen.')
})

test('afgebroken stream (geen META-marker) toont het gedeeltelijke antwoord zonder te crashen', async ({ page }) => {
  await mockChatDroppedMidStream(page, 'Dit antwoord breekt halverwege af zonder')
  await page.goto('/bot')
  await page.getByLabel('Je bericht').fill('Test afgebroken stream')
  await page.locator('.spar-send').click()

  await expect(page.locator('.msg-arno-text').last()).toContainText('Dit antwoord breekt halverwege af zonder')
  // De pagina moet daarna gewoon bruikbaar blijven, geen vastgelopen UI.
  await expect(page.getByLabel('Je bericht')).toBeEnabled()
})

test('rate limit (429) toont een foutmelding en blokkeert de UI niet blijvend', async ({ page }) => {
  await mockChatRateLimit(page)
  await page.goto('/bot')
  await page.getByLabel('Je bericht').fill('Test rate limit')
  await page.locator('.spar-send').click()

  // Huidig gedrag: de algemene rate limit (IP/uur-limiet) heeft geen eigen vriendelijke tekst,
  // in tegenstelling tot de daglimiet en dual-session-gevallen. Deze test bevestigt het
  // BESTAANDE gedrag (geen crash, wel een zichtbare foutmelding), geen oordeel over of dat de
  // beste tekst is.
  await expect(page.locator('.msg-arno-text').last()).toContainText('rate_limit')
  await expect(page.getByLabel('Je bericht')).toBeEnabled()
})

test('serverfout (500) toont een foutmelding en blokkeert de UI niet blijvend', async ({ page }) => {
  await mockChatServerError(page)
  await page.goto('/bot')
  await page.getByLabel('Je bericht').fill('Test serverfout')
  await page.locator('.spar-send').click()

  await expect(page.locator('.msg-arno-text').last()).toContainText('internal_error')
  await expect(page.getByLabel('Je bericht')).toBeEnabled()
})

test('netwerkfout toont de vriendelijke fallback-melding met WhatsApp-link', async ({ page }) => {
  await mockChatNetworkFailure(page)
  await page.goto('/bot')
  await page.getByLabel('Je bericht').fill('Test netwerkfout')
  await page.locator('.spar-send').click()

  await expect(page.locator('.msg-arno-text').last()).toContainText('Er ging iets mis')
  await expect(page.locator('.msg-arno-text').last().locator('a')).toHaveAttribute('href', /wa\.me/)
  await expect(page.getByLabel('Je bericht')).toBeEnabled()
})
