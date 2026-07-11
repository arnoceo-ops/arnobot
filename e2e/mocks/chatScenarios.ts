import type { Page } from '@playwright/test'

// Mock-scenario's voor /api/chat via page.route(), zonder echte Anthropic/Voyage-aanroep.
// Beperking: route.fulfill() levert de body in één keer, geen echte chunk-voor-chunk timing
// zoals een echte stream. Scenario's die daadwerkelijke trage/lange streaming-timing willen
// testen (trickle-effect, scroll-gedrag over meerdere seconden) vereisen een aparte lokale
// mock-server met eigen CORS/CSP-toestemming, dat is bewust nog niet gebouwd, geen silent cap.

const META_MARKER = '\n<<<ARNOBOT_META>>>'

function metaSuffix(logId = 'e2e-mock-log-id') {
  return `${META_MARKER}${JSON.stringify({ log_id: logId })}`
}

export async function mockChatNormal(page: Page, answer: string) {
  await page.route('**/api/chat', route => route.fulfill({
    status: 200,
    contentType: 'text/plain; charset=utf-8',
    body: answer + metaSuffix(),
  }))
}

export async function mockChatMarkdown(page: Page) {
  await page.route('**/api/chat', route => route.fulfill({
    status: 200,
    contentType: 'text/plain; charset=utf-8',
    body: 'Dit is **vetgedrukt** en dit is *cursief* in het antwoord.' + metaSuffix(),
  }))
}

export async function mockChatEmpty(page: Page) {
  await page.route('**/api/chat', route => route.fulfill({
    status: 200,
    contentType: 'text/plain; charset=utf-8',
    body: '' + metaSuffix(),
  }))
}

// Simuleert een stream die halverwege afbreekt: geen META-marker, alsof de verbinding wegviel
// vóórdat het antwoord (en de log_id) compleet was.
export async function mockChatDroppedMidStream(page: Page, partialAnswer: string) {
  await page.route('**/api/chat', route => route.fulfill({
    status: 200,
    contentType: 'text/plain; charset=utf-8',
    body: partialAnswer,
  }))
}

export async function mockChatRateLimit(page: Page) {
  await page.route('**/api/chat', route => route.fulfill({
    status: 429,
    contentType: 'application/json',
    body: JSON.stringify({ error: 'rate_limit' }),
  }))
}

export async function mockChatServerError(page: Page) {
  await page.route('**/api/chat', route => route.fulfill({
    status: 500,
    contentType: 'application/json',
    body: JSON.stringify({ error: 'internal_error' }),
  }))
}

export async function mockChatNetworkFailure(page: Page) {
  await page.route('**/api/chat', route => route.abort('failed'))
}
